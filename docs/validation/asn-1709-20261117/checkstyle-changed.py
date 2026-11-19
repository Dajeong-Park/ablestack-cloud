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

import hashlib,json,shutil,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/'), 'Use WSL ext4'
paths=['api/src/main/java/com/cloud/bgp/ASNumberRangeValidator.java',
       'api/src/main/java/org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmd.java',
       'api/src/test/java/com/cloud/bgp/ASNumberRangeValidatorTest.java',
       'api/src/test/java/org/apache/cloudstack/api/command/admin/bgp/CreateASNRangeCmdTest.java',
       'server/src/main/java/com/cloud/bgp/BGPServiceImpl.java',
       'server/src/test/java/com/cloud/bgp/BGPASNumberRangeTransactionTest.java']
target=OUT/'checkstyle-packaged-sources';target.mkdir(exist_ok=True)
for name in paths:
    dest=target/name.split('/java/',1)[1]
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/name,dest)
pom=f'''<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>qa</groupId><artifactId>asn1709-changed-checkstyle</artifactId><version>1</version><build><plugins><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-checkstyle-plugin</artifactId><version>3.6.0</version><dependencies><dependency><groupId>org.apache.cloudstack</groupId><artifactId>checkstyle</artifactId><version>4.23.0.0</version></dependency><dependency><groupId>com.puppycrawl.tools</groupId><artifactId>checkstyle</artifactId><version>8.18</version></dependency></dependencies><configuration><configLocation>cloud-style.xml</configLocation><sourceDirectories><sourceDirectory>{target}</sourceDirectory></sourceDirectories><includes>**/*.java</includes><consoleOutput>true</consoleOutput><failsOnError>true</failsOnError></configuration></plugin></plugins></build></project>'''
(OUT/'changed-checkstyle-pom.xml').write_text(pom,encoding='utf-8')
with (OUT/'changed-checkstyle-final.log').open('w') as log:
    subprocess.run(['mvn','-f',str(OUT/'changed-checkstyle-pom.xml'),'checkstyle:check'],stdout=log,stderr=subprocess.STDOUT,check=True)
(OUT/'changed-checkstyle-manifest.json').write_text(json.dumps({name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in paths},indent=2),encoding='utf-8')
print('Changed Java Checkstyle: PASS (6 files)')
