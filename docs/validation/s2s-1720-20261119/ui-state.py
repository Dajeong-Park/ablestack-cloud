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
desired=sys.argv[1]=='true'
for cluster in [31,32]:
    f=json.loads((OUT/f'{cluster}-fixtures.json').read_text())
    r=next(x for x in f['resources'] if x['scope']=='account')
    mold=Mold(cluster)
    response=mold.wait(mold.call('updateVpnGateway',{'id':r['current_id'],'fordisplay':str(desired).lower()}))
    body=response.get('queryasyncjobresultresponse',{})
    assert body.get('jobstatus')==1 and body['jobresult']['vpngateway']['fordisplay']==desired,redact(response)
    r['display']=desired
    save(f'{cluster}-fixtures.json',f)
    save(f'{cluster}-ui-display-{str(desired).lower()}.json',response)
    print(cluster,desired,r['current_id'],body['jobresult']['vpngateway']['publicip'],flush=True)
