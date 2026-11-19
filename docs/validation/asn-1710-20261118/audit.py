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

import json, sys, concurrent.futures
from api import Mold, redact, OUT

COMMANDS = ['listASNumbers', 'listASNRanges', 'createASNRange', 'deleteASNRange', 'releaseASNumber']
INVENTORY = ['listZones', 'listASNRanges', 'listASNumbers', 'listNetworks', 'listVPCs', 'listNetworkOfferings', 'listVPCOfferings', 'listBgpPeers', 'listStoragePools']

def save(name, data):
    (OUT / name).write_text(json.dumps(redact(data), ensure_ascii=False, indent=2), encoding='utf-8')

def run(cluster, phase):
    m = Mold(cluster)
    result = {}
    for cmd in INVENTORY:
        result[cmd] = m.call(cmd, {'listall': 'true', 'page': 1, 'pagesize': 500})
    save(f'{cluster}-inventory-{phase}.json', result)
    if phase == 'before':
        cat = {}
        for cmd in COMMANDS:
            cat[cmd] = m.call('listApis', {'name': cmd})
        save(f'{cluster}-api-contracts.json', cat)
    print(cluster, json.dumps({cmd: next(iter(data.values())).get('count', 0) for cmd, data in result.items()}))
    for cmd in ['listZones', 'listASNRanges', 'listASNumbers', 'listBgpPeers']:
        print(cluster, cmd, json.dumps(redact(result[cmd]), ensure_ascii=False))

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(2) as ex:
        list(ex.map(lambda c: run(c, sys.argv[1]), [31, 32]))
