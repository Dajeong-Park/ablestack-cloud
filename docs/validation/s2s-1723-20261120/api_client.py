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

import concurrent.futures
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).parent
SENSITIVE = {'sessionkey', 'apikey', 'secretkey', 'password', 'ipsecpsk', 'zonetoken', 'secret', 'rbdsecretkey', 'users', 'user', 'userdetails', 'sshkeypairs'}

def sensitive_key(key):
    name = re.sub(r'[^a-z0-9]', '', key.lower())
    if name == 'apikeyaccess':
        return False  # Enabled/Disabled/Inherit policy enum, not a credential.
    return name in SENSITIVE or any(part in name for part in (
        'password', 'secret', 'accesskey', 'privatekey', 'sessionkey', 'apikey', 'token'))

def redact(value):
    if isinstance(value, dict):
        return {k: '[redacted]' if sensitive_key(k) else redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value

def save(name, value):
    (OUT / name).write_text(json.dumps(redact(value), ensure_ascii=False, indent=2), encoding='utf-8')

class Mold:
    def __init__(self, cluster):
        self.cluster = cluster
        self.base = f'http://10.10.{cluster}.10:8080/client/api'
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        login = self.request({'command': 'login', 'username': 'admin', 'password': os.environ['MOLD_PASSWORD'], 'response': 'json'})['loginresponse']
        self.key = login['sessionkey']

    def request(self, params):
        req = urllib.request.Request(self.base, data=urllib.parse.urlencode(params).encode())
        try:
            with self.opener.open(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            return json.load(error)

    def call(self, command, params=None):
        return self.request({'command': command, 'sessionkey': self.key, 'response': 'json', **(params or {})})

    def wait(self, data):
        jobid = next(iter(data.values())).get('jobid')
        if not jobid:
            return data
        for _ in range(90):
            data = self.call('queryAsyncJobResult', {'jobid': jobid})
            if data['queryasyncjobresultresponse']['jobstatus'] != 0:
                return data
            time.sleep(1)
        return data

def items(data):
    body = next(iter(data.values()))
    return next((v for v in body.values() if isinstance(v, list)), [])

def inventory(cluster, suffix):
    mold = Mold(cluster)
    commands = ['listZones', 'listClusters', 'listStoragePools', 'listVPCs', 'listVPCOfferings', 'listPublicIpAddresses', 'listVpnGateways', 'listVpnConnections', 'listVpnCustomerGateways', 'listNetworks', 'listRouters', 'listProjects']
    result = {command: mold.call(command, {'listall': 'true', 'page': 1, 'pagesize': 500}) for command in commands}
    for command, response in result.items():
        if 'errorcode' in next(iter(response.values())):
            raise RuntimeError((command, redact(response)))
    save(f'{cluster}-inventory-{suffix}.json', result)
    if suffix == 'before':
        contracts = mold.call('listApis')
        target = [a for a in items(contracts) if any(word in a['name'] for word in ['VpnGateway', 'VpnGateways', 'VpnConnection', 'VpnConnections', 'VpnCustomerGateway', 'VpnCustomerGateways', 'VpnParameters'])]
        save(f'{cluster}-api-contracts.json', target)
        print(cluster, 'apis', [a['name'] for a in target])
    for command, data in result.items():
        rows = items(data)
        print(cluster, command, len(rows), json.dumps([{k: v for k, v in row.items() if k in {'id', 'name', 'displaytext', 'state', 'type', 'publicip', 'vpcid', 'projectid', 'gateway', 'cidr', 'ipaddress', 'issourcenat', 'isstaticnat', 'account'}} for row in rows], ensure_ascii=False) if command in ['listVPCs', 'listVPCOfferings', 'listVpnGateways', 'listProjects', 'listStoragePools'] else '')
    return result

if __name__ == '__main__':
    if sys.argv[1] == 'inventory':
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda cluster: inventory(cluster, sys.argv[2]), [31, 32]))
    else:
        cluster, command = int(sys.argv[1]), sys.argv[2]
        params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        mold = Mold(cluster)
        response = mold.wait(mold.call(command, params))
        if len(sys.argv) > 4:
            save(sys.argv[4], response)
        print(json.dumps(redact(response), ensure_ascii=False, indent=2))
