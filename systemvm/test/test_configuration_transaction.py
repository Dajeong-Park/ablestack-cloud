# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file distributed
# with this work for additional information regarding copyright ownership.
# The ASF licenses this file under the Apache License, Version 2.0
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS.
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from contextlib import ExitStack
from unittest.mock import patch
import uuid

MODULE = Path(os.environ.get("CONFIGURATION_MODULE", Path(__file__).resolve().parents[1] /
              "debian/usr/local/lib/ablestack-storage/configuration_transaction.py"))
spec = importlib.util.spec_from_file_location("configuration_transaction", MODULE)
configuration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configuration)


class RestoreReceiptTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="restore-receipt-test-")
        self.addCleanup(self.temp.cleanup)
        self.adapter = configuration.RuntimeAdapter(Path(self.temp.name))
        self.plan = "a" * 64
        self.commands = {"iscsi target apply": {"enabled": False}, "smb share apply": {"enabled": False}}
        configuration.atomic_json(self.adapter.payload_path,
                                  {"restorePlanDigest": self.plan, "candidate": self.commands})
        self.adapter.restore_boot = lambda: "test-boot"

    def success(self, command, value):
        return {"returncode": 0, "operation": command, "result": {"success": True}}

    def test_latest_runner_success_alone_cannot_confirm_batch(self):
        operation = list(self.commands)[-1]
        configuration.atomic_json(self.adapter.private / "runner-result.json", self.success(operation, None))
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_RECEIPTS_INCOMPLETE"):
            self.adapter.verify_restore_receipts(self.commands)

    def test_requires_every_candidate_receipt_and_keeps_rollback_separate(self):
        self.adapter.run = self.success
        self.adapter.apply(self.commands)
        result = self.adapter.verify_restore_receipts(self.commands)
        self.assertEqual(set(self.commands), set(result["receipts"]))
        self.adapter.apply(self.commands, restoring=True)
        self.assertEqual(result, self.adapter.verify_restore_receipts(self.commands))
        self.assertEqual(result, self.adapter.verify_restore_receipts(self.commands, "restore-before"))
        self.adapter.restore_boot = lambda: "new-boot"
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_RECEIPT_BOOT_CHANGED"):
            self.adapter.verify_restore_receipts(self.commands)

    def test_first_receipt_survives_second_protocol_failure(self):
        def run(command, value):
            if command.startswith("smb"):
                return {"returncode": 0, "operation": command, "result": {"listening": False}}
            return self.success(command, value)
        self.adapter.run = run
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_PROTOCOL_RECEIPT_FAILED"):
            self.adapter.apply(self.commands)
        saved = configuration.load(self.adapter.private / "restore-candidate-receipts.json")
        self.assertEqual({"iscsi target apply"}, set(saved))
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_RECEIPTS_INCOMPLETE"):
            self.adapter.verify_restore_receipts(self.commands)


class NfsRestoreBindingTests(unittest.TestCase):
    def test_binding_and_nic_are_rechecked_at_each_stage(self):
        before = {"bootId": "boot", "interfaces": [{"address": "192.0.2.21"}], "listeners": []}
        scope = {"mode": "SERVICE_WIDE", "port": 2049, "families": ["IPv4", "IPv6"]}
        expected = dict(before, beforeListeners=[], listeners=[scope])
        with patch.object(configuration, "observe_nfs_binding", return_value=before):
            self.assertEqual(before, configuration.require_nfs_restore_binding(expected, "beforeListeners"))
            with self.assertRaisesRegex(configuration.Rejected, "NFS_RESTORE_BINDING_MISMATCH"):
                configuration.require_nfs_restore_binding(expected, "listeners")
        after = dict(before, listeners=[scope])
        with patch.object(configuration, "observe_nfs_binding", return_value=after):
            self.assertEqual(after, configuration.require_nfs_restore_binding(expected, "listeners"))
            changed = dict(expected, interfaces=[])
            with self.assertRaisesRegex(configuration.Rejected, "NFS_RESTORE_NETWORK_CHANGED"):
                configuration.require_nfs_restore_binding(changed, "listeners")
        dedicated = dict(scope, mode="DEDICATED")
        with patch.object(configuration, "observe_nfs_binding", return_value=dict(after, listeners=[dedicated])):
            with self.assertRaisesRegex(configuration.Rejected, "NFS_DEDICATED_RESTORE_UNSUPPORTED"):
                configuration.require_nfs_restore_binding(dict(expected, listeners=[dedicated]), "listeners")


class NfsSocketObservationTests(unittest.TestCase):
    def test_empty_configuration_requires_absence_of_watched_or_ganesha_sockets(self):
        def observe(socket_line):
            def checked(args, **kwargs):
                if args[0] == "ip":
                    return b"[]"
                return socket_line if args[-1] == "-4" else b""
            with patch.object(Path, "glob", return_value=[]), patch.object(configuration, "checked", side_effect=checked):
                return configuration.observe_nfs_binding([2050])

        self.assertEqual([], observe(b'LISTEN 0 64 0.0.0.0:445 0.0.0.0:* users:(("smbd",pid=17))')["listeners"])
        for line in (b'LISTEN 0 64 0.0.0.0:2050 0.0.0.0:* users:(("other",pid=17))',
                     b'LISTEN 0 64 0.0.0.0:3099 0.0.0.0:* users:(("ganesha.nfsd",pid=17))',
                     b'LISTEN 0 64 0.0.0.0:2049 0.0.0.0:*'):
            with self.assertRaisesRegex(configuration.Rejected, "NFS_BINDING_UNEXPECTED_SOCKET"):
                observe(line)


    def test_dual_mode_only_exempts_verified_registered_auxiliary_sockets(self):
        with tempfile.TemporaryDirectory(prefix="nfs-observation-") as tmp:
            root = Path(tmp)
            config_dir = root / "configs"
            config_dir.mkdir()
            config_file = config_dir / "0.0.0.0_2049.conf"
            config_file.write_text("NFS_Core_Param {\n    NFS_Port = 2049;\n    Bind_addr = 0.0.0.0;\n    Protocols = 3, 4;\n}\n")
            pid_dir = root / "pids"
            pid_dir.mkdir()
            (pid_dir / "0.0.0.0_2049.pid").write_text("17")
            proc_dir = root / "proc"
            proc = proc_dir / "17"
            proc.mkdir(parents=True)
            (proc / "cmdline").write_bytes(b"/usr/bin/ganesha.nfsd\0-f\0" + os.fsencode(config_file) + b"\0")
            # The observer compares process start time before and after the socket read.
            (proc / "stat").write_text("17 (ganesha.nfsd) " + " ".join(["0"] * 20))

            def path(value):
                return {"/etc/ganesha/ablestack-storage": config_dir,
                        "/run/ablestack-storage/ganesha": pid_dir, "/proc": proc_dir}.get(value, Path(value))

            def listen(port, owner=17):
                return f'LISTEN 0 4096 *:{port} *:* users:(("ganesha.nfsd",pid={owner},fd=14)) v6only:0'

            data = listen(2049)
            rpc = ("100003 3 tcp 2049 nfs\n"
                   "100005 3 tcp 34143 mountd\n"
                   "100021 4 tcp 37339 nlockmgr\n"
                   "100011 1 tcp 875 rquotad\n"
                   "100005 3 udp 36410 mountd\n")
            aux = [listen(port) for port in (34143, 37339, 875)]

            def observe(extra, watched=(), registrations=rpc):
                def checked(args, **kwargs):
                    if args[0] == "ip":
                        return b"[]"
                    if args[0] == "rpcinfo":
                        return registrations.encode()
                    return "\n".join([data, *extra]).encode() if args[-1] == "-6" else b""

                with ExitStack() as mocks:
                    mocks.enter_context(patch.object(configuration, "Path", side_effect=path))
                    mocks.enter_context(patch.object(configuration.os, "readlink", return_value="/usr/bin/ganesha.nfsd"))
                    mocks.enter_context(patch.object(configuration.RuntimeAdapter, "restore_boot", return_value="boot"))
                    mocks.enter_context(patch.object(configuration, "checked", side_effect=checked))
                    return configuration.observe_nfs_binding(watched)

            self.assertEqual([2049], [row["port"] for row in observe(aux)["listeners"]])
            moved = rpc.replace("34143", "48143")
            self.assertEqual([2049], [row["port"] for row in
                             observe([listen(48143), *aux[1:]], registrations=moved)["listeners"]])
            for sockets, watched, registrations in (
                    (aux + [listen(36410)], (), rpc),  # UDP-only registration.
                    ([listen(34143, 18), *aux[1:]], (), rpc),  # Wrong process.
                    (aux, (34143,), rpc),  # Port also reserved for the restore.
                    (aux, (), rpc + "100003 3 tcp 34143 nfs\n")):
                with self.assertRaisesRegex(configuration.Rejected, "NFS_BINDING_UNEXPECTED_SOCKET"):
                    observe(sockets, watched, registrations)
            with self.assertRaisesRegex(configuration.Rejected, "NFS_RPC_BINDING_UNCONFIRMED"):
                observe(aux[1:])


class RestoreVolumeTests(unittest.TestCase):
    def setUp(self):
        self.volume = str(uuid.uuid4())
        self.fs = str(uuid.uuid4())
        self.size = 2 * 1024 ** 3
        self.serial = self.volume.replace("-", "")[:20]
        self.mount = "/srv/ablestack-storage/volumes/" + self.volume
        self.request = {"requireMatch": True, "volumes": [{"uuid": self.volume, "bytes": self.size,
                        "filesystem": "xfs", "filesystemUuid": self.fs, "purpose": "FILE"}]}
        self.devices = [{"type": "disk", "name": "vdb", "path": "/dev/vdb", "serial": self.serial,
                         "fstype": "xfs", "uuid": self.fs, "size": self.size, "mountpoint": self.mount}]
        self.mounts = [{"target": self.mount, "source": "/dev/vdb", "fstype": "xfs",
                        "uuid": self.fs, "fsroot": "/"}]

    def test_serial_filesystem_and_mount_must_all_match(self):
        verified = configuration.observe_restore_volumes(self.request, self.devices, self.mounts)
        self.assertEqual("OBSERVED", verified["volumes"][0]["state"])
        self.mounts[0]["fsroot"] = "/other"
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_FILESYSTEM_IDENTITY_CHANGED"):
            configuration.observe_restore_volumes(self.request, self.devices, self.mounts)

    def test_root_and_serial_prefix_mismatch_are_rejected(self):
        self.devices[0]["mountpoint"] = "/"
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_DATA_SERIAL_OR_SIZE_CHANGED"):
            configuration.observe_restore_volumes(self.request, self.devices, self.mounts)
        self.devices[0].update(mountpoint=self.mount, serial=self.serial[:8])
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_DATA_SERIAL_OR_SIZE_CHANGED"):
            configuration.observe_restore_volumes(self.request, self.devices, self.mounts)


class RestorePathProofTests(unittest.TestCase):
    def test_rejects_replaced_inode_or_candidate_with_source_identity(self):
        volume, share, fs = [str(uuid.uuid4()) for _ in range(3)]
        root = "/srv/ablestack-storage/volumes/" + volume
        proof = {"resourceUuid": share, "volumeUuid": volume, "relativePath": "existing/child",
                 "protocol": "NFS", "protected": True, "name": "existing", "filesystemUuid": fs,
                 "inode": 402, "rootInode": 128, "mountId": 19, "mountSource": "/dev/vdb"}
        config = {"volumeMountPath": root, "backingPath": root + "/existing/child",
                  "pathBindingVersion": 1, "createDirectory": False,
                  "pathIdentity": {"filesystemUuid": fs, "inode": 402, "volumeRootInode": 128}}
        payload = {"restorePathProofs": [proof], "candidate": {"nfs export apply": {
            "exports": [{"uuid": share, "name": "existing", "config": config}]}}}
        configuration.verify_restore_path_proofs(payload, {"paths": [dict(proof)]})
        for changed in (dict(proof, inode=403), dict(proof, mountId=20), dict(proof, filesystemUuid=str(uuid.uuid4()))):
            with self.assertRaisesRegex(configuration.Rejected, "RESTORE_FILE_PATH_IDENTITY_CHANGED"):
                configuration.verify_restore_path_proofs(payload, {"paths": [changed]})
        config["pathIdentity"]["inode"] = 99
        with self.assertRaisesRegex(configuration.Rejected, "RESTORE_FILE_PATH_CANDIDATE_MISMATCH"):
            configuration.verify_restore_path_proofs(payload, {"paths": [dict(proof)]})


class RestoreAdmissionTests(unittest.TestCase):
    def attempt(self, connections, observation=None, busy_volumes=None):
        import configuration_preflight

        boot = configuration.RuntimeAdapter.restore_boot()
        instance, operation = str(uuid.uuid4()), str(uuid.uuid4())
        query = {"instanceUuid": instance, "protocol": "NFS", "action": "UPDATE",
                 "revision": 0, "drainrequired": True, "ports": [2049]}
        measured = {"memoryavailablebytes": 1024 ** 3, "filesystems": [], "load1": 0, "cpucount": 1,
                    "connections": connections, "busyvolumes": busy_volumes or [], "snapshotbytes": 0}
        report = observation or configuration_preflight.evaluate(query, measured)
        candidate = {"nfs export apply": {"enabled": True, "exports": []}}
        payload = {"operationid": operation, "instanceUuid": instance, "baseRevision": 0, "targetRevision": 1,
                   "restorePlanDigest": "a" * 64, "restoreBootId": boot, "before": candidate, "candidate": candidate,
                   "restoreVolumes": {"requireMatch": True, "volumes": [], "paths": []},
                   "restorePathProofs": [], "restoreAdmission": {"NFS": query}}
        with tempfile.TemporaryDirectory(prefix="restore-admission-") as tmp:
            root = Path(tmp)
            with ExitStack() as mocks:
                mocks.enter_context(patch.object(configuration, "observe_restore_volumes",
                                                 return_value={"bootId": boot, "paths": []}))
                mocks.enter_context(patch.object(configuration, "require_nfs_restore_binding"))
                mocks.enter_context(patch.object(configuration_preflight, "inspect", return_value=report))
                snapshot = mocks.enter_context(patch.object(configuration.RuntimeAdapter, "snapshot"))
                apply = mocks.enter_context(patch.object(configuration.RuntimeAdapter, "apply"))
                restore = mocks.enter_context(patch.object(configuration.RuntimeAdapter, "restore"))
                txn = configuration.Transaction(root)
                result = txn.execute("apply", payload)
                self.assertEqual("ROLLED_BACK", result["state"])
                self.assertEqual({"state": "NOT_NEEDED"}, result["rollback"])
                self.assertEqual(result["originalfailure"], txn.show(payload)["originalfailure"])
                self.assertFalse((root / instance / "revision.json").exists())
                snapshot.assert_not_called()
                apply.assert_not_called()
                restore.assert_not_called()
        return result["originalfailure"]

    def test_active_connections_are_rejected_before_snapshot_apply_or_revision(self):
        failure = self.attempt(3)
        self.assertEqual({"code": "DRAIN_REQUIRED", "phase": "PREFLIGHT", "started": False,
                          "protocol": "NFS", "blockingcodes": ["DRAIN_REQUIRED"]}, failure)
        self.assertEqual(["VOLUME_PREPARATION_ACTIVE", "DRAIN_REQUIRED"],
                         self.attempt(3, busy_volumes=["active"])["blockingcodes"])

    def test_online_result_cannot_override_restore_drain(self):
        failure = self.attempt(3, {"status": "READY", "checks": [],
                                   "impact": {"connections": 3, "drainrequired": False}})
        self.assertEqual("DRAIN_REQUIRED", failure["code"])
        failure = self.attempt(0, {"status": "READY", "checks": [],
                                   "impact": {"connections": 0, "drainrequired": False}})
        self.assertEqual("RESOURCE_OBSERVATION_UNAVAILABLE", failure["code"])


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="configuration-test-")
        self.root = Path(self.temp.name)
        self.instance = str(uuid.uuid4())
        self.operation = str(uuid.uuid4())
        self.calls = []
        self.runtime = {"value": "old"}
        self.failure = None
        self.rollback_failure = False
        outer = self
        class Adapter:
            def __init__(self, private):
                self.private = private
            def preflight(self, payload):
                outer.calls.append("preflight")
                if outer.failure == "VALIDATING":
                    raise configuration.Rejected("INVALID_CANDIDATE")
            def snapshot(self, payload):
                outer.calls.append("snapshot")
            def apply(self, candidate):
                outer.calls.append("apply")
                outer.runtime["value"] = "new"
                if outer.failure == "APPLYING":
                    raise configuration.Rejected("FIRST_FAILURE")
            def verify(self, candidate):
                outer.calls.append("verify")
                if outer.failure == "VERIFYING":
                    raise configuration.Rejected("FIRST_FAILURE")
            def restore(self):
                outer.calls.append("restore")
                if outer.rollback_failure:
                    raise configuration.Rejected("SECOND_FAILURE")
                outer.runtime["value"] = "old"
            def verify_restored(self):
                outer.calls.append("verify_restored")
                if outer.runtime["value"] != "old":
                    raise AssertionError("runtime differs")
            def is_running(self):
                return outer.failure == "RUNNING"
            def observe_completed(self):
                return "UNKNOWN"
        self.transaction = configuration.Transaction(self.root / "journal", Adapter)
        self.payload = {"instanceUuid": self.instance, "operationid": self.operation,
                        "baseRevision": 0, "targetRevision": 1,
                        "before": {"nfs export apply": {"exports": []}},
                        "candidate": {"nfs export apply": {"exports": []}}}

    def tearDown(self):
        self.temp.cleanup()

    def test_four_protocols_apply_failure_rolls_back_and_keeps_first_failure(self):
        for protocol in ("nfs export apply", "smb share apply", "iscsi target apply", "nvmeof subsystem apply"):
            with self.subTest(protocol=protocol):
                self.payload["operationid"] = str(uuid.uuid4())
                self.payload["candidate"] = {protocol: {"items": ["changed"]}}
                self.failure = "APPLYING"
                value = self.transaction.execute("apply", self.payload)
                self.assertEqual("ROLLED_BACK", value["state"])
                self.assertEqual("SUCCEEDED", value["rollback"]["state"])
                self.assertEqual("FIRST_FAILURE", value["originalfailure"]["code"])
                self.assertEqual("old", self.runtime["value"])
                self.assertEqual(value, self.transaction.show(self.payload))

    def test_duplicate_request_has_no_second_apply_even_with_changed_secret(self):
        self.payload["candidate"]["nfs export apply"]["password"] = "transient-one"
        first = self.transaction.execute("apply", self.payload)
        self.payload["candidate"]["nfs export apply"]["password"] = "transient-two"
        self.assertEqual(first, self.transaction.execute("apply", self.payload))
        self.assertEqual(1, self.calls.count("apply"))
        for file in (self.root / "journal").rglob("*"):
            if file.is_file():
                self.assertNotIn("transient-", file.read_text())

    def test_public_payload_conflict_rejected_without_mutation(self):
        self.transaction.execute("apply", self.payload)
        self.payload["candidate"]["nfs export apply"]["enabled"] = False
        with self.assertRaisesRegex(configuration.Rejected, "REQUEST_CONFLICT"):
            self.transaction.execute("apply", self.payload)
        self.assertEqual(1, self.calls.count("apply"))

    def test_verification_failure_and_failed_rollback_are_separate_after_reload(self):
        self.failure = "VERIFYING"
        self.rollback_failure = True
        value = self.transaction.execute("apply", self.payload)
        self.assertEqual("RECOVERY_REQUIRED", value["state"])
        reloaded = configuration.Transaction(self.root / "journal").show(self.payload)
        self.assertEqual("FIRST_FAILURE", reloaded["originalfailure"]["code"])
        self.assertEqual("SECOND_FAILURE", reloaded["rollback"]["code"])

    def test_preflight_failure_does_not_apply_or_restore(self):
        self.failure = "VALIDATING"
        value = self.transaction.execute("apply", self.payload)
        self.assertEqual("NOT_NEEDED", value["rollback"]["state"])
        self.assertEqual(["preflight"], self.calls)

    def test_getter_never_calls_adapter_or_mutates_journal(self):
        self.transaction.execute("apply", self.payload)
        calls = list(self.calls)
        before = {str(p): p.read_bytes() for p in (self.root / "journal").rglob("*") if p.is_file()}
        self.transaction.show(self.payload)
        self.assertEqual(calls, self.calls)
        self.assertEqual(before, {str(p): p.read_bytes() for p in (self.root / "journal").rglob("*") if p.is_file()})

    def test_revision_fence_and_verified_commit(self):
        self.transaction.execute("apply", self.payload)
        self.transaction.execute("commit", self.payload)
        stale = dict(self.payload, operationid=str(uuid.uuid4()))
        with self.assertRaisesRegex(configuration.Rejected, "REVISION_CONFLICT"):
            self.transaction.execute("apply", stale)
        self.assertEqual(1, self.calls.count("apply"))

    def test_new_attempt_is_blocked_while_previous_is_unresolved(self):
        self.transaction.execute("apply", self.payload)
        another = dict(self.payload, operationid=str(uuid.uuid4()))
        with self.assertRaisesRegex(configuration.Rejected, "RECOVERY_REQUIRED"):
            self.transaction.execute("apply", another)

    def test_unknown_or_live_apply_is_never_blindly_replayed_or_rolled_back(self):
        self.failure = "APPLYING"
        self.rollback_failure = True
        self.transaction.execute("apply", self.payload)
        self.failure = "RUNNING"
        calls = list(self.calls)
        value = self.transaction.execute("resume", self.payload)
        self.assertEqual("RECOVERY_REQUIRED", value["state"])
        self.assertEqual(calls, self.calls)

    def test_confirmed_failure_resumes_rollback_not_stale_candidate_success(self):
        self.failure = "VERIFYING"
        self.rollback_failure = True
        first = self.transaction.execute("apply", self.payload)
        self.assertEqual("RECOVERY_REQUIRED", first["state"])
        self.rollback_failure = False
        self.failure = None
        def invalid_observation(adapter):
            raise AssertionError("confirmed failure must not be reclassified from stale child success")
        self.transaction.adapter_factory.observe_completed = invalid_observation
        result = self.transaction.execute("resume", self.payload)
        self.assertEqual("ROLLED_BACK", result["state"])
        self.assertEqual("SUCCEEDED", result["rollback"]["state"])
        self.assertEqual(first["originalfailure"], result["originalfailure"])
        self.assertEqual("old", self.runtime["value"])

    def test_identity_traversal_rejected(self):
        self.payload["operationid"] = "../other"
        with self.assertRaises(configuration.Rejected):
            self.transaction.show(self.payload)


if __name__ == "__main__":
    unittest.main(verbosity=2)
