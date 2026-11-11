# Licensed under the Apache License, Version 2.0. See NOTICE.
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import tempfile
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("native_image_verifier", ROOT / "tools/build/verify-storage-runtime-template.py")
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

def fixture(root):
    prefix = "/opt/ablestack-ganesha/5.5.3-posix-acl"
    assets = {}
    for name in ("bin/ganesha.nfsd", "lib/ganesha/libfsalvfs.so",
                 "lib/libganesha_nfsd.so.5.5.3", "lib/libntirpc.so.5.0"):
        path = root / prefix.lstrip("/") / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(("unit-fixture:" + name).encode())
        path.chmod(0o644)
        assets[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    profile = dict(version=1, prefix=prefix, ganeshaVersion="5.5.3", posixAcl=True,
                   sourceCommit="2a57b6d53295426247b200cd100ba0741b12aff9", assets=assets,
                   verification=dict(namedAccess=True, denyWrite=True, defaultInheritance=True))
    file = root / "etc/ablestack-storage/ganesha-posix-acl-profile.json"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(profile))
    file.chmod(0o644)
    unit = root / "etc/systemd/system/ablestack-storage-ganesha@.service.d/20-posix-acl.conf"
    unit.parent.mkdir(parents=True, exist_ok=True)
    unit.write_text("[Service]\nEnvironment=LD_LIBRARY_PATH=" + prefix + "/lib\nExecStart=\nExecStart=" + prefix + "/bin/ganesha.nfsd -F\n")
    unit.chmod(0o644)
    return file, profile


@unittest.skipUnless(os.geteuid() == 0, "Requires root-owned isolated fixtures")
class NativeImage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.file, self.profile = fixture(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_actual_image_verifier_requires_asset_integrity_and_unit(self):
        self.assertTrue(verifier.verify_native(self.root)["nativePosixAclVerified"])
        asset = self.root / self.profile["prefix"].lstrip("/") / "bin/ganesha.nfsd"
        asset.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "digest differs"):
            verifier.verify_native(self.root)

    def test_missing_or_unverified_profile_is_not_accepted(self):
        self.profile["verification"]["denyWrite"] = False
        self.file.write_text(json.dumps(self.profile))
        with self.assertRaisesRegex(ValueError, "incomplete"):
            verifier.verify_native(self.root)
        self.file.unlink()
        with self.assertRaises(FileNotFoundError):
            verifier.verify_native(self.root)

    def test_foreign_unit_and_writable_profile_are_rejected(self):
        unit = self.root / "etc/systemd/system/ablestack-storage-ganesha@.service.d/20-posix-acl.conf"
        unit.write_text("ExecStart=/usr/bin/ganesha.nfsd -F")
        with self.assertRaisesRegex(ValueError, "unit differs"):
            verifier.verify_native(self.root)
        self.file.chmod(0o666)
        with self.assertRaisesRegex(ValueError, "unsafe"):
            verifier.verify_native(self.root)

    def test_canonical_packer_path_includes_native_build_after_cloud_install(self):
        config = json.loads((ROOT / "tools/appliance/systemvmtemplate/template-base_x86_64-target_x86_64.json").read_text())
        scripts = config["provisioners"][0]["scripts"]
        self.assertLess(scripts.index("scripts/configure_systemvm_services.sh"), scripts.index("scripts/install_sharedfs_ganesha.sh"))
        self.assertLess(scripts.index("scripts/install_sharedfs_ganesha.sh"), scripts.index("scripts/cleanup.sh"))
        packaging = (ROOT / "tools/appliance/shar_cloud_scripts.sh").read_text()
        self.assertIn("probe-ganesha-posix-acl.py", packaging)
        installer = (ROOT / "tools/appliance/systemvmtemplate/scripts/install_sharedfs_ganesha.sh").read_text()
        self.assertLess(installer.index("python3 \"$helpers/probe-ganesha-posix-acl.py\""), installer.index("python3 \"$helpers/install-ganesha-posix-acl.py\""))

    def test_image_account_randomization_never_exposes_secret_in_xtrace(self):
        marker = "GENERATED_NATIVE_IMAGE_TEST_MARKER"
        script = r'''source "$1"
rm() { :; }
chpasswd() { cat >/dev/null; }
# The real randomizer invokes openssl with -base64 32, so use a constant fixture.
openssl() { printf %s GENERATED_NATIVE_IMAGE_TEST_MARKER; }
configure_misc
echo AFTER_RANDOMIZER
'''
        result = subprocess.run(["bash", "-c", script, "native-image-test",
                                 str(ROOT / "tools/appliance/systemvmtemplate/scripts/finalize.sh")],
                                capture_output=True, text=True, check=True)
        self.assertNotIn(marker, result.stdout + result.stderr)
        self.assertIn("+ echo AFTER_RANDOMIZER", result.stderr)
