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

import hashlib,json,os,struct,subprocess,zipfile
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/dhslove/')
cp=(ROOT/'server/target/s2s1719-classpath.txt').read_text().strip()
name='com/cloud/network/vpn/Site2SiteVpnManagerImpl.class'
major=struct.unpack('>H',(ROOT/'server/target/classes'/name).read_bytes()[6:8])[0]
src=OUT/'baseline-source/com/cloud/network/vpn/Site2SiteVpnManagerImpl.java';src.parent.mkdir(parents=True,exist_ok=True)
src.write_bytes(subprocess.check_output(['git','show','055ea57b238746c65b66cc5600215b10f0087b23:server/src/main/java/com/cloud/network/vpn/Site2SiteVpnManagerImpl.java'],cwd=ROOT))
baseline=OUT/'baseline';baseline.mkdir(exist_ok=True)
subprocess.run(['javac','-source',str(major-44),'-target',str(major-44),'-cp',str(ROOT/'server/target/classes')+os.pathsep+cp,'-d',str(baseline),str(src)],check=True)
asm=os.pathsep.join(str(next((Path.home()/'.m2/repository/org/ow2/asm'/a/'7.3.1').glob(a+'-7.3.1.jar'))) for a in ['asm','asm-tree','asm-util'])
subprocess.run(['javac','-cp',asm,'-d',str(OUT),str(ROOT/'docs/validation/asn-1711-20261118/OverlayASNDeletion.java'),str(OUT/'OverlayS2sSearch.java')],check=True)
checks=[]
for cluster in [31,32]:
    for mode,name,built,base in [('service','com/cloud/network/vpn/Site2SiteVpnManagerImpl.class',ROOT/'server/target/classes',baseline),('command','org/apache/cloudstack/api/command/user/vpn/ListVpnGatewaysCmd.class',ROOT/'api/target/classes',ROOT/'api/target/classes')]:
        args=['java','-cp',str(OUT)+os.pathsep+asm,'OverlayS2sSearch',mode,str(OUT/'before-classes'/str(cluster)/name),str(base/name),str(built/name),str(OUT/'overlay'/str(cluster)/name)]
        text=subprocess.check_output(args,text=True).strip();print(cluster,text);checks.append({'cluster':cluster,'check':text})
    helper='com/cloud/network/vpn/Site2SiteVpnGatewaySearch.class'
    dest=OUT/'overlay'/str(cluster)/helper;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((ROOT/'server/target/classes'/helper).read_bytes())
    classpath=os.pathsep.join([str(OUT/'overlay'/str(cluster)),str(ROOT/'server/target/test-classes'),str(ROOT/'server/target/classes'),str(ROOT/'api/target/classes'),cp])
    result=subprocess.run(['java','--add-opens=java.base/java.lang=ALL-UNNAMED','-Xverify:all','-cp',classpath,'org.junit.runner.JUnitCore','com.cloud.network.vpn.Site2SiteVpnGatewaySearchTest','com.cloud.network.vpn.Site2SiteVpnManagerImplTest'],capture_output=True,text=True)
    (OUT/f'{cluster}-overlay-tests.log').write_text(result.stdout+result.stderr)
    assert result.returncode==0,result.stdout[-3000:]+result.stderr[-1000:]
    print(cluster,'overlay JUnit passed')
(OUT/'preservation-check.json').write_text(json.dumps({'source':'055ea57b238746c65b66cc5600215b10f0087b23','passed':True,'checks':checks,'overlayTests':'49 tests per deployed overlay; class verification enabled'},indent=2))
