# Licensed under the Apache License, Version 2.0. See NOTICE.
# http://www.apache.org/licenses/LICENSE-2.0
import copy,fcntl,hashlib,json,os,subprocess,sys,tempfile,uuid,urllib.request
from pathlib import Path
assert os.environ.get('STORAGE_NATIVE_NFS_RESTORE_RECEIPTS')=='1', 'explicit native-test opt-in required'
assert Path('/sys/class/dmi/id/product_uuid').read_text().strip().lower()==os.environ['STORAGE_NATIVE_VM_UUID']
release=Path('/opt/ablestack/storage-runtime/current').resolve()
stage=Path(tempfile.mkdtemp(prefix='issue1462-nfs-receipts-pre-',dir='/var/tmp'));stage.chmod(0o700)
candidate=os.environ.get('STORAGE_RUNTIME_CANDIDATE_URL')
if candidate:
 code=urllib.request.urlopen(candidate,timeout=10).read()
 assert hashlib.sha256(code).hexdigest()==os.environ['STORAGE_RUNTIME_CANDIDATE_SHA256']
 (stage/'configuration_transaction.py').write_bytes(code)
sys.path[:0]=[str(stage),str(release/'lib/ablestack-storage')]
import configuration_transaction as tx
from volume_identity import resolve_volume_device
source=Path('/srv/ablestack-storage/volumes/3940999e-3065-488b-9d64-ef483d9af506/export/parent1462')
original=Path(os.environ['STORAGE_NATIVE_RESTORE_REQUEST'])
saved=json.loads(original.read_text())
assert tx.RuntimeAdapter.nfs_client_policy_only(saved)
assert not [l for l in subprocess.check_output(['ss','-Htn','state','established'],text=True).splitlines() if any(l.split()[2].endswith(':'+str(p)) for p in (2049,445,3261,4421))]
def protected():
 s=source.stat()
 v={'inode':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':s.st_mode&0o7777,'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',source])).hexdigest(),'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()},'privateModes':{n:Path(n).stat().st_mode&0o7777 for n in ['/srv/ablestack-storage','/srv/ablestack-storage/volumes']},'accounts':hashlib.sha256(subprocess.check_output(['pdbedit','-L','-w'],stderr=subprocess.DEVNULL)).hexdigest(),'blocks':{}}
 blocks=json.loads(subprocess.check_output(['lsblk','-b','-J','-o','NAME,PATH,TYPE,SIZE,SERIAL,FSTYPE,UUID,MOUNTPOINT'],text=True))
 for vol in ('a59c2c54-02ee-4a4a-8132-47967728d1bc','d647e089-ef59-4187-b608-8196cd9e646a'):
  dev=resolve_volume_device(blocks['blockdevices'],volume_uuid=vol,expected_size=2147483648,allow_blank_size_fallback=False)['devicePath']
  with open(dev,'rb') as f:
   for off in (1048576,3145728,4194304):
    f.seek(off);v['blocks'][vol+':'+str(off)]=hashlib.sha256(f.read(64)).hexdigest()
 return v
paths=[Path('/etc/ablestack-storage/desired-state/nfs-export-apply.json'),Path('/etc/ablestack-storage/nfs-local-probes.json'),Path('/etc/ablestack-storage/desired-state/smb-share-apply.json'),Path('/etc/ablestack-storage/iscsi-targets.json'),Path('/etc/ablestack-storage/nvmeof-subsystems.json')]
def images():return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
before=protected();before_images=images();active_sha=hashlib.sha256((release/'lib/ablestack-storage/configuration_transaction.py').read_bytes()).hexdigest()
def request():
 p=copy.deepcopy(saved);p['operationid']=str(uuid.uuid4());p['baseRevision']=0;p['targetRevision']=1;p['restoreBootId']=tx.RuntimeAdapter.restore_boot()
 for q in p['restoreAdmission'].values():q['revision']=0
 p['restorePlanDigest']=hashlib.sha256(json.dumps(p['candidate'],sort_keys=True).encode()).hexdigest()
 return p
class Fault(tx.RuntimeAdapter):
 def verify(self, commands, restoring=False):
  super().verify(commands,restoring)
  if not restoring:raise tx.Rejected('CONTROLLED_AFTER_NFS_VERIFY')
leases=[];checks={}
try:
 for name in ['/run/lock/ablestack-storage-runtime-upgrade.lock','/run/lock/ablestack-storage-boot-reconcile.lock','/var/lib/ablestack-storage/configuration-operations/'+saved['instanceUuid']+'/lock']:
  f=Path(name).open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);leases.append(f)
 for fault in [False,True]:
  req=request();txn=tx.Transaction(stage/('fault' if fault else 'success'),Fault if fault else None)
  result=txn.execute('apply',req);private=txn.paths(req)[1];adapter=txn.adapter_factory(private)
  if not fault:
   assert result['state']=='VERIFIED',result
   assert set(result['restoreVerification']['receipts'])=={'nfs export apply'}
   receipt=tx.load(private/'restore-candidate-receipts.json')
   assert receipt['nfs export apply']['requestHash']==tx.public_hash(req['candidate']['nfs export apply'])
   assert result['restoreVerification']['directoryPolicies']==['f084e464-a5cf-4dd6-9caf-cda19d172093']
   assert txn.execute('commit',req)['state']=='COMMITTED'
   # Re-query durable proof; reject altered boot/hash instead of weakening receipt checks.
   for field,value in [('bootId','different-boot'),('requestHash','0'*64)]:
    bad=copy.deepcopy(receipt);bad['nfs export apply'][field]=value;tx.atomic_json(private/'restore-candidate-receipts.json',bad)
    try:adapter.verify_restore_receipts(req['candidate']);raise AssertionError('tamper accepted')
    except tx.Rejected as e:assert e.code==('RESTORE_RECEIPT_BOOT_CHANGED' if field=='bootId' else 'RESTORE_RECEIPT_MISMATCH')
    finally:tx.atomic_json(private/'restore-candidate-receipts.json',receipt)
   result=txn.rollback(tx.load(private/'status.json'),private/'status.json',adapter)
  assert result['state']=='ROLLED_BACK' and result['rollback']['state']=='SUCCEEDED',result
  if fault:assert result['originalfailure']['code']=='CONTROLLED_AFTER_NFS_VERIFY'
  before_receipt=tx.load(private/'restore-before-receipts.json')
  assert before_receipt['nfs export apply']['requestHash']==tx.public_hash(req['before']['nfs export apply'])
  snap=tx.load(private/'before.json')['nfsClientPolicy']
  assert all(adapter.nfs_client_policy_engine().process(row['key'],Path(row['config']),row['port'])==row['process'] for row in snap['rows'])
  assert before==protected()
  assert before_images==images()
  checks['controlledFailure' if fault else 'successAndCommit']={'state':result['state'],'rollback':result['rollback']['state'],'candidateReceipt':True,'separateBeforeReceipt':True,'sameProcess':True,'dataAclAccountsPreserved':True,'desiredBytesRestored':True}
 assert hashlib.sha256((release/'lib/ablestack-storage/configuration_transaction.py').read_bytes()).hexdigest()==active_sha
 print(json.dumps({'status':'PASS','stage':str(stage),'checks':checks,'bootHashTamperRejected':True,'privateModesPreserved':True,'activeSignedCodePreserved':True}))
finally:
 for f in reversed(leases):f.close()
