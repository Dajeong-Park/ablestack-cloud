# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
# Opt-in regression for the declared-RO/native-RW #1462 fixture; no client may be connected.
import copy,fcntl,hashlib,json,os,shutil,subprocess,sys,tempfile,urllib.request,uuid
from pathlib import Path
assert os.environ.get('STORAGE_NATIVE_ISCSI_WRITE_PROTECT')=='1', 'explicit native-test opt-in required'
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==os.environ['STORAGE_NATIVE_VM_UUID']
runtime=Path('/opt/ablestack/storage-runtime/current').resolve()
stage=Path(tempfile.mkdtemp(prefix='issue1462-iscsiwp-pre-',dir='/var/tmp'));stage.chmod(0o700)
for name,source in [('candidate_configuration_transaction.py',os.environ['STORAGE_NATIVE_CONFIGURATION_MODULE']),('candidate-storagectl',os.environ['STORAGE_NATIVE_STORAGECTL'])]:
 b=Path(source).read_bytes()
 (stage/name).write_bytes(b);(stage/name).chmod(0o755 if name=='candidate-storagectl' else 0o644)
sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
from volume_identity import resolve_volume_device
from rtslib_fb import RTSRoot
source=Path('/srv/ablestack-storage/volumes/3940999e-3065-488b-9d64-ef483d9af506/export/parent1462')
def protected():
 s=source.stat()
 out={'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()},'leaf':[s.st_ino,s.st_uid,s.st_gid,s.st_mode&0o7777],'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',source])).hexdigest(),'blocks':{},'accounts':hashlib.sha256(subprocess.check_output(['pdbedit','-L','-w'],stderr=subprocess.DEVNULL)).hexdigest(),'lio':hashlib.sha256(json.dumps(RTSRoot().dump(),sort_keys=True).encode()).hexdigest(),'code':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [runtime/'ablestack-storagectl',runtime/'lib/ablestack-storage/configuration_transaction.py']},'privateModes':{n:Path(n).stat().st_mode&0o7777 for n in ['/srv/ablestack-storage','/srv/ablestack-storage/volumes']}}
 devices=json.loads(subprocess.check_output(['lsblk','-b','-J','-o','NAME,PATH,TYPE,SIZE,SERIAL,FSTYPE,UUID,MOUNTPOINT'],text=True))
 for vol in ['a59c2c54-02ee-4a4a-8132-47967728d1bc','d647e089-ef59-4187-b608-8196cd9e646a']:
  dev=resolve_volume_device(devices['blockdevices'],volume_uuid=vol,expected_size=2147483648,allow_blank_size_fallback=False)['devicePath']
  with open(dev,'rb') as f:
   for off in [1048576,3145728,4194304]:
    f.seek(off);out['blocks'][vol+':'+str(off)]=hashlib.sha256(f.read(64)).hexdigest()
 return out
assert not list(RTSRoot().sessions)
before=protected()
(stage/'before-integrity.json').write_text(json.dumps(before))
state=Path('/etc/ablestack-storage/iscsi-targets.json')
config_sha=hashlib.sha256(state.read_bytes()).hexdigest()
driver=r"""
import copy,hashlib,json,os,subprocess,sys,uuid
from pathlib import Path
root=Path(sys.argv[1]);runtime=Path('/opt/ablestack/storage-runtime/current').resolve()
subprocess.run(['mount','--bind',str(root/'candidate-storagectl'),str(runtime/'ablestack-storagectl')],check=True)
subprocess.run(['mount','--bind',str(root/'candidate_configuration_transaction.py'),str(runtime/'lib/ablestack-storage/configuration_transaction.py')],check=True)
sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
import configuration_transaction as tx
from rtslib_fb import RTSRoot,FabricModule,Target,TPG,LUN,NodeACL,MappedLUN
state=Path('/etc/ablestack-storage/iscsi-targets.json')
declared=json.loads(state.read_text());base=copy.deepcopy(declared)
iqn=base['targets'][0]['targetName'];principal=base['targets'][0]['acls'][0]['principal']
def mapped():
 target=next(t for t in RTSRoot().targets if t.wwn==iqn)
 tpg=next(p for p in target.tpgs if p.tag==1)
 acl=next(a for a in tpg.node_acls if a.node_wwn==principal)
 return next(m for m in acl.mapped_luns if m.mapped_lun==0)
# The existing declared RO/native RW mismatch is explicitly preserved at the end.
assert mapped().write_protect is False
for row in base['targets']:
 for acl in row.get('acls',[]):acl['permission']='READ_WRITE'
candidate=copy.deepcopy(base)
for row in candidate['targets']:
 for acl in row.get('acls',[]):acl['permission']='READ_ONLY'
counter={}
class Fault(tx.RuntimeAdapter):
 def verify(self,commands,restoring=False):
  super().verify(commands,restoring)
  marker=self.private/'controlled-failure-fired'
  if not restoring and not marker.exists():
   marker.write_text('once')
   raise tx.Rejected('CONTROLLED_AFTER_ISCSI_PERMISSION_VERIFY')
for fault in [False,True]:
 req={'instanceUuid':declared['instanceUuid'],'operationid':str(uuid.uuid4()),'baseRevision':0,'targetRevision':1,'before':{'iscsi target apply':copy.deepcopy(base)},'candidate':{'iscsi target apply':copy.deepcopy(candidate)}}
 txn=tx.Transaction(root/('fault' if fault else 'positive'),Fault if fault else None)
 result=txn.execute('apply',req);private=txn.paths(req)[1];adapter=txn.adapter_factory(private)
 if not fault:
  assert result['state']=='VERIFIED',result
  assert mapped().write_protect is True
  adapter.verify(req['candidate'])
  mapped().write_protect=False
  try:adapter.verify(req['candidate']);raise AssertionError('mismatch accepted')
  except tx.Rejected as error:assert error.code=='ISCSI_WRITE_PROTECT_MISMATCH',error.code
  finally:mapped().write_protect=True
  # Exercise the real CLI's reverse transition too, before compensation.
  adapter.run('iscsi target apply',copy.deepcopy(base));adapter.verify({'iscsi target apply':base})
  assert mapped().write_protect is False
  result=txn.rollback(tx.load(private/'status.json'),private/'status.json',adapter)
 assert result['state']=='ROLLED_BACK' and result['rollback']['state']=='SUCCEEDED',result
 if fault:assert result['originalfailure']['code']=='CONTROLLED_AFTER_ISCSI_PERMISSION_VERIFY'
 assert mapped().write_protect is False
 assert json.loads(state.read_text())==declared
 counter['controlledFailure' if fault else 'RO_RW']='PASS'
# Isolated target, no portal and no client: reuse only the existing SPARSE backstore.
so=next(o for o in RTSRoot().storage_objects if o.name=='ablestack-'+base['targets'][0]['uuid'])
test_iqn='iqn.2026-11.local.test:issue1462-wp-'+uuid.uuid4().hex
native=Target(FabricModule('iscsi'),test_iqn,mode='create')
try:
 tpg=TPG(native,1);LUN(tpg,0,storage_object=so);LUN(tpg,1,storage_object=so)
 acl=NodeACL(tpg,'iqn.2026-11.local.test:wp-client',mode='create')
 acl.chap_userid='wp-native-fixture';acl.chap_password=uuid.uuid4().hex
 auth=(acl.chap_userid,acl.chap_password)
 value={'targets':[{'targetName':test_iqn,'lunOrNamespace':str(n),'acls':[{'principal':acl.node_wwn,'permission':p}]} for n,p in [(0,'READ_ONLY'),(1,'READ_WRITE')]]}
 tx.iscsi_mapped_lun_permissions(value,apply=True)
 assert {m.mapped_lun:m.write_protect for m in acl.mapped_luns}=={0:True,1:False}
 for row in value['targets']:row['acls'][0]['permission']='READ_WRITE' if row['lunOrNamespace']=='0' else 'READ_ONLY'
 tx.iscsi_mapped_lun_permissions(value,apply=True)
 assert {m.mapped_lun:m.write_protect for m in acl.mapped_luns}=={0:False,1:True}
 assert (acl.chap_userid,acl.chap_password)==auth
 ambiguous=copy.deepcopy(value);ambiguous['targets'].append({'targetName':test_iqn,'lunOrNamespace':'2','acls':[]})
 try:tx.iscsi_acl_permission_plan(ambiguous);raise AssertionError('ambiguous inherited permission accepted')
 except tx.Rejected as error:assert error.code=='ISCSI_ACL_PERMISSION_AMBIGUOUS'
 m=next(m for m in acl.mapped_luns if m.mapped_lun==0);m.delete();MappedLUN(acl,0,tpg_lun=next(l for l in tpg.luns if l.lun==1))
 try:tx.iscsi_mapped_lun_permissions(value,apply=True);raise AssertionError('changed mapping accepted')
 except tx.Rejected as error:assert error.code=='ISCSI_MAPPED_LUN_IDENTITY_CHANGED'
 counter['multiLunMixedPermissionsChApAndIdentity']='PASS'
finally:
 assert native.wwn==test_iqn and test_iqn.startswith('iqn.2026-11.local.test:issue1462-wp-')
 native.delete()
print(json.dumps({'status':'PASS','checks':counter,'existingMismatchRestoredForUiDeployment':True,'fullCliAndCoordinator':True,'noDataWrites':True}))
"""
(stage/'driver.py').write_text(driver)
leases=[]
try:
 for name in ['/run/lock/ablestack-storage-runtime-upgrade.lock','/run/lock/ablestack-storage-boot-reconcile.lock','/var/lib/ablestack-storage/configuration-operations/'+json.loads(state.read_text())['instanceUuid']+'/lock']:
  f=Path(name).open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 done=subprocess.run(['unshare','--mount','--propagation','private',sys.executable,str(stage/'driver.py'),str(stage)],capture_output=True,text=True,timeout=180)
 if done.returncode:
  print(json.dumps({'stage':str(stage),'stdout':done.stdout[-1500:],'stderr':done.stderr[-4000:]}));raise SystemExit(done.returncode)
 assert protected()==before,'DATA/ACL/accounts/LIO/native code changed'
 assert hashlib.sha256(state.read_bytes()).hexdigest()==config_sha
 result=json.loads(done.stdout);result.update(stage=str(stage),liveDataAclWwnChApAndCodePreserved=True)
 print(json.dumps(result))
finally:
 for f in reversed(leases):f.close()
