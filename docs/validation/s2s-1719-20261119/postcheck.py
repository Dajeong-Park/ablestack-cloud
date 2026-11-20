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

from api_client import *
import subprocess,base64,hashlib

for cluster in [31,32]:
    mold=Mold(cluster)
    contract=next(x for x in items(mold.call('listApis')) if x['name']=='listVpnGateways')
    assert 'literal' in contract['description'].lower(),contract['description']
    hosts=items(mold.call('listHosts',{'type':'Routing','listall':'true'}))
    assert len(hosts)==3 and all(x['state']=='Up' and x['resourcestate']=='Enabled' for x in hosts)
    expected=json.loads((OUT/f'{cluster}-payload-manifest.json').read_text())['classes']
    code="""import json,pathlib,zipfile,hashlib,subprocess
jar=pathlib.Path('/usr/share/cloudstack-management/lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar')
sha=lambda d:hashlib.sha256(d).hexdigest()
expected=json.loads('EXPECTED')
with zipfile.ZipFile(jar) as z: actual={n:sha(z.read(n)) for n in expected}
assert actual==expected
web=pathlib.Path('/usr/share/cloudstack-management/webapp')
assert (web/'WEB-INF').is_dir()
service=subprocess.check_output(['systemctl','is-active','mold'],text=True).strip()
http=subprocess.check_output(['curl','--max-time','10','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'],text=True)
assert service=='active' and http=='200'
print(json.dumps({'jarSha256':sha(jar.read_bytes()),'classes':actual,'WEB-INF':True,'http':http,'service':service}))
""".replace('EXPECTED',json.dumps(expected))
    r=subprocess.run(['sshpass','-e','ssh','-p','22',f'ablecloud@10.10.{cluster}.10','sudo -n python3 -'],input=code,text=True,capture_output=True,check=True)
    save(f'{cluster}-runtime-final.json',{'runtime':json.loads(r.stdout),'hosts':[{'id':h['id'],'name':h['name'],'state':h['state'],'resourceState':h['resourcestate']} for h in hosts],'description':contract['description']})
    print(cluster,'runtime class hashes, active service, HTTP200, WEB-INF, 3 hosts Up, API description verified',flush=True)
