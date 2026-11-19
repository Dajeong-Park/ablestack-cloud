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
import shutil
OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
files = []
for p in (OUT / 'overlay').rglob('*.class'):
    name = str(p.relative_to(OUT / 'overlay'))
    module = 'engine/schema' if name.startswith('com/cloud/dc/dao/') else 'server' if name in [
        'com/cloud/bgp/BGPServiceImpl.class', 'com/cloud/api/ApiResponseHelper.class'] else 'api'
    files.append((module, name, p))
files.append(('server', 'com/cloud/bgp/BGPServiceImpl$1.class', OUT /
             'before-classes/31/com/cloud/bgp/BGPServiceImpl$1.class'))
try:
    for module, name, p in files:
        target = ROOT / module / 'target/classes' / name
        backup = OUT / 'built-original' / module / name
        backup.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.copy2(target, backup)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
    tests = [('api', 'ASNumberReleasePolicyTest,ReleaseASNumberCmdTest,ListASNumbersCmdTest'), ('engine/schema', 'ASNumberDaoQueryTest'),
             ('server', 'BGPASNumberQueryTest,BGPASNumberRangeDeletionTest,BGPASNumberReleasePolicyTest,ApiResponseHelperAsnTest')]
    for module, names in tests:
        with (OUT / ('overlay-' + module.replace('/', '-') + '.log')).open('w') as log:
            subprocess.run(['mvn', '-pl', module, 'surefire:test', '-Dtest=' + names, '-DfailIfNoTests=false'],
                           cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
finally:
    for module, name, p in files:
        target = ROOT / module / 'target/classes' / name
        backup = OUT / 'built-original' / module / name
        if backup.exists():
            shutil.copy2(backup, target)
        elif target.exists():
            target.unlink()
print('Overlay API/schema/server behavior PASS; compiled classes restored')
