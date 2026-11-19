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

import shutil,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2]
assert str(ROOT).startswith('/home/ablecloud/work/')
classes=[('server','com/cloud/bgp/BGPServiceImpl$1.class'),('api','org/apache/cloudstack/api/command/admin/bgp/DeleteASNRangeCmd.class'),('server','com/cloud/bgp/BGPServiceImpl.class'),('server','com/cloud/api/response/ApiResponseSerializer.class'),('engine/schema','com/cloud/dc/dao/ASNumberDaoImpl.class')]
try:
 for module,name in classes:
  target=ROOT/module/'target/classes'/name;backup=OUT/'built-original'/name;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup) if target.exists() else None;shutil.copy2(OUT/('before-classes/31' if name.endswith('$1.class') else 'overlay')/name,target)
 for module,tests in [('engine/schema','ASNumberDaoQueryTest'),('server','BGPASNumberRangeDeletionTest,BGPASNumberRangeTransactionTest,BGPASNumberQueryTest,BGPServiceImplTest,ASNListCountSerializationTest,ApiResponseSerializerTest')]:
  with (OUT/('overlay-'+module.replace('/','-')+'.log')).open('w') as log:
   subprocess.run(['mvn','-pl',module,'surefire:test','-Dtest='+tests,'-DfailIfNoTests=false','-Dcheckstyle.skip=true'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
finally:
 for module,name in classes:
  backup=OUT/'built-original'/name
  if backup.exists():shutil.copy2(backup,ROOT/module/'target/classes'/name)
  elif name.endswith('$1.class'):(ROOT/module/'target/classes'/name).unlink(missing_ok=True)
print('Overlay schema / server behavior tests PASS; Maven classes restored')
