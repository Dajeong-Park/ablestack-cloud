# Apache-2.0. Design-only, read observations and copies; no service changes.
from pathlib import Path
import subprocess,json,hashlib,copy,time,sys
cli=Path('/usr/local/bin/ablestack-storagectl')
def protected():
 files=list(Path('/etc/ablestack-storage/desired-state').glob('nfs*.json'))+list(Path('/etc/ganesha').rglob('*.conf'))
 return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}
before=protected()
def command(*args): return subprocess.check_output(args,text=True,timeout=40)
inv=json.loads(command(str(cli),'inventory'))
health=json.loads(command(str(cli),'health'))
items=inv.get('nfsGaneshaExports',[])
sockets=command('ss','-Hlnpt')
rows=[]
for x in items:
 p=int(x['port'])
 relevant=[line for line in sockets.splitlines() if line.split()[3].endswith(':'+str(p))]
 assert relevant,('missing socket',p)
 assert x.get('listening') is True and x.get('processRunning') is True
 assert x.get('protocolMode') in ['V4_ONLY','V3V4_DUAL']
 rows.append({k:x.get(k) for k in ['file','listenIp','port','pid','listening','processRunning','protocolMode','status']})
cases={}
def classify(x,fresh=True,available=True):
 if not available:return 'UNAVAILABLE'
 if not fresh:return 'STALE'
 if x is None:return 'NOT_OBSERVED'
 if x.get('listening') is False or x.get('processRunning') is False:return 'FAILED'
 if x.get('listening') is True and x.get('processRunning') is True:return 'READY'
 return 'UNKNOWN'
assert all(classify(x)=='READY' for x in items);cases['nativeProcessAndSocket']='PASS'
if items:
 assert classify(items[0],False)=='STALE';cases['staleCopyIsNotLiveFailure']='PASS'
 assert classify(items[0],available=False)=='UNAVAILABLE';cases['readErrorCopyIsNotLiveFailure']='PASS'
 bad=copy.deepcopy(items[0]);bad['listening']=False
 assert classify(bad)=='FAILED' and items[0]['listening'] is True;cases['oneFailedCopyDoesNotMutateLive']='PASS'
 assert classify(None)=='NOT_OBSERVED';cases['missingObservationNeverInheritsDbReady']='PASS'
 unknown=copy.deepcopy(items[0]);unknown.pop('protocolMode',None)
 assert unknown.get('protocolMode') is None;cases['unknownModeNeverDefaultsToV4']='PASS'
for p in Path('/etc/ganesha').rglob('*.conf'):
 text=p.read_text()
 if p.name in [x.get('file') for x in items]:
  assert 'Protocols' in text
assert protected()==before
out={'nativeRows':rows,'nativeSockets':[x for x in sockets.splitlines() if any(x.split()[3].endswith(':'+str(y['port'])) for y in rows)],'healthNfs':health.get('nfsGanesha'), 'generatedAt':inv.get('generatedAt'),'staleAfterSeconds':inv.get('staleAfterSeconds'),'cases':cases,'configurationUnchanged':True,'configurationHashes':before,'cliSha256':hashlib.sha256(cli.resolve().read_bytes()).hexdigest(),'dataWrites':0,'serviceRestart':0,'testType':'design observation and synthetic copies; not implementation acceptance'}
print(json.dumps(out))
