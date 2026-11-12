import os,sys,json,io
os.environ['KRB5CCNAME']='MEMORY:issue1466-dns-rpc'
from samba.credentials import Credentials,MUST_USE_KERBEROS
from samba.param import LoadParm
from samba import gensec
from samba.dcerpc import dnsserver
from samba.netcmd import dns
x=json.load(sys.stdin);lp=LoadParm();lp.load('/etc/samba/smb.conf');c=Credentials();c.guess(lp);c.set_username(x['username']);c.set_password(x['password']);c.set_domain('ABLESTACK');c.set_realm('ABLESTACK.LOCAL');c.set_kerberos_state(MUST_USE_KERBEROS);c.set_gensec_features(c.get_gensec_features()|gensec.FEATURE_SEAL)
r={}
try:
 conn=dnsserver.dnsserver('ncacn_ip_tcp:'+x['dcFqdn']+'[seal]',lp,c)
 try:
  n,res=conn.DnssrvEnumRecords2(dnsserver.DNS_CLIENT_VERSION_LONGHORN,0,x['dcFqdn'],'ablestack.local','i1466-a',None,dns.dns_type_flag('A'),dnsserver.DNS_RPC_VIEW_AUTHORITY_DATA,None,None)
  out=io.StringIO();dns.print_dnsrecords(out,res);r['query']={'success':True,'out':out.getvalue()}
 except Exception as e:r['query']={'success':False,'code':str(e)}
 try:
  rec=dns.data_to_dns_record(dns.dns_type_flag('A'),'10.10.13.220');rec.dwTtlSeconds=300;b=dnsserver.DNS_RPC_RECORD_BUF();b.rec=rec
  conn.DnssrvUpdateRecord2(dnsserver.DNS_CLIENT_VERSION_LONGHORN,0,x['dcFqdn'],'ablestack.local','i1466-b',b,None)
  r['add']={'success':True}
 except Exception as e:r['add']={'success':False,'code':str(e)}
except Exception as e:r['connect']={'success':False,'code':str(e)}
print(json.dumps(r))