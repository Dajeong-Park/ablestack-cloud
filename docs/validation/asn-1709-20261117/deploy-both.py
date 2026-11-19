# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import copy,hashlib,json,os,pathlib,subprocess,tarfile,base64
OUT=pathlib.Path(__file__).resolve().parent;ROOT=OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
sha=lambda d:hashlib.sha256(d).hexdigest()
files={'com/cloud/bgp/BGPServiceImpl.class':OUT/'overlay/com/cloud/bgp/BGPServiceImpl.class','com/cloud/bgp/ASNumberRangeValidator.class':ROOT/'api/target/classes/com/cloud/bgp/ASNumberRangeValidator.class','org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmd.class':ROOT/'api/target/classes/org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmd.class'}
with tarfile.open(OUT/'asn1709-java.tgz','w:gz') as t:
 for n,p in files.items():t.add(p,arcname=n)
with tarfile.open(OUT/'asn1709-ui.tgz','w:gz') as t:
 for p in (ROOT/'ui/dist').iterdir():
  if p.name not in ['config.json','WEB-INF','META-INF']:t.add(p,arcname=p.name)
manifest={'baseSource':'10150bdead45260b58313879d27402383b6b9bf8','classes':{n:sha(p.read_bytes()) for n,p in files.items()},'preservedUnrelatedBGPMethods':19,'registrationMethodsFromModuleBuild':2,'javaPayloadSha256':sha((OUT/'asn1709-java.tgz').read_bytes()),'uiPayloadSha256':sha((OUT/'asn1709-ui.tgz').read_bytes())}
(OUT/'payload-manifest.json').write_text(json.dumps(manifest,indent=2))
REMOTE=r"""
import pathlib,subprocess,hashlib,json,tarfile,zipfile,copy,time,sys
before=json.loads(base64.b64decode('BEFORE'));expected=json.loads(base64.b64decode('MANIFEST'))
jar=pathlib.Path(before['jar']);web=pathlib.Path('/usr/share/cloudstack-management/webapp');sha=lambda d:hashlib.sha256(d).hexdigest()
assert sha(jar.read_bytes())==before['jar_sha256'],'runtime changed since preflight'
assert (web/'WEB-INF').is_dir()
backup=pathlib.Path('/root/asn1709-server-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));backup.mkdir()
subprocess.run(['cp','--preserve=all',str(jar),str(backup/'cloudstack-before.jar')],check=True)
with tarfile.open('/home/ablecloud/asn1709-java.tgz') as t:payload={m.name:t.extractfile(m).read() for m in t.getmembers()}
assert {n:sha(d) for n,d in payload.items()}==expected['classes']
new=pathlib.Path(str(jar)+'.asn1709.new')
with zipfile.ZipFile(jar) as src:
 infos=src.infolist();assert not [i.filename for i in infos if i.filename.upper().startswith('META-INF/') and i.filename.upper().endswith(('.SF','.RSA','.DSA'))]
 assert len({i.filename for i in infos})==len(infos)
 with zipfile.ZipFile(new,'w') as out:
  for info in infos:out.writestr(copy.copy(info),payload.get(info.filename,src.read(info)))
  for n,d in payload.items():
   if n not in src.namelist():out.writestr(n,d)
 with zipfile.ZipFile(new) as out:
  assert all(src.read(i)==out.read(i.filename) for i in infos if i.filename not in payload)
  assert all(out.read(n)==d for n,d in payload.items())
 report={**expected,'oldJarSha256':sha(jar.read_bytes()),'newJarSha256':sha(new.read_bytes()),'allOtherEntryBytesPreserved':True,'backup':str(backup)}
 (backup/'patch-manifest.json').write_text(json.dumps(report,indent=2))
for cmd in [['chown','--reference='+str(jar),str(new)],['chmod','--reference='+str(jar),str(new)],['chcon','--reference='+str(jar),str(new)]]:subprocess.run(cmd,check=cmd[0]!='chcon')
subprocess.run(['systemctl','stop','mold'],check=True);new.replace(jar);subprocess.run(['systemctl','start','mold'],check=True)
healthy=False
for _ in range(90):
 time.sleep(2)
 code=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'],capture_output=True,text=True).stdout
 if code=='200' and subprocess.run(['systemctl','is-active','--quiet','mold']).returncode==0:healthy=True;break
if not healthy:
 subprocess.run(['systemctl','stop','mold']);subprocess.run(['cp','--preserve=all',str(backup/'cloudstack-before.jar'),str(jar)],check=True);subprocess.run(['systemctl','start','mold']);raise RuntimeError('health failure; server jar rolled back')
assert (web/'WEB-INF').is_dir() and sha((web/'config.json').read_bytes())==before['config_sha256']
report.update(http=code,webInf=True,pid=subprocess.check_output(['systemctl','show','mold','-p','MainPID','--value'],text=True).strip())
print(json.dumps(report))
"""
# Prefix imports explicitly; placeholders contain only base64 JSON, never credentials.
REMOTE='import base64\n'+REMOTE
for cluster in [31,32]:
 host=f'ablecloud@10.10.{cluster}.10';common=['sshpass','-e']; opts=['-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=10']
 subprocess.run(common+['scp','-P','22',*opts,str(OUT/'asn1709-java.tgz'),str(OUT/'asn1709-ui.tgz'),str(OUT/'deploy-static.sh'),host+':/home/ablecloud/'],check=True)
 code=REMOTE.replace('BEFORE',base64.b64encode((OUT/f'{cluster}-deployment-before.json').read_bytes()).decode()).replace('MANIFEST',base64.b64encode(json.dumps(manifest).encode()).decode())
 result=subprocess.run(common+['ssh','-p','22',*opts,host,'sudo -n python3 -'],input=code,text=True,capture_output=True)
 (OUT/f'{cluster}-server-deployment.log').write_text(result.stdout+result.stderr);print(cluster,'server',result.returncode,result.stdout[-1000:],result.stderr[-300:],flush=True);result.check_returncode()
 result=subprocess.run(common+['ssh','-p','22',*opts,host,'sudo -n bash /home/ablecloud/deploy-static.sh'],text=True,capture_output=True)
 (OUT/f'{cluster}-ui-deployment.log').write_text(result.stdout+result.stderr);print(cluster,'UI',result.returncode,result.stdout[-1100:],result.stderr[-300:],flush=True);result.check_returncode()
