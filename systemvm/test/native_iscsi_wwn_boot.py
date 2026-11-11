# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
# Opt-in actual cold/warm boot regression on the preserved three-SPARSE-DATA fixture.
import copy,fcntl,hashlib,json,os,shutil,subprocess,sys,tempfile,urllib.request
from pathlib import Path
assert os.environ.get('STORAGE_NATIVE_ISCSI_WWN')=='1', 'explicit native-test opt-in required'
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==os.environ['STORAGE_NATIVE_VM_UUID']
runtime=Path('/opt/ablestack/storage-runtime/current').resolve()
stage=Path(tempfile.mkdtemp(prefix='issue1462-wwn-pre-',dir='/var/tmp'));stage.chmod(0o700)
for name,path in [('candidate_configuration_transaction.py',os.environ['STORAGE_NATIVE_CONFIGURATION_MODULE']),('candidate-storagectl',os.environ['STORAGE_NATIVE_STORAGECTL'])]:
 b=Path(path).read_bytes()
 (stage/name).write_bytes(b);(stage/name).chmod(0o755 if name=='candidate-storagectl' else 0o644)
sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
from volume_identity import resolve_volume_device
from rtslib_fb import RTSRoot
source=Path('/srv/ablestack-storage/volumes/3940999e-3065-488b-9d64-ef483d9af506/export/parent1462')
state=Path('/etc/ablestack-storage/iscsi-targets.json')
def protected():
 s=source.stat();r=RTSRoot()
 result={'leaf':[s.st_ino,s.st_uid,s.st_gid,s.st_mode&4095],'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',source])).hexdigest(),'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()},'namespaceUuid':Path('/sys/kernel/config/nvmet/subsystems/nqn.2026-11.local.storage:issue1462parent/namespaces/1/device_uuid').read_text().strip(),'backstores':{o.name:[o.wwn,o.udev_path] for o in r.storage_objects},'aclMap':{t.wwn:{a.node_wwn:{m.mapped_lun:[m.tpg_lun.lun,m.write_protect] for m in a.mapped_luns} for p in t.tpgs for a in p.node_acls} for t in r.targets},'chap':hashlib.sha256(json.dumps([{t.wwn:[{a.node_wwn:[a.chap_userid,a.chap_password,a.chap_mutual_userid,a.chap_mutual_password]} for p in t.tpgs for a in p.node_acls]} for t in r.targets],sort_keys=True).encode()).hexdigest(),'blocks':{},'stateSha':hashlib.sha256(state.read_bytes()).hexdigest(),'code':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [runtime/'ablestack-storagectl',runtime/'lib/ablestack-storage/configuration_transaction.py']}}
 devices=json.loads(subprocess.check_output(['lsblk','-b','-J','-o','NAME,PATH,TYPE,SIZE,SERIAL,FSTYPE,UUID,MOUNTPOINT'],text=True))
 for v in ['a59c2c54-02ee-4a4a-8132-47967728d1bc','d647e089-ef59-4187-b608-8196cd9e646a']:
  dev=resolve_volume_device(devices['blockdevices'],volume_uuid=v,expected_size=2147483648,allow_blank_size_fallback=False)['devicePath']
  with open(dev,'rb') as f:
   for off in [1048576,3145728,4194304,6291456]:
    f.seek(off);result['blocks'][v+':'+str(off)]=hashlib.sha256(f.read(64)).hexdigest()
 return result
assert not list(RTSRoot().sessions)
before=protected();(stage/'before-integrity.json').write_text(json.dumps(before))
identity_dir=Path('/var/lib/ablestack-storage/iscsi-identities');made=not identity_dir.exists()
identity_dir.mkdir(mode=0o700,exist_ok=True)
for source_dir,name in [(identity_dir,'identities'),(Path('/etc/rtslib-fb-target'),'saveconfig'),(Path('/etc/ablestack-storage/secrets'),'secrets')]:
 shutil.copytree(source_dir,stage/name);(stage/name).chmod(0o700)
driver=r"""
import copy,hashlib,json,os,subprocess,sys,uuid
from pathlib import Path
root=Path(sys.argv[1]);runtime=Path('/opt/ablestack/storage-runtime/current').resolve()
os.environ['PYTHONDONTWRITEBYTECODE']='1'
for src,dst in [(root/'candidate-storagectl',runtime/'ablestack-storagectl'),(root/'candidate_configuration_transaction.py',runtime/'lib/ablestack-storage/configuration_transaction.py'),(root/'identities',Path('/var/lib/ablestack-storage/iscsi-identities')),(root/'saveconfig',Path('/etc/rtslib-fb-target')),(root/'secrets',Path('/etc/ablestack-storage/secrets'))]:
 subprocess.run(['mount','--bind',str(src),str(dst)],check=True)
sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
import configuration_transaction as tx
from boot_reconcile import Runtime
from rtslib_fb import RTSRoot,BlockStorageObject
state=Path('/etc/ablestack-storage/iscsi-targets.json');original=state.read_bytes();desired=json.loads(original)
target=desired['targets'][0];name='ablestack-'+target['uuid'];iqn=target['targetName'];principal=target['acls'][0]['principal']
store=tx.IscsiBackstoreIdentityStore()
old=BlockStorageObject(name).wwn
def native():
 t=next(t for t in RTSRoot().targets if t.wwn==iqn)
 p=next(p for p in t.tpgs if p.tag==1)
 a=next(a for a in p.node_acls if a.node_wwn==principal)
 return p,a,next(m for m in a.mapped_luns if m.mapped_lun==int(target['lunOrNamespace']))
def prepare(value):
 path=root/'input.json';path.write_text(json.dumps(value));path.chmod(0o600)
 Runtime().prepare('ISCSI',path,60)
 assert BlockStorageObject(name).wwn==old
 assert store.load()['entries'][target['uuid']]['wwn']==old
checks={}
try:
 prepare(desired);prepare(desired)
 checks['warmAndRepeatedAuthoritativeRebuild']='PASS'
 # Cold legacy import: no kernel object/store, saved /dev path now refers to another DATA.
 saved_path=Path('/etc/rtslib-fb-target/saveconfig.json')
 saved=json.loads(saved_path.read_text())
 for o in saved['storage_objects']:
  if o['name']==name:o['dev']='/dev/sdb'
 tx.atomic_json(saved_path,saved)
 store.path.unlink()
 p,a,m=native();p.parent_target.delete();BlockStorageObject(name).delete()
 prepare(desired)
 checks['coldLegacyStaleDevPathWithVerifiedUuidAndSize']='PASS'
 # RO and CHAP survive the actual authoritative path, including an initial RAM-only secret.
 ro=copy.deepcopy(desired);rule=ro['targets'][0]['acls'][0]
 rule['permission']='READ_ONLY'
 rule.setdefault('config',{}).update(chapEnabled=True,chapUsername='wwn-native-fixture')
 rule.pop('secrets',None)
 p,a,m=native();secret=uuid.uuid4().hex;a.chap_userid='wwn-native-fixture';a.chap_password=secret;p.set_attribute('authentication',1)
 prepare(ro)
 p,a,m=native()
 assert m.write_protect is True and a.chap_userid=='wwn-native-fixture' and a.chap_password==secret
 prepare(ro)
 p,a,m=native();assert m.write_protect is True and a.chap_password==secret
 checks['readOnlyAndChapAuthoritativeRebuild']='PASS'
 prepare(desired)
 p,a,m=native();assert m.write_protect is False and not a.chap_userid and not a.chap_password
 checks['readWriteAndOriginalAuthRestored']='PASS'
 # Verify failures before any deletion using real DATA UUID/size resolution.
 devices=json.loads(subprocess.check_output(['lsblk','-b','-J','-o','NAME,PATH,TYPE,SIZE,SERIAL,FSTYPE,UUID,MOUNTPOINT'],text=True))['blockdevices']
 actual={o.name:{'wwn':o.wwn,'devicePath':o.udev_path} for o in RTSRoot().storage_objects}
 for field,value,code in [('volumeSizeBytes',1073741824,'ISCSI_BACKSTORE_DATA_SIZE_MISMATCH'),('volumeUuid','d647e089-ef59-4187-b608-8196cd9e646a','ISCSI_BACKSTORE_IDENTITY_BINDING_CHANGED')]:
  wrong=copy.deepcopy(target);wrong[field]=value
  try:store.prepare([wrong],devices,actual,desired,lambda path:None,True);raise AssertionError('unverified DATA accepted')
  except tx.Rejected as error:assert error.code==code,(field,error.code)
  assert BlockStorageObject(name).wwn==old
 wrong=copy.deepcopy(target);wrong.update(volumeUuid='e23dbfc1-6e63-4701-934c-ff3074d54e27',volumeSizeBytes=10737418240)
 try:store.prepare([wrong],devices,actual,desired,lambda path:None,True);raise AssertionError('ROOT accepted')
 except tx.Rejected as error:assert error.code=='ISCSI_BACKSTORE_DATA_IDENTITY_MISMATCH',error.code
 checks['uuidSizeAndRootGuards']='PASS'
 # Full transaction rollback with a post-verify controlled failure.
 class Fault(tx.RuntimeAdapter):
  def verify(self,commands,restoring=False):
   super().verify(commands,restoring)
   marker=self.private/'controlled-failure-fired'
   if not marker.exists():
    marker.write_text('once');raise tx.Rejected('CONTROLLED_AFTER_WWN_VERIFY')
 cand=copy.deepcopy(desired);cand['targets'][0]['acls'][0]['permission']='READ_ONLY'
 req={'instanceUuid':desired['instanceUuid'],'operationid':str(uuid.uuid4()),'baseRevision':0,'targetRevision':1,'before':{'iscsi target apply':desired},'candidate':{'iscsi target apply':cand}}
 txn=tx.Transaction(root/'rollback',Fault)
 result=txn.execute('apply',req)
 assert result['state']=='ROLLED_BACK' and result['rollback']['state']=='SUCCEEDED',result
 assert BlockStorageObject(name).wwn==old and native()[2].write_protect is False
 checks['failedApplyCompensationWwnAndPermissions']='PASS'
 state.write_bytes(original)
 print(json.dumps({'status':'PASS','checks':checks,'wwn':old,'noDataWrites':True,'fullBootReconcileAndCli':True}))
finally:
 # Restore through the tested path, then restore byte-exact declared state.
 if BlockStorageObject(name).wwn==old:
  prepare(desired);state.write_bytes(original)
"""
(stage/'driver.py').write_text(driver)
leases=[]
try:
 for name in ['/run/lock/ablestack-storage-runtime-upgrade.lock','/run/lock/ablestack-storage-boot-reconcile.lock','/var/lib/ablestack-storage/configuration-operations/'+json.loads(state.read_text())['instanceUuid']+'/lock']:
  f=Path(name).open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 done=subprocess.run(['unshare','--mount','--propagation','private',sys.executable,'-B',str(stage/'driver.py'),str(stage)],capture_output=True,text=True,timeout=240,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
 if done.returncode:
  print(json.dumps({'stage':str(stage),'stdout':done.stdout[-1500:],'stderr':done.stderr[-4500:]}));raise SystemExit(done.returncode)
 assert protected()==before,'DATA/ACL/CHAP/WWN/native code changed'
 result=json.loads(done.stdout);result.update(stage=str(stage),liveDataWwnChapAclAndCodePreserved=True)
 print(json.dumps(result))
finally:
 for f in reversed(leases):f.close()
 if made and not list(identity_dir.iterdir()):identity_dir.rmdir()
 secrets=(stage/'secrets').resolve()
 assert secrets.parent==stage.resolve()
 shutil.rmtree(secrets)
