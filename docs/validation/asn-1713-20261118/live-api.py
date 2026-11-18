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
import subprocess
import base64
from api import Mold, OUT, redact


def body(data):
    return next(iter(data.values()))


def ok(data):
    value = body(data)
    assert not value.get('errorcode'), redact(data)
    return value


def inventory(cluster, after=False):
    m = Mold(cluster)
    result = {}
    before = json.loads((OUT / f'{cluster}-inventory-before.json').read_text()) if after else None
    fields = ['id', 'name', 'displaytext', 'zoneid', 'networkofferingid', 'vpcofferingid', 'account', 'domainid',
              'vpcid', 'routingmode', 'specifyasnumber', 'type', 'routedmodeenabled', 'networktype', 'cidr', 'netmask', 'gateway']
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
        else:
            def project(rows):
                return sorted([{k: row[k] for k in fields if k in row}
                               for row in rows], key=lambda row: row['id'])
            assert project(before[cmd]['rows']) == project(val.get(key, [])), cmd
            result[cmd]['configurationFieldsPreserved'] = True
    if after:
        before = json.loads(
            (OUT / f'{cluster}-inventory-before.json').read_text())
        assert all(value['count'] == before[cmd]['count'] and value['ids']
                   == before[cmd]['ids'] for cmd, value in result.items())
    (OUT / (str(cluster) + '-inventory-' + ('after' if after else 'before') +
     '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(cluster, 'inventory ' +
          ('preserved' if after else 'recorded'), flush=True)


def discover(cluster):
    """Record only the two disposable ranges created through the UI."""
    m = Mold(cluster)
    inv = json.loads((OUT / f'{cluster}-inventory-before.json').read_text())
    assert inv['listASNRanges']['count'] == inv['listASNumbers']['count'] == 0
    zone = inv['listZones']['rows'][0]['id']
    ranges = ok(m.call('listASNRanges', {'zoneid': zone})).get('asnumberrange', [])
    assert len(ranges) == 2
    assert sorted((int(r['startasn']), int(r['endasn'])) for r in ranges) == [(64512, 64514), (4200000000, 4200000002)]
    rows = ok(m.call('listASNumbers', {'zoneid': zone, 'page': 1, 'pagesize': 500})).get('asnumber', [])
    assert len(rows) == 6 and all(r['asnrangeid'] in {v['id'] for v in ranges} for r in rows)
    f = {'cluster': cluster, 'zoneid': zone, 'ranges': ranges, 'numbers': rows}
    (OUT / f'{cluster}-ui-fixtures.json').write_text(json.dumps(f, indent=2))
    print(cluster, 'recorded UI-created disposable ranges', flush=True)


def sql(cluster, statement):
    """Run local MySQL on the management node; never connect remotely to MySQL."""
    code = '''import os,subprocess,base64
env=dict(os.environ, MYSQL_PWD=os.environ['ASN_DB_PASSWORD'])
r=subprocess.run(['mysql','-uroot','-N','-B','cloud'],input=base64.b64decode('SQL_PAYLOAD').decode(),text=True,capture_output=True,env=env,check=True)
print(r.stdout,end='')
'''.replace('SQL_PAYLOAD', base64.b64encode(statement.encode()).decode())
    # A shell-free SSH invocation transports a script; the password is not logged.
    code = "import os\nos.environ['ASN_DB_PASSWORD']=" + repr(os.environ['ASN_DB_PASSWORD']) + '\n' + code
    return subprocess.check_output(['sshpass', '-e', 'ssh', '-o', 'ConnectTimeout=10',
                                    f'ablecloud@10.10.{cluster}.10', 'sudo -n python3 -'],
                                   input=code, text=True).strip()


def allocation_fixture(cluster, mode):
    """Modify only an owned new ASN row. Referenced networks/VPCs are read-only."""
    f = json.loads((OUT / f'{cluster}-ui-fixtures.json').read_text())
    inv = json.loads((OUT / f'{cluster}-inventory-before.json').read_text())
    index = {'network': 64512, 'vpc': 64513, 'missing': 64514}[mode]
    row = next(r for r in f['numbers'] if int(r['asnumber']) == index)
    guard = (f"a.uuid='{row['id']}' AND r.uuid='{row['asnrangeid']}' AND a.as_number={index} "
             f"AND z.uuid='{f['zoneid']}' AND a.removed IS NULL AND r.removed IS NULL")
    join = 'JOIN as_number_range r ON r.id=a.as_number_range_id JOIN data_center z ON z.id=a.data_center_id'
    assert sql(cluster, f'SELECT COUNT(*) FROM as_number a {join} WHERE {guard} AND a.is_allocated=0;') == '1'
    if mode == 'missing':
        assignment = 'a.is_allocated=1,a.allocated=UTC_TIMESTAMP(),a.network_id=NULL,a.vpc_id=NULL'
    else:
        key, offkey, cmd = ('network', 'networkofferingid', 'listNetworkOfferings') if mode == 'network' else (
            'vpc', 'vpcofferingid', 'listVPCOfferings')
        allowed = {r['id'] for r in inv[cmd]['rows'] if r.get('specifyasnumber') is False}
        refs = inv['listNetworks' if mode == 'network' else 'listVPCs']['rows']
        ref = next(r for r in refs if r.get(offkey) in allowed and r.get('zoneid') == f['zoneid'] and r.get('account'))
        table, zonecol = ('networks', 'data_center_id') if mode == 'network' else ('vpc', 'zone_id')
        join += f" JOIN {table} ref ON ref.uuid='{ref['id']}' AND ref.{zonecol}=z.id AND ref.removed IS NULL"
        assignment = ('a.is_allocated=1,a.allocated=UTC_TIMESTAMP(),a.account_id=ref.account_id,a.domain_id=ref.domain_id,'
                      + ('a.network_id=ref.id,a.vpc_id=NULL' if mode == 'network' else 'a.network_id=NULL,a.vpc_id=ref.id'))
    assert sql(
        cluster, f'UPDATE as_number a {join} SET {assignment} WHERE {guard} AND a.is_allocated=0; SELECT ROW_COUNT();') == '1'
    print(cluster, mode, 'disposable ASN allocation fixture prepared', flush=True)


def validate(cluster, phase):
    m = Mold(cluster)
    f = json.loads((OUT / f'{cluster}-ui-fixtures.json').read_text())
    zone = f['zoneid']
    checks = []

    def check(name, condition, data=None):
        checks.append({'name': name, 'pass': bool(condition), 'response': redact(data)})
        assert condition, checks[-1]

    def query(**params):
        return ok(m.call('listASNumbers', {'zoneid': zone, 'page': 1, 'pagesize': 500, **params}))
    rows = query(pagesize=500)
    check('six-owned-members', rows.get('count') == 6 and len(rows.get('asnumber', [])) == 6, rows)
    for row in rows['asnumber']:
        check('additive-eligibility-' + str(row['asnumber']), isinstance(row.get('releasable'), bool) and row.get(
            'releasereason') in ['eligible', 'notallocated', 'requiredbyoffering', 'missingreference', 'unknown'], row)
    exact = query(asnumber=4200000000)
    check('exact-32bit-query', exact.get('count') == 1 and exact['asnumber'][0]['asnumber'] == 4200000000, exact)
    high_range = next(r for r in f['ranges'] if int(r['startasn']) == 4200000000)
    interval = query(asnrangeid=high_range['id'])
    check('32bit-range-filter', interval.get('count') == 3, interval)
    page = query(page=2, pagesize=2)
    check('server-page-count', page.get('count') == 6 and len(page.get('asnumber', [])) == 2, page)
    free = ok(m.call('releaseASNumber', {'zoneid': zone, 'asnumber': 4200000002}))
    check('free-release-idempotent-sync', free.get('success') is True and not free.get('jobid'), free)
    absent = body(m.call('releaseASNumber', {'zoneid': zone, 'asnumber': 64599}))
    check('absent-target-rejected', absent.get('errorcode') == 431, absent)
    if phase == 'allocated':
        for asn in [64512, 64513]:
            row = query(asnumber=asn)['asnumber'][0]
            check('read-only-offering-eligible-' + str(asn),
                  row['releasable'] is True and row['releasereason'] == 'eligible' and row['allocationstate'] == 'Allocated', row)
        missing = query(asnumber=64514)['asnumber'][0]
        check('missing-reference-fails-closed', missing['releasable']
              is False and missing['releasereason'] == 'missingreference', missing)
        rejected = body(m.call('releaseASNumber', {'zoneid': zone, 'asnumber': 64514}))
        check('missing-reference-release-rejected', rejected.get('errorcode') == 431, rejected)
        state = query(isallocated='true')
        check('allocated-filter-current-count', state.get('count') == 3, state)
    elif phase == 'released':
        for asn in [64512, 64513]:
            row = query(asnumber=asn)['asnumber'][0]
            check('ui-release-observed-free-' + str(asn), row['allocationstate'] == 'Free' and row['releasable'] is False and row['releasereason']
                  == 'notallocated' and not row.get('associatednetworkid') and not row.get('vpcid') and not row.get('allocated'), row)
    (OUT / f'{cluster}-api-{phase}.json').write_text(json.dumps({'cluster': cluster,
                                                                 'checks': checks, 'all_passed': True}, ensure_ascii=False, indent=2))
    print(cluster, phase, len(checks), 'checks PASS', flush=True)


def reset_missing(cluster):
    f = json.loads((OUT / f'{cluster}-ui-fixtures.json').read_text())
    row = next(r for r in f['numbers'] if int(r['asnumber']) == 64514)
    guard = f"a.uuid='{row['id']}' AND r.uuid='{row['asnrangeid']}' AND a.as_number=64514 AND a.network_id IS NULL AND a.vpc_id IS NULL"
    assert sql(
        cluster, f'UPDATE as_number a JOIN as_number_range r ON r.id=a.as_number_range_id SET a.is_allocated=0,a.allocated=NULL WHERE {guard}; SELECT ROW_COUNT();') == '1'
    print(cluster, 'removed controlled missing-reference fixture', flush=True)


def cleanup_identity(cluster):
    m = Mold(cluster)
    f = json.loads((OUT / f'{cluster}-ui-fixtures.json').read_text())
    account = ok(m.call('listAccounts', {'name': f['username'], 'listall': 'true'})).get('account', [])
    if account:
        assert len(
            account) == 1 and account[0]['name'] == f'asn1713-read{cluster}' and account[0]['id'] == f['accountid']
        result = ok(m.wait(m.call('deleteAccount', {'id': f['accountid']})))
        assert result.get('jobstatus', 1) == 1
    roles = [r for r in ok(m.call('listRoles', {'page': 1, 'pagesize': 500})).get('role', []) if r['id'] == f['roleid']]
    if roles:
        assert len(roles) == 1 and roles[0]['name'] == f'asn1713-read{cluster}'
        ok(m.call('deleteRole', {'id': f['roleid']}))
    assert not ok(m.call('listAccounts', {'name': f['username'], 'listall': 'true'})).get('account')
    assert not [r for r in ok(m.call('listRoles', {'page': 1, 'pagesize': 500})).get(
        'role', []) if r['id'] == f['roleid']]
    (OUT / f'{cluster}-identity-cleanup.json').write_text(json.dumps({'accountAbsent': True, 'roleAbsent': True}, indent=2))
    print(cluster, 'disposable identity cleanup PASS', flush=True)


def permission_fixture(cluster):
    m = Mold(cluster)
    fpath = OUT / f'{cluster}-ui-fixtures.json'
    f = json.loads(fpath.read_text())
    inv = json.loads((OUT / f'{cluster}-inventory-before.json').read_text())
    domain = inv['listNetworks']['rows'][0]['domainid']
    roots = ok(m.call('listDomains', {'listall': 'true', 'page': 1, 'pagesize': 500}))['domain']
    domain = next(r['id'] for r in roots if r.get('level') == 0)
    name = f'asn1713-read{cluster}'
    role = ok(m.call('createRole', {'name': name, 'type': 'Admin',
              'description': 'Disposable ASN-05 read-only verification'}))['role']
    f['roleid'] = role['id']
    fpath.write_text(json.dumps(f, indent=2))
    for rule in ['list*', 'readyForShutdown', '*']:
        ok(m.call('createRolePermission', {'roleid': role['id'],
           'rule': rule, 'permission': 'deny' if rule == '*' else 'allow'}))
    account = ok(m.call('createAccount', {'username': name, 'password': os.environ['MOLD_PASSWORD'], 'firstname': 'ASN',
                 'lastname': 'Read', 'email': 'asn1713@example.invalid', 'accounttype': 1, 'roleid': role['id'], 'domainid': domain}))['account']
    f.update(accountid=account['id'], username=name)
    fpath.write_text(json.dumps(f, indent=2))
    user = Mold.__new__(Mold)
    user.cluster = m.cluster
    user.base = m.base
    user.s = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    user.key = user.request({'command': 'login', 'username': name, 'password': os.environ['MOLD_PASSWORD'], 'response': 'json'})[
        'loginresponse']['sessionkey']
    denied = body(user.call('releaseASNumber', {'zoneid': f['zoneid'], 'asnumber': 64512}))
    assert denied.get('errorcode') in [401, 432], redact(denied)
    row = ok(user.call('listASNumbers', {'zoneid': f['zoneid'], 'asnumber': 64512}))['asnumber'][0]
    assert row['releasable'] is True and row['releasereason'] == 'eligible'
    catalog = ok(user.call('listApis', {})).get('api', [])
    assert 'releaseASNumber' not in {r['name'] for r in catalog}
    (OUT / f'{cluster}-permission.json').write_text(json.dumps({'releaseDenied': True,
                                                                'errorcode': denied['errorcode'], 'resourceEligibilityIndependentOfPermission': True, 'releaseAbsentFromCatalog': True}, indent=2))
    print(cluster, 'read-only Admin API permission checks PASS', flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    clusters = [int(sys.argv[2])] if len(sys.argv) > 2 else [31, 32]
    for cluster in clusters:
        if mode == 'inventory':
            inventory(cluster)
        elif mode == 'audit':
            inventory(cluster, True)
        elif mode == 'discover':
            discover(cluster)
        elif mode in ['network', 'vpc', 'missing']:
            allocation_fixture(cluster, mode)
        elif mode == 'reset-missing':
            reset_missing(cluster)
        elif mode == 'cleanup-identity':
            cleanup_identity(cluster)
        elif mode == 'permission':
            permission_fixture(cluster)
        else:
            validate(cluster, mode)
