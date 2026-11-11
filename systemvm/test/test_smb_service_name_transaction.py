# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "debian/usr/local/lib/ablestack-storage"))
import configuration_transaction as transaction
from smb_service_names import OPERATION


class NameAdapterContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.instance = str(uuid.uuid4())
        self.operation = str(uuid.uuid4())
        self.adapter = transaction.RuntimeAdapter(Path(self.temp.name))
        self.request = {"operationid": self.operation, "instanceUuid": self.instance, "action": "CREATE", "entry": {"fqdn": "a.example.local"}}
        self.payload = {"operationid": self.operation, "instanceUuid": self.instance, "baseRevision": 0, "targetRevision": 1,
                        "candidate": {OPERATION: self.request}, "before": {},
                        "secrets": {"smbAd": {"username": "one-use-user", "password": "one-use-password"}}}
        self.receipt = {"version": 1, "state": "VERIFIED", "instanceUuid": self.instance, "operationid": self.operation}
        self.rollback = {**self.receipt, "renewals": []}
        self.engine = Mock()
        self.engine.apply.return_value = self.receipt
        self.engine.verify.return_value = self.receipt
        self.engine.restore.return_value = self.rollback
        self.engine.verify_restored.return_value = self.rollback
        self.adapter.names_engine = Mock(return_value=self.engine)

    def test_only_name_adapter_runs_and_credentials_never_reach_request_or_status(self):
        with patch.object(self.adapter, "run") as unrelated, patch.object(self.adapter, "path_bindings") as paths:
            self.adapter.preflight(self.payload)
            self.assertEqual(self.payload["secrets"]["smbAd"], self.adapter.smb_name_credentials)
            self.adapter.snapshot(self.payload)
            self.adapter.apply(self.payload["candidate"])
            self.adapter.verify(self.payload["candidate"])
            status = transaction.Transaction.bindings_status({"state": "VERIFIED"}, self.adapter.private)
            self.assertEqual(self.receipt, status["smbServiceNameReceipt"])
            self.adapter.restore(); self.adapter.verify_restored()
            rolled = transaction.Transaction.bindings_status({"state": "ROLLED_BACK"}, self.adapter.private)
            self.assertEqual(self.rollback, rolled["smbServiceNameRollback"])
            self.assertNotIn("smbServiceNameReceipt", rolled)
            self.assertNotIn("one-use", self.adapter.payload_path.read_text())
            unrelated.assert_not_called(); paths.assert_not_called()

    def test_mixed_commands_cannot_use_the_names_only_admission(self):
        self.payload["candidate"]["smb share apply"] = {}
        with self.assertRaisesRegex(transaction.Rejected, "SMB_NAME_COMMAND_SCOPE_INVALID"):
            self.adapter.preflight(self.payload)
        self.adapter.names_engine.assert_not_called()
        self.assertFalse(self.adapter.payload_path.exists())

    def test_explicit_resume_supplies_fresh_credentials_to_compensation_and_forwards_receipt(self):
        root = Path(self.temp.name) / "operations"
        operation = transaction.Transaction(root=root)
        directory, private, status_path = operation.paths(self.payload)
        self.adapter = transaction.RuntimeAdapter(private)
        self.adapter.names_engine = Mock(return_value=self.engine)
        self.adapter.is_running = lambda: False
        self.adapter.preflight(self.payload)
        self.adapter.snapshot(self.payload)
        self.engine.restore.side_effect = lambda: self.assertEqual(self.payload["secrets"]["smbAd"], self.adapter.smb_name_credentials) or self.rollback
        transaction.atomic_json(status_path, {"operationid": self.operation, "instanceUuid": self.instance,
            "state": "RECOVERY_REQUIRED", "phase": "OBSERVING", "baseRevision": 0, "targetRevision": 1,
            "smbServiceNames": True, "originalfailure": {"code": "SMB_NAME_TEST_FAILURE", "phase": "APPLYING"}})
        operation.adapter_factory = lambda path: self.adapter
        result = operation.execute("resume", {"operationid": self.operation, "instanceUuid": self.instance,
                                   "targetRevision": 1, "secrets": self.payload["secrets"]})
        self.assertEqual("ROLLED_BACK", result["state"])
        self.assertEqual(self.rollback, result["smbServiceNameRollback"])
        self.assertEqual("SUCCEEDED", result["rollback"]["state"])
        self.assertNotIn("one-use", status_path.read_text())


if __name__ == "__main__":
    unittest.main()
