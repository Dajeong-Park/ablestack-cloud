import json,sys,os,stat,subprocess,tempfile
from pathlib import Path
json.load(sys.stdin)
sys.path.insert(0,'/opt/ablestack/storage-runtime/current/lib/ablestack-storage')
import smb_service_names as names
data=Path('/srv/ablestack-storage/volumes/e070a0aa-dbf5-48c0-83e0-09f874446277')
key=Path('/etc/krb5.keytab')
def info(p):
 s=p.stat()
 return {'exists':True,'device':s.st_dev,'inode':s.st_ino,'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'bytes':s.st_size}
before={'root':info(Path('/')),'data':info(data),'keytab':info(key),'mountNamespace':os.readlink('/proc/self/ns/mnt')}
paths=['/var/lib/samba/private/secrets.tdb','/var/lib/samba/private/passdb.tdb','/var/lib/samba/winbindd_idmap.tdb',
'/var/lib/ablestack-storage/iscsi-identities/identities.json','/etc/krb5.keytab']
inventory=[{'path':p,**info(Path(p)),'onRootDevice':Path(p).stat().st_dev==Path('/').stat().st_dev} if Path(p).exists() else {'path':p,'exists':False} for p in paths]
with names.NativeDirectory() as d:identityBefore=d.computer()
with tempfile.TemporaryDirectory(prefix='issue1467-design-',dir='/run') as temp:
 empty=Path(temp)/'empty-keytab';empty.write_bytes(b'');empty.chmod(0o600)
 child=r"""
import os,sys,json,subprocess
sys.path.insert(0,'/opt/ablestack/storage-runtime/current/lib/ablestack-storage')
import smb_service_names as n
assert os.readlink('/proc/self/ns/mnt')!=sys.argv[2]
subprocess.run(['mount','--bind',sys.argv[1],'/etc/krb5.keytab'],check=True)
subprocess.run(['mount','-o','remount,bind,ro','/etc/krb5.keytab'],check=True)
assert os.stat('/etc/krb5.keytab').st_size==0
try:
 with n.NativeDirectory() as d:d.computer()
 raise AssertionError('Fresh ROOT without machine keytab was authenticated')
except n.NameError as error:
 print(json.dumps({'privateNamespace':True,'simulatedMissingRootKeytab':True,'result':'BLOCKED','code':error.code}))
"""
 result=subprocess.run(['unshare','--mount','--propagation','private','/usr/bin/python3','-c',child,str(empty),before['mountNamespace']],text=True,capture_output=True,check=True,timeout=60)
 cold=json.loads(result.stdout)
with names.NativeDirectory() as d:identityAfter=d.computer()
after={'root':info(Path('/')),'data':info(data),'keytab':info(key),'mountNamespace':os.readlink('/proc/self/ns/mnt')}
assert before==after
assert identityBefore==identityAfter
assert before['root']['device']!=before['data']['device']
assert cold['result']=='BLOCKED'
print(json.dumps({'test':'LIVE_SYSTEMVM_ROOT_AUTH_BOUNDARY','runtimeModule':str(Path(names.__file__).resolve()),
'checks':{'rootDataSeparate':True,'privateMountOnly':True,'coldRootKeytabMissingBlocked':True,'parentMountAndKeytabMetadataUnchanged':True,
'adComputerAndSpnsUnchanged':True,'dataDeviceInodeUnchanged':True,'dataBytesWritten':0,'secretsReadOrExportedByProbe':False},
'coldRootSimulation':cold,'stateInventory':inventory,'rootAndData':before,'identity':{'computerGuid':identityAfter['guid'],'realm':identityAfter['realm'],'computer':identityAfter['account']}}))
