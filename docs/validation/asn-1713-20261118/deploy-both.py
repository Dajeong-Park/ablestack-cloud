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

import pathlib
import subprocess
import json
import hashlib
import tarfile
import base64
import sys
OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')


def sha(b):
    return hashlib.sha256(b).hexdigest()


files = {str(p.relative_to(OUT / 'overlay')): p for p in (OUT / 'overlay').rglob('*.class')}
with tarfile.open(OUT / 'asn1713-java.tgz', 'w:gz') as t:
    for n, p in files.items():
        t.add(p, arcname=n)
manifest = {
    'baseSource': '0b92097f11c6d0cb0c7c960d9fbb4107bd30f17e',
    'classes': {
        n: sha(
            p.read_bytes()) for n,
        p in files.items()},
    'preservation': json.loads(
        (OUT / 'preservation-check.json').read_text()),
    'javaPayloadSha256': sha(
        (OUT / 'asn1713-java.tgz').read_bytes())}
(OUT / 'payload-manifest.json').write_text(json.dumps(manifest, indent=2))
REMOTE = "import base64\n\nimport pathlib,subprocess,hashlib,json,tarfile,zipfile,copy,time,sys\nbefore=json.loads(base64.b64decode('BEFORE'));expected=json.loads(base64.b64decode('MANIFEST'))\njar=pathlib.Path(before['jar']);web=pathlib.Path('/usr/share/cloudstack-management/webapp');sha=lambda d:hashlib.sha256(d).hexdigest()\nassert sha(jar.read_bytes())==before['jar_sha256'],'runtime changed since preflight'\nassert (web/'WEB-INF').is_dir()\nbackup=pathlib.Path('/root/asn1713-server-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));backup.mkdir()\nsubprocess.run(['cp','--preserve=all',str(jar),str(backup/'cloudstack-before.jar')],check=True)\nwith tarfile.open('/home/ablecloud/asn1713-java.tgz') as t:payload={m.name:t.extractfile(m).read() for m in t.getmembers()}\nassert {n:sha(d) for n,d in payload.items()}==expected['classes']\nnew=pathlib.Path(str(jar)+'.asn1713.new')\nwith zipfile.ZipFile(jar) as src:\n infos=src.infolist();assert not [i.filename for i in infos if i.filename.upper().startswith('META-INF/') and i.filename.upper().endswith(('.SF','.RSA','.DSA'))]\n assert len({i.filename for i in infos})==len(infos)\n with zipfile.ZipFile(new,'w') as out:\n  for info in infos:out.writestr(copy.copy(info),payload.get(info.filename,src.read(info)))\n  for n,d in payload.items():\n   if n not in src.namelist():out.writestr(n,d)\n with zipfile.ZipFile(new) as out:\n  assert all(src.read(i)==out.read(i.filename) for i in infos if i.filename not in payload)\n  assert all(out.read(n)==d for n,d in payload.items())\n report={**expected,'oldJarSha256':sha(jar.read_bytes()),'newJarSha256':sha(new.read_bytes()),'allOtherEntryBytesPreserved':True,'backup':str(backup)}\n (backup/'patch-manifest.json').write_text(json.dumps(report,indent=2))\nfor cmd in [['chown','--reference='+str(jar),str(new)],['chmod','--reference='+str(jar),str(new)],['chcon','--reference='+str(jar),str(new)]]:subprocess.run(cmd,check=cmd[0]!='chcon')\nsubprocess.run(['systemctl','stop','mold'],check=True);new.replace(jar);subprocess.run(['systemctl','start','mold'],check=True)\nhealthy=False\nfor _ in range(90):\n time.sleep(2)\n code=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:8080/client/'],capture_output=True,text=True).stdout\n if code=='200' and subprocess.run(['systemctl','is-active','--quiet','mold']).returncode==0:healthy=True;break\nif not healthy:\n subprocess.run(['systemctl','stop','mold']);subprocess.run(['cp','--preserve=all',str(backup/'cloudstack-before.jar'),str(jar)],check=True);subprocess.run(['systemctl','start','mold']);raise RuntimeError('health failure; server jar rolled back')\nassert (web/'WEB-INF').is_dir() and sha((web/'config.json').read_bytes())==before['config_sha256']\nassert sha((web/'index.html').read_bytes())==before['ui_index_sha256']\nreport.update(http=code,webInf=True,pid=subprocess.check_output(['systemctl','show','mold','-p','MainPID','--value'],text=True).strip())\nprint(json.dumps(report))\n"
for cluster in [31, 32]:
    host = f'ablecloud@10.10.{cluster}.10'
    opts = [
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ConnectTimeout=10']
    subprocess.run(['sshpass',
                    '-e',
                    'scp',
                    '-P',
                    '22',
                    *opts,
                    str(OUT / 'asn1713-java.tgz'),
                    host + ':/home/ablecloud/'],
                   check=True)
    beforefile = OUT / \
        f'{cluster}-deployment-current.json' if '--current' in sys.argv else OUT / f'{cluster}-deployment-before.json'
    code = REMOTE.replace(
        'BEFORE', base64.b64encode(
            beforefile.read_bytes()).decode()).replace(
        'MANIFEST', base64.b64encode(
            json.dumps(manifest).encode()).decode())
    result = subprocess.run(['sshpass',
                             '-e',
                             'ssh',
                             '-p',
                             '22',
                             *opts,
                             host,
                             'sudo -n python3 -'],
                            input=code,
                            capture_output=True,
                            text=True)
    (OUT / (f'{cluster}-deployment-final.log' if '--current' in sys.argv else f'{cluster}-deployment.log')
     ).write_text(result.stdout + result.stderr)
    print(cluster,
          result.returncode,
          result.stdout[-1200:],
          result.stderr[-300:],
          flush=True)
    result.check_returncode()
