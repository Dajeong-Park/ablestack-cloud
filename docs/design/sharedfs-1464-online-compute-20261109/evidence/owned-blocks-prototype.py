# Apache-2.0. Isolated ownership prototype. Never writes live sysfs.
from pathlib import Path
import tempfile,json
root=Path(tempfile.mkdtemp(prefix='issue1464-owned-blocks-'))
blocks=root/'mock-sysfs';blocks.mkdir()
for name in ['memory0','memory128','memory129','memory256']:
 (blocks/name).mkdir();(blocks/name/'state').write_text('offline')
before={'memory0'}
blockBytes=128*1024*1024
def online_owned(names,expectedBoot='same',currentBoot='same',wantedBytes=256*1024*1024):
 if expectedBoot!=currentBoot:raise ValueError('BOOT_CHANGED')
 if wantedBytes!=len(names)*blockBytes:raise ValueError('RANGE_SIZE_MISMATCH')
 paths=[]
 for name in names:
  p=blocks/name/'state'
  if not name.startswith('memory') or not name[6:].isdigit():raise ValueError('BAD_BLOCK')
  index=int(name[6:])
  if name in before or not 128<=index<130:raise ValueError('NOT_OWNED_NEW_BLOCK')
  if p.is_symlink() or p.resolve().parent.parent!=blocks.resolve():raise ValueError('PATH_CHANGED')
  if p.read_text() not in ['offline','online']:raise ValueError('UNKNOWN_STATE')
  paths.append(p)
 writes=0
 for p in paths:
  if p.read_text()=='offline':p.write_text('online');writes+=1
 return writes
checks={}
assert online_owned(['memory128','memory129'])==2;checks['acceptedNewRangeOnly']='PASS'
assert (blocks/'memory0/state').read_text()=='offline' and (blocks/'memory256/state').read_text()=='offline';checks['existingAndUnrelatedBlocksPreserved']='PASS'
assert online_owned(['memory128','memory129'])==0;checks['sameOperationResumeNoDuplicateWrite']='PASS'
for names,kw,code in [(['memory0'],{'wantedBytes':blockBytes},'NOT_OWNED_NEW_BLOCK'),(['memory128','memory129'],{'currentBoot':'changed'},'BOOT_CHANGED'),(['memory128'],{},'RANGE_SIZE_MISMATCH')]:
 try:online_owned(names,**kw);raise AssertionError('rejected case accepted')
 except ValueError as e:assert str(e)==code;checks[code]='PASS'
assert all(p.read_text()=='online' for p in [blocks/'memory128/state',blocks/'memory129/state'])
checks['noOfflineOrUnplugCompensation']='PASS'
print(json.dumps({'stage':str(root),'checks':checks,'liveSysfsWrites':0,'scope':'private prototype files on actual SystemVM, not a real hotplug acceptance test'}))
