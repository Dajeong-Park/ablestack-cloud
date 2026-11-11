# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
"""Durable iSCSI WWN binding to verified managed DATA, never volatile device names."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "debian/usr/local/lib/ablestack-storage"))
import configuration_transaction as tx


class IscsiBackstoreIdentityTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.resource = str(uuid.uuid4())
        self.volume = str(uuid.uuid4())
        self.other = str(uuid.uuid4())
        self.wwn = str(uuid.uuid4())
        self.size = 2147483648
        self.target = {"uuid": self.resource, "volumeUuid": self.volume, "volumeSizeBytes": self.size,
                       "targetName": "iqn.test:managed", "lunOrNamespace": "0"}
        self.devices = [
            {"name": "vda", "path": "/dev/vda", "type": "disk", "size": 10*self.size,
             "serial": "ROOT-uuid", "children": [
                 {"name": "vda1", "path": "/dev/vda1", "type": "part", "size": 10*self.size,
                  "mountpoint": "/", "fstype": "xfs"}]},
            {"name": "vdb", "path": "/dev/vdb", "type": "disk", "size": self.size,
             "serial": self.volume.replace("-", "")[:20]},
            {"name": "vdc", "path": "/dev/vdc", "type": "disk", "size": self.size,
             "serial": self.other.replace("-", "")[:20]},
        ]
        self.path = self.root / "identities" / "identities.json"
        self.saved = self.root / "saveconfig.json"
        self.store = tx.IscsiBackstoreIdentityStore(self.path, self.saved)
        self.native = {"ablestack-" + self.resource: {"wwn": self.wwn, "devicePath": "/dev/vdb"}}
        self.validated = []

    def prepare(self, native=None, previous=None, target=None, allow=False, validate=None):
        return self.store.prepare([target or self.target], self.devices,
                                  self.native if native is None else native,
                                  previous or {"targets": [self.target]},
                                  validate or self.validated.append, allow)

    def legacy(self, linked=True):
        tx.atomic_json(self.saved, {
            "storage_objects": [{"name": "ablestack-" + self.resource, "plugin": "block",
                                 "wwn": self.wwn, "dev": "/dev/stale-now-another-disk"}],
            "targets": [{"wwn": self.target["targetName"], "tpgs": [
                {"tag": 1, "luns": [{"index": 0, "storage_object":
                                    "/backstores/block/" + self.resource if not linked else
                                    "/backstores/block/ablestack-" + self.resource}]}]}]})

    def test_live_adoption_is_durable_idempotent_and_not_part_of_desired(self):
        before = copy.deepcopy(self.target)
        first = self.prepare()
        encoded = self.path.read_bytes()
        self.assertEqual(self.wwn, first[self.resource]["wwn"])
        self.assertEqual("/dev/vdb", first[self.resource]["devicePath"])
        self.assertEqual(["/dev/vdb"], self.validated)
        self.assertEqual(first, self.prepare())
        self.assertEqual(encoded, self.path.read_bytes())
        entry = self.store.load()["entries"][self.resource]
        self.assertEqual({"volumeUuid", "bytes", "wwn"}, set(entry))
        self.assertNotIn("devicePath", encoded.decode())
        self.assertEqual(before, self.target)
        self.assertEqual(0o600, self.path.stat().st_mode & 0o777)

    def test_new_resource_allocates_once_then_survives_absent_kernel(self):
        new = copy.deepcopy(self.target)
        result = self.store.prepare([new], self.devices, {}, {"targets": []}, lambda path: None)
        expected = result[self.resource]["wwn"]
        self.assertEqual(str(uuid.UUID(expected)), expected)
        self.assertEqual(expected, self.prepare(native={})[self.resource]["wwn"])
        self.assertEqual(expected, self.store.load()["entries"][self.resource]["wwn"])

    def test_cold_legacy_adopts_verified_managed_link_despite_stale_dev_path(self):
        self.legacy()
        result = self.prepare(native={})
        self.assertEqual(self.wwn, result[self.resource]["wwn"])
        self.assertEqual("/dev/vdb", result[self.resource]["devicePath"])
        self.assertEqual(self.volume, self.store.load()["entries"][self.resource]["volumeUuid"])

    def test_existing_resource_without_native_or_trusted_legacy_is_not_regenerated(self):
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_UNCONFIRMED"):
            self.prepare(native={})
        self.assertFalse(self.path.exists())
        self.legacy(linked=False)
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_UNCONFIRMED"):
            self.prepare(native={})
        self.assertFalse(self.path.exists())

    def test_changed_volume_and_same_uuid_wrong_size_are_rejected(self):
        self.prepare()
        original = self.path.read_bytes()
        other = dict(self.target, volumeUuid=self.other)
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_BINDING_CHANGED"):
            self.prepare(target=other, allow=True)
        wrong = dict(self.target, volumeSizeBytes=self.size // 2)
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_DATA_SIZE_MISMATCH"):
            self.prepare(target=wrong, allow=True)
        self.assertEqual(original, self.path.read_bytes())

    def test_root_and_unique_equal_size_fallback_never_authorize_data(self):
        target = dict(self.target, volumeUuid=str(uuid.uuid4()))
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_DATA_IDENTITY_MISMATCH"):
            self.prepare(target=target)
        root = str(uuid.uuid4())
        self.devices[0]["serial"] = root.replace("-", "")[:20]
        target = dict(self.target, volumeUuid=root, volumeSizeBytes=self.devices[0]["size"])
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_DATA_IDENTITY_MISMATCH"):
            self.prepare(target=target)
        self.assertFalse(self.path.exists())

    def test_device_reordering_uses_uuid_preserves_wwn_and_requires_rebind_admission(self):
        self.prepare()
        original = self.path.read_bytes()
        self.devices[1]["name"], self.devices[1]["path"] = "vdd", "/dev/vdd"
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_DATA_IDENTITY_MISMATCH"):
            self.prepare()
        result = self.prepare(allow=True)
        self.assertEqual({"wwn": self.wwn, "devicePath": "/dev/vdd"}, result[self.resource])
        self.assertEqual(original, self.path.read_bytes())
        self.store.verify(self.target, {"wwn": self.wwn, "devicePath": "/dev/vdd"}, self.devices)

    def test_growth_keeps_wwn_but_shrink_or_retarged_data_cannot_rebind(self):
        self.prepare()
        grown = dict(self.target, volumeSizeBytes=self.size * 2)
        self.devices[1]["size"] = self.size * 2
        self.assertEqual(self.wwn, self.prepare(target=grown)[self.resource]["wwn"])
        self.assertEqual(self.size * 2, self.store.load()["entries"][self.resource]["bytes"])
        self.devices[1]["size"] = self.size
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_BINDING_CHANGED"):
            self.prepare()

    def test_live_identity_mismatch_and_colliding_wwn_are_rejected(self):
        self.prepare()
        bad = copy.deepcopy(self.native)
        bad["ablestack-" + self.resource]["wwn"] = str(uuid.uuid4())
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_ACTIVE_WWN_MISMATCH"):
            self.prepare(native=bad)
        target = dict(self.target, uuid=str(uuid.uuid4()))
        bad = {"ablestack-" + target["uuid"]: {"wwn": self.wwn, "devicePath": "/dev/vdb"}}
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_COLLISION"):
            self.prepare(native=bad, target=target)

    def test_corrupt_symlink_writable_or_noncanonical_store_is_rejected(self):
        self.prepare()
        original = self.path.read_bytes()
        self.path.chmod(0o666)
        with self.assertRaises(tx.Rejected):
            self.prepare()
        self.path.chmod(0o600)
        value = json.loads(original)
        key = str(uuid.uuid4()).upper()
        value["entries"][key] = value["entries"].pop(self.resource)
        tx.atomic_json(self.path, value)
        with self.assertRaises(tx.Rejected):
            self.prepare()
        self.path.unlink()
        self.path.symlink_to(self.saved)
        tx.atomic_json(self.saved, {})
        with self.assertRaises(tx.Rejected):
            self.prepare()
        self.path.unlink()
        self.path.write_text("not-json"); self.path.chmod(0o600)
        with self.assertRaises(tx.Rejected):
            self.prepare()

    def test_batch_validation_failure_does_not_publish_partial_identity_records(self):
        second = dict(self.target, uuid=str(uuid.uuid4()), volumeSizeBytes=1)
        with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_DATA_SIZE_MISMATCH"):
            self.store.prepare([self.target, second], self.devices, self.native, {"targets": []},
                               lambda path: None)
        self.assertFalse(self.path.exists())

    def test_existing_mount_protection_precedes_record_or_kernel_mutation(self):
        def mounted(path):
            raise tx.Rejected("MOUNTED_DATA_FIXTURE")
        with self.assertRaisesRegex(tx.Rejected, "MOUNTED_DATA_FIXTURE"):
            self.prepare(validate=mounted)
        self.assertFalse(self.path.exists())

    def test_verify_requires_both_data_binding_and_observed_native_wwn(self):
        self.prepare()
        self.store.verify(self.target, self.native["ablestack-" + self.resource], self.devices)
        for native in [{"wwn": str(uuid.uuid4()), "devicePath": "/dev/vdb"},
                       {"wwn": self.wwn, "devicePath": "/dev/vdc"}]:
            with self.assertRaisesRegex(tx.Rejected, "ISCSI_BACKSTORE_IDENTITY_VERIFY_FAILED"):
                self.store.verify(self.target, native, self.devices)


if __name__ == "__main__":
    unittest.main()
