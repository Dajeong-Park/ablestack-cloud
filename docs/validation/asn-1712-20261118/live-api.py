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
import os
import sys
import urllib.request
import http.cookiejar
from api import Mold, OUT, redact


def body(data): return next(iter(data.values()))


def ok(data):
    value = body(data)
    assert not value.get('errorcode'), redact(data)
    return value


def inventory(cluster, after=False):
    m = Mold(cluster)
    result = {}
    for cmd, key in [('listZones', 'zone'), ('listASNRanges', 'asnumberrange'), ('listASNumbers', 'asnumber'), ('listNetworks', 'network'),
                     ('listVPCs', 'vpc'), ('listBgpPeers', 'bgppeer'), ('listNetworkOfferings', 'networkoffering'), ('listVPCOfferings', 'vpcoffering')]:
        val = ok(m.call(cmd, {'listall': 'true', 'page': 1, 'pagesize': 500}))
        result[cmd] = {
            'count': val.get(
                'count', 0), 'ids': sorted(
                row['id'] for row in val.get(
                    key, []))}
        if not after:
            result[cmd]['rows'] = redact(val.get(key, []))
    if after:
        before = json.loads(
            (OUT / f'{cluster}-inventory-before.json').read_text())
        assert all(value['count'] == before[cmd]['count'] and value['ids']
                   == before[cmd]['ids'] for cmd, value in result.items())
    (OUT / (str(cluster) + '-inventory-' + ('after' if after else 'before') +
     '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(cluster, 'inventory ' +
          ('preserved' if after else 'recorded'), flush=True)


def run(cluster):
    m = Mold(cluster)
    inv = json.loads((OUT / f'{cluster}-inventory-before.json').read_text())
    zone = inv['listZones']['rows'][0]['id']
    checks = []
    assert ok(m.call('listASNRanges', {'zoneid': zone})).get('count') == 0
    fixture = {'cluster': cluster, 'zoneid': zone, 'ranges': []}
    file = OUT / f'{cluster}-ui-fixtures.json'
    def save(): file.write_text(json.dumps(fixture, ensure_ascii=False, indent=2))

    def check(name, condition, data=None):
        checks.append({'name': name, 'pass': bool(
            condition), 'response': redact(data)})
        (OUT / f'{cluster}-api-validation.json').write_text(
            json.dumps({'checks': checks}, ensure_ascii=False, indent=2))
        assert condition, (name, redact(data))

    def query(**params): return m.call('listASNumbers',
                                       {'zoneid': zone, **params})
    for first, last in [(64512, 64534), (4200000000, 4200000002)]:
        row = ok(
            m.call(
                'createASNRange', {
                    'zoneid': zone, 'startasn': first, 'endasn': last}))['asnumberrange']
        fixture['ranges'].append(row)
        save()
    high = fixture['ranges'][1]['id']
    low = fixture['ranges'][0]['id']
    for label, params, count in [
        ('exact', {
            'asnumber': '4200000000'}, 1), ('leading-zero', {
            'asnumber': '004200000000'}, 1), ('keyword', {
                'keyword': '4200000000'}, 1), ('range', {
                    'asnrangeid': high}, 3), ('intersection', {
                        'asnumber': '4200000000', 'asnrangeid': high, 'keyword': '420'}, 1), ('wrong-keyword', {
                            'asnumber': '4200000000', 'keyword': '64512'}, 0), ('wrong-range', {
                                'asnumber': '4200000000', 'asnrangeid': low}, 0), ('free', {
                                    'isallocated': 'false'}, 26), ('allocated', {
                                        'isallocated': 'true'}, 0)]:
        data = query(**params)
        check(label, ok(data).get('count') == count, data)
    first = query(page=1, pagesize=20)
    second = query(page=2, pagesize=20)
    check(
        'server-page-total', ok(first)['count'] == ok(second)['count'] == 26 and len(
            ok(first)['asnumber']) == 20 and len(
            ok(second)['asnumber']) == 6 and not (
                {
                    r['id'] for r in ok(first)['asnumber']} & {
                        r['id'] for r in ok(second)['asnumber']}), {
                            'first': first, 'second': second})
    for raw in ['-1', '1e3', '4294967296']:
        data = query(asnumber=raw)
        check('invalid-exact-' + raw, body(data).get('errorcode') == 431, data)
    admin = ok(
        m.call(
            'listAccounts', {
                'name': 'admin', 'listall': 'true'}))['account'][0]
    domain = admin['domainid']
    fixture['rootdomainid'] = domain
    save()
    for label, params in [('domain-only', {'domainid': domain}),
                          ('account-domain', {'account': 'admin', 'domainid': domain})]:
        data = query(**params)
        check(label + '-excludes-unowned-free',
              ok(data).get('count') == 0, data)
    vpc = inv['listVPCs']['rows'][0]
    fixture['vpcid'] = vpc['id']
    save()
    data = query(vpcid=vpc['id'])
    check('vpc-read-only-empty', ok(data).get('count') == 0, data)
    tier = next((r for r in inv['listNetworks']
                ['rows'] if r.get('vpcid') == vpc['id']), None)
    if tier:
        fixture['tierid'] = tier['id']
        save()
        data = query(networkid=tier['id'], vpcid=vpc['id'])
        check('vpc-tier-and-empty', ok(data).get('count') == 0, data)
    standalone = next(r for r in inv['listNetworks']['rows'] if not r.get(
        'vpcid') and r.get('traffictype') == 'Guest')
    fixture['networkid'] = standalone['id']
    save()
    data = query(networkid=standalone['id'])
    check('network-read-only-empty', ok(data).get('count') == 0, data)
    data = query(networkid=standalone['id'], vpcid=vpc['id'])
    check('contradictory-network-vpc-rejected',
          body(data).get('errorcode') == 431, data)
    name = f'asn1712-user-{cluster}'
    assert not ok(
        m.call(
            'listAccounts', {
                'name': name, 'listall': 'true'})).get('account')
    role = ok(m.call('createRole',
                     {'name': name,
                      'type': 'User',
                      'ispublic': 'false',
                      'description': 'Disposable read-only ASN scope fixture'}))['role']
    fixture['roleid'] = role['id']
    save()
    for rule in ['listASNumbers', 'listApis', '*']:
        ok(m.call('createRolePermission',
                  {'roleid': role['id'],
                   'rule': rule,
                   'permission': 'deny' if rule == '*' else 'allow'}))
    account = ok(m.call('createAccount',
                        {'account': name,
                         'username': name,
                         'password': os.environ['MOLD_PASSWORD'],
                         'firstname': 'ASN',
                         'lastname': 'Scope',
                         'email': 'asn1712@example.invalid',
                         'roleid': role['id'],
                            'domainid': domain}))['account']
    fixture['accountid'] = account['id']
    fixture['username'] = name
    save()
    domainrow = ok(
        m.call(
            'createDomain', {
                'name': name, 'parentdomainid': domain}))['domain']
    fixture['domainid'] = domainrow['id']
    save()
    assert domainrow['id'] != domain
    user = Mold.__new__(Mold)
    user.__dict__.update(m.__dict__)
    user.s = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(
            http.cookiejar.CookieJar()))
    user.key = user.request({'command': 'login',
                             'username': name,
                             'password': os.environ['MOLD_PASSWORD'],
                             'response': 'json'})['loginresponse']['sessionkey']
    data = user.call('listASNumbers', {'zoneid': zone})
    check('user-default-free-visibility-preserved',
          ok(data).get('count') == 26, data)
    data = user.call('listASNumbers', {'zoneid': zone, 'domainid': domain})
    check('user-explicit-domain-excludes-unowned',
          ok(data).get('count') == 0, data)
    data = user.call(
        'listASNumbers', {
            'zoneid': zone, 'domainid': domainrow['id']})
    check(
        'user-foreign-domain-no-visible-records',
        body(data).get('errorcode') == 401 or body(data).get('count') == 0,
        data)
    fixture['numbers'] = ok(query())['asnumber']
    save()
    (OUT / f'{cluster}-api-validation.json').write_text(json.dumps({'cluster': cluster,
                                                                    'checks': checks, 'all_passed': True}, ensure_ascii=False, indent=2))
    print(
        cluster,
        len(checks),
        'checks PASS; UI fixtures retained',
        flush=True)


def cleanup(cluster):
    m = Mold(cluster)
    f = json.loads((OUT / f'{cluster}-ui-fixtures.json').read_text())
    for row in f['ranges']:
        present = ok(
            m.call(
                'listASNRanges', {
                    'zoneid': f['zoneid']})).get(
                'asnumberrange', [])
        if any(r['id'] == row['id'] for r in present):
            ok(m.call('deleteASNRange', {'id': row['id']}))
    for cmd, key in [('deleteAccount', 'accountid'),
                     ('deleteDomain', 'domainid')]:
        if f.get(key):
            result = ok(m.wait(m.call(cmd, {'id': f[key]})))
            assert result.get('jobstatus', 1) == 1
    if f.get('roleid'):
        ok(m.call('deleteRole', {'id': f['roleid']}))
    counts = {cmd: ok(m.call(cmd, {'zoneid': f['zoneid']})).get(
        'count') for cmd in ['listASNumbers', 'listASNRanges']}
    assert set(counts.values()) == {0}
    assert not ok(
        m.call(
            'listAccounts', {
                'name': f['username'], 'listall': 'true'})).get('account')
    roles = ok(
        m.call(
            'listRoles', {
                'pagesize': 500, 'page': 1})).get(
        'role', [])
    assert not any(r['id'] == f['roleid'] for r in roles)
    domains = ok(
        m.call(
            'listDomains', {
                'listall': 'true', 'pagesize': 500, 'page': 1})).get(
        'domain', [])
    assert not any(r['id'] == f['domainid'] for r in domains)
    (OUT / f'{cluster}-cleanup.json').write_text(json.dumps({'cluster': cluster,
                                                             'counts': counts,
                                                             'accountAbsent': True,
                                                             'roleAbsent': True,
                                                             'domainAbsent': True},
                                                            indent=2))
    print(cluster, 'cleanup PASS', flush=True)


if __name__ == '__main__':
    for cluster in [31, 32]:
        if sys.argv[1] == 'inventory':
            inventory(cluster)
        elif sys.argv[1] == 'audit':
            inventory(cluster, True)
        elif sys.argv[1] == 'cleanup':
            cleanup(cluster)
        else:
            run(cluster)
