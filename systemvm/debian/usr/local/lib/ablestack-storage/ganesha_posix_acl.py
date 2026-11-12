# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
"""Observe the verified OS-level Ganesha VFS, independently of helper API versions."""
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess

PROFILE = Path("/etc/ablestack-storage/ganesha-posix-acl-profile.json")
UNSUPPORTED = "DIRECTORY_NFS_POSIX_ACL_UNSUPPORTED"
UNAVAILABLE = "DIRECTORY_NFS_POSIX_ACL_UNAVAILABLE"


def _protected(path):
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
        raise ValueError("unprotected asset")
    return info


def _sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _profile(path):
    if path.is_symlink() or _protected(path).st_size > 65536:
        raise ValueError("invalid profile")
    value = json.loads(path.read_text())
    if (not isinstance(value, dict) or not isinstance(value.get("assets"), dict)
            or not isinstance(value.get("verification"), dict)):
        raise ValueError("invalid profile structure")
    prefix = Path(value["prefix"])
    if (value.get("version") != 1 or value.get("posixAcl") is not True
            or not re.fullmatch(r"/opt/ablestack-ganesha/[A-Za-z0-9._-]+", str(prefix))
            or not re.fullmatch(r"[0-9a-f]{40}", value["sourceCommit"])
            or not all(value.get("verification", {}).get(k) is True
                       for k in ("namedAccess", "denyWrite", "defaultInheritance"))):
        raise ValueError("unverified profile")
    expected = {"bin/ganesha.nfsd", "lib/ganesha/libfsalvfs.so",
                "lib/libganesha_nfsd.so." + value["ganeshaVersion"], "lib/libntirpc.so.5.0"}
    if set(value["assets"]) != expected:
        raise ValueError("incomplete assets")
    for relative, digest in value["assets"].items():
        target = prefix / relative
        if target.is_symlink() or not target.resolve().is_relative_to(prefix.resolve()):
            raise ValueError("asset path changed")
        _protected(target)
        if not re.fullmatch(r"[0-9a-f]{64}", digest) or _sha(target) != digest:
            raise ValueError("asset content changed")
    module = prefix / "lib/ganesha/libfsalvfs.so"
    binary = module.read_bytes()
    if b"acl_get_fd" not in binary or b"acl_set_fd" not in binary:
        raise ValueError("POSIX ACL mapping missing")
    return value


def verify_process(profile, pid, proc=Path("/proc")):
    """Check executable and every private mapped library in the running server."""
    prefix = Path(profile["prefix"])
    process = proc / str(pid)
    if (process / "exe").resolve() != prefix / "bin/ganesha.nfsd":
        return False
    maps = (process / "maps").read_text()
    mapped = {parts[5] for line in maps.splitlines() if len(parts := line.split()) >= 6}
    return all(str(prefix / name) in mapped for name in profile["assets"] if name.startswith("lib/"))


def capability(units=None, profile_path=PROFILE):
    result = {"status": "BLOCKED", "code": UNSUPPORTED, "supported": False}
    try:
        if not profile_path.exists():
            return result
        value = _profile(profile_path)
        result["requiredversion"] = value["ganeshaVersion"]
        result["fingerprint"] = hashlib.sha256(json.dumps(
            {"sourceCommit": value["sourceCommit"], "assets": value["assets"]},
            sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        if units is None:
            query = subprocess.run(["systemctl", "list-units", "--state=active", "--no-legend", "--plain",
                                    "ablestack-storage-ganesha@*.service"],
                                   capture_output=True, text=True, timeout=5)
            if query.returncode:
                raise ValueError("unit observation unavailable")
            units = [{"unit": line.split()[0]} for line in query.stdout.splitlines() if line.strip()]
        for unit in units:
            state = subprocess.run(["systemctl", "show", "-p", "MainPID", "--value", unit["unit"]],
                                   capture_output=True, text=True, timeout=5)
            if state.returncode or not state.stdout.strip().isdecimal() or int(state.stdout.strip()) < 1:
                raise ValueError("listener unavailable")
            if not verify_process(value, int(state.stdout.strip())):
                result["code"] = UNSUPPORTED
                return result
        if not units:
            command = subprocess.run(["systemctl", "show", "-p", "ExecStart", "--value",
                                      "ablestack-storage-ganesha@capability-probe.service"],
                                     capture_output=True, text=True, timeout=5)
            if command.returncode or str(Path(value["prefix"]) / "bin/ganesha.nfsd") not in command.stdout:
                return result
        result.update(status="READY", version=value["ganeshaVersion"], code="DIRECTORY_NFS_POSIX_ACL_SUPPORTED", supported=True,
                      binarysha256=value["assets"]["bin/ganesha.nfsd"],
                      modulesha256=value["assets"]["lib/ganesha/libfsalvfs.so"], listeners=len(units))
        return result
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        result.update(status="UNKNOWN", code=UNAVAILABLE)
        return result


def not_applicable():
    return {"status": "NOT_APPLICABLE", "code": "DIRECTORY_NFS_POSIX_ACL_NOT_APPLICABLE", "supported": False}
