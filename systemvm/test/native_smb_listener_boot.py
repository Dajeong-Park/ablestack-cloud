#!/usr/bin/env python3
# Licensed under the Apache License, Version 2.0. See NOTICE.
# Explicit opt-in regression for a disposable SharedFS SystemVM.
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--vm-uuid',required=True)
parser.add_argument('--instance-uuid',required=True)
parser.add_argument('--boot-helper',required=True)
parser.add_argument('--configuration-helper',required=True)
parser.add_argument('--seed-root',required=True)
parser.add_argument('--share',required=True)
parser.add_argument('--expect-missing-binding',action='store_true')
args=parser.parse_args()
import base64,copy,fcntl,hashlib,importlib.util,json,os,subprocess,sys,tempfile
from pathlib import Path
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==args.vm_uuid.lower()
release=Path('/opt/ablestack/storage-runtime/current').resolve()
sys.path.insert(0,str(release/'lib/ablestack-storage'))
import boot_reconcile as original
import shared_directory_policy as directory
stage=Path(tempfile.mkdtemp(prefix='issue1462-listeneronly-pre-',dir='/var/tmp'));stage.chmod(0o700)
candidate=Path(args.boot_helper).resolve();assert candidate.is_file()
spec=importlib.util.spec_from_file_location('boot_proposal',candidate);fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
desired=Path('/etc/ablestack-storage/desired-state/smb-share-apply.json')
saved=desired.read_bytes();before=json.loads(saved)
assert before['instanceUuid']==args.instance_uuid.lower()
legacy=copy.deepcopy(before);legacy['listenerOnly']=True
legacy_path=stage/'legacy.json';original.atomic_json(legacy_path,legacy)
shares=before['shares'];assert len(shares)==1 and shares[0]['name']==args.share
engine=directory.FileSharePathBindings()
if args.expect_missing_binding:assert engine.observe(shares[0])['status']=='UNAVAILABLE'
connections=subprocess.check_output(['ss','-Htn','state','established'],text=True).splitlines()
assert not any(any(line.split()[2].endswith(':'+str(port)) for port in (2049,445,3261,4421)) for line in connections)
source=Path(args.seed_root).resolve()
assert str(source).startswith('/srv/ablestack-storage/volumes/')
def protected_state():
 result={}
 for p in [source,*[p for p in source.iterdir() if p.is_file()],Path('/etc/passwd'),Path('/etc/group'),Path('/etc/shadow'),Path('/etc/gshadow')]:
  s=p.stat();result[str(p)]={'uid':s.st_uid,'gid':s.st_gid,'mode':s.st_mode&0o7777,'inode':s.st_ino}
  if p.is_file():result[str(p)]['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
 result['posixAcl']=hashlib.sha256(subprocess.check_output(['getfacl','-cpn',str(source)])).hexdigest()
 result['accounts']=hashlib.sha256(subprocess.check_output(['pdbedit','-L','-w'],stderr=subprocess.DEVNULL)).hexdigest()
 return result
protected=protected_state()
watched=[release/'ablestack-storagectl',release/'lib/ablestack-storage/boot_reconcile.py',release/'lib/ablestack-storage/configuration_transaction.py']
code={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
leases=[]
try:
 for p in [Path('/run/lock/ablestack-storage-runtime-upgrade.lock'),Path('/run/lock/ablestack-storage-boot-reconcile.lock'),Path('/var/lib/ablestack-storage/configuration-operations')/before['instanceUuid']/'lock']:
  f=p.open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 native=fixed.Runtime();native.eligibility(before['instanceUuid'])
 native.data(original.desired_snapshot())
 result=native.prepare('SMB',legacy_path,60)
 assert result.get('success') is True,result
 after=json.loads(desired.read_text())
 assert 'listenerOnly' not in after
 assert fixed.desired_projection('SMB',before)==fixed.desired_projection('SMB',after)
 engine.verify({'smb share apply':after})
 assert protected==protected_state(),'account/data/ACL mutation'
 assert subprocess.run(['systemctl','is-active','smbd'],capture_output=True).returncode!=0
 # Exercise the proposal's real commit -> atomic storage -> reload on private SystemVM state.
 text=Path(args.configuration_helper).read_text()
 old='if k not in ("configurationOperationId", "releaseAddresses", "listenerImplicitBefore")'
 assert text.count(old)==0 and '"listenerImplicitBefore", "listenerOnly"' in text
 patched=stage/'configuration_transaction.py';patched.write_text(text)
 cs=importlib.util.spec_from_file_location('configuration_proposal',patched);cm=importlib.util.module_from_spec(cs);cs.loader.exec_module(cm)
 ctl=cm.SmbListenerProfiles(stage/'profiles',stage/'base.conf')
 operation='00000000-0000-4000-8000-000000001462'
 value=copy.deepcopy(before);value['listeners']=[]
 cm.atomic_json(ctl.manifest,{'profiles':{},'pending':{'operationid':operation,'wanted':[],'value':value}})
 ctl.commit(operation);persisted=cm.load(ctl.desired,{})
 assert 'listenerOnly' not in persisted and persisted['shares']==before['shares']
 assert protected==protected_state()
 assert code=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
 print(json.dumps({'status':'PASS','stage':str(stage),'actualSignedCliApply':True,'missingBindingRecreatedAndVerified':True,'oldStoredFlagCompatible':True,'nativeCommitReloadExcludesFlag':True,'desiredProjectionStable':True,'accountsAclDataPreserved':True,'defaultSmbdInactive':True,'activeSignedCodePreserved':True}))
finally:
 fd,tmp=tempfile.mkstemp(prefix='.pretest-restore-',dir=desired.parent)
 with os.fdopen(fd,'wb') as f:os.fchmod(f.fileno(),0o600);f.write(saved);f.flush();os.fsync(f.fileno())
 os.replace(tmp,desired)
 for f in reversed(leases):f.close()
