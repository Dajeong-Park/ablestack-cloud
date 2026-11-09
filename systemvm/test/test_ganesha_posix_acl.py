# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
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
from types import SimpleNamespace
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "debian/usr/local/lib/ablestack-storage"))
import ganesha_posix_acl as support


@unittest.skipUnless(os.geteuid() == 0, "protected asset checks require root-owned fixtures")
class FsalCapability(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.prefix = Path("/opt/ablestack-ganesha") / ("issue1465-test-" + str(uuid.uuid4()))
        self.assets = {"bin/ganesha.nfsd": b"executable", "lib/ganesha/libfsalvfs.so": b"acl_get_fd acl_set_fd",
                       "lib/libganesha_nfsd.so.5.5.3": b"core", "lib/libntirpc.so.5.0": b"rpc"}
        for name, data in self.assets.items():
            target = self.prefix / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o644)
        self.profile = self.root / "profile.json"
        self.value = {"version": 1, "prefix": str(self.prefix), "ganeshaVersion": "5.5.3", "sourceCommit": "a" * 40,
                      "posixAcl": True, "verification": {"namedAccess": True, "denyWrite": True, "defaultInheritance": True},
                      "assets": {name: hashlib.sha256(data).hexdigest() for name, data in self.assets.items()}}
        self.write_profile()

    def write_profile(self):
        self.profile.write_text(json.dumps(self.value))
        self.profile.chmod(0o644)

    def tearDown(self):
        self.assertEqual(Path("/opt/ablestack-ganesha"), self.prefix.parent)
        self.assertTrue(self.prefix.name.startswith("issue1465-test-"))
        shutil.rmtree(self.prefix)
        self.temp.cleanup()

    def test_version_claim_without_profile_is_blocked(self):
        result = support.capability([], self.root / "absent")
        self.assertFalse(result["supported"])
        self.assertEqual("BLOCKED", result["status"])

    def test_hash_tamper_or_unprotected_assets_cannot_become_ready(self):
        target = self.prefix / "lib/ganesha/libfsalvfs.so"
        target.write_bytes(b"changed")
        self.assertEqual("UNKNOWN", support.capability([], self.profile)["status"])
        target.write_bytes(self.assets["lib/ganesha/libfsalvfs.so"])
        target.chmod(0o666)
        self.assertFalse(support.capability([], self.profile)["supported"])

    def test_incomplete_native_probe_or_missing_acl_symbols_cannot_become_ready(self):
        self.value["verification"]["denyWrite"] = False
        self.write_profile()
        self.assertEqual("UNKNOWN", support.capability([], self.profile)["status"])
        self.value["verification"]["denyWrite"] = True
        target = self.prefix / "lib/ganesha/libfsalvfs.so"
        target.write_bytes(b"without-posix-conversion")
        self.value["assets"]["lib/ganesha/libfsalvfs.so"] = hashlib.sha256(target.read_bytes()).hexdigest()
        self.write_profile()
        self.assertFalse(support.capability([], self.profile)["supported"])

    def test_running_old_executable_or_foreign_library_is_blocked(self):
        proc = self.root / "proc"
        process = proc / "123"
        process.mkdir(parents=True)
        (process / "exe").symlink_to(self.prefix / "bin/ganesha.nfsd")
        mapped = [f"1-2 r-xp 0 00:00 1 {self.prefix / n}" for n in self.assets if n.startswith("lib/")]
        (process / "maps").write_text("\n".join(mapped))
        profile = support._profile(self.profile)
        self.assertTrue(support.verify_process(profile, 123, proc))
        (process / "maps").write_text("\n".join(mapped[:-1]))
        self.assertFalse(support.verify_process(profile, 123, proc))
        (process / "exe").unlink()
        (process / "exe").symlink_to("/usr/bin/ganesha.nfsd")
        self.assertFalse(support.verify_process(profile, 123, proc))

    def test_active_unit_must_match_the_protected_profile_and_process(self):
        unit = [{"unit": "ablestack-storage-ganesha@2049.service"}]
        with patch.object(support.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="123\n")), \
                patch.object(support, "verify_process", return_value=False):
            self.assertEqual("BLOCKED", support.capability(unit, self.profile)["status"])
        with patch.object(support.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="123\n")), \
                patch.object(support, "verify_process", return_value=True):
            result = support.capability(unit, self.profile)
            self.assertEqual("READY", result["status"])
            self.assertTrue(result["supported"])
            self.assertEqual(64, len(result["fingerprint"]))

    def test_inactive_or_unobservable_unit_remains_unknown(self):
        with patch.object(support.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="0\n")):
            self.assertEqual("UNKNOWN", support.capability([{"unit": "test.service"}], self.profile)["status"])
        with patch.object(support.subprocess, "run", side_effect=subprocess.TimeoutExpired("systemctl", 5)):
            self.assertFalse(support.capability([{"unit": "test.service"}], self.profile)["supported"])

    def test_no_active_listener_requires_the_installed_unit_command_to_match(self):
        with patch.object(support.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="/usr/bin/ganesha.nfsd")):
            self.assertFalse(support.capability([], self.profile)["supported"])
        with patch.object(support.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=str(self.prefix / "bin/ganesha.nfsd"))):
            self.assertTrue(support.capability([], self.profile)["supported"])
