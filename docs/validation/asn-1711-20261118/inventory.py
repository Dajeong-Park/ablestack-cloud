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
 m=Mold(cluster);result={}
 for cmd,key in [('listZones','zone'),('listASNRanges','asnumberrange'),('listASNumbers','asnumber'),('listNetworks','network'),('listVPCs','vpc'),('listBgpPeers','bgppeer'),('listNetworkOfferings','networkoffering'),('listVPCOfferings','vpcoffering')]:
  response=m.call(cmd,{'listall':'true','pagesize':500,'page':1});body=next(iter(response.values()));assert not body.get('errorcode'),redact(response)
  result[cmd]={'count':body.get('count',0),'ids':sorted(r['id'] for r in body.get(key,[]))}
  if cmd=='listZones':result['zones']=body.get(key,[])
 (OUT/f'{cluster}-inventory-before.json').write_text(json.dumps(redact(result),ensure_ascii=False,indent=2))
 print(cluster,{k:v['count'] for k,v in result.items() if isinstance(v,dict)},flush=True)
 if cluster==31:
  for name in ['createRole','createAccount','deleteRole','deleteAccount']:
   entry=m.call('listApis',{'name':name})['listapisresponse']['api'][0]
   print(name,[(p['name'],p['required']) for p in entry['params']],flush=True)
