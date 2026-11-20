# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

from pathlib import Path
import subprocess,json,concurrent.futures
out=Path('docs/validation/s2s-1723-standard-filter-20261120')
remote="""import pathlib,subprocess,hashlib,json,zipfile
web=pathlib.Path('/usr/share/cloudstack-management/webapp');jar=pathlib.Path('/usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar');sha=lambda d:hashlib.sha256(d).hexdigest()
r={'jarSha256':sha(jar.read_bytes()),'indexSha256':sha((web/'index.html').read_bytes()),'configSha256':sha((web/'config.json').read_bytes()),'webInf':(web/'WEB-INF').is_dir(),'http':subprocess.check_output(['curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'],text=True),'pid':subprocess.check_output(['systemctl','show','mold','-p','MainPID','--value'],text=True).strip(),'service':subprocess.check_output(['systemctl','is-active','mold'],text=True).strip()}
with zipfile.ZipFile(jar) as z:r['classSha256']={n:sha(z.read(n)) for n in ['org/apache/cloudstack/api/command/user/vpn/'+x+'.class' for x in ['ListVpnGatewaysCmd','UpdateVpnGatewayCmd','CreateVpnGatewayCmd']]}
log=subprocess.run(['journalctl','-u','mold','--since','2026-11-20 05:00:00 UTC','--no-pager','-o','cat'],capture_output=True,text=True,check=True).stdout
r['journalScope']='mold since 2026-11-20 05:00:00 UTC';r['classLoadErrors']={s:log.count(s) for s in ['VerifyError','NoSuchMethodError','NoSuchFieldError','ClassFormatError']}
print(json.dumps(r))
"""
def verify(c):
 r=subprocess.run(['sshpass','-e','ssh','-p','22','-o','ConnectTimeout=10','-o','StrictHostKeyChecking=accept-new',f'ablecloud@10.10.{c}.10','sudo -n python3 -'],input=remote,text=True,capture_output=True,check=True);a=json.loads(r.stdout)
 b=json.loads((out/f'{c}-deployment-before.json').read_text());d=json.loads((out/f'{c}-deployment.json').read_text());u=json.loads((out/'ui-manifest.json').read_text())
 assert a['jarSha256']==d['newJarSha256'] and a['indexSha256']==u['indexSha256'] and a['configSha256']==b['config_sha256'] and a['pid']==d['pid']
 assert a['http']=='200' and a['webInf'] and a['service']=='active' and not any(a['classLoadErrors'].values())
 for name in ['UpdateVpnGatewayCmd','CreateVpnGatewayCmd']:
  key='org/apache/cloudstack/api/command/user/vpn/'+name+'.class';assert a['classSha256'][key]==b['class_sha256'][key]
 (out/f'{c}-health-final.json').write_text(json.dumps(a,indent=2)+'\n');print(c,'health and retained API patches PASS',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(verify,[31,32]))
