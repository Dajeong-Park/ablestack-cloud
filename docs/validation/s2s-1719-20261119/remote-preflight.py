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

import base64
import hashlib
import json
import os
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent
REMOTE = r'''
import base64,hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path('/usr/share/cloudstack-management')
jar=root/'lib/cloudstack-4.23.0.0-ABLESTACK.Mold.jar'
web=root/'webapp'
names=['com/cloud/network/vpn/Site2SiteVpnManagerImpl.class','org/apache/cloudstack/api/command/user/vpn/ListVpnGatewaysCmd.class']
sha=lambda x:hashlib.sha256(x).hexdigest()
def run(*a):return subprocess.check_output(a,text=True).strip()
with zipfile.ZipFile(jar) as z:
    classes={n:base64.b64encode(z.read(n)).decode() for n in names if n in z.namelist()}
    hashes={n:sha(z.read(n)) if n in z.namelist() else None for n in names}
print(json.dumps({'jar':str(jar),'jar_sha256':sha(jar.read_bytes()),'class_sha256':hashes,'classes':classes,'ui_index_sha256':sha((web/'index.html').read_bytes()),'web_inf_exists':(web/'WEB-INF').is_dir(),'meta_inf_exists':(web/'META-INF').is_dir(),'config_sha256':sha((web/'config.json').read_bytes()) if (web/'config.json').exists() else None,'http':run('curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'),'service':run('systemctl','is-active','mold'),'pid':run('systemctl','show','mold','-p','MainPID','--value')}))
'''

assert str(OUT).startswith(
    '/home/ablecloud/work/'), 'Run SSH/artifact operations from WSL ext4'
for cluster in [31, 32]:
    r = subprocess.run(['sshpass',
                        '-e',
                        'ssh',
                        '-p',
                        '22',
                        '-o',
                        'StrictHostKeyChecking=accept-new',
                        '-o',
                        'ConnectTimeout=10',
                        f'ablecloud@10.10.{cluster}.10',
                        'sudo -n python3 -'],
                       input=REMOTE,
                       text=True,
                       capture_output=True,
                       check=True)
    data = json.loads(r.stdout)
    for name, value in data.pop('classes').items():
        dest = OUT / 'before-classes' / str(cluster) / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(base64.b64decode(value))
    assert data['web_inf_exists'] and data['http'] == '200' and data['service'] == 'active'
    (OUT / f'{cluster}-deployment-before.json').write_text(
        json.dumps(data, indent=2), encoding='utf-8')
    print(cluster, json.dumps(data), flush=True)
