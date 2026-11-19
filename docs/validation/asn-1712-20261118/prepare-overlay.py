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

import json
import os
import subprocess
from pathlib import Path
OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
cp = os.pathsep.join(str(next((Path.home() /
                               '.m2/repository/org/ow2/asm' /
                               a /
                               '7.3.1').glob(a +
                                             '-7.3.1.jar'))) for a in ['asm', 'asm-tree', 'asm-util'])
subprocess.run(['javac', '-cp', cp, '-d', str(OUT), str(ROOT /
                                                        'docs/validation/asn-1711-20261118/OverlayASNDeletion.java'), str(OUT /
                                                                                                                          'OverlayASNSearch.java')], check=True)
rows = [
    ('service',
     'com/cloud/bgp/BGPServiceImpl.class',
     ROOT / 'server/target/classes',
     Path('/home/ablecloud/work/asn1712-baseline')),
    ('command',
     'org/apache/cloudstack/api/command/user/bgp/ListASNumbersCmd.class',
     ROOT / 'api/target/classes',
     Path('/home/ablecloud/work/dhslove/cloud-asnumbers-1711/api/target/classes'))]
checks = []
for mode, name, built, baseline in rows:
    old = OUT / 'before-classes/31' / name
    assert old.read_bytes() == (OUT / 'before-classes/32' / name).read_bytes()
    result = subprocess.check_output(['java',
                                      '-cp',
                                      str(OUT) + os.pathsep + cp,
                                      'OverlayASNSearch',
                                      mode,
                                      str(old),
                                      str(baseline / name),
                                      str(built / name),
                                      str(OUT / 'overlay' / name)],
                                     text=True)
    print(result.strip())
    checks.append(result.strip())
(OUT / 'preservation-check.json').write_text(
    json.dumps({'passed': True, 'checks': checks}, indent=2))
