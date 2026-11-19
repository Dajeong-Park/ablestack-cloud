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
from api import Mold,OUT,redact
for cluster in [31,32]:
 m=Mold(cluster);before=json.loads((OUT/f'{cluster}-inventory-before.json').read_text());after={};checks=[]
 for cmd,key in [('listZones','zone'),('listASNRanges','asnumberrange'),('listASNumbers','asnumber'),('listNetworks','network'),('listVPCs','vpc'),('listBgpPeers','bgppeer'),('listNetworkOfferings','networkoffering'),('listVPCOfferings','vpcoffering')]:
  data=m.call(cmd,{'listall':'true','page':1,'pagesize':500});value=next(iter(data.values()));assert not value.get('errorcode'),redact(data)
  after[cmd]={'count':value.get('count',0),'ids':sorted(row['id'] for row in value.get(key,[]))}
  assert after[cmd]==before[cmd],(cluster,cmd,after[cmd],before[cmd])
  checks.append({'name':cmd+'-inventory-preserved','pass':True})
 assert after['listASNRanges']['count']==after['listASNumbers']['count']==0
 (OUT/f'{cluster}-inventory-after.json').write_text(json.dumps({'inventory':after,'checks':checks,'all_passed':True},ensure_ascii=False,indent=2))
 print(cluster,'range/member 0; existing Zone/network/VPC/peer/offering IDs and counts preserved')
