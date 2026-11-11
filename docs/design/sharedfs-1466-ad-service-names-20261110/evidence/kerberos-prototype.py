import sys,json,os,subprocess,ctypes,ctypes.util,uuid,hashlib,socket
x=json.load(sys.stdin);k=ctypes.CDLL(ctypes.util.find_library('keyutils'));k.keyctl_join_session_keyring.argtypes=[ctypes.c_char_p];k.keyctl_join_session_keyring.restype=ctypes.c_long;key=k.keyctl_join_session_keyring(('issue1466-'+str(uuid.uuid4())).encode());assert key>0
cache='KEYRING:session:issue1466';env={**os.environ,'KRB5CCNAME':cache};r={'connections':[],'dns':{},'persistentCredentialFilesWritten':False}
try:
 p=subprocess.run(['kinit','-c',cache,x['username']+'@ABLESTACK.LOCAL'],input=x['password']+'\n',capture_output=True,text=True,env=env,timeout=20);assert p.returncode==0,(p.stdout+p.stderr).replace(x['password'],'<redacted>')
 for host in ['i1466-a.ablestack.local','i1466-b.ablestack.local']:
  r['dns'][host]=sorted({a[4][0] for a in socket.getaddrinfo(host,445,socket.AF_INET)})
  for port in [445,1445]:
   fd=os.memfd_create('issue1466-read',0)
   try:
    p=subprocess.run(['smbclient','//'+host+'/i1465ad5','-p',str(port),'--use-kerberos=required','--use-krb5-ccache='+cache,'-N','-c','get rw-marker /proc/self/fd/'+str(fd)],pass_fds=(fd,),capture_output=True,text=True,env=env,timeout=20)
    os.lseek(fd,0,0);data=os.read(fd,1048576)
    r['connections'].append({'fqdn':host,'port':port,'exit':p.returncode,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'out':(p.stdout+p.stderr)[-1200:]})
   finally:os.close(fd)
 r['tickets']=subprocess.check_output(['klist','-e','-c',cache],text=True,env=env)
 print(json.dumps(r))
finally:k.keyctl_clear(ctypes.c_long(key))