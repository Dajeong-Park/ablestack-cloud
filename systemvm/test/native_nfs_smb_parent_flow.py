#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
import argparse,copy,hashlib,json,os,pwd,shutil,stat,subprocess,sys,tempfile,uuid
from pathlib import Path
parser=argparse.ArgumentParser(description="Opt-in SPARSE/FAT SystemVM prepare-to-POSIX parent regression; never formats DATA")
parser.add_argument('--volume',required=True)
parser.add_argument('--filesystem-uuid',required=True)
parser.add_argument('--runtime-root',required=True)
parser.add_argument('--user',required=True)
parser.add_argument('--provisioning',choices=('SPARSE','FAT'),required=True)
args=parser.parse_args()
assert os.geteuid()==0
stage=Path(args.runtime_root)
lib=stage/'lib/ablestack-storage'
sys.path.insert(0,str(lib))
from shared_directory_policy import FileSharePathBindings, PolicyError
import configuration_transaction as tx
volume=Path(args.volume)
assert volume.parent==Path('/srv/ablestack-storage/volumes') and str(uuid.UUID(volume.name))==volume.name and not volume.is_symlink()
fs=subprocess.check_output(['findmnt','-n','-M',str(volume),'-o','UUID'],text=True).strip()
assert fs==args.filesystem_uuid
def signature(path):
 st=path.stat()
 return [st.st_ino,st.st_uid,st.st_gid,stat.S_IMODE(st.st_mode),hashlib.sha256(subprocess.check_output(['getfacl','-cpn',str(path)])).hexdigest()]
original_path=volume/'export' if (volume/'export').exists() else volume
original=signature(original_path)
control=Path(tempfile.mkdtemp(prefix='issue1462-flow-',dir='/var/tmp')); control.chmod(0o755)
nonce='.issue1462-flow-'+uuid.uuid4().hex
owned=volume/nonce;path=owned/'export/share'
operation=str(uuid.uuid4());share=str(uuid.uuid4());instance=str(uuid.uuid4())
payload={'protocol':'NFS','deferDirectory':True,'configurationOperationId':operation,'instanceUuid':instance,
 'volumeUuid':volume.name,'volumeName':'issue1462-pretest','volumeSizeBytes':int(subprocess.check_output(['blockdev','--getsize64',subprocess.check_output(['findmnt','-n','-M',str(volume),'-o','SOURCE'],text=True).strip()],text=True)),'shareUuid':share,
 'path':'/'+nonce+'/export/share','importMode':'INSPECT_ONLY',
 'config':{'volumeMountPath':str(volume),'filesystemUuid':fs,'createDirectory':True}}
binding_engine=None
previous=os.umask(0o077)
try:
 request=control/'inspect.json';request.write_text(json.dumps(payload))
 got=subprocess.run([str(stage/'ablestack-storagectl'),'volume','attach','inspect',str(request)],capture_output=True,text=True,timeout=30)
 assert got.returncode==0,got.stderr
 receipt=json.loads(got.stdout)
 assert receipt['directoryManagedByApply'] and not receipt['directoryCreated'] and receipt['filesystemUuid']==fs and not owned.exists()
 row={'uuid':share,'state':'Allocated','config':{'volumeMountPath':str(volume),'backingPath':str(path),
      'filesystemUuid':fs,'createDirectory':True,'lastInspection':receipt}}
 value={'instanceUuid':instance,'configurationOperationId':operation,'posixOnly':True,'exports':[row],
        'posixIntent':{'version':1,'targetUuid':share,'create':True,'fields':{}}}
 request={'operationid':operation,'instanceUuid':instance,'baseRevision':0,'targetRevision':1,
          'candidate':{'nfs export apply':value},'before':{}}
 class Deferred(tx.RuntimeAdapter):
  def path_bindings(self,restoring=False):
   return FileSharePathBindings(root=control/'bindings',journal=self.private/'pathbindings.json',restoring=restoring)
  def run(self,*args):raise AssertionError('NFS published before ACL')
 transaction=tx.Transaction(control/'transaction',Deferred)
 result=transaction.execute('apply',request)
 assert result['state']=='VERIFIED',result
 assert stat.S_IMODE((owned/'export').stat().st_mode)==0o711
 assert (path.stat().st_uid,path.stat().st_gid,stat.S_IMODE(path.stat().st_mode))==(65534,65534,0o775)
 journal=json.loads((control/'transaction'/instance/operation/'pathbindings.json').read_text())
 assert len(journal['created'])==3
 # Actual current-user POSIX grant matches how the SMB common policy renders.
 subprocess.run(['setfacl','-m','u:'+str(pwd.getpwnam(args.user).pw_uid)+':rwx',str(path)],check=True)
 bound=copy.deepcopy(row);bound['state']='Ready';bound['acls']=[{'principalType':'LOCAL_USER','principal':args.user}]
 bound['config'].update(pathBindingVersion=1,relativeSharePath=str(path.relative_to(volume)),
   pathIdentity={'filesystemUuid':fs,'volumeRootInode':volume.stat().st_ino,'inode':path.stat().st_ino})
 binding_engine=FileSharePathBindings(root=control/'smb-bindings',journal=control/'private'/'smb-journal.json')
 binding_engine.begin({'instanceUuid':instance,'operationid':str(uuid.uuid4()),'candidate':{'smb share apply':{'shares':[bound]}}})
 data_before=signature(path)
 binding=binding_engine.ensure(bound,'SMB')
 record=binding_engine.registered()['records'][share]
 anchor=Path(record['anchor'])
 assert anchor.stat().st_ino==path.stat().st_ino
 assert stat.S_IMODE(binding_engine.root.stat().st_mode)==0o711
 assert stat.S_IMODE(binding_engine.registry.stat().st_mode)==0o600
 assert binding_engine.smb_parent_traversal(bound)['code']=='SMB_PARENT_TRAVERSAL_OK'
 subprocess.run(['runuser','-u',args.user,'--','touch',str(anchor/'client')],check=True)
 assert (path/'client').is_file()
 (path/'client').unlink()
 assert signature(path)==data_before
 registry_before=binding_engine.registry.read_bytes()
 binding_engine.root.chmod(0o700)
 assert binding_engine.smb_parent_traversal(bound)['code']=='SMB_RUNTIME_BINDING_TRAVERSAL_DENIED'
 binding_engine.prepare_runtime_root()
 assert binding_engine.registry.read_bytes()==registry_before
 assert binding_engine.smb_parent_traversal(bound)['code']=='SMB_PARENT_TRAVERSAL_OK'
 binding_engine.rollback()
 binding_engine=None
 # Failure after verified POSIX must remove only the new operation-owned empty tree.
 retry_op=str(uuid.uuid4()); retry_share=str(uuid.uuid4())
 inspect_request=copy.deepcopy(payload)
 inspect_request.update(configurationOperationId=retry_op,shareUuid=retry_share,path='/'+nonce+'/rollback/share')
 inspect_file=control/'rollback-inspect.json';inspect_file.write_text(json.dumps(inspect_request))
 prepared=subprocess.run([str(stage/'ablestack-storagectl'),'volume','attach','inspect',str(inspect_file)],capture_output=True,text=True,timeout=30)
 assert prepared.returncode==0,prepared.stderr
 retry_receipt=json.loads(prepared.stdout)
 retry_row=copy.deepcopy(row);retry_row['uuid']=retry_share
 retry_row['config'].update(backingPath=str(owned/'rollback/share'),lastInspection=retry_receipt)
 retry_value={'instanceUuid':instance,'configurationOperationId':retry_op,'posixOnly':True,'exports':[retry_row],
    'posixIntent':{'version':1,'targetUuid':retry_share,'create':True,'fields':{}}}
 retry_request={'operationid':retry_op,'instanceUuid':instance,'baseRevision':0,'targetRevision':1,
    'candidate':{'nfs export apply':retry_value},'before':{}}
 class Failed(Deferred):
  def verify(self,commands,restoring=False):
   super().verify(commands,restoring)
   if not restoring:raise tx.Rejected('INJECTED_AFTER_POSIX')
 failed=tx.Transaction(control/'failure',Failed).execute('apply',retry_request)
 assert failed['state']=='ROLLED_BACK' and failed['originalfailure']['code']=='INJECTED_AFTER_POSIX',failed
 assert not (owned/'rollback').exists() and path.is_dir()
 assert signature(original_path)==original
 print(json.dumps({'passed':True,'checks':['actual volume attach inspect defers NFS mkdir and verifies mounted UUID',
  'actual deferred transaction creates journal-owned parents with 0711 under private umask077',
  'leaf default POSIX 65534:65534/0775 verified before any publish',
  'actual bind anchor under private umask077 supports account write with unchanged DATA ACL and private registry','failure compensation removes owned empty paths only','original failed parent unchanged']}))
finally:
 os.umask(previous)
 if binding_engine is not None:binding_engine.rollback()
 if owned.exists():
  assert owned.parent==volume and owned.name==nonce and not owned.is_symlink()
  shutil.rmtree(owned)
 shutil.rmtree(control)
