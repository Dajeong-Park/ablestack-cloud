import os,sys,json,uuid,io
os.environ['KRB5CCNAME']='MEMORY:issue1466-design'
from samba.credentials import Credentials,MUST_USE_KERBEROS
from samba.param import LoadParm
from samba import gensec
from samba.dcerpc import dnsserver
from samba.netcmd import dns
from samba.samdb import SamDB
x=json.load(sys.stdin);lp=LoadParm();lp.load('/etc/samba/smb.conf');c=Credentials();c.guess(lp);c.set_username(x['username']);c.set_password(x['password']);c.set_domain('ABLESTACK');c.set_realm('ABLESTACK.LOCAL');c.set_kerberos_state(MUST_USE_KERBEROS);c.set_gensec_features(c.get_gensec_features()|gensec.FEATURE_SEAL)
conn=dnsserver.dnsserver('ncacn_ip_tcp:'+x['dcFqdn']+'[seal]',lp,c)
r={}
def query(name):
 n,res=conn.DnssrvEnumRecords2(dnsserver.DNS_CLIENT_VERSION_LONGHORN,0,x['dcFqdn'],'ablestack.local',name,None,dns.dns_type_flag('A'),dnsserver.DNS_RPC_VIEW_AUTHORITY_DATA,None,None)
 out=io.StringIO();dns.print_dnsrecords(out,res);return out.getvalue()
def modify(name,ip,add):
 rec=dns.data_to_dns_record(dns.dns_type_flag('A'),ip);rec.dwTtlSeconds=300
 if not add:
  rec=dns.dns_record_match(conn,x['dcFqdn'],'ablestack.local',name,dns.dns_type_flag('A'),ip);assert rec
 buf=dnsserver.DNS_RPC_RECORD_BUF();buf.rec=rec
 conn.DnssrvUpdateRecord2(dnsserver.DNS_CLIENT_VERSION_LONGHORN,0,x['dcFqdn'],'ablestack.local',name,buf if add else None,None if add else buf)
modify('i1466-a','203.0.113.66',True);r['dnsBeforeExactDelete']=query('i1466-a');modify('i1466-a','10.10.13.220',False);r['dnsAfterExactDelete']=query('i1466-a')
r['foreignRdataPreserved']='203.0.113.66' in r['dnsAfterExactDelete'] and '10.10.13.220' not in r['dnsAfterExactDelete']
modify('i1466-a','203.0.113.66',False);modify('i1466-b','10.10.13.220',False);r['temporaryARecordsRemoved']=True
print(json.dumps(r))