#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
"""Install a native-tested Ganesha build for managed SharedFS listeners."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def verify(profile, prefix):
    if profile.get("version") != 1 or profile.get("posixAcl") is not True:
        raise ValueError("Invalid POSIX ACL profile")
    if not all(profile.get("verification", {}).get(k) is True
               for k in ("namedAccess", "denyWrite", "defaultInheritance")):
        raise ValueError("Actual SystemVM network verification is required")
    names = {"bin/ganesha.nfsd", "lib/ganesha/libfsalvfs.so",
             "lib/libganesha_nfsd.so." + profile["ganeshaVersion"], "lib/libntirpc.so.5.0"}
    if set(profile["assets"]) != names:
        raise ValueError("Incomplete native assets")
    for name, expected in profile["assets"].items():
        source = prefix / name
        info = source.stat()
        if source.is_symlink() or not source.is_file() or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("Native asset ownership or permissions changed")
        if digest(source) != expected:
            raise ValueError("Native asset digest mismatch")
    module = (prefix / "lib/ganesha/libfsalvfs.so").read_bytes()
    if b"acl_get_fd" not in module or b"acl_set_fd" not in module:
        raise ValueError("POSIX ACL conversion was not compiled")

def atomic(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".installing")
    with temporary.open("wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.chmod(mode)
    os.replace(temporary, path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("profile", type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise PermissionError("Root is required")
    profile = json.loads(args.profile.read_text())
    prefix = Path(profile["prefix"])
    if not re.fullmatch(r"/opt/ablestack-ganesha/[A-Za-z0-9._-]+", str(prefix)):
        raise ValueError("Invalid installation prefix")
    prefix.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".issue1465-stage-", dir=prefix.parent))
    try:
        with tarfile.open(args.archive) as archive:
            for member in archive:
                name = Path(member.name)
                if (name.is_absolute() or ".." in name.parts or not member.name.startswith(str(prefix).lstrip("/") + "/")
                        or not (member.isfile() or member.isdir() or member.issym())
                        or member.issym() and (Path(member.linkname).is_absolute() or ".." in Path(member.linkname).parts)):
                    raise ValueError("Unsafe native package path")
            archive.extractall(stage)
        staged = stage / str(prefix).lstrip("/")
        verify(profile, staged)
        if prefix.exists():
            verify(profile, prefix)
        else:
            os.replace(staged, prefix)
        command = str(prefix / "bin/ganesha.nfsd")
        override = ("# Managed SharedFS native POSIX ACL engine\n"
                    "[Service]\nEnvironment=LD_LIBRARY_PATH=" + str(prefix / "lib") +
                    "\nExecStart=\nExecStart=" + command +
                    " -F -p /run/ablestack-storage/ganesha/%i.pid"
                    " -L /run/ablestack-storage/ganesha/%i.log"
                    " -f /etc/ganesha/ablestack-storage/%i.conf\n")
        target = Path("/etc/systemd/system/ablestack-storage-ganesha@.service.d/20-posix-acl.conf")
        if target.exists() and not target.read_text().startswith("# Managed SharedFS native POSIX ACL engine"):
            raise ValueError("Existing operator override requires separate handling")
        atomic(Path("/etc/ablestack-storage/ganesha-posix-acl-profile.json"),
               (json.dumps(profile, indent=2) + "\n").encode())
        atomic(target, override.encode())
        subprocess.run(["systemctl", "daemon-reload"], check=True)
        print(json.dumps({"prefix": str(prefix), "assetsVerified": True, "serviceRestarted": False,
                          "nextAction": "Restart the test SystemVM through Mold UI"}))
    finally:
        assert stage.parent == prefix.parent and stage.name.startswith(".issue1465-stage-")
        shutil.rmtree(stage)

if __name__ == "__main__":
    main()
