# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "debian/usr/local/lib/ablestack-storage"))
import shared_directory_policy as policy
import configuration_transaction as transaction


class InputContract(unittest.TestCase):
    def test_normalized_octal_and_only_explicit_fields(self):
        self.assertEqual({"mode": "0770"}, policy.fields({"mode": "770"}))
        self.assertEqual({}, policy.fields({}))
        self.assertEqual({"recursivePermission": False}, policy.fields({"recursivePermission": False}))

    def test_invalid_and_unknown_fields_are_rejected(self):
        for value in ({"ownerUid": -1}, {"ownerGid": True}, {"mode": "888"}, {"recursivePermission": "true"}, {"force": True}):
            with self.assertRaises(policy.PolicyError):
                policy.fields(value)

    def test_named_acl_never_expands_common_mask(self):
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_MASK_CONFLICT"):
            policy.DirectoryPolicies.compatible({("u", 1001): 7}, 1001, 0o750)


@unittest.skipUnless(os.geteuid() == 0 and shutil.which("getfacl") and shutil.which("setfacl"), "root and native POSIX ACL tools required")
class PosixTransactions(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.managed = self.root / "managed"
        self.mount = self.managed / str(uuid.uuid4())
        self.mount.mkdir(parents=True)
        self.path = self.mount / "shared"
        self.path.mkdir()
        self.path.chmod(0o770)
        self.child = self.path / "child"
        self.child.write_bytes(b"preserve")
        self.child.chmod(0o640)
        self.real_run = subprocess.run
        def run(argv, **kwargs):
            if argv[0] == "findmnt":
                output = "fixture-filesystem xfs\n" if "UUID,FSTYPE" in argv else "fixture-filesystem\n"
                return SimpleNamespace(returncode=0, stdout=output if kwargs.get("text") else output.encode(), stderr=b"")
            return self.real_run(argv, **kwargs)
        self.command_patch = patch.object(subprocess, "run", side_effect=run)
        self.command_patch.start()
        self.engine = policy.DirectoryPolicies(registry=self.root/"registry/policy.json", managed=self.managed,
            configs=self.root/"configs", desired=self.root/"desired", refresh=lambda units: None, protocol_check=lambda value: None)
        self.row = {"uuid": "ref", "config": {"volumeMountPath":str(self.mount),"backingPath":str(self.path)}}
        o = self.engine.observe(self.row)
        self.p = {k:o[k] for k in ("volumeuuid","canonicalpath","filesystemuuid","inode","owneruid","ownergid","mode")}
        self.p.update(uuid=str(uuid.uuid4()), revision=1)
        adopted = self.value("ADOPT", self.p)
        self.engine.apply(adopted, self.engine.snapshot(adopted))

    def tearDown(self):
        self.command_patch.stop()
        self.tmp.cleanup()

    def value(self, action, p, changes=None):
        value={"action":action,"policy":dict(p),"changes":changes or {},"units":[],
               "expectedObservation":self.engine.observe(self.row)["fingerprint"],"smbShares":[]}
        if action=="UPDATE":value["expectedPolicyRevision"]=p["revision"]-1
        return value

    def test_nonrecursive_update_and_full_acl_rollback(self):
        p={**self.p,"revision":2,"owneruid":1001,"ownergid":1001,"mode":"0777"}
        value=self.value("UPDATE",p,{"ownerUid":1001,"ownerGid":1001,"mode":"0777"})
        before=self.engine.snapshot(value);counts=[]
        self.engine.apply(value,before,counts.append)
        self.assertEqual(1001,self.path.stat().st_uid)
        self.assertEqual(0,self.child.stat().st_uid)
        self.assertEqual(0o640,self.child.stat().st_mode & 0o7777)
        self.engine.restore(before,max(counts))
        self.assertEqual(0,self.path.stat().st_uid)
        self.assertEqual(b"preserve",self.child.read_bytes())

    def test_enabling_setgid_checks_effective_smb_identity_before_metadata_change(self):
        value=self.value("UPDATE",{**self.p,"revision":2,"mode":"2770"},{"mode":"2770"})
        value["smbShares"]=[{"name":"team","state":"Ready","config":self.row["config"]}]
        original=(self.path.stat().st_uid,self.path.stat().st_gid,self.path.stat().st_mode,self.path.stat().st_ino)
        with patch.object(policy,"smb_publication_state",return_value={"name":"team","uuid":"fixture","state":"PUBLISHED","listeners":1,"runtime":[{"forceGroup":"out-of-band"}]}) as reader:
            with self.assertRaisesRegex(policy.PolicyError,"SMB_PARENT_IDENTITY_CONFLICT"):
                self.engine.snapshot(value)
            reader.assert_called_once_with(value["smbShares"][0],self.engine.desired/"smb-share-apply.json")
        self.assertEqual(original,(self.path.stat().st_uid,self.path.stat().st_gid,self.path.stat().st_mode,self.path.stat().st_ino))
        self.assertEqual(b"preserve",self.child.read_bytes())
        with patch.object(policy,"smb_publication_state",return_value={"name":"team","uuid":"fixture","state":"PUBLISHED","listeners":1,"runtime":[{"forceUser":"","forceGroup":""}]}):
            before=self.engine.snapshot(value)
            self.engine.apply(value,before)
            self.engine.verify(value,before)
        self.assertEqual(0o2770,self.path.stat().st_mode&0o7777)
        self.engine.restore(before,1)
        self.assertEqual(original,(self.path.stat().st_uid,self.path.stat().st_gid,self.path.stat().st_mode,self.path.stat().st_ino))

    def test_recursive_is_explicit_bounded_and_verified(self):
        p={**self.p,"revision":2}
        value=self.value("UPDATE",p,{"recursivePermission":True})
        before=self.engine.snapshot(value)
        self.engine.apply(value,before)
        self.assertEqual(0o770,self.child.stat().st_mode & 0o7777)
        self.assertEqual(b"preserve",self.child.read_bytes())
        self.child.chmod(0o600)
        with self.assertRaisesRegex(policy.PolicyError,"DIRECTORY_POLICY_VERIFY_FAILED"):
            self.engine.verify(value,before)

    def acl_receipt_snapshot(self):
        import base64
        return {"files":{str(self.engine.registry):{"content":base64.b64encode(self.engine.registry.read_bytes()).decode()}},
                "metadata":{str(self.path):{"acl":subprocess.check_output(["getfacl","-pn",str(self.path)],text=True)}}}

    def test_smb_owned_acl_receipt_preserves_explicit_acl_and_publishes_actual_guest_contract(self):
        before=self.acl_receipt_snapshot()
        rows=[{"config":self.row["config"],"acls":[{"principalType":"LOCAL_USER","principal":"nobody","permission":"READ_WRITE"}]}]
        self.engine.apply_acl_batch(rows,[str(self.path)])
        entries=self.engine.smb_acl_receipts(before,[],rows)
        self.assertEqual(1,len(entries))
        self.assertEqual({"u:65534":"rwx"},entries[0]["after"]["ownedacl"])
        self.assertEqual(entries[0]["before"]["managedEntries"],entries[0]["after"]["managedEntries"])
        receipt={"operationid":"native-operation","instanceUuid":"native-instance","baseRevision":3,"targetRevision":4,"version":1,"entries":entries}
        transaction.atomic_json(self.root/"directory-acl-receipts.json",receipt)
        self.assertEqual(receipt,transaction.Transaction.bindings_status({"state":"VERIFIED"},self.root)["directoryAclReceipts"])
        self.assertNotIn("directoryAclReceipts",transaction.Transaction.bindings_status({"state":"ROLLED_BACK"},self.root))
        self.assertEqual(b"preserve",self.child.read_bytes())

    def test_smb_receipt_rejects_external_acl_and_unknown_ownership(self):
        before=self.acl_receipt_snapshot()
        rows=[{"config":self.row["config"],"acls":[{"principalType":"LOCAL_USER","principal":"nobody","permission":"READ_WRITE"}]}]
        self.engine.apply_acl_batch(rows,[str(self.path)])
        with self.assertRaisesRegex(policy.PolicyError,"OWNERSHIP_CHANGED"):
            self.engine.smb_acl_receipts(before,[{"config":self.row["config"]}],[])
        subprocess.check_call(["setfacl","-n","-m","u:100099:r-x",str(self.path)])
        with self.assertRaisesRegex(policy.PolicyError,"VERIFY_FAILED"):
            self.engine.smb_acl_receipts(before,[],rows)

    def test_smb_removal_keeps_same_explicit_acl_and_next_edit_keeps_owned_acl(self):
        old=self.engine.read()[self.p["uuid"]]
        value=self.value("UPDATE",{**old,"revision":2})
        value["aclchanges"]={"version":1,"entries":[{"action":"UPSERT","scope":"BOTH","principalType":"UID","principal":"65534","permissions":"rwx"}]}
        value["policy"].pop("principalBindings",None)
        preview=self.engine.prepare(value);value["policy"]=preview[0]
        self.engine.apply(value,self.engine.snapshot(value))
        rows=[{"config":self.row["config"],"acls":[{"principalType":"LOCAL_USER","principal":"nobody","permission":"READ_WRITE"}]}]
        self.engine.apply_acl_batch(rows,[str(self.path)])
        before=self.acl_receipt_snapshot()
        current=self.engine.read()[self.p["uuid"]]
        edit=self.value("UPDATE",{**current,"revision":3})
        edit["aclchanges"]={"version":1,"entries":[{"action":"UPSERT","scope":"ACCESS","principalType":"UID","principal":"100099","permissions":"r-x"}]}
        edit["policy"].pop("principalBindings",None)
        preview=self.engine.prepare(edit)
        self.assertEqual({"u:65534":"rwx"},preview[0]["ownedacl"])
        self.engine.apply_acl_batch([],[str(self.path)])
        receipt=self.engine.smb_acl_receipts(before,rows,[])
        self.assertEqual({},receipt[0]["after"]["ownedacl"])
        for field in ("accessAcl","defaultAcl"):
            self.assertTrue(any(e["tag"]=="user" and e["id"]=="65534" for e in receipt[0]["after"][field]))

    def test_repeated_acl_render_is_a_true_noop_and_mode_is_not_expanded(self):
        rows=[{"config":self.row["config"],"acls":[{"principalType":"LOCAL_USER","principal":"nobody","permission":"READ_WRITE"}]}]
        self.engine.apply_acl_batch(rows,[str(self.path),str(self.path)])
        stamp=self.engine.registry.stat().st_mtime_ns
        self.engine.apply_acl_batch(rows,[str(self.path)])
        self.assertEqual(stamp,self.engine.registry.stat().st_mtime_ns)
        self.assertEqual(0o770,self.path.stat().st_mode & 0o7777)

    def test_stale_observation_and_replaced_inode_are_not_overwritten(self):
        p={**self.p,"revision":2,"mode":"0777"}
        value=self.value("UPDATE",p,{"mode":"0777"})
        before=self.engine.snapshot(value)
        self.path.chmod(0o771)
        with self.assertRaisesRegex(policy.PolicyError,"DIRECTORY_POLICY_STALE"):
            self.engine.apply(value,before)
        self.assertEqual(0o771,self.path.stat().st_mode & 0o7777)
        self.path.rename(self.mount/"original")
        self.path.mkdir(mode=0o700)
        with self.assertRaisesRegex(policy.PolicyError,"DIRECTORY_IDENTITY_CHANGED"):
            self.engine.restore(before,1)
        self.assertEqual(0o700,self.path.stat().st_mode & 0o7777)


    def test_child_metadata_change_invalidates_recursive_tree_confirmation(self):
        value=self.value("UPDATE",{**self.p,"revision":2},{"recursivePermission":True})
        before=self.engine.snapshot(value)
        value["expectedTreeFingerprint"]=before["treefingerprint"]
        self.child.chmod(0o600)
        with self.assertRaisesRegex(policy.PolicyError,"DIRECTORY_POLICY_STALE"):
            self.engine.snapshot(value)
        self.assertEqual(0o600,self.child.stat().st_mode & 0o7777)

    def test_named_acl_effective_widening_is_in_the_public_preview(self):
        subprocess.run(["setfacl","-m","u:65534:rwx",str(self.path)],check=True)
        self.path.chmod(0o750)
        value=self.value("UPDATE",{**self.p,"revision":2},{"mode":"0770"})
        before=self.engine.snapshot(value)
        impact=self.engine.acl_impact(value,before)
        self.assertEqual(1,impact["count"])
        self.assertEqual("r-x",impact["changes"][0]["before"])
        self.assertEqual("rwx",impact["changes"][0]["after"])


    def test_disabled_smb_reference_does_not_require_a_running_listener(self):
        self.engine.desired.mkdir()
        (self.engine.desired/"smb-share-apply.json").write_text('{"enabled":false}')
        self.engine.protocol_check=None
        value=self.value("UPDATE",{**self.p,"revision":2,"mode":"0777"},{"mode":"0777"})
        value["smbShares"]=[{"state":"Ready","config":self.row["config"]}]
        with patch.object(transaction.SmbListenerProfiles,"show",side_effect=AssertionError("disabled SMB must not be started or required")):
            self.engine.verify_protocols(value)

    def inspection_rows(self, count):
        return [{**self.row, "uuid": "ref-" + str(n), "name": "alias-" + str(n), "protocol": "NFS"} for n in range(count)]

    def test_request_reuses_units_only_after_each_row_identity_and_acl_observation(self):
        before = (self.child.read_bytes(), self.path.stat(), self.child.stat())
        ports = [{"port": "2049"}, {"port": "2050"}]
        with patch.object(self.engine, "units", return_value=ports) as units, \
             patch.object(self.engine, "observe", wraps=self.engine.observe) as observe:
            result = self.engine.inspect(self.inspection_rows(100))
            self.assertEqual(100, observe.call_count)
            self.assertEqual(1, units.call_count)
            self.assertEqual(100, len(result[0]["references"]))
            self.assertEqual(ports, result[0]["units"])
            self.engine.inspect(self.inspection_rows(100))
            self.assertEqual(2, units.call_count)  # a new request always observes aliases again
        self.assertEqual(before, (self.child.read_bytes(), self.path.stat(), self.child.stat()))

    def test_invalid_filesystem_reference_does_not_inherit_verified_group(self):
        rows = self.inspection_rows(2)
        rows[1]["config"] = {**rows[1]["config"], "filesystemUuid": "untrusted-filesystem"}
        with patch.object(self.engine, "units", return_value=[]) as units:
            result = self.engine.inspect(rows)
        self.assertEqual(1, units.call_count)
        self.assertEqual(2, len(result))
        self.assertEqual("UNAVAILABLE", next(x for x in result if x["resourceuuid"] == "ref-1")["status"])

    def test_different_physical_paths_are_independently_observed(self):
        other = self.mount / "another"; other.mkdir()
        rows = self.inspection_rows(2)
        rows[1]["config"] = {**rows[1]["config"], "backingPath": str(other)}
        with patch.object(self.engine, "units", return_value=[]) as units:
            self.assertEqual(2, len(self.engine.inspect(rows)))
        self.assertEqual(2, units.call_count)

    def test_replaced_inode_between_references_is_rejected_before_reusing_units(self):
        def replace(path):
            self.path.rename(self.mount / "original")
            self.path.mkdir(mode=0o770)
            return []
        with patch.object(self.engine, "units", side_effect=replace) as units:
            with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_IDENTITY_CHANGED"):
                self.engine.inspect(self.inspection_rows(2))
        self.assertEqual(1, units.call_count)
        self.assertEqual(b"preserve", (self.mount / "original/child").read_bytes())

    def test_acl_change_between_references_is_rejected_before_reusing_units(self):
        def change(path):
            self.real_run(["setfacl", "-m", "u:65534:r--", str(self.path)], check=True)
            return []
        with patch.object(self.engine, "units", side_effect=change) as units:
            with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_POLICY_STALE"):
                self.engine.inspect(self.inspection_rows(2))
        self.assertEqual(1, units.call_count)
        self.assertEqual(b"preserve", self.child.read_bytes())

    def test_actual_runtime_adapter_reopen_and_duplicate_use_one_apply(self):
        value=self.value("UPDATE",{**self.p,"revision":2,"mode":"0777"},{"mode":"0777"})
        calls=[]
        engine=self.engine
        class Adapter(transaction.RuntimeAdapter):
            def apply(self, commands):
                calls.append(1)
                super().apply(commands)
        payload={"instanceUuid":str(uuid.uuid4()),"operationid":str(uuid.uuid4()),"baseRevision":0,"targetRevision":1,
                 "candidate":{"directory policy apply":value},"before":{}}
        with patch.object(policy,"DirectoryPolicies",return_value=engine):
            tx=transaction.Transaction(self.root/"journal",Adapter)
            self.assertEqual("VERIFIED",tx.execute("apply",payload)["state"])
            tx.execute("commit",payload)
            tx=transaction.Transaction(self.root/"journal",Adapter)
            self.assertEqual("COMMITTED",tx.execute("resume",payload)["state"])
            self.assertEqual("COMMITTED",tx.execute("apply",payload)["state"])
        self.assertEqual(1,len(calls))


class NfsRestartIdentity(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.config = root / "configs"
        self.config.mkdir()
        self.run = root / "run"
        self.run.mkdir()
        self.engine = policy.DirectoryPolicies(configs=self.config, desired=root / "desired")
        self.engine.desired.mkdir()
        self.desired = {"nfs4IdentityMappingMode": "NUMERIC", "nfs4IdentityPolicyRevision": 3}
        (self.engine.desired / "nfs-export-apply.json").write_text(json.dumps(self.desired))
        self.identity = transaction.NfsIdentityMapping(self.config, self.run)
        self.pid = 10
        self.text = 'NFSV4 { DomainName = "test.local"; Only_Numeric_Owners = true; }\nSecType = sys;\n'
        self.items = []
        for port in (2049, 2050):
            path = self.config / ("endpoint-" + str(port) + ".conf")
            path.write_text(self.text)
            self.items.append({"unit": path.stem, "config": str(path), "port": port,
                               "sha256": policy.canonical_hash(self.text)})
        self.process_patch = patch.object(transaction.NfsIdentityMapping, "process",
            side_effect=lambda pid: {"pid": pid, "boot": "test-boot", "start": str(pid * 100)})
        self.process_patch.start()
        self.addCleanup(self.process_patch.stop)
        self.identity.complete([Path(x["config"]).stem for x in self.items], self.desired)
        for item in self.items:
            self.identity.publish(Path(item["config"]).stem, item["config"], self.pid, self.desired)
        self.real_read_bytes = Path.read_bytes

    def checked(self, argv, **kwargs):
        if argv[:2] == ["systemctl", "restart"]:
            self.pid += 1
            return b""
        if argv[:2] == ["systemctl", "show"]:
            return str(self.pid).encode()
        if argv[0] == "ss":
            return ("\n".join('LISTEN 0 128 0.0.0.0:%s 0.0.0.0:* users:(("ganesha.nfsd",pid=%s,fd=9))'
                              % (x["port"], self.pid) for x in self.items)).encode()
        raise AssertionError(argv)

    def proc_read(self, path):
        if str(path).startswith("/proc/"):
            return b"/usr/bin/ganesha.nfsd\0" + b"\0".join(x["config"].encode() for x in self.items)
        return self.real_read_bytes(path)

    def commands(self):
        stack = __import__("contextlib").ExitStack()
        stack.enter_context(patch.object(policy, "checked", side_effect=self.checked))
        stack.enter_context(patch.object(policy.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="test.local\n")))
        stack.enter_context(patch.object(Path, "read_bytes", autospec=True, side_effect=self.proc_read))
        stack.enter_context(patch.object(transaction.NfsIdentityMapping, "__init__",
            lambda obj: vars(obj).update(config=self.config, run=self.run,
                                        desired=self.engine.desired / "nfs-export-apply.json")))
        return stack

    def test_final_policy_refresh_reissues_both_process_bound_receipts(self):
        old = [(self.run / (Path(x["config"]).stem + ".identity.json")).read_bytes() for x in self.items]
        with self.commands():
            self.engine.restart_units(self.items)
            self.assertEqual("APPLIED", self.identity.observe(self.desired)["observationstatus"])
        for index, item in enumerate(self.items):
            key = Path(item["config"]).stem
            receipt = json.loads((self.run / (key + ".identity.json")).read_text())
            self.assertNotEqual(old[index], (self.run / (key + ".identity.json")).read_bytes())
            self.assertEqual(11 + index, receipt["process"]["pid"])
            self.assertEqual("NUMERIC", receipt["mode"])
            self.assertEqual(3, receipt["revision"])
            self.assertEqual(str(11 + index), (self.run / (key + ".pid")).read_text())

    def test_changed_configuration_rejected_before_restart_or_receipt(self):
        item = self.items[0]
        receipt = self.run / (Path(item["config"]).stem + ".identity.json")
        before = receipt.read_bytes()
        Path(item["config"]).write_text(self.text + "# unapproved replacement\n")
        with self.commands(), self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_NFS_IDENTITY_CHANGED"):
            self.engine.restart_units([item])
        self.assertEqual(10, self.pid)
        self.assertEqual(before, receipt.read_bytes())

    def test_wrong_executable_preserves_identity_rejection(self):
        item = self.items[0]
        receipt = self.run / (Path(item["config"]).stem + ".identity.json")
        before = receipt.read_bytes()
        with self.commands(), patch.object(transaction.NfsIdentityMapping, "process",
                side_effect=transaction.Rejected("NFS_IDENTITY_PROCESS_INVALID")):
            with self.assertRaisesRegex(policy.PolicyError, "NFS_IDENTITY_PROCESS_INVALID"):
                self.engine.restart_units([item])
        self.assertEqual(before, receipt.read_bytes())

    def test_socket_owned_by_other_process_cannot_be_receipted(self):
        with self.commands(), patch.object(policy, "checked", side_effect=lambda args, **kw:
                b"LISTEN 0 128 0.0.0.0:2049 0.0.0.0:* users:((other,pid=999,fd=9))"
                if args[0] == "ss" else self.checked(args, **kw)):
            self.assertFalse(self.engine.unit_ready(self.items[0]))


class AdvancedDirectoryAcl(unittest.TestCase):
    setUp = PosixTransactions.setUp
    tearDown = PosixTransactions.tearDown
    value = PosixTransactions.value

    def update(self, entries, changes=None):
        p = {**self.p, "revision": 2}
        for key, val in (changes or {}).items():
            if key != "recursivePermission":
                p[key.lower()] = val
        value = self.value("UPDATE", p, changes)
        value["aclchanges"] = {"version": 1, "entries": entries}
        value["policy"] = self.engine.prepare(value)[0]
        return value

    def test_access_default_are_independent_and_full_rollback_preserves_child(self):
        entries = [{"action": "UPSERT", "scope": "ACCESS", "principalType": "UID", "principal": "100001", "permissions": "rwx"},
                   {"action": "UPSERT", "scope": "DEFAULT", "principalType": "UID", "principal": "100001", "permissions": "r-x"}]
        value = self.update(entries)
        before = self.engine.snapshot(value)
        progress = []
        self.engine.apply(value, before, progress.append)
        actual = policy.acl_values(policy.checked(["getfacl", "-cpn", str(self.path)]).decode())
        self.assertIn({"tag": "user", "id": "100001", "permissions": "rwx"}, actual["ACCESS"])
        self.assertIn({"tag": "user", "id": "100001", "permissions": "r-x"}, actual["DEFAULT"])
        self.assertEqual(0o640, self.child.stat().st_mode & 0o7777)
        self.engine.restore(before, max(progress))
        self.assertEqual(before["entries"][0]["acl"], policy.checked(["getfacl", "-cpn", str(self.path)]).decode())
        self.assertEqual(b"preserve", self.child.read_bytes())

    def test_new_objects_inherit_default_acl_and_setgid(self):
        value = self.update([{"action": "UPSERT", "scope": "DEFAULT", "principalType": "UID", "principal": "100001", "permissions": "r-x"}],
                            {"mode": "2770", "ownerGid": 100001})
        self.engine.apply(value, self.engine.snapshot(value))
        new = self.path / "new"
        new.mkdir()
        self.assertEqual(100001, new.stat().st_gid)
        self.assertTrue(new.stat().st_mode & 0o2000)
        actual = policy.acl_values(policy.checked(["getfacl", "-cpn", str(new)]).decode())
        self.assertIn({"tag": "user", "id": "100001", "permissions": "r-x"}, actual["DEFAULT"])

    def test_external_and_smb_owned_acl_removal_is_blocked(self):
        entry = {"action": "REMOVE", "scope": "ACCESS", "principalType": "UID", "principal": "100001"}
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_NOT_OWNED"):
            self.update([entry])
        saved = self.engine.read()
        saved[self.p["uuid"]]["ownedacl"] = {"u:100001": "rwx"}
        self.engine.write(saved)
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_POLICY_CONFLICT"):
            self.update([entry])

    def test_conflicting_mask_recursive_and_duplicate_entries_are_blocked(self):
        entry = {"action": "UPSERT", "scope": "ACCESS", "principalType": "UID", "principal": "100001", "permissions": "r-x"}
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_CONFLICT"):
            self.update([entry, entry])
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_INVALID"):
            self.update([entry], {"recursivePermission": True})
        value = self.value("UPDATE", {**self.p, "revision": 2})
        value["aclchanges"] = {"version": 1, "entries": [], "accessMask": "r-x"}
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_ACL_MASK_CONFLICT"):
            self.engine.prepare(value)

    def test_stale_acl_or_reinterpreted_principal_cannot_apply(self):
        value = self.update([{"action": "UPSERT", "scope": "ACCESS", "principalType": "UID", "principal": "100001", "permissions": "r-x"}])
        before = self.engine.snapshot(value)
        subprocess.run(["setfacl", "-m", "u:100002:r--", str(self.path)], check=True)
        with self.assertRaisesRegex(policy.PolicyError, "DIRECTORY_POLICY_STALE"):
            self.engine.apply(value, before)

    def test_unregister_only_removes_registry_and_preserves_actual_acl(self):
        original = policy.checked(["getfacl", "-cpn", str(self.path)])
        value = self.value("DELETE", self.p)
        value["expectedPolicyRevision"] = 1
        value["references"] = []
        self.engine.apply(value, self.engine.snapshot(value))
        self.assertEqual({}, self.engine.read())
        self.assertEqual(original, policy.checked(["getfacl", "-cpn", str(self.path)]))
        self.assertEqual(b"preserve", self.child.read_bytes())

if __name__=="__main__":
    unittest.main()
