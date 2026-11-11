# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
# Opt-in #1462 regression for the preserved three-DATA fixture; no client may be connected.
import fcntl,hashlib,json,os,shutil,subprocess,sys,tempfile,urllib.request
from pathlib import Path
assert os.environ.get('STORAGE_NATIVE_RELEASE_SNAPSHOT')=='1', 'explicit native-test opt-in required'
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==os.environ['STORAGE_NATIVE_VM_UUID']
live=Path('/opt/ablestack/storage-runtime')
transaction=os.environ['STORAGE_NATIVE_RUNTIME_TRANSACTION']
state_source=Path('/var/lib/ablestack-storage/runtime-updates')/transaction
original=json.loads((state_source/'state.json').read_text())
assert original['phase'] in ('REJECTED','PREFLIGHT_OK')
stage=Path(tempfile.mkdtemp(prefix='issue1462-release-snapshot-pre-',dir='/var/tmp'));stage.chmod(0o700)
code=Path(os.environ['STORAGE_NATIVE_UPDATER_CANDIDATE']).read_bytes()
assert hashlib.sha256(code).hexdigest()==os.environ['STORAGE_NATIVE_UPDATER_SHA256']
(stage/'candidate.py').write_bytes(code)
sys.path.insert(0,str((live/'current').resolve()/'lib/ablestack-storage'))
from volume_identity import resolve_volume_device
leaf=Path('/srv/ablestack-storage/volumes/3940999e-3065-488b-9d64-ef483d9af506/export/parent1462')
def protected():
 s=leaf.stat()
 v={'leaf':[s.st_ino,s.st_uid,s.st_gid,s.st_mode&0o7777],'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',leaf])).hexdigest(),'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in leaf.iterdir() if p.is_file()},'privateModes':{n:Path(n).stat().st_mode&0o7777 for n in ['/srv/ablestack-storage','/srv/ablestack-storage/volumes']},'accounts':hashlib.sha256(subprocess.check_output(['pdbedit','-L','-w'],stderr=subprocess.DEVNULL)).hexdigest(),'blocks':{},'pointer':os.readlink(live/'current'),'previous':os.readlink(live/'previous'),'updater':hashlib.sha256(Path('/usr/local/lib/ablestack-storage/runtime_updater.py').read_bytes()).hexdigest(),'namespaceUuid':Path('/sys/kernel/config/nvmet/subsystems/nqn.2026-11.local.storage:issue1462parent/namespaces/1/device_uuid').read_text().strip()}
 devices=json.loads(subprocess.check_output(['lsblk','-b','-J','-o','NAME,PATH,TYPE,SIZE,SERIAL,FSTYPE,UUID,MOUNTPOINT'],text=True))
 for vol in ['a59c2c54-02ee-4a4a-8132-47967728d1bc','d647e089-ef59-4187-b608-8196cd9e646a']:
  dev=resolve_volume_device(devices['blockdevices'],volume_uuid=vol,expected_size=2147483648,allow_blank_size_fallback=False)['devicePath']
  with open(dev,'rb') as f:
   for off in [1048576,3145728,4194304]:
    f.seek(off);v['blocks'][vol+':'+str(off)]=hashlib.sha256(f.read(64)).hexdigest()
 return v
before=protected()
assert not [l for l in subprocess.check_output(['ss','-Htn','state','established'],text=True).splitlines() if any(l.split()[2].endswith(':'+str(p)) for p in (2049,445,3261,4421))]
driver=r"""
from pathlib import Path
import importlib.util,json,os,subprocess,sys,hashlib
root=Path(sys.argv[1]);mode=sys.argv[2]
subprocess.run(['mount','--bind',str(root/'runtime'),'/opt/ablestack/storage-runtime'],check=True,capture_output=True)
# Keep the old baseline modules already imported in the parent; the new child must not reuse them.
sys.path.insert(0,'/usr/local/lib/ablestack-storage')
import configuration_transaction,shared_directory_policy
spec=importlib.util.spec_from_file_location('candidate_updater',root/'candidate.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Actual(m.RuntimeUpdater):
 def refresh_monitor(self):
  self.refreshes+=1
 def configuration_snapshot(self,request):
  super().configuration_snapshot(request)
  if mode=='failure':raise RuntimeError('controlled snapshot failure')
engine=Actual();engine.state_root=root/'state';engine.refreshes=0
request=json.loads((root/'request.json').read_text())
old=engine.current_version();old_previous=engine.current_version(engine.previous)
if mode=='success':
 applied=engine.activate(request)
 assert applied['phase']=='ACTIVATED'
 private=engine.transaction_dir(request)/'configuration-before'
 proof=json.loads((private/'release.json').read_text())
 assert proof['version']==old
 assert proof['modules']['shared_directory_policy']==hashlib.sha256((engine.releases/old/'lib/ablestack-storage/shared_directory_policy.py').read_bytes()).hexdigest()
 assert proof['modules']['configuration_transaction']==hashlib.sha256((engine.releases/old/'lib/ablestack-storage/configuration_transaction.py').read_bytes()).hexdigest()
 assert engine.activate(dict(request,confirmActivation=True))['phase']=='COMPLETE'
 pointer=os.readlink(engine.current);previous=os.readlink(engine.previous)
 for change,expected in [('receipt','CONFIGURATION_SNAPSHOT_RELEASE_UNCONFIRMED'),('module','PREVIOUS_RUNTIME_INTEGRITY_MISMATCH')]:
  if change=='receipt':
   f=private/'release.json';original=f.read_bytes();v=dict(proof,version='unconfirmed');m.atomic_json(f,v)
  else:
   f=engine.releases/old/'lib/ablestack-storage/shared_directory_policy.py';original=f.read_bytes();f.write_bytes(original+b'\n# tampered\n')
  try:
   engine.rollback(dict(request,restoreConfiguration=True))
   raise AssertionError('unconfirmed rollback accepted')
  except m.RuntimeUpgradeError as error:assert error.code==expected,(change,error.code)
  finally:f.write_bytes(original)
  assert os.readlink(engine.current)==pointer and os.readlink(engine.previous)==previous
 result=engine.rollback(dict(request,restoreConfiguration=True))
 assert result['phase']=='ROLLED_BACK' and engine.current_version()==old
 assert engine.rollback(dict(request,restoreConfiguration=True))['phase']=='ROLLED_BACK'
 assert engine.refreshes==2
 print(json.dumps({'mode':mode,'snapshotSource':proof['version'],'verifiedModules':proof['modules'],'confirmed':True,'configurationRollback':'ROLLED_BACK','tamperedReceiptAndModuleRejectedBeforePointerChange':True,'isolatedImportsDespiteOldParentModules':True,'repeatRollbackIdempotent':True,'monitorRestartExcluded':True}))
else:
 try:engine.activate(request)
 except m.RuntimeUpgradeError as error:assert error.code=='BASELINE_SNAPSHOT_FAILED',error.code
 else:raise AssertionError('controlled failure accepted')
 assert engine.current_version()==old and engine.current_version(engine.previous)==old_previous
 assert engine.read_state(request)['phase']=='REJECTED' and engine.refreshes==0
 print(json.dumps({'mode':mode,'state':'REJECTED','snapshotReal':True,'pointersUnchanged':True}))
"""
leases=[];results=[]
try:
 for name in ['/run/lock/ablestack-storage-runtime-upgrade.lock','/run/lock/ablestack-storage-boot-reconcile.lock','/var/lib/ablestack-storage/configuration-operations/2b6eab19-b339-40fd-b62a-e84d056844db/lock']:
  f=Path(name).open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 for mode in ['success','failure']:
  root=stage/mode;root.mkdir(mode=0o700);shutil.copytree(live,root/'runtime',symlinks=True)
  shutil.copyfile(stage/'candidate.py',root/'candidate.py')
  state=root/'state'/transaction;state.mkdir(parents=True,mode=0o700)
  for n in ['manifest.json','manifest.sig','bundle.tar.gz']:shutil.copyfile(state_source/n,state/n)
  (state/'state.json').write_text(json.dumps(dict(original,phase='PREFLIGHT_OK')));(state/'state.json').chmod(0o600)
  request={'transactionId':transaction,'instanceUuid':'2b6eab19-b339-40fd-b62a-e84d056844db','bundleVersion':original['bundleVersion']}
  (root/'request.json').write_text(json.dumps(request));(root/'driver.py').write_text(driver)
  done=subprocess.run(['unshare','--mount','--propagation','private',sys.executable,str(root/'driver.py'),str(root),mode],capture_output=True,text=True,timeout=180)
  if done.returncode:
   print(json.dumps({'stage':str(stage),'case':mode,'error':done.stderr[-4500:],'stdout':done.stdout[-2000:]}));raise SystemExit(done.returncode)
  results.append(json.loads(done.stdout))
  assert protected()==before,'live DATA/account/ACL/namespace/pointer/updater changed'
 print(json.dumps({'status':'PASS','stage':str(stage),'results':results,'liveDataAccountsAclNamespacesPointersAndUpdaterPreserved':True,'scope':'real activate -> signed release adapter snapshot -> confirmation -> restoreConfiguration rollback; only collector refresh excluded'}))
finally:
 for f in reversed(leases):f.close()
