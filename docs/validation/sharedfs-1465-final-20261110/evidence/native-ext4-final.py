import os,sys,json,tempfile,uuid,hashlib,copy,subprocess
from pathlib import Path
helper=Path('/usr/local/bin/ablestack-storagectl').resolve().parent/'lib/ablestack-storage'
sys.path.insert(0,str(helper));os.environ['ABLESTACK_STORAGE_HELPER_ROOT']=str(helper)
import shared_directory_policy as m
volume='2a75f6d4-5808-47d7-81fc-5fcd2d4f73bf'
managed=m.MANAGED;parent=managed/volume
fs=subprocess.check_output(['findmnt','-n','-o','UUID,FSTYPE','-T',str(parent)],text=True).strip()
assert fs.split()[-1]=='ext4'
production=Path('/etc/ablestack-storage/desired-state/directory-policy.json')
stamp=hashlib.sha256(production.read_bytes()).hexdigest()
existing=list(parent.glob('.issue1465-unpublished-*'));assert len(existing)==1
path=existing[0];assert not path.is_symlink() and path.parent==parent
child=path/'original';assert child.read_bytes()==b'issue1465-private-ext4-original\n'
def state():
 st=path.stat();c=child.stat()
 return [st.st_uid,st.st_gid,st.st_mode,st.st_ino,subprocess.check_output(['getfacl','-cpn',str(path)],text=True),c.st_uid,c.st_gid,c.st_mode,c.st_ino,hashlib.sha256(child.read_bytes()).hexdigest()]
baseline=state()
with tempfile.TemporaryDirectory(prefix='issue1465-ext4-',dir='/run') as tmp:
 raised=[False]
 def failure(_):
  if not raised[0]:
   raised[0]=True
   raise RuntimeError('INJECTED_AFTER_PRIVATE_METADATA_WRITE')
 e=m.DirectoryPolicies(registry=Path(tmp)/'registry.json',refresh=failure)
 row={'config':{'volumeMountPath':str(parent),'backingPath':str(path)}}
 o=e.observe(row);p={k:o[k] for k in ['volumeuuid','canonicalpath','filesystemuuid','inode','owneruid','ownergid','mode']};p.update(uuid=str(uuid.uuid4()),revision=1)
 adopt={'action':'ADOPT','policy':p,'changes':{},'expectedObservation':o['fingerprint'],'units':[],'smbShares':[],'references':[]}
 e.apply(adopt,e.snapshot(adopt))
 pp=copy.deepcopy(e.read()[p['uuid']]);pp.update(revision=2,owneruid=100005,ownergid=100006,mode='2770');pp.pop('principalBindings',None)
 value={'action':'UPDATE','policy':pp,'changes':{'ownerUid':100005,'ownerGid':100006,'mode':'2770'},'expectedPolicyRevision':1,'expectedObservation':e.observe(row)['fingerprint'],'units':[],'smbShares':[],'references':[],
 'aclchanges':{'version':1,'entries':[{'action':'UPSERT','scope':'BOTH','principalType':'UID','principal':'100004','permissions':'r-x'}]}}
 value['policy']=e.prepare(value)[0];before=e.snapshot(value)
 try:e.apply(value,before);raise AssertionError('injection missing')
 except RuntimeError as error:assert str(error)=='INJECTED_AFTER_PRIVATE_METADATA_WRITE'
 assert state()!=baseline
 e.restore(before,1)
 assert state()==baseline
 remove={'action':'DELETE','policy':e.read()[p['uuid']],'changes':{},'expectedPolicyRevision':1,'expectedObservation':e.observe(row)['fingerprint'],'units':[],'smbShares':[],'references':[]}
 e.apply(remove,e.snapshot(remove));assert not e.read();assert state()==baseline
assert hashlib.sha256(production.read_bytes()).hexdigest()==stamp
print(json.dumps({'filesystem':fs,'fixtureRelativePath':path.relative_to(parent).as_posix(),'actualExt4PartialMutationObserved':True,'injectedFailureRollbackVerified':True,'privateUnregisterPreservedDirectoryAclData':True,'productionRegistryUnchanged':True,'baseline':baseline}))
