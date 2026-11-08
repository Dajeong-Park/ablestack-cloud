#!/usr/bin/env python3
# Licensed under the Apache License, Version 2.0. See NOTICE.
# Explicit opt-in native reload regression on a disposable SharedFS VM only.
import argparse
parser=argparse.ArgumentParser()
for name in ('vm-uuid','instance-uuid','helper','request','seed-root'):parser.add_argument('--'+name,required=True)
parser.add_argument('--expect-baseline-failure',action='store_true')
parser.add_argument('--expect-missing-reference',action='store_true')
args=parser.parse_args()
import copy,fcntl,hashlib,importlib.util,json,os,sys,tempfile,urllib.request,uuid
from pathlib import Path
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==args.vm_uuid.lower()
release=Path('/opt/ablestack/storage-runtime/current').resolve();sys.path.insert(0,str(release/'lib/ablestack-storage'))
import nfs_client_policy_runtime as baseline
import boot_reconcile
from shared_directory_policy import DirectoryPolicies
stage=Path(tempfile.mkdtemp(prefix='issue1462-nfs-reference-pre-',dir='/var/tmp'));stage.chmod(0o700)
candidate=Path(args.helper).resolve();assert candidate.is_file()
spec=importlib.util.spec_from_file_location('reference_proposal',candidate);fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
path=Path(args.request)
request=json.loads(path.read_text());request['operationid']=str(uuid.uuid4())
assert request['instanceUuid']==args.instance_uuid.lower()
root=stage/'private';root.mkdir(mode=0o700)
engine=fixed.ClientPolicies(root)
saved=engine.desired.read_bytes()
source=Path(args.seed_root).resolve()
assert str(source).startswith('/srv/ablestack-storage/volumes/')
def protected():
 s=source.stat()
 return {'inode':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':s.st_mode&0o7777,
 'acl':hashlib.sha256(__import__('subprocess').check_output(['getfacl','-cpn',str(source)])).hexdigest(),
 'data':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()}}
connections=__import__('subprocess').check_output(['ss','-Htn','state','established'],text=True).splitlines()
assert not any(any(line.split()[2].endswith(':'+str(port)) for port in (2049,2050,445,3261,4421)) for line in connections)
before=protected();code_before=hashlib.sha256((release/'lib/ablestack-storage/nfs_client_policy_runtime.py').read_bytes()).hexdigest()
leases=[];snapshot=None;applying=False
try:
 for p in [Path('/run/lock/ablestack-storage-runtime-upgrade.lock'),Path('/run/lock/ablestack-storage-boot-reconcile.lock'),Path('/var/lib/ablestack-storage/configuration-operations')/request['instanceUuid']/'lock']:
  f=p.open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 boot_reconcile.Runtime().eligibility(request['instanceUuid'])
 if args.expect_baseline_failure:
  try:baseline.ClientPolicies(root).snapshot(request);raise AssertionError('baseline unexpectedly accepted')
  except baseline.PolicyError as e:assert e.code=='NFS_CLIENT_DESIRED_CHANGED',e.code
 preview=fixed.preview_client_intent(request['preflight'],engine)
 fixed.require_client_intent(request,engine)
 snapshot=engine.snapshot(request)
 assert preview['configs']==engine.rendered(snapshot['value'])
 if args.expect_missing_reference:assert 'directoryPolicyUuid' not in json.loads(saved)['exports'][0]['config']
 assert snapshot['value']['exports'][0]['config']['directoryPolicyUuid']==request['before'][fixed.OP]['exports'][0]['config']['directoryPolicyUuid']
 policies=DirectoryPolicies();registry=policies.read();negatives=[]
 for field,value in [('uuid',str(uuid.uuid4())),('revision',0),('filesystemuuid',str(uuid.uuid4())),('inode',1),('owneruid',1),('ownergid',1),('mode','0700')]:
  wrong=copy.deepcopy(registry);wrong['906b1ffc-2e66-336d-a49e-4066a998a670'][field]=value
  try:fixed.verified_directory_policies(request['before'][fixed.OP],policies,wrong);raise AssertionError(field)
  except fixed.PolicyError:negatives.append(field)
 bad=copy.deepcopy(snapshot)
 for v in bad['directories'].values():v['acl']='unapproved ACL'
 try:engine.apply(bad);raise AssertionError('ACL guard')
 except fixed.PolicyError as e:assert e.code=='NFS_CLIENT_DIRECTORY_IDENTITY_CHANGED'
 applying=True;engine.apply(snapshot);engine.verify(snapshot)
 assert 'directoryPolicyUuid' in json.loads(engine.desired.read_text())['exports'][0]['config']
 assert protected()==before
 engine.restore(snapshot);engine.verify(snapshot,True);applying=False
 assert engine.desired.read_bytes()==saved and protected()==before
 assert hashlib.sha256((release/'lib/ablestack-storage/nfs_client_policy_runtime.py').read_bytes()).hexdigest()==code_before
 print(json.dumps({'status':'PASS','stage':str(stage),'baselineFailureReproduced':args.expect_baseline_failure,'realPreflightApplyConfigsEqual':True,'nativeReloadApplyVerifyRestore':True,'missingReferencePersistedOnSuccess':True,'originalMissingReferenceRestored':True,'policyNegativeChecks':negatives,'aclGuardPreserved':True,'dataPermissionsPreserved':True,'activeSignedCodePreserved':True}))
finally:
 if applying and snapshot is not None:engine.restore(snapshot)
 for f in reversed(leases):f.close()
