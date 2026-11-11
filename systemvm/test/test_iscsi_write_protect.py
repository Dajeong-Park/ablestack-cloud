# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
"""iSCSI mapped-LUN policy, native write-protect readback and identity guards."""
import copy
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "debian/usr/local/lib/ablestack-storage"))
import configuration_transaction as tx


class Mapping:
    def __init__(self, number, target, protected=False, ignore=False):
        self.mapped_lun = number
        self.tpg_lun = types.SimpleNamespace(lun=target)
        self._protected = protected
        self.ignore = ignore
        self.writes = 0

    @property
    def write_protect(self):
        return self._protected

    @write_protect.setter
    def write_protect(self, value):
        self.writes += 1
        if not self.ignore:
            self._protected = value


class IscsiMappedLunPolicyTest(unittest.TestCase):
    def value(self, permissions):
        return {"enabled": True, "targets": [
            {"targetName": "iqn.test:target", "lunOrNamespace": str(number),
             "acls": [] if permission is None else [
                 {"principal": "iqn.test:initiator", "permission": permission,
                  "config": {"chapEnabled": True, "chapUsername": "same-user"},
                  "secrets": {"chapSecret": "synthetic-secret"}}]}
            for number, permission in enumerate(permissions)]}

    def root(self, mappings):
        acl = types.SimpleNamespace(node_wwn="iqn.test:initiator", mapped_luns=mappings,
                                    chap_userid="same-user", chap_password="same-secret")
        tpg = types.SimpleNamespace(tag=1, node_acls=[acl],
                                    luns=[types.SimpleNamespace(lun=n) for n in range(3)])
        root = types.SimpleNamespace(targets=[types.SimpleNamespace(wwn="iqn.test:target", tpgs=[tpg])])
        return root, acl

    def test_ro_rw_changes_and_noop_readback_without_chap_or_payload_mutation(self):
        mapping = Mapping(0, 0)
        root, acl = self.root([mapping])
        value = self.value(["READ_ONLY"])
        original = copy.deepcopy(value)
        first = tx.iscsi_mapped_lun_permissions(value, apply=True, root=root)
        self.assertTrue(mapping.write_protect)
        self.assertTrue(first[0]["writeProtect"])
        self.assertEqual(original, value)
        self.assertNotIn("synthetic-secret", str(first))
        tx.iscsi_mapped_lun_permissions(value, apply=True, root=root)
        self.assertEqual(1, mapping.writes)
        value["targets"][0]["acls"][0]["permission"] = "READ_WRITE"
        tx.iscsi_mapped_lun_permissions(value, apply=True, root=root)
        self.assertFalse(mapping.write_protect)
        self.assertEqual(2, mapping.writes)
        self.assertEqual(("same-user", "same-secret"), (acl.chap_userid, acl.chap_password))

    def test_fresh_readback_rejects_ignored_setter_and_wrong_mapping(self):
        root, _ = self.root([Mapping(0, 0, ignore=True)])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_WRITE_PROTECT_MISMATCH"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), apply=True, root=root)
        root, _ = self.root([Mapping(0, 1)])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_MAPPED_LUN_IDENTITY_CHANGED"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), apply=True, root=root)
        root, _ = self.root([Mapping(0, 0)])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_WRITE_PROTECT_MISMATCH"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), root=root)

    def test_missing_mapping_is_never_verified_and_created_with_explicit_protection(self):
        root, acl = self.root([])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_MAPPED_LUN_NOT_READY"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), root=root)
        calls = []
        def create(parent, number, tpg_lun=None, write_protect=None):
            self.assertIs(parent, acl)
            calls.append((number, tpg_lun.lun, write_protect))
            m = Mapping(number, tpg_lun.lun, write_protect)
            parent.mapped_luns.append(m)
            return m
        fake = types.ModuleType("rtslib_fb")
        fake.MappedLUN = create
        with patch.dict(sys.modules, {"rtslib_fb": fake}):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), apply=True, root=root)
        self.assertEqual([(0, 0, True)], calls)
        tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), root=root)

    def test_explicit_mixed_lun_permissions_and_target_wide_legacy_inheritance(self):
        value = self.value(["READ_ONLY", "READ_WRITE"])
        expected = {0: True, 1: False}
        self.assertEqual(expected, tx.iscsi_acl_permission_plan(value)["iqn.test:target"]["iqn.test:initiator"])
        mappings = [Mapping(0, 0), Mapping(1, 1)]
        root, _ = self.root(mappings)
        tx.iscsi_mapped_lun_permissions(value, apply=True, root=root)
        self.assertEqual(expected, {m.mapped_lun: m.write_protect for m in mappings})
        self.assertEqual({0: True, 1: True},
                         tx.iscsi_acl_permission_plan(self.value(["READ_ONLY", None]))["iqn.test:target"]["iqn.test:initiator"])
        self.assertEqual({0: False, 1: False},
                         tx.iscsi_acl_permission_plan(self.value(["READ_WRITE", None]))["iqn.test:target"]["iqn.test:initiator"])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_ACL_PERMISSION_AMBIGUOUS"):
            tx.iscsi_acl_permission_plan(self.value(["READ_ONLY", "READ_WRITE", None]))

    def test_invalid_conflicting_and_disabled_rules_cannot_change_permissions(self):
        value = self.value(["ADMIN"])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_ACL_PERMISSION_UNSUPPORTED"):
            tx.iscsi_acl_permission_plan(value)
        value = self.value(["READ_ONLY"])
        duplicate = copy.deepcopy(value["targets"][0]["acls"][0])
        duplicate["permission"] = "READ_WRITE"
        value["targets"][0]["acls"].append(duplicate)
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_ACL_PERMISSION_CONFLICT"):
            tx.iscsi_acl_permission_plan(value)
        duplicate["state"] = "Disabled"
        self.assertEqual({0: True}, tx.iscsi_acl_permission_plan(value)["iqn.test:target"]["iqn.test:initiator"])
        value["targets"][0]["state"] = "Destroyed"
        self.assertEqual({}, tx.iscsi_acl_permission_plan(value))
        legacy = self.value(["READ_WRITE"])
        legacy["targets"][0]["acls"][0].pop("permission")
        self.assertEqual({0: False}, tx.iscsi_acl_permission_plan(legacy)["iqn.test:target"]["iqn.test:initiator"])

    def test_missing_target_or_acl_is_not_reclassified_as_success(self):
        root, acl = self.root([Mapping(0, 0)])
        root.targets[0].tpgs[0].node_acls = []
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_ACL_NOT_READY"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), root=root)
        root.targets = []
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_TARGET_NOT_READY"):
            tx.iscsi_mapped_lun_permissions(self.value(["READ_ONLY"]), root=root)


if __name__ == "__main__":
    unittest.main()
