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

from api_client import *

fixtures=json.loads((OUT / 'fixtures.json').read_text())
for cluster in [31,32]:
    mold=Mold(cluster)
    for fixture in fixtures[str(cluster)]:
        gateway, vpc=fixture['gateway'],fixture['vpc']
        assert vpc['name'].startswith(f'qa-s2s1719-{cluster}-')
        result=mold.wait(mold.call('deleteVpnGateway',{'id':gateway['id']}))
        save(f"{cluster}-cleanup-gateway-{gateway['id']}.json",result)
        assert result['queryasyncjobresultresponse']['jobstatus']==1,redact(result)
        result=mold.wait(mold.call('deleteVPC',{'id':vpc['id']}))
        save(f"{cluster}-cleanup-vpc-{vpc['id']}.json",result)
        assert result['queryasyncjobresultresponse']['jobstatus']==1,redact(result)
    before=json.loads((OUT / f'{cluster}-inventory-before.json').read_text())
    checks={}
    fields={'listVPCs':['id','name','account','domainid','cidr','fordisplay','vpcofferingid'], 'listVpnGateways':['id','vpcid','publicip','account','domainid','projectid','fordisplay'], 'listVpnConnections':['id','s2svpngatewayid','s2scustomergatewayid','passive','account','domainid','projectid','fordisplay'], 'listVpnCustomerGateways':['id','name','gateway','cidrlist','account','domainid','projectid'], 'listPublicIpAddresses':['id','ipaddress','account','domainid','projectid','vpcid','networkid','issourcenat','isstaticnat','fordisplay']}
    def stable(data,keys): return sorted([{k:r[k] for k in keys if k in r} for r in items(data)],key=lambda r:r['id'])
    for command,keys in fields.items():
        after=mold.call(command,{'listall':'true','page':1,'pagesize':500})
        old=stable(before[command],keys);new=stable(after,keys)
        checks[command]={'before':old,'after':new,'preserved':old==new}
        assert old==new,(cluster,command,old,new)
    projects=json.loads((OUT/f'{cluster}-projects-before.json').read_text())
    for pid,data in projects.items():
        for command,old in data.items():
            keys=fields[command]
            after=mold.call(command,{'projectid':pid,'listall':'true','page':1,'pagesize':500})
            prior=stable(old,keys);current=stable(after,keys)
            checks[pid+':'+command]={'before':prior,'after':current,'preserved':prior==current}
            assert prior==current,(cluster,pid,command)
    save(f'{cluster}-cleanup-preservation.json',checks)
    print(cluster,'dedicated gateways/VPCs removed; existing default/project identities/settings preserved',flush=True)
