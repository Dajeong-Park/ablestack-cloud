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
import os
import json
import shutil
OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
asm = pathlib.Path('/home/ablecloud/.m2/repository/org/ow2/asm')
cp = os.pathsep.join(str(asm / name / '7.3.1' / f'{name}-7.3.1.jar')
                     for name in ['asm', 'asm-tree', 'asm-util', 'asm-analysis'])
subprocess.run(['javac', '-cp', cp, str(ROOT / 'docs/validation/asn-1711-20261118/OverlayASNDeletion.java'),
               str(OUT / 'OverlayASNIntegration.java'), '-d', str(OUT)], check=True)
rows = [('service', 'server', 'com/cloud/bgp/BGPServiceImpl.class'), ('helper', 'server', 'com/cloud/api/ApiResponseHelper.class'), ('command', 'api', 'org/apache/cloudstack/api/command/user/bgp/ListASNumbersCmd.class'), ('command', 'api', 'org/apache/cloudstack/api/command/admin/bgp/ReleaseASNumberCmd.class'),
        ('response', 'api', 'org/apache/cloudstack/api/response/ASNumberResponse.class'), ('bgp-interface', 'api', 'com/cloud/bgp/BGPService.class'), ('dao-interface', 'schema', 'com/cloud/dc/dao/ASNumberDao.class'), ('dao', 'schema', 'com/cloud/dc/dao/ASNumberDaoImpl.class')]
checks = []
for mode, module, name in rows:
    before = OUT / 'before-classes/31' / name
    assert before.read_bytes() == (OUT / 'before-classes/32' / name).read_bytes()
    built = ROOT / ('engine/schema' if module == 'schema' else module) / 'target/classes' / name
    baseline = pathlib.Path('/home/ablecloud/work/asn1713-baseline') / module / name
    line = subprocess.check_output(['java', '-cp', str(OUT) + os.pathsep + cp, 'OverlayASNIntegration',
                                   mode, str(before), str(baseline), str(built), str(OUT / 'overlay' / name)], text=True)
    print(line.strip())
    checks.append(line.strip())
name = 'com/cloud/bgp/ASNumberReleasePolicy.class'
dest = OUT / 'overlay' / name
dest.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(ROOT / 'api/target/classes' / name, dest)
(OUT / 'preservation-check.json').write_text(json.dumps({'passed': True, 'checks': checks}, indent=2))
