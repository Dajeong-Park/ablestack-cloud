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
from pathlib import Path

P = Path(__file__).parent
FIELDS = {
 'listZones': ['id','name','networktype','routedmodeenabled','allocationstate','asnrange','dns1','dns2','internaldns1','internaldns2','guestcidraddress','resourcedetails'],
 'listNetworks': ['id','name','displaytext','state','account','domainid','networkofferingid','vpcid','cidr','ip4routing','asnumber','gateway','netmask','dns1','dns2','tags'],
 'listVPCs': ['id','name','state','account','domainid','vpcofferingid','cidr','asnumber','dns1','dns2','tags'],
 'listNetworkOfferings': ['id','name','state','guestiptype','forvpc','routingmode','specifyasnumber','service','tags'],
 'listVPCOfferings': ['id','name','state','routingmode','specifyasnumber','service','tags'],
 'listBgpPeers': ['id','asnumber','ip4address','ip6address','zoneid'],
 'listStoragePools': ['id','name','type','state','zoneid','clusterid']
}
def rows(data):
    v = next(iter(data.values()))
    return next((x for x in v.values() if isinstance(x,list)), [])
def canonical(value):
    if isinstance(value,dict):return {k:canonical(v) for k,v in value.items()}
    if isinstance(value,list):return sorted([canonical(v) for v in value],key=lambda v:json.dumps(v,sort_keys=True,ensure_ascii=False))
    return value

def selected(data, fields):
    return sorted([{k:r.get(k) for k in fields} for r in rows(data)], key=lambda r:r.get('id') or '')
result = {'clusters': {}, 'all_preserved': True}
for c in [31,32]:
    before=json.loads((P/f'{c}-inventory-before.json').read_text(encoding='utf-8'))
    after=json.loads((P/f'{c}-inventory-after.json').read_text(encoding='utf-8'))
    checks={}
    for cmd,fields in FIELDS.items():
        a,b=selected(before[cmd],fields), selected(after[cmd],fields)
        checks[cmd]={'before_count':len(a),'after_count':len(b),'selected_fields':fields,'raw_equal':a==b,'equal':canonical(a)==canonical(b)}
    for cmd in ['listASNRanges','listASNumbers']:
        checks[cmd]={'before_count':len(rows(before[cmd])),'after_count':len(rows(after[cmd])),'empty_restored':len(rows(before[cmd]))==len(rows(after[cmd]))==0}
    result['clusters'][str(c)]=checks
    result['all_preserved'] &= all(v.get('equal',v.get('empty_restored',False)) for v in checks.values())
(P/'preservation-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert result['all_preserved']
