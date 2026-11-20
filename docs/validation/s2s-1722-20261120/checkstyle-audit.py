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

from pathlib import Path
import subprocess,json,xml.etree.ElementTree as E
out=Path('docs/validation/s2s-1722-20261120');root=Path.cwd()
r=E.parse('api/target/checkstyle-result.xml').getroot();files={str(Path(e.attrib['name']).relative_to(root)):e for e in r.findall('file')}
changed=['api/src/main/java/org/apache/cloudstack/api/command/user/vpn/CreateVpnGatewayCmd.java','api/src/test/java/org/apache/cloudstack/api/command/user/vpn/CreateVpnGatewayCmdMetadataTest.java']
for name in changed:assert name in files and not files[name].findall('error'),name
errors={name:len(e.findall('error')) for name,e in files.items() if e.findall('error')}
for name in errors:assert subprocess.check_output(['git','rev-parse','afbf6f26f14:'+name])==subprocess.check_output(['git','rev-parse','HEAD:'+name]),name
report={'changedJavaFiles':changed,'changedFileErrors':0,'moduleFilesChecked':len(files),'moduleErrors':sum(errors.values()),'unchangedBaselineFiles':errors,'base':'afbf6f26f14cfdb22cedb65d746c0a3f18784b2e'}
(out/'checkstyle-audit.json').write_text(json.dumps(report,indent=2));print('Changed Java2 PASS; module baseline:',sum(errors.values()),'errors in',len(errors),'unchanged files')
