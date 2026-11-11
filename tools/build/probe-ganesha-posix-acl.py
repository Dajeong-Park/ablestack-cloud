#!/usr/bin/env python3
# Licensed under the Apache License, Version 2.0. See NOTICE.
"""Attest a pinned native Ganesha using real NFS I/O on a fresh SPARSE test FS."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time

SOURCE = "2a57b6d53295426247b200cd100ba0741b12aff9"
PREFIX = Path("/opt/ablestack-ganesha/5.5.3-posix-acl")
ASSETS = ("bin/ganesha.nfsd", "lib/ganesha/libfsalvfs.so",
          "lib/libganesha_nfsd.so.5.5.3", "lib/libntirpc.so.5.0")


def run(args, **kwargs):
    try:
        return subprocess.run(args, check=True, capture_output=True, timeout=kwargs.pop("timeout", 30), **kwargs)
    except subprocess.CalledProcessError as error:
        for output in (error.stdout, error.stderr):
            if output:
                print(output.decode(errors="replace") if isinstance(output, bytes) else output, file=sys.stderr)
        raise


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def profile(prefix):
    if prefix != PREFIX or prefix.is_symlink():
        raise ValueError("Unexpected native build prefix")
    assets = {}
    for name in ASSETS:
        path = prefix / name
        info = path.stat()
        if path.is_symlink() or not path.resolve().is_relative_to(prefix.resolve()):
            raise ValueError("Unsafe native asset")
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("Native asset ownership/mode differs")
        assets[name] = digest(path)
    binary = (prefix / "lib/ganesha/libfsalvfs.so").read_bytes()
    if b"acl_get_fd" not in binary or b"acl_set_fd" not in binary:
        raise ValueError("Native VFS lacks POSIX ACL support")
    return dict(version=1, prefix=str(prefix), ganeshaVersion="5.5.3", posixAcl=True,
                sourceCommit=SOURCE, assets=assets)


def inside(root, prefix):
    probe_sha = digest(Path(__file__))
    # Private /run avoids every existing RPC/systemd listener. The ext4 image
    # and loop mount are test-only; no configured SharedFS DATA path is touched.
    run(["mount", "-t", "tmpfs", "-o", "size=16m,mode=0755", "sharedfs-probe", "/run"])
    Path("/run/rpcbind").mkdir()
    run(["ip", "link", "set", "lo", "up"])
    # Ganesha's local-address initialization expects a non-loopback address;
    # it remains private to this probe's network namespace.
    run(["ip", "link", "add", "sharedfs-probe", "type", "dummy"])
    run(["ip", "addr", "add", "192.0.2.1/32", "dev", "sharedfs-probe"])
    run(["ip", "link", "set", "sharedfs-probe", "up"])
    volume = root / "data"
    volume.mkdir()
    run(["mount", "-o", "loop", str(root / "data.sparse"), str(volume)])
    control = root / "control"
    control.mkdir(mode=0o755)
    share = volume / "share"
    share.mkdir(mode=0o2770)
    os.chown(share, 100001, 100001)
    share.chmod(0o2770)
    original = share / "original"
    original.write_bytes(b"sharedfs-native-build-preserve")
    os.chown(original, 65534, 65534)
    original.chmod(0o640)
    run(["setfacl", "-n", "-m", "u:65534:rwx,u:100002:r-x,m::rwx", str(share)])
    run(["setfacl", "-n", "-d", "-m", "u::rwx,u:100002:r-x,g::rwx,m::rwx,o::---", str(share)])
    config = control / "ganesha.conf"
    config.write_text("""NFS_Core_Param {
 NFS_Port=2055; Bind_addr=127.0.0.1; Protocols=4;
 Enable_NLM=false; Enable_RQUOTA=false;
 Plugins_Dir=""" + str(prefix / "lib/ganesha") + """;
 Dbus_Name_Prefix=sharedfs_build_probe;
}
NFSV4 {
 Grace_Period=5; Allow_Numeric_Owners=true; Only_Numeric_Owners=false;
 RecoveryBackend=fs; RecoveryRoot=""" + str(control / "recovery") + """;
}
EXPORT_DEFAULTS { Access_Type=None; Protocols=4; Transports=TCP; SecType=sys; }
EXPORT {
 Export_Id=62000; Path=""" + str(share) + """; Pseudo=/native-probe;
 Protocols=4; Transports=TCP; Access_Type=None; Squash=Root_Squash; SecType=sys;
 Anonymous_uid=65534; Anonymous_gid=65534;
 FSAL { Name=VFS; }
 CLIENT { Clients=127.0.0.1/32; Access_Type=RW; Squash=Root_Squash; Anonymous_uid=65534; Anonymous_gid=65534; }
}
""")
    rpc = subprocess.Popen(["/usr/sbin/rpcbind", "-f"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log = (control / "stderr.log").open("wb")
    server = subprocess.Popen([str(prefix / "bin/ganesha.nfsd"), "-F", "-x", "-p", str(control / "pid"),
                               "-L", str(control / "ganesha.log"), "-f", str(config)],
                              env={**os.environ, "LD_LIBRARY_PATH": str(prefix / "lib")}, stdout=log, stderr=log)
    client = control / "client"
    client.mkdir()
    mounted = False
    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError("Native probe server exited: " + (control / "ganesha.log").read_text()[-4000:])
            try:
                with socket.create_connection(("127.0.0.1", 2055), timeout=.1):
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Native probe listener unavailable")
        run(["mount", "-t", "nfs4", "-o", "vers=4.1,proto=tcp,port=2055", "127.0.0.1:/native-probe", str(client)])
        mounted = True
        before = (original.stat().st_ino, original.stat().st_uid, original.stat().st_gid,
                  stat.S_IMODE(original.stat().st_mode), digest(original))
        if (client / "original").read_bytes() != b"sharedfs-native-build-preserve":
            raise RuntimeError("Native probe original read differs")
        (client / "newfile").write_bytes(b"sharedfs-native-build-acl")
        (client / "newdir").mkdir()
        if (share / "newfile").stat().st_gid != 100001 or not (share / "newdir").stat().st_mode & 0o2000:
            raise RuntimeError("Native probe setgid inheritance failed")
        allowed = run(["setpriv", "--reuid=100002", "--regid=100002", "--clear-groups", "cat", str(client / "newfile")])
        if allowed.stdout != b"sharedfs-native-build-acl":
            raise RuntimeError("Named principal access failed")
        denied = subprocess.run(["setpriv", "--reuid=100002", "--regid=100002", "--clear-groups",
                                 "touch", str(client / "denied")], capture_output=True, timeout=10)
        if denied.returncode == 0 or (share / "denied").exists():
            raise RuntimeError("Read-only principal gained write access")
        old = subprocess.run(["setpriv", "--reuid=100002", "--regid=100002", "--clear-groups",
                              "cat", str(client / "original")], capture_output=True, timeout=10)
        after = (original.stat().st_ino, original.stat().st_uid, original.stat().st_gid,
                 stat.S_IMODE(original.stat().st_mode), digest(original))
        if old.returncode == 0 or before != after:
            raise RuntimeError("Original file permissions/data changed")
        maps = (Path("/proc") / str(server.pid) / "maps").read_text()
        if not all(str(prefix / name) in maps for name in ASSETS if name.startswith("lib/")):
            raise RuntimeError("Unexpected running FSAL/libraries")
        value = profile(prefix)
        value["verification"] = dict(namedAccess=True, denyWrite=True, defaultInheritance=True)
        value["probeSha256"] = probe_sha
        print(json.dumps(value, sort_keys=True))
    finally:
        if mounted:
            run(["umount", str(client)])
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
        rpc.terminate()
        rpc.wait(timeout=10)
        log.close()
        run(["umount", str(volume)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", type=Path, default=PREFIX)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--inside", type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise PermissionError("Native image probe requires root in the image guest")
    profile(args.prefix)
    if args.inside:
        inside(args.inside, args.prefix)
        return
    if not args.profile:
        raise ValueError("--profile output is required")
    with tempfile.TemporaryDirectory(prefix="sharedfs-native-probe-", dir="/var/tmp") as directory:
        root = Path(directory)
        root.chmod(0o755)
        with (root / "data.sparse").open("wb") as stream:
            stream.truncate(64 * 1024 * 1024)
        run(["mkfs.ext4", "-q", "-F", str(root / "data.sparse")])
        result = run(["unshare", "--net", "--mount", "--propagation", "private", "--fork",
                      sys.executable, str(Path(__file__).resolve()), "--prefix", str(args.prefix),
                      "--inside", str(root)], timeout=120, text=True)
        value = json.loads(result.stdout)
        if value["verification"] != dict(namedAccess=True, denyWrite=True, defaultInheritance=True):
            raise ValueError("Native network probe incomplete")
        args.profile.write_text(json.dumps(value, indent=2) + "\n")
        args.profile.chmod(0o644)
        print(json.dumps(dict(nativeProbe="PASS", sparseBytes=64 * 1024 * 1024,
                              verification=value["verification"], assets=value["assets"])))


if __name__ == "__main__":
    main()
