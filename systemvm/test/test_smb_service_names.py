# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
import copy
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "debian/usr/local/lib/ablestack-storage"))
import smb_service_names as names

GUID = "7189b3df-b6d3-4089-83bf-c1ec9d79bf68"
INSTANCE = "c1eca707-a554-4c42-85cd-1e9e9744d804"


class Directory:
    def __init__(self):
        self.spns = {"host/base.ablestack.local"}
        self.dns = {}
        self.foreign = {}
        self.fail_dns = False
        self.mutations = []
        self.nodes = {}
        self.node_counter = 0

    def __call__(self, credentials=None):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def computer(self, expected=None):
        return {"guid": GUID, "sid": "sid", "fqdn": "base.ablestack.local",
                "realm": "ABLESTACK.LOCAL", "zone": "ablestack.local", "dc": "dc.ablestack.local",
                "spns": sorted(self.spns)}

    def owners(self, name):
        return self.foreign.get(name, [GUID] if "cifs/" + name in self.spns else [])

    def records(self, name):
        return [SimpleNamespace(wType=1, data=value) for value in self.dns.get(name, set())]

    def node(self, name):
        return self.nodes.get(name, "preexisting-node-guid") if self.dns.get(name) else None

    def change_spn(self, guid, add, name):
        assert guid == GUID
        value = "cifs/" + name
        self.mutations.append(("SPN", add, name))
        if add:
            self.spns.add(value)
        else:
            self.spns.remove(value)

    def change_dns(self, name, add, address, image=None):
        if self.fail_dns and add:
            raise names.NameError("SMB_NAME_DNS_ACCESS_DENIED")
        self.mutations.append(("DNS", add, name, address))
        self.dns.setdefault(name, set())
        if add:
            if not self.dns[name]:
                self.node_counter += 1
                self.nodes[name] = "dns-node-" + str(self.node_counter)
            self.dns[name].add(address)
        else:
            self.dns[name].remove(address)
            if not self.dns[name]:
                self.nodes.pop(name, None)


class OwnedNamesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.directory = Directory()
        self.engine = names.ServiceNames(self.tmp.name, self.directory, lambda e, i: None,
                                        {"username": "operator", "password": "runtime-only-secret"})
        self.patch = patch.object(names, "record_image", lambda r: "record-image")
        self.patch.start()
        self.entry = {"uuid": "name-id", "fqdn": "alias.ablestack.local", "ip": "10.10.13.220",
                      "endpointUuid": "endpoint", "port": 445, "kind": "ALIAS"}
        self.request = {"action": "CREATE", "entry": self.entry, "instanceUuid": INSTANCE,
                        "operationid": "operation-one"}

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_create_verified_and_no_credentials_in_journal(self):
        receipt = self.engine.apply(self.request)
        self.assertEqual("VERIFIED", receipt["state"])
        self.assertEqual("CREATED", receipt["entry"]["ownership"]["dns"])
        self.assertEqual("CREATED", receipt["entry"]["ownership"]["spn"])
        text = self.engine.journal.read_text()
        self.assertNotIn("runtime-only-secret", text)
        self.assertNotIn("operator", text)
        self.assertEqual(GUID, receipt["entry"]["computerGuid"])

    def test_before_image_and_accepted_request_remain_immutable_during_apply(self):
        before = self.engine.preview(self.request)
        original = copy.deepcopy(self.request)
        self.engine.apply(self.request)
        journal = self.engine.read()
        self.assertEqual(before, journal["before"])
        self.assertEqual(original, journal["request"])
        self.assertEqual(original, self.request)
        self.assertIsNone(journal["before"]["entry"]["ownership"]["nodeGuid"])
        self.assertIsNotNone(journal["result"]["ownership"]["nodeGuid"])

    def test_dns_failure_compensates_only_own_spn(self):
        self.directory.fail_dns = True
        with self.assertRaisesRegex(names.NameError, "DNS_ACCESS_DENIED"):
            self.engine.apply(self.request)
        self.directory.spns.add("cifs/external.ablestack.local")
        self.engine.restore()
        self.engine.verify_restored()
        self.assertEqual({"host/base.ablestack.local", "cifs/external.ablestack.local"}, self.directory.spns)

    def test_foreign_spn_owner_blocks_before_mutation(self):
        self.directory.foreign[self.entry["fqdn"]] = ["another-guid"]
        with self.assertRaisesRegex(names.NameError, "SPN_CONFLICT"):
            self.engine.preview(self.request)
        self.assertFalse(self.directory.mutations)

    def test_foreign_dns_blocks_before_mutation(self):
        self.directory.dns[self.entry["fqdn"]] = {"203.0.113.10"}
        with self.assertRaisesRegex(names.NameError, "DNS_CONFLICT"):
            self.engine.preview(self.request)
        self.assertFalse(self.directory.mutations)

    def test_reused_records_are_preserved_on_delete(self):
        self.directory.spns.add("cifs/" + self.entry["fqdn"])
        self.directory.dns[self.entry["fqdn"]] = {self.entry["ip"]}
        result = self.engine.apply(self.request)["entry"]
        self.assertEqual("REUSED", result["ownership"]["dns"])
        self.assertEqual("REUSED", result["ownership"]["spn"])
        self.engine.apply({**self.request, "action": "DELETE", "entry": result, "operationid": "operation-two"})
        self.assertIn("cifs/" + self.entry["fqdn"], self.directory.spns)
        self.assertEqual({self.entry["ip"]}, self.directory.dns[self.entry["fqdn"]])

    def test_owned_delete_preserves_other_rdata_and_spns(self):
        result = self.engine.apply(self.request)["entry"]
        self.directory.spns.add("cifs/external.ablestack.local")
        self.directory.dns[self.entry["fqdn"]].add("203.0.113.10")
        self.engine.apply({**self.request, "action": "DELETE", "entry": result, "operationid": "operation-two"})
        self.assertEqual({"203.0.113.10"}, self.directory.dns[self.entry["fqdn"]])
        self.assertIn("cifs/external.ablestack.local", self.directory.spns)

    def test_rename_prepares_new_then_removes_old(self):
        old = self.engine.apply(self.request)["entry"]
        new = {**self.entry, "fqdn": "new.ablestack.local"}
        self.engine.apply({**self.request, "action": "UPDATE", "entry": new, "previous": old,
                           "operationid": "operation-two"})
        self.assertIn("cifs/new.ablestack.local", self.directory.spns)
        self.assertNotIn("cifs/alias.ablestack.local", self.directory.spns)
        mutations = self.directory.mutations
        self.assertLess(mutations.index(("DNS", True, new["fqdn"], new["ip"])),
                        mutations.index(("DNS", False, old["fqdn"], old["ip"])))

    def test_delete_keeps_original_ownership_when_dns_was_already_absent(self):
        old = self.engine.apply(self.request)["entry"]
        self.directory.change_dns(old["fqdn"], False, old["ip"])
        receipt = self.engine.apply({**self.request, "action":"DELETE", "entry":old, "operationid":"delete-missing"})
        self.assertEqual(old["ownership"], receipt["entry"]["ownership"])
        self.assertTrue(receipt["entry"]["deleted"])
        self.assertNotIn("cifs/"+old["fqdn"], self.directory.spns)

    def test_own_rollback_renews_identity_and_followup_delete_works(self):
        old = self.engine.apply(self.request)["entry"]
        engine = names.ServiceNames(Path(self.tmp.name) / "rename", self.directory, lambda e, i: None,
                                    self.engine.credentials)
        engine.apply({**self.request, "action":"UPDATE", "entry":{**self.entry, "fqdn":"new.ablestack.local"},
                      "previous":old, "operationid":"operation-two"})
        receipt = engine.restore()
        self.assertEqual("VERIFIED", receipt["state"])
        self.assertEqual("operation-two", receipt["operationid"])
        self.assertEqual(1, len(receipt["renewals"]))
        renewal = receipt["renewals"][0]
        self.assertEqual(old["ownership"], renewal["expectedOwnership"])
        self.assertNotEqual(old["ownership"]["nodeGuid"], renewal["ownership"]["nodeGuid"])
        current = {**old, "ownership":renewal["ownership"]}
        deleted = self.engine.apply({**self.request, "action":"DELETE", "entry":current,
                                     "operationid":"operation-three"})
        self.assertTrue(deleted["entry"]["deleted"])

    def test_rollback_reobserves_real_spn_not_only_undone_flags(self):
        self.engine.apply(self.request)
        self.engine.restore()
        self.directory.spns.remove("host/base.ablestack.local")
        with self.assertRaisesRegex(names.NameError, "ROLLBACK_SPN_MISMATCH"):
            self.engine.verify_restored()

    def test_external_dns_churn_after_verified_own_rollback_is_blocked(self):
        old = self.engine.apply(self.request)["entry"]
        engine = names.ServiceNames(Path(self.tmp.name) / "rename", self.directory, lambda e, i: None,
                                    self.engine.credentials)
        engine.apply({**self.request, "action":"UPDATE", "entry":{**self.entry, "fqdn":"new.ablestack.local"},
                      "previous":old, "operationid":"operation-two"})
        engine.restore()
        self.directory.nodes[old["fqdn"]] = "external-replacement-node"
        with self.assertRaisesRegex(names.NameError, "DNS_OWNER_CHANGED"):
            engine.verify_restored()

    def test_foreign_computer_identity_blocked(self):
        self.entry.update(computerGuid="different-guid", computerSid="sid", realm="ABLESTACK.LOCAL")
        with self.assertRaisesRegex(names.NameError, "IDENTITY_CHANGED"):
            self.engine.preview(self.request)

    def test_credentials_required_and_unknown_delta_not_blindly_undone(self):
        self.engine.credentials = None
        with self.assertRaisesRegex(names.NameError, "CREDENTIALS_REQUIRED"):
            self.engine.apply(self.request)
        self.engine.save({"steps": [{"state": "UNKNOWN"}]})
        with self.assertRaisesRegex(names.NameError, "CHANGE_UNCONFIRMED"):
            self.engine.restore()

    def test_approval_matches_public_entry_but_rejects_real_change(self):
        preview = self.engine.preview(self.request)
        query = copy.deepcopy(self.request); query.pop("operationid"); query["entry"].pop("uuid")
        payload = {"instanceUuid":INSTANCE, "operationid":self.request["operationid"], "candidate": {names.OPERATION: self.request},
                   "preflight": {"smbadnames": query, "expectedFingerprint": preview["fingerprint"]}}
        self.engine.prepare(payload)
        payload["candidate"][names.OPERATION]["entry"]["ip"] = "10.10.13.221"
        with self.assertRaisesRegex(names.NameError, "APPROVAL_CHANGED"):
            self.engine.prepare(payload)

    def test_fqdn_scope_and_base_immutable(self):
        for value in ["foreign.example", "ablestack.local", "a..ablestack.local", "-bad.ablestack.local"]:
            with self.assertRaises(names.NameError):
                names.fqdn(value, "ablestack.local")
        self.entry["kind"] = "BASE"
        with self.assertRaisesRegex(names.NameError, "BASE_IMMUTABLE"):
            self.engine.preview(self.request)


class CurrentMemberIdentityTest(unittest.TestCase):
    def test_existing_expected_guid_cannot_select_another_computer_than_the_current_member(self):
        import uuid
        from unittest.mock import Mock
        other="11111111-2222-3333-4444-555555555555"
        directory=object.__new__(names.NativeDirectory)
        directory.settings={"base":"DC=ablestack,DC=local","machine":"CURRENT"}
        directory.ldap=Mock()
        directory.ldap.search.side_effect=[
            [{"objectGUID":[uuid.UUID(GUID).bytes_le],"objectSid":[b"sid"],"dNSHostName":[b"old.ablestack.local"],"servicePrincipalName":[]}],
            [{"objectGUID":[uuid.UUID(other).bytes_le]}]]
        with self.assertRaisesRegex(names.NameError,"COMPUTER_IDENTITY_CHANGED"):
            directory.computer(GUID)


class NativeDnsRecordTest(unittest.TestCase):
    def setUp(self):
        try:
            from samba.dcerpc import dnsserver
            from samba.netcmd import dns
            from samba.ndr import ndr_pack
        except ImportError:
            self.skipTest("Requires actual SystemVM Samba Python bindings")
        self.dnsserver, self.dns, self.pack = dnsserver, dns, ndr_pack
        self.record = dns.data_to_dns_record(1, "10.10.13.220")
        self.record.dwTtlSeconds = 777
        self.record.dwSerial = 29
        self.directory = object.__new__(names.NativeDirectory)
        self.directory.settings = {"dc":"ad1453.ablestack.local","zone":"ablestack.local"}
        self.directory.records = lambda name: [self.record]
        from unittest.mock import Mock
        self.directory.dns = Mock()

    def test_delete_uses_live_record_and_does_not_decode_image(self):
        self.directory.change_dns("alias.ablestack.local", False, "10.10.13.220", "not-base64-and-must-not-be-decoded")
        args = self.directory.dns.DnssrvUpdateRecord2.call_args.args
        self.assertIsNone(args[-2])
        self.assertEqual(self.pack(self.record), self.pack(args[-1].rec))

    def test_restore_plain_wire_record_preserves_ip_ttl_serial_flags(self):
        import base64
        image = base64.b64encode(self.pack(self.record)).decode()
        self.directory.change_dns("alias.ablestack.local", True, "10.10.13.220", image)
        args = self.directory.dns.DnssrvUpdateRecord2.call_args.args
        self.assertIsNone(args[-1])
        self.assertEqual(self.pack(self.record), self.pack(args[-2].rec))
        self.assertEqual(self.dnsserver.DNS_RPC_RECORD, type(args[-2].rec))

    def test_restore_does_not_accept_a_different_address(self):
        import base64
        image = base64.b64encode(self.pack(self.record)).decode()
        with self.assertRaisesRegex(names.NameError, "DNS_IMAGE_INVALID"):
            self.directory.change_dns("alias.ablestack.local", True, "10.10.13.221", image)
        self.directory.dns.DnssrvUpdateRecord2.assert_not_called()


if __name__ == "__main__":
    unittest.main()
