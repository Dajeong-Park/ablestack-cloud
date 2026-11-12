import os,sys,json,copy,uuid,tempfile,importlib.util,hashlib,shutil
from pathlib import Path
root=Path('/usr/local/bin/ablestack-storagectl').resolve().parent/'lib/ablestack-storage'
sys.path.insert(0,str(root));os.environ['ABLESTACK_STORAGE_HELPER_ROOT']=str(root)
import shared_directory_policy as old
wire=json.loads("{\"status\":\"READY\",\"mode\":\"MANAGED\",\"instanceUuid\":\"c1eca707-a554-4c42-85cd-1e9e9744d804\",\"listeners\":[{\"id\":\"4f04f7ac-0330-4a9d-b9b7-7c37a3010e46\",\"listenIp\":\"10.10.13.220\",\"port\":1445,\"state\":\"READY\",\"pid\":65700},{\"id\":\"bb7897d3-6702-4849-9472-1cf9229ad967\",\"listenIp\":\"10.10.13.220\",\"port\":445,\"state\":\"READY\",\"pid\":65675}]}")
instance=wire['instanceUuid']
old_engine=old.DirectoryPolicies()
baseline=[old_engine.registry,old_engine.desired/'smb-share-apply.json',Path('/etc/samba/smb.conf'),Path('/etc/passwd'),Path('/etc/group')]
stamp={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in baseline}
try:old_engine.smb_readiness(wire,instance);raise AssertionError('old boundary did not reproduce')
except old.PolicyError as e:assert e.code=='DIRECTORY_SMB_IDENTITY_CHANGED'
spec=importlib.util.spec_from_file_location('candidate_directory','/run/issue1465-null-candidate.py')
candidate=importlib.util.module_from_spec(spec);spec.loader.exec_module(candidate)
engine=candidate.DirectoryPolicies()
assert engine.smb_readiness(wire,instance)==wire
raw=old_engine.smb_readiness(instance=instance)
assert engine.smb_readiness(raw,instance)==wire
bad=copy.deepcopy(wire);bad['listeners'][0]['pid']+=1
try:engine.smb_readiness(bad,instance);raise AssertionError('PID change accepted')
except candidate.PolicyError as e:assert e.code=='DIRECTORY_SMB_IDENTITY_CHANGED'
for field,value in [('port',2445),('listenIp','10.10.13.221'),('coveredBy','unexpected-owner')]:
 bad=copy.deepcopy(wire);bad['listeners'][0][field]=value
 try:engine.smb_readiness(bad,instance);raise AssertionError(field+' change accepted')
 except candidate.PolicyError as e:assert e.code=='DIRECTORY_SMB_IDENTITY_CHANGED'
volume='e070a0aa-dbf5-48c0-83e0-09f874446277'
scratch=engine.managed/volume/('.issue1465-null-'+str(uuid.uuid4()))
scratch.mkdir(mode=0o770);scratch.chmod(0o770)
child=scratch/'preserve';child.write_bytes(b'private-native-preserve');child.chmod(0o640)
try:
 with tempfile.TemporaryDirectory(prefix='issue1465-null-',dir='/run') as temp:
  private=candidate.DirectoryPolicies(registry=Path(temp)/'registry.json')
  row={'name':'private','protocol':'SMB','state':'Ready','config':{'volumeMountPath':str(engine.managed/volume),'backingPath':str(scratch)},'acls':[]}
  o=private.observe(row);p={k:o[k] for k in ('volumeuuid','canonicalpath','filesystemuuid','inode','owneruid','ownergid','mode')}
  p.update(uuid=str(uuid.uuid4()),revision=1)
  adopt={'action':'ADOPT','policy':p,'changes':{},'expectedObservation':o['fingerprint'],'units':[],'smbShares':[row],'instanceUuid':instance}
  private.apply(adopt,private.snapshot(adopt))
  acl=candidate.checked(['getfacl','-cpn',str(scratch)]);child_before=(child.stat().st_ino,child.stat().st_mode,child.read_bytes())
  p=copy.deepcopy(private.read()[p['uuid']]);p.update(revision=2);p.pop('principalBindings',None)
  change={'action':'UPDATE','policy':p,'changes':{},'expectedPolicyRevision':1,'expectedObservation':private.observe(row)['fingerprint'],
          'units':[],'smbShares':[row],'instanceUuid':instance,'expectedSmbReadiness':wire,
          'aclchanges':{'version':1,'entries':[{'action':'UPSERT','scope':'ACCESS','principalType':'UID','principal':'100004','permissions':'rwx'}]}}
  change['policy']=private.prepare(change)[0]
  before=private.snapshot(change);counts=[];private.apply(change,before,counts.append);private.verify(change,before)
  assert 'user:100004:rwx' in candidate.checked(['getfacl','-cpn',str(scratch)]).decode()
  private.restore(before,max(counts))
  assert candidate.checked(['getfacl','-cpn',str(scratch)])==acl
  assert child_before==(child.stat().st_ino,child.stat().st_mode,child.read_bytes())
 assert stamp=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in baseline}
 print(json.dumps({'actualSystemVM':True,'oldGsonBoundaryFailureReproduced':True,'actualGsonWireAccepted':True,'legacyNullProofAccepted':True,
 'pidPortAddressCoverageChangesRejected':True,'privateSparseXfsApplyVerifyRestore':True,'productionAndAccountFilesUnchanged':True,'readiness':wire}))
finally:
 assert scratch.parent==engine.managed/volume and scratch.name.startswith('.issue1465-null-') and not scratch.is_symlink()
 shutil.rmtree(scratch)
