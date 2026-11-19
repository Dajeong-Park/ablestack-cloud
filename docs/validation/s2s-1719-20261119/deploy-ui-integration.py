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

import tarfile
import pathlib
import json
import hashlib
import subprocess
OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
with tarfile.open(OUT / 's2s1719-ui.tgz', 'w:gz') as t:
    for p in (ROOT / 'ui/dist').iterdir():
        if p.name not in ['config.json', 'WEB-INF', 'META-INF']:
            t.add(p, arcname=p.name)


def sha(d): return hashlib.sha256(d).hexdigest()


report = {
    'uiPayloadSha256': sha(
        (OUT /
         's2s1719-ui.tgz').read_bytes()),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'sourceSha256': {
        p: sha((ROOT / p).read_bytes()) for p in ['ui/src/utils/s2sGatewaySearch.js', 'ui/src/components/view/S2sGatewaySearch.vue', 'ui/src/components/view/S2sGatewaySearchSelect.vue', 'ui/src/views/AutogenView.vue', 'ui/src/components/view/SearchView.vue', 'ui/src/components/view/ListView.vue', 'ui/src/components/widgets/Breadcrumb.vue', 'ui/src/config/section/network.js', 'ui/public/locales/en.json', 'ui/public/locales/ko_KR.json', 'ui/src/style/components/view/list-toolbar.css']}}
(OUT / 'ui-integration-manifest.json').write_text(json.dumps(report, indent=2))
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
                    str(OUT / 's2s1719-ui.tgz'),
                    str(OUT / 'deploy-s2s1719-static.sh'),
                    host + ':/home/ablecloud/'],
                   check=True)
    r = subprocess.run(['sshpass',
                        '-e',
                        'ssh',
                        '-p',
                        '22',
                        *opts,
                        host,
                        'sudo -n bash /home/ablecloud/deploy-s2s1719-static.sh'],
                       capture_output=True,
                       text=True)
    (OUT / f'{cluster}-ui-integration-deployment.log').write_text(r.stdout + r.stderr)
    print(cluster, r.returncode, r.stdout[-1000:], r.stderr[-300:], flush=True)
    r.check_returncode()
subprocess.run(['git', 'restore', '--', 'ui/public/config.json'], check=True)
