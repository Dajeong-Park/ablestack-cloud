#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
"""Opt-in real SystemVM listener apply/rollback on one explicit disposable SPARSE/FAT backstore."""
import argparse
parser=argparse.ArgumentParser(description=__doc__)
for name in ['instance','target','volume','active-ip']:
 parser.add_argument('--'+name,required=True)
parser.add_argument('--unused-ip',default='0.0.0.0')
parser.add_argument('--unused-port',type=int,required=True)
parser.add_argument('--active-port',type=int,required=True)
parser.add_argument('--shared-directory',required=True)
parser.add_argument('--revision',type=int,required=True)
parser.add_argument('--provisioning',choices=['SPARSE','FAT'],required=True)
args=parser.parse_args()
from pathlib import Path
import sys,json,copy,uuid,hashlib,subprocess,fcntl,contextlib,stat
runtime=Path('/opt/ablestack/storage-runtime/current').resolve();sys.path.insert(0,str(runtime/'lib/ablestack-storage'))
import configuration_transaction as tx
from configuration_preflight import inspect
from rtslib_fb import RTSRoot
state=Path('/etc/ablestack-storage/iscsi-targets.json')
before=json.loads(state.read_text())
instance=str(uuid.UUID(args.instance))
assert before['instanceUuid']==instance and len(before['targets'])==1
target=before['targets'][0]
assert target['uuid']==str(uuid.UUID(args.target)) and target['volumeUuid']==str(uuid.UUID(args.volume))
assert target['listenerPorts']==str(args.active_port) and int(target['volumeSizeBytes'])==2147483648
candidate=copy.deepcopy(before)
candidate['listeners']=[r for r in before['listeners'] if not (r['listenIp']==args.unused_ip and r['port']==args.unused_port)]
assert len(candidate['listeners'])==1 and candidate['listeners'][0]['listenIp']==args.active_ip and candidate['listeners'][0]['port']==args.active_port
assert candidate['targets']==before['targets']
admission=inspect({'instanceUuid':instance,'protocol':'ISCSI','revision':args.revision,'ports':[args.unused_port,args.active_port],'drainrequired':True,'resourcecount':1})
assert admission['status']=='READY',{'status':admission['status'],'checks':admission['checks']}
leaf=Path(args.shared_directory)
def proof():
 so=next(s for s in RTSRoot().storage_objects if s.name=='ablestack-'+target['uuid'])
 assert int(subprocess.check_output(['blockdev','--getsize64',so.udev_path]))==2147483648
 with open(so.udev_path,'rb') as f:f.seek(1048576);data=hashlib.sha256(f.read(64)).hexdigest()
 graph=[{'iqn':t.wwn,'groups':[{'tag':g.tag,'portals':sorted((p.ip_address,p.port) for p in g.network_portals),
  'luns':sorted((l.lun,l.storage_object.name) for l in g.luns),'acls':sorted(a.node_wwn for a in g.node_acls)} for g in t.tpgs]} for t in RTSRoot().targets]
 return {'device':so.udev_path,'wwn':so.wwn,'markerSha256':data,'graph':graph,
 'directory':[leaf.stat().st_ino,leaf.stat().st_uid,leaf.stat().st_gid,stat.S_IMODE(leaf.stat().st_mode)],
 'acl':hashlib.sha256(subprocess.check_output(['getfacl','-cpn',str(leaf)])).hexdigest()}
initial=proof();stateHash=hashlib.sha256(state.read_bytes()).hexdigest()
private=Path('/var/tmp/issue1462-iscsi-listener-pretest-'+uuid.uuid4().hex);private.mkdir(mode=0o700)
operation=str(uuid.uuid4())
payload={'instanceUuid':instance,'operationid':operation,'baseRevision':args.revision,'targetRevision':args.revision+1,
 'before':{'iscsi target apply':before},'candidate':{'iscsi target apply':candidate}}
adapter=tx.RuntimeAdapter(private)
with contextlib.ExitStack() as stack:
 for path in [Path('/var/lib/ablestack-storage/configuration-operations')/instance/'lock',Path('/run/lock/ablestack-storage-boot-reconcile.lock')]:
  h=stack.enter_context(path.open('a+'));fcntl.flock(h,fcntl.LOCK_EX|fcntl.LOCK_NB)
 tx.atomic_json(adapter.payload_path,payload)
 adapter.preflight(payload);adapter.snapshot(payload)
 try:
  adapter.apply(payload['candidate']);adapter.verify(payload['candidate'])
  assert proof()==initial
 finally:
  adapter.restore();adapter.verify_restored()
  adapter.restore_files(tx.load(adapter.snapshot_path))
 assert proof()==initial and hashlib.sha256(state.read_bytes()).hexdigest()==stateHash
result={'passed':True,'runtime':runtime.name,'operation':operation,'provisioning':args.provisioning,
 'actualCandidateApplyAndRollback':True,'existingTargetBackstoreAclDataUnchanged':True,'beforeConfigurationRestored':True,
 'markerSha256':initial['markerSha256'],'privateEvidence':str(private)}
(private/'native-regression-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
