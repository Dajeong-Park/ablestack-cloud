# Apache-2.0. #1464 design-only observation and synthetic guard/state checks.
from pathlib import Path
import json,copy,hashlib,platform,subprocess
host={"domain":"i-2-227-VM","xmlSha256":"420098ff58d35960cff6d6c26e845a71ba9b15e0f717438d7b601fe1702d25e4","vcpu":{"attrs":{"placement":"static"},"text":"2"},"memory":{"attrs":{"unit":"KiB"},"text":"4194304"},"currentMemory":{"attrs":{"unit":"KiB"},"text":"4194304"},"maxMemory":None,"numa":"<cpu mode=\"host-passthrough\" check=\"none\" migratable=\"on\">\n    <topology sockets=\"1\" dies=\"1\" clusters=\"1\" cores=\"2\" threads=\"1\" />\n  </cpu>\n  ","memoryDeviceCount":0,"hotpluggableCpuEntries":{"return":[{"props":{"core-id":1,"thread-id":0,"socket-id":0},"vcpus-count":1,"qom-path":"/machine/unattached/device[2]","type":"host-x86_64-cpu"},{"props":{"core-id":0,"thread-id":0,"socket-id":0},"vcpus-count":1,"qom-path":"/machine/unattached/device[0]","type":"host-x86_64-cpu"}],"id":"libvirt-41341"},"hostArch":"x86_64","hostVcpuMax":{"max":"240"},"versions":"Compiled against library: libvirt 11.10.0\nUsing library: libvirt 11.10.0\nUsing API: QEMU 11.10.0\nRunning hypervisor: QEMU 10.1.0\n\n"}
facts={"vm":{"id":"52478e8d-47d4-30f7-93ee-8299a52e9dfe","name":"sharedfs-52478e8d-47d4-30f7-93ee-8299a52e9dfe","cpunumber":2,"cpuspeed":2000,"memory":4096,"serviceofferingid":"5da2d6c9-d9c4-453a-a28c-3e93274a3380","templateid":"2924ccf5-efa6-4661-b09f-5e319f5585df","hostid":"52ca8321-c228-4234-8273-f19b0d1c6525","hostname":"ablecube13-3","hypervisor":"KVM","state":"Running","isdynamicallyscalable":False},"templates":[{"id":"2924ccf5-efa6-4661-b09f-5e319f5585df","name":"Europa-SystemVM-1462-nfsref-fbba6c13","isdynamicallyscalable":False,"isready":True,"arch":"x86_64","hypervisor":"KVM","templatetype":"SYSTEM"}],"catalog":{"offerings":[{"id":"4007504f-6cc3-4694-b44e-46f5a6f0baa4","name":"CKS Instance","dynamicscalingenabled":True,"iscustomized":False,"offerha":False,"cpunumber":2,"memory":2048,"cpuspeed":1000,"diskofferingid":"00ab83a6-e6fd-40ca-aae3-12913393f14e","diskofferingcomputeonly":True},{"id":"ff8d160d-7523-46a7-ab98-faf49d16554b","name":"2C4GB","dynamicscalingenabled":True,"iscustomized":False,"offerha":True,"cpunumber":2,"memory":4096,"cpuspeed":2000,"diskofferingid":"48bae5f6-dc30-451f-a7bb-b4e4a877a1ee","diskofferingcomputeonly":True},{"id":"1dae1249-0b94-4db8-9317-4f60ecfdaa6a","name":"epic898-scale-4C8GB","dynamicscalingenabled":True,"iscustomized":False,"offerha":True,"cpunumber":4,"memory":8192,"cpuspeed":2000,"diskofferingid":"fd600aae-1dfd-4b05-82a1-85f5966478b1","diskofferingcomputeonly":True},{"id":"5da2d6c9-d9c4-453a-a28c-3e93274a3380","name":"사용자 정의 컴퓨트 오퍼링","dynamicscalingenabled":True,"iscustomized":True,"offerha":True,"cpunumber":None,"memory":None,"cpuspeed":None,"diskofferingid":"c48ab8d8-faba-4d43-85a6-e98a9ecc0cd5","diskofferingcomputeonly":False},{"id":"fc808c8b-00fa-42d2-98b6-a082f12c347f","name":"epic898-sharedfs-sparse-2C4GB","dynamicscalingenabled":True,"iscustomized":False,"offerha":True,"cpunumber":2,"memory":4096,"cpuspeed":2000,"diskofferingid":"90b3f7d0-bf5b-46dc-bb6c-d46c57fa8774","diskofferingcomputeonly":True},{"id":"57c431e2-3330-4a1d-a0ff-11cbb5321899","name":"epic898-sharedfs-sparse-4C8GB","dynamicscalingenabled":True,"iscustomized":False,"offerha":True,"cpunumber":4,"memory":8192,"cpuspeed":2000,"diskofferingid":"1ae2dee3-dbf8-4626-9664-601a7dbef950","diskofferingcomputeonly":True},{"id":"de15d05b-32fb-48de-8aeb-b01b55e1594f","name":"epic1438-1441-fixed-20261021","dynamicscalingenabled":False,"iscustomized":False,"offerha":True,"cpunumber":2,"memory":4096,"cpuspeed":2000,"diskofferingid":"df2c1607-58de-42c7-be4b-c950ed62e071","diskofferingcomputeonly":True},{"id":"610b811a-6674-4f1d-a16f-55681e50a6de","name":"epic1438-1441-free-20261021","dynamicscalingenabled":False,"iscustomized":True,"offerha":True,"cpunumber":None,"memory":None,"cpuspeed":None,"diskofferingid":"a250168d-a33a-498a-bfd2-528908b4da8f","diskofferingcomputeonly":True},{"id":"0a3cccb9-62ed-4fa6-a3e9-d3f1dcb7bd00","name":"epic1438-1441-range-20261021","dynamicscalingenabled":True,"iscustomized":True,"offerha":True,"cpunumber":None,"memory":None,"cpuspeed":2000,"diskofferingid":"cd54d518-d71e-4403-b6c6-37a75d6f4425","diskofferingcomputeonly":True},{"id":"89e587e6-3dc6-493b-9472-756ec2073c95","name":"1C1GB","dynamicscalingenabled":True,"iscustomized":False,"offerha":False,"cpunumber":1,"memory":1024,"cpuspeed":2000,"diskofferingid":"f0cd29a7-e7c7-4f5b-a9ba-570d255a118b","diskofferingcomputeonly":True}],"configs":[{"name":"enable.dynamic.scale.vm","value":"True","scope":None},{"name":"kvm.memory.dynamic.scaling.capacity","value":"0","scope":None},{"name":"kvm.cpu.dynamic.scaling.capacity","value":"0","scope":None}]},"environment":{"clusterid":"ec412fc1-ab32-4b4d-a214-c0d4cfd7c44a","host":{"id":"52ca8321-c228-4234-8273-f19b0d1c6525","name":"ablecube13-3","hypervisor":"KVM","hypervisorversion":None,"state":"Up","cpunumber":48,"memorytotal":269043728384,"clusterid":"ec412fc1-ab32-4b4d-a214-c0d4cfd7c44a"},"effective":[{"name":"enable.dynamic.scale.vm","value":"True","scope":"zone"},{"name":"kvm.memory.dynamic.scaling.capacity","value":"0","scope":"cluster"},{"name":"kvm.cpu.dynamic.scaling.capacity","value":"0","scope":"cluster"}]}}
def read(p):return Path(p).read_text().strip() if Path(p).exists() else None
protected=[Path('/usr/local/bin/ablestack-storagectl'),Path('/etc/ablestack-storage/desired-state/nfs-export-apply.json')]
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
online=read('/sys/devices/system/cpu/online')
memBlocks=sorted(Path('/sys/devices/system/memory').glob('memory[0-9]*'))
mem={'blockSizeHex':read('/sys/devices/system/memory/block_size_bytes'),'autoOnline':read('/sys/devices/system/memory/auto_online_blocks'),'onlineBlocks':[p.name for p in memBlocks if read(p/'state')=='online'],'offlineBlocks':[p.name for p in memBlocks if read(p/'state')=='offline']}
config=read('/boot/config-'+platform.release()) or ''
flags={k:next((s.split('=',1)[1] for s in config.splitlines() if s.startswith(k+'=')),'UNKNOWN') for k in ['CONFIG_HOTPLUG_CPU','CONFIG_MEMORY_HOTPLUG','CONFIG_MEMORY_HOTREMOVE']}
udev=[]
for directory in ['/usr/lib/udev/rules.d','/etc/udev/rules.d']:
 for p in Path(directory).glob('*.rules'):
  t=p.read_text(errors='replace')
  lines=[s for s in t.splitlines() if ('cpu' in s.lower() or 'memory' in s.lower()) and 'online' in s.lower()]
  if lines:udev.append({'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'rules':lines})
def guard(profile,cpu,memory):
 if not profile['zone']:return 'ZONE_DYNAMIC_DISABLED'
 if not profile['offering']:return 'OFFERING_DYNAMIC_DISABLED'
 if not profile['template']:return 'TEMPLATE_DYNAMIC_DISABLED'
 if not profile['vm']:return 'COLD_PREPARATION_REQUIRED'
 if profile['maxCpu']<cpu or profile['maxMemory']<memory or not profile['slots']:return 'LIVE_HEADROOM_MISSING'
 if not profile['guest']:return 'GUEST_OBSERVATION_UNAVAILABLE'
 if cpu<2 or memory<4096:return 'SCALE_DOWN_UNSUPPORTED'
 if cpu==2 and memory==4096:return 'NO_RESOURCE_CHANGE'
 if cpu>2 and memory>4096:return 'COMBINED_GROWTH_UNSUPPORTED'
 if (memory-4096)%profile['blockMiB']:return 'MEMORY_ALIGNMENT'
 return 'READY'
actual={'zone':True,'offering':True,'template':facts['templates'][0]['isdynamicallyscalable'],'vm':facts['vm']['isdynamicallyscalable'],'maxCpu':int(host['vcpu']['text']),'maxMemory':0 if host['maxMemory'] is None else int(host['maxMemory']['text'])//1024,'slots':0,'guest':True,'blockMiB':int(mem['blockSizeHex'],16)//(1024*1024)}
checks={}
assert guard(actual,4,4096)=='TEMPLATE_DYNAMIC_DISABLED';checks['actualTemplateBlocksBeforeChange']='PASS'
a=copy.deepcopy(actual);a['template']=True
assert guard(a,4,4096)=='COLD_PREPARATION_REQUIRED';checks['flagAloneCannotPrepareLiveVm']='PASS'
a['vm']=True
assert guard(a,4,4096)=='LIVE_HEADROOM_MISSING';checks['actualXmlBlocksEvenAfterFlags']='PASS'
prepared=dict(a,maxCpu=8,maxMemory=16384,slots=16,guest=True)
for cpu,ram,code in [(4,4096,'READY'),(2,8192,'READY'),(1,4096,'SCALE_DOWN_UNSUPPORTED'),(2,2048,'SCALE_DOWN_UNSUPPORTED'),(4,8192,'COMBINED_GROWTH_UNSUPPORTED'),(2,4096,'NO_RESOURCE_CHANGE'),(9,4096,'LIVE_HEADROOM_MISSING'),(2,4097,'MEMORY_ALIGNMENT')]:
 assert guard(prepared,cpu,ram)==code,(cpu,ram);checks['copyPlan-'+str(cpu)+'-'+str(ram)]=code
for flag,code in [('zone','ZONE_DYNAMIC_DISABLED'),('offering','OFFERING_DYNAMIC_DISABLED'),('template','TEMPLATE_DYNAMIC_DISABLED'),('vm','COLD_PREPARATION_REQUIRED'),('guest','GUEST_OBSERVATION_UNAVAILABLE')]:
 a=copy.deepcopy(prepared);a[flag]=False;assert guard(a,4,4096)==code;checks['copyGuard-'+flag]='PASS'
def recovery(observed,guestOnline):
 if observed is None:return {'state':'OBSERVATION_PENDING','holdWriter':True,'holdCapacityUpperBound':True,'unplug':False}
 if observed==(2,4096):return {'state':'FAILED_UNCHANGED','holdWriter':False,'holdCapacityUpperBound':False,'unplug':False}
 if observed==(4,4096) and guestOnline:return {'state':'VERIFIED_CANDIDATE','holdWriter':True,'holdCapacityUpperBound':True,'unplug':False}
 return {'state':'RECOVERY_REQUIRED','holdWriter':True,'holdCapacityUpperBound':True,'unplug':False}
recoveryCases=[recovery(None,False),recovery((2,4096),True),recovery((4,4096),False),recovery((4,4096),True)]
assert recoveryCases[0]['holdWriter'] and recoveryCases[2]['holdCapacityUpperBound'] and not any(x['unplug'] for x in recoveryCases)
assert {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}==before
print(json.dumps({'kernel':platform.release(),'cpuOnline':online,'cpuPresent':read('/sys/devices/system/cpu/present'),'cpuPossible':read('/sys/devices/system/cpu/possible'),'memory':mem,'kernelFlags':flags,'udevRules':udev,'memTotalLine':next(x for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemTotal:')),'checks':checks,'recoveryModelCopies':recoveryCases,'protectedHashes':before,'configurationUnchanged':True,'dataWrites':0,'hotplugExecuted':False,'vmRestarted':False,'testBoundary':'actual read-only SystemVM inspection + copied guard/recovery model, not hardware scale acceptance'}))
