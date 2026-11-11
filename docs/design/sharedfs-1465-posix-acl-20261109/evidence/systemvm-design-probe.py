# #1465 design-only native experiment. No active policy or protocol configuration changes.
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid

sys.path.insert(0, "/usr/local/lib/ablestack-storage")
import shared_directory_policy as deployed

volume = Path("/srv/ablestack-storage/volumes/c14a6445-6de0-433a-b4df-fde4aca852ba")
mount = json.loads(subprocess.check_output(["findmnt", "-J", "-M", str(volume), "-o", "TARGET,UUID,FSTYPE,SOURCE"]))["filesystems"][0]
assert mount["uuid"] == "eb2e98ae-2c46-4935-8e5f-2c90e1401750"
assert mount["fstype"] == "xfs"
desired = Path("/etc/ablestack-storage/desired-state")
def state():
    result = {}
    for p in sorted(desired.glob("*")):
        if p.is_file():
            result[str(p)] = hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted((volume / "export/compute1464").rglob("*")):
        if p.is_file():
            s = p.stat()
            result[str(p)] = [hashlib.sha256(p.read_bytes()).hexdigest(),s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode)]
    return result

original = state()
private = Path(tempfile.mkdtemp(prefix="issue1465-design-",dir="/run"))
root = volume / (".issue1465-design-" + str(uuid.uuid4()))
root.mkdir(mode=0o755)
engine = deployed.DirectoryPolicies(registry=private/"registry.json",managed=volume.parent,
    desired=private/"desired",configs=private/"configs",refresh=lambda units: None,protocol_check=lambda value: None)
results = {}
def acl(path):
    return subprocess.check_output(["getfacl","-cpn",str(path)]).decode()
def command(args):
    subprocess.run(args,check=True,capture_output=True)
def signature(path):
    s=path.stat()
    return [s.st_ino,s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),acl(path)]
try:
    target = root/"team"
    target.mkdir(mode=0o770)
    old = target/"old.txt"
    old.write_bytes(b"issue1465-existing-data")
    old.chmod(0o640)
    before_file = [signature(old),hashlib.sha256(old.read_bytes()).hexdigest()]
    row = {"uuid":"design-only","config":{"volumeMountPath":str(volume),"backingPath":str(target),"filesystemUuid":mount["uuid"]}}
    observed=engine.observe(row)
    assert observed["status"]=="OBSERVED"
    assert observed["filesystemuuid"]==mount["uuid"]
    p={k:observed[k] for k in ("volumeuuid","canonicalpath","filesystemuuid","inode","owneruid","ownergid","mode")}
    p.update(uuid=str(uuid.uuid4()),revision=1)
    value={"action":"ADOPT","policy":p,"changes":{},"units":[],"expectedObservation":observed["fingerprint"],"smbShares":[]}
    engine.apply(value,engine.snapshot(value))
    before=signature(target)
    # Kernel experiment for the proposed ACL delta, not a product API or active registry write.
    command(["setfacl","-n","-m","u:65534:rwx,m::rwx",str(target)])
    command(["setfacl","-n","-d","-m","u::rwx,u:65534:r-x,g::rwx,m::rwx,o::---",str(target)])
    text=acl(target)
    assert "user:65534:rwx" in text and "default:user:65534:r-x" in text
    results["separateAccessDefault"]=True
    # Applying mode alters the ACL mask. Admission must show all effective changes.
    command(["chmod","0750",str(target)])
    assert "mask::r-x" in acl(target) and "user:65534:rwx" in acl(target)
    results["maskChangesEffectivePermission"]=True
    try:
        deployed.DirectoryPolicies.compatible({("u",65534):7},0,0o750)
        raise AssertionError("mask conflict was not blocked")
    except deployed.PolicyError as e:
        assert e.code=="DIRECTORY_ACL_MASK_CONFLICT"
    results["existingMaskProtection"]=True
    # Roll back native change with full access/default snapshot and exact mode.
    command(["setfacl","-k",str(target)])
    subprocess.run(["setfacl","--set-file=-",str(target)],input=before[4].encode(),check=True,capture_output=True)
    target.chmod(before[3])
    assert signature(target)==before
    results["nativeFullAclRollback"]=True

    # Existing transaction owns one directory only and restores complete ACL.
    p2={**p,"revision":2,"mode":"2770","ownergid":65001}
    update={"action":"UPDATE","policy":p2,"changes":{"mode":"2770","ownerGid":65001},"expectedPolicyRevision":1,
        "expectedObservation":engine.observe(row)["fingerprint"],"units":[],"smbShares":[]}
    snap=engine.snapshot(update)
    assert len(snap["entries"])==1
    counts=[]
    engine.apply(update,snap,counts.append)
    assert stat.S_IMODE(target.stat().st_mode)==0o2770
    assert [signature(old),hashlib.sha256(old.read_bytes()).hexdigest()]==before_file
    engine.restore(snap,max(counts))
    assert signature(target)==before
    results["deployedTransactionNonrecursiveRollback"]=True

    # Native setgid/default ACL inheritance and real unprivileged identity.
    os.chown(target,0,65001)
    target.chmod(0o2770)
    command(["setfacl","-n","-m","u:65534:rwx,m::rwx",str(target)])
    command(["setfacl","-n","-d","-m","u::rwx,u:65002:r-x,g::rwx,m::rwx,o::---",str(target)])
    with engine.opened(volume,str(target.relative_to(volume)),target.stat().st_ino) as fd:
        script="import os,sys;os.fchdir(int(sys.argv[1]));os.setgroups([65001]);os.setgid(65534);os.setuid(65534);open('new.txt','w').write('new-object');os.mkdir('newdir')"
        subprocess.run([sys.executable,"-c",script,str(fd)],pass_fds=(fd,),check=True,capture_output=True)
    assert (target/"new.txt").stat().st_gid==65001
    assert (target/"newdir").stat().st_gid==65001
    assert stat.S_IMODE((target/"newdir").stat().st_mode)&0o2000
    assert "default:user:65002:r-x" in acl(target/"newdir")
    assert "user:65002:r-x" in acl(target/"newdir")
    assert [signature(old),hashlib.sha256(old.read_bytes()).hexdigest()]==before_file
    results["kernelSetgidAndDefaultInheritance"]=True
    results["newObjectsOnlyExistingChildPreserved"]=True

    # Large numeric AD-style IDs are valid in the filesystem but rejected by current contract.
    command(["setfacl","-n","-m","u:100001:r-x",str(target)])
    assert "user:100001:r-x" in acl(target)
    try:
        deployed.fields({"ownerUid":100001})
        raise AssertionError("expected current 16-bit field limit")
    except deployed.PolicyError as e:
        assert e.code=="DIRECTORY_POLICY_INVALID"
    results["numericIdAbove65535Confirmed"]=True

    # Same inode, changed ACL must invalidate approval.
    fingerprint=engine.observe(row)["fingerprint"]
    command(["setfacl","-n","-m","u:100001:r--",str(target)])
    assert engine.observe(row)["fingerprint"]!=fingerprint
    results["aclMutationInvalidatesApproval"]=True

    link=root/"link"
    link.symlink_to(target,target_is_directory=True)
    try:
        with engine.opened(volume,str(link.relative_to(volume)),target.stat().st_ino):
            raise AssertionError("symlink traversal accepted")
    except OSError:
        results["symlinkBlocked"]=True
    try:
        with engine.opened(volume,"../escape"):
            raise AssertionError("parent traversal accepted")
    except deployed.PolicyError:
        results["parentEscapeBlocked"]=True
    boundary=root/"boundary"
    boundary.mkdir()
    command(["mount","-t","tmpfs","-o","size=1m","issue1465-design",str(boundary)])
    try:
        with engine.opened(volume,str(boundary.relative_to(volume))):
            raise AssertionError("nested mount accepted")
    except deployed.PolicyError:
        results["differentMountBlocked"]=True
    finally:
        command(["umount",str(boundary)])
    # Same-device bind mounts need mount identity beyond st_dev/inode.
    alias=root/"same-device-bind"
    alias.mkdir()
    command(["mount","--bind",str(target),str(alias)])
    try:
        with engine.opened(volume,str(alias.relative_to(volume)),target.stat().st_ino) as observed_fd:
            root_fd=os.open(volume,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
            try:
                def mount_id(fd):
                    return next(line.split()[1] for line in Path("/proc/self/fdinfo/"+str(fd)).read_text().splitlines() if line.startswith("mnt_id:"))
                assert os.fstat(root_fd).st_dev==os.fstat(observed_fd).st_dev
                assert mount_id(root_fd)!=mount_id(observed_fd)
                results["sameDeviceBindNeedsMountIdCheck"]=True
                results["proposedFdMountGuardRejectsBind"]=True
            finally:
                os.close(root_fd)
    finally:
        command(["umount",str(alias)])
    # Synthetic NFS/SMB reference grouping goes through the real deployed observation path.
    refs=engine.inspect([{**row,"protocol":"NFS","name":"nfs-design"},{**row,"uuid":"design-smb","protocol":"SMB","name":"smb-design"}])
    assert len(refs)==1 and len(refs[0]["references"])==2
    results["samePhysicalDirectoryCommonObservation"]=True
    preserved=signature(target)
    policies=engine.read()
    assert p["uuid"] in policies
    del policies[p["uuid"]]
    engine.write(policies)
    assert p["uuid"] not in engine.read()
    assert signature(target)==preserved
    results["privateRegistryRemovalKeepsDirectoryAndAcl"]=True
    final=state()
    assert final==original
    results["existingDesiredAndPublishedFilesUnchanged"]=True
    print(json.dumps({"kind":"design-only-SystemVM-native-experiment","filesystem":mount,"results":results,
        "limits":["No product API implementation","AD numeric-ID experiment is not live AD authorization","No network NFS/SMB acceptance claimed"],
        "cleanup":"temporary directory and private registry removed in finally"},sort_keys=True))
finally:
    # Cleanup is confined to exact generated test paths.
    assert root.parent==volume and root.name.startswith(".issue1465-design-")
    assert private.parent==Path("/run") and private.name.startswith("issue1465-design-")
    shutil.rmtree(root)
    shutil.rmtree(private)
