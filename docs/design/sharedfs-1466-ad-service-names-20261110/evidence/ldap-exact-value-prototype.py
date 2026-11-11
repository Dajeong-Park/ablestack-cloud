# Design experiment only. Reads credentials from runtime stdin; never installed as product code.
import os,ctypes,ctypes.util,subprocess,json,sys,uuid
x=json.load(sys.stdin)
k=ctypes.CDLL(ctypes.util.find_library('keyutils'))
k.keyctl_join_session_keyring.argtypes=[ctypes.c_char_p];k.keyctl_join_session_keyring.restype=ctypes.c_long
key=k.keyctl_join_session_keyring(('issue1466-'+str(uuid.uuid4())).encode());assert key>0
cache='KEYRING:session:issue1466';os.environ['KRB5CCNAME']=cache
lib=ctypes.util.find_library('ldap-2.5');print(json.dumps({'lib':lib}))
l=ctypes.CDLL(lib)
P=ctypes.c_void_p;C=ctypes.c_char_p;I=ctypes.c_int
l.ldap_initialize.argtypes=[ctypes.POINTER(P),C];l.ldap_initialize.restype=I
l.ldap_set_option.argtypes=[P,I,P];l.ldap_set_option.restype=I
l.ldap_get_option.argtypes=[P,I,P];l.ldap_get_option.restype=I
l.ldap_sasl_interactive_bind_s.argtypes=[P,C,C,P,P,ctypes.c_uint,P,P];l.ldap_sasl_interactive_bind_s.restype=I
l.ldap_err2string.argtypes=[I];l.ldap_err2string.restype=C
l.ldap_unbind_ext_s.argtypes=[P,P,P];l.ldap_unbind_ext_s.restype=I
ld=P()
try:
 r=subprocess.run(['kinit','-c',cache,x['username']+'@ABLESTACK.LOCAL'],input=x['password']+'\n',capture_output=True,text=True,timeout=20);assert r.returncode==0,r.stderr
 assert l.ldap_initialize(ctypes.byref(ld),b'ldap://ad1453.ablestack.local')==0
 assert l.ldap_set_option(ld,0x0011,ctypes.byref(I(3)))==0
 assert l.ldap_set_option(ld,0x6106,ctypes.cast(C(b'minssf=128'),P))==0
 class Interact(ctypes.Structure):
  _fields_=[('id',ctypes.c_ulong),('challenge',C),('prompt',C),('defresult',C),('result',P),('len',ctypes.c_uint)]
 refs=[]
 @ctypes.CFUNCTYPE(I,P,ctypes.c_uint,P,P)
 def cb(a,b,c,d):
  arr=ctypes.cast(d,ctypes.POINTER(Interact));i=0
  while arr[i].id:
   ident=arr[i].id;v=arr[i].defresult or b''
   if ident==0x4002:v=x['username'].encode()
   elif ident==0x4008:v=b'ABLESTACK.LOCAL'
   v=ctypes.create_string_buffer(v);refs.append(v);arr[i].result=ctypes.cast(v,P);arr[i].len=len(v.value)
   print(json.dumps({'interaction':ident,'prompt':(arr[i].prompt or b'').decode()}));i+=1
  return 0
 assert l.ldap_set_option(ld,0x610b,ctypes.byref(I(1)))==0
 r=l.ldap_sasl_interactive_bind_s(ld,None,b'GSSAPI',None,None,2,ctypes.cast(cb,P),None)
 ssf=ctypes.c_uint();l.ldap_get_option(ld,0x6104,ctypes.byref(ssf))
 assert r==0 and ssf.value>=128,{'bind':r,'ssf':ssf.value}
 class Berval(ctypes.Structure):_fields_=[('len',ctypes.c_size_t),('value',P)]
 class Mod(ctypes.Structure):_fields_=[('op',I),('type',C),('values',ctypes.POINTER(C))]
 l.ldap_search_ext_s.argtypes=[P,C,I,C,ctypes.POINTER(C),I,P,P,P,I,ctypes.POINTER(P)];l.ldap_search_ext_s.restype=I
 l.ldap_first_entry.argtypes=[P,P];l.ldap_first_entry.restype=P
 l.ldap_count_entries.argtypes=[P,P];l.ldap_count_entries.restype=I
 l.ldap_get_values_len.argtypes=[P,P,C];l.ldap_get_values_len.restype=ctypes.POINTER(ctypes.POINTER(Berval))
 l.ldap_value_free_len.argtypes=[ctypes.POINTER(ctypes.POINTER(Berval))]
 l.ldap_msgfree.argtypes=[P]
 l.ldap_modify_ext_s.argtypes=[P,C,ctypes.POINTER(ctypes.POINTER(Mod)),P,P];l.ldap_modify_ext_s.restype=I
 target=b'<GUID=7189b3df-b6d3-4089-83bf-c1ec9d79bf68>'
 def read():
  result=P();attrs=(C*4)(b'objectGUID',b'objectSid',b'servicePrincipalName',None)
  code=l.ldap_search_ext_s(ld,target,0,b'(objectClass=*)',attrs,0,None,None,None,2,ctypes.byref(result))
  assert code==0,{'search':code,'error':l.ldap_err2string(code).decode()}
  try:
   assert l.ldap_count_entries(ld,result)==1
   entry=l.ldap_first_entry(ld,result);out={}
   for attr in ['objectGUID','objectSid','servicePrincipalName']:
    vals=l.ldap_get_values_len(ld,entry,attr.encode());arr=[]
    if vals:
     i=0
     while vals[i]:
      v=vals[i].contents;arr.append(ctypes.string_at(v.value,v.len));i+=1
     l.ldap_value_free_len(vals)
    out[attr]=arr
   assert len(out['objectGUID'])==1
   guid=str(uuid.UUID(bytes_le=out['objectGUID'][0]));assert guid=='7189b3df-b6d3-4089-83bf-c1ec9d79bf68'
   return {'guid':guid,'spns':sorted(v.decode() for v in out['servicePrincipalName']),'sidHex':out['objectSid'][0].hex()}
  finally:l.ldap_msgfree(result)
 print(json.dumps({'phase':'before','ssf':ssf.value,'observed':read()}))
 for action in x.get('actions',[]):
  assert action['op'] in ['add','delete']
  value=action['value'];assert value.startswith('cifs/i1466-') and value.endswith('.ablestack.local')
  vals=(C*2)(value.encode(),None);mod=Mod(0 if action['op']=='add' else 1,b'servicePrincipalName',vals)
  mods=(ctypes.POINTER(Mod)*2)(ctypes.pointer(mod),None)
  read()
  code=l.ldap_modify_ext_s(ld,target,mods,None,None)
  print(json.dumps({'phase':action['op'],'value':value,'code':code,'message':l.ldap_err2string(code).decode(),'observed':read()}))
  assert code==0
finally:
 if ld:l.ldap_unbind_ext_s(ld,None,None)
 k.keyctl_clear(ctypes.c_long(key))
