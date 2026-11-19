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

import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'asn-1713-20261118'))
from api import Mold, redact
OUT=Path(__file__).resolve().parent

def ok(data):
    val=next(iter(data.values()))
    assert 'errorcode' not in val, redact(data)
    return val

def snapshot(m):
    result={}
    for cmd in ['listZones','listASNRanges','listASNumbers','listVirtualMachines','listNetworks','listVPCs','listPublicIpAddresses']:
        v=ok(m.call(cmd, {'listall':'true','pagesize':500,'page':1}))
        rows=next((x for x in v.values() if isinstance(x,list)),[])
        result[cmd]={'count':v.get('count',len(rows)),'ids':sorted(r['id'] for r in rows)}
    return result

for cluster in [31,32]:
    m=Mold(cluster); mode=sys.argv[1]
    if mode=='create':
        before=snapshot(m)
        if (OUT/f'{cluster}-fixture.json').exists():
            f=json.loads((OUT/f'{cluster}-fixture.json').read_text()); zone=f['zoneid']; row=f['range']
        else:
            assert before['listASNRanges']['count']==before['listASNumbers']['count']==0
            (OUT/f'{cluster}-inventory-before.json').write_text(json.dumps(before,indent=2))
            zone=before['listZones']['ids'][0]
            row=ok(m.call('createASNRange',{'zoneid':zone,'startasn':64512,'endasn':64514}))['asnumberrange']
        fixture={'cluster':cluster,'zoneid':zone,'range':row}
        (OUT/f'{cluster}-fixture.json').write_text(json.dumps(fixture,indent=2))
        numbers=ok(m.call('listASNumbers',{'zoneid':zone,'pagesize':500,'page':1}))
        assert len(numbers['asnumber'])==3
        assert all(r['asnrangeid']==row['id'] and r['allocationstate']=='Free' for r in numbers['asnumber'])
        checks={'all':numbers}
        for params in [{'asnumber':64512},{'keyword':'6451'},{'isallocated':'false'}]:
            checks[str(params)]=ok(m.call('listASNumbers',{'zoneid':zone,**params}))
        (OUT/f'{cluster}-api.json').write_text(json.dumps(checks,indent=2))
        print(cluster,'fixture',row['id'],flush=True)
    elif mode=='add':
        f=json.loads((OUT/f'{cluster}-fixture.json').read_text())
        assert 'extra' not in f
        f['extra']=ok(m.call('createASNRange', {'zoneid':f['zoneid'],'startasn':64515,'endasn':64515}))['asnumberrange']
        (OUT/f'{cluster}-fixture.json').write_text(json.dumps(f,indent=2))
        print(cluster,'added one disposable ASN for refresh',flush=True)
    elif mode=='cleanup':
        f=json.loads((OUT/f'{cluster}-fixture.json').read_text())
        rows=ok(m.call('listASNRanges',{'zoneid':f['zoneid']})).get('asnumberrange',[])
        for expected in [f['range']]+([f['extra']] if 'extra' in f else []):
            owned=[r for r in rows if r['id']==expected['id']]
            if owned:
                assert owned[0]['startasn']==expected['startasn'] and owned[0]['endasn']==expected['endasn']
                ok(m.call('deleteASNRange',{'id':owned[0]['id']}))
        after=snapshot(m)
        assert after==json.loads((OUT/f'{cluster}-inventory-before.json').read_text())
        (OUT/f'{cluster}-inventory-after.json').write_text(json.dumps(after,indent=2))
        print(cluster,'cleanup and inventory preservation PASS',flush=True)
