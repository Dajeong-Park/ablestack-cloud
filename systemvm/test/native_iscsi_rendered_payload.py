#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
"""Apply the actual Java-rendered iSCSI candidate to one disposable 2GiB SPARSE/FAT backstore, then restore."""
import argparse
parser=argparse.ArgumentParser(description=__doc__)
for name in ['candidate','instance','target','volume','active-ip','shared-directory']:
 parser.add_argument('--'+name,required=True)
parser.add_argument('--active-port',type=int,required=True)
parser.add_argument('--revision',type=int,required=True)
parser.add_argument('--provisioning',choices=['SPARSE','FAT'],required=True)
args=parser.parse_args()
from pathlib import Path
from urllib.parse import unquote
import sys,json,uuid,hashlib,subprocess,fcntl,contextlib,stat,shutil,re
runtime=Path('/opt/ablestack/storage-runtime/current').resolve();sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
import configuration_transaction as tx
from configuration_preflight import inspect
from rtslib_fb import RTSRoot
candidate=json.loads(Path(args.candidate).read_text())
state=Path('/etc/ablestack-storage/iscsi-targets.json');before=json.loads(state.read_text())
instance=str(uuid.UUID(args.instance))
assert candidate['instanceUuid']==before['instanceUuid']==instance and candidate['enabled'] is True
assert candidate['targets']==before['targets'] and candidate['listeners']==before['listeners']
assert candidate['listenIp']==args.active_ip and candidate['port']==args.active_port
assert candidate['targets'][0]['volumeUuid']==str(uuid.UUID(args.volume)) and candidate['targets'][0]['uuid']==str(uuid.UUID(args.target))
assert int(candidate['targets'][0]['volumeSizeBytes'])==2147483648
admission=inspect({'instanceUuid':instance,'protocol':'ISCSI','revision':args.revision,'ports':[args.active_port],'drainrequired':True,'resourcecount':1})
assert admission['status']=='READY',{'status':admission['status'],'checks':admission['checks']}
if shutil.which('firewall-cmd'):
 active=subprocess.run(['firewall-cmd','--state'],capture_output=True).returncode==0
 if active:
  assert subprocess.run(['firewall-cmd','--query-port='+str(args.active_port)+'/tcp'],capture_output=True).returncode==0
  assert subprocess.run(['firewall-cmd','--permanent','--query-port='+str(args.active_port)+'/tcp'],capture_output=True).returncode==0
firewall=subprocess.check_output(['iptables-save']) if shutil.which('iptables-save') else None
def firewall_shape(value):
 return re.sub(rb'\[\d+:\d+\]',b'[0:0]',b'\n'.join(x for x in value.splitlines() if not x.startswith(b'#')))
leaf=Path(args.shared_directory)
def proof():
 root=RTSRoot();so=next(s for s in root.storage_objects if s.name=='ablestack-'+args.target)
 with open(so.udev_path,'rb') as f:f.seek(1048576);data=hashlib.sha256(f.read(64)).hexdigest()
 return {'lioHash':hashlib.sha256(json.dumps(root.dump(),sort_keys=True).encode()).hexdigest(),
 'wwn':so.wwn,'markerSha256':data,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in leaf.iterdir() if p.is_file()},
 'directory':[leaf.stat().st_ino,leaf.stat().st_uid,leaf.stat().st_gid,stat.S_IMODE(leaf.stat().st_mode)],
 'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',str(leaf)])).hexdigest(),
 'mac':Path('/sys/class/net/eth0/address').read_text().strip(),
 'addresses':json.loads(subprocess.check_output(['ip','-j','-4','addr']))}
initial=proof();stateHash=hashlib.sha256(state.read_bytes()).hexdigest()
private=Path('/var/tmp/issue1462-real-render-'+uuid.uuid4().hex);private.mkdir(mode=0o700)
operation=str(uuid.uuid4())
payload={'instanceUuid':instance,'operationid':operation,'baseRevision':args.revision,'targetRevision':args.revision+1,
 'before':{'iscsi target apply':before},'candidate':{'iscsi target apply':candidate}}
adapter=tx.RuntimeAdapter(private)
with contextlib.ExitStack() as stack:
 for path in [Path('/var/lib/ablestack-storage/configuration-operations')/instance/'lock',Path('/run/lock/ablestack-storage-boot-reconcile.lock')]:
  h=stack.enter_context(path.open('a+'));fcntl.flock(h,fcntl.LOCK_EX|fcntl.LOCK_NB)
 tx.atomic_json(adapter.payload_path,payload);adapter.preflight(payload);adapter.snapshot(payload)
 try:
  adapter.apply(payload['candidate']);adapter.verify(payload['candidate'])
  result=tx.load(private/'runner-result.json')
  assert result['returncode']==0 and result['result']['applied']==1 and result['result']['skipped']==0
  assert result['result']['ports']==[args.active_port] and result['result']['listening'] is True
  assert json.loads(state.read_text())['enabled'] is True
  assert proof()==initial
 finally:
  adapter.restore();adapter.verify_restored();adapter.restore_files(tx.load(adapter.snapshot_path))
  if firewall is not None:
   current=subprocess.check_output(['iptables-save'])
   if firewall_shape(current)!=firewall_shape(firewall):
    subprocess.run(['iptables-restore'],input=firewall,check=True)
 assert proof()==initial and hashlib.sha256(state.read_bytes()).hexdigest()==stateHash
result={'passed':True,'actualJavaRenderedCandidate':True,'applied':1,'skipped':0,'verifiedPorts':[args.active_port],
 'dataAclWwnMacAddressesUnchanged':True,'originalConfigRestored':True,'originalEnabled':before['enabled'],
 'provisioning':args.provisioning,'operation':operation,'privateEvidence':str(private)}
(private/'native-regression-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
