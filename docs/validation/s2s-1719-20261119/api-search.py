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

fixtures = json.loads((OUT / 'fixtures.json').read_text())
for cluster in [31, 32]:
    mold = Mold(cluster)
    first, second = fixtures[str(cluster)]
    a, b = first['gateway'], second['gateway']
    results = []
    def check(name, params, expected, count=None):
        query = {'listall': 'true', 'page': 1, 'pagesize': 500, **params}
        response = mold.call('listVpnGateways', query)
        body = response.get('listvpngatewaysresponse', {})
        actual = sorted(x['id'] for x in body.get('vpngateway', []))
        wanted = sorted(expected)
        result = {'name': name, 'params': query, 'response': response, 'passed': actual == wanted and body.get('count', 0) == (len(wanted) if count is None else count) and 'errorcode' not in body}
        results.append(result); save(f'{cluster}-api-search.json', results)
        assert result['passed'], redact(result)
    both = [a['id'], b['id']]
    check('baseline', {}, both)
    check('ip', {'keyword': a['publicip']}, [a['id']])
    check('uuid', {'keyword': a['id']}, [a['id']])
    check('uuid-upper-trim', {'keyword': '  '+a['id'].upper()+'  '}, [a['id']])
    check('name-case', {'keyword': 'mix_'}, [a['id']])
    check('korean', {'keyword': '한글'}, [a['id']])
    check('literal-percent', {'keyword': '%'}, [a['id']])
    check('literal-underscore', {'keyword': '_'}, [a['id']])
    check('literal-backslash', {'keyword': chr(92)}, [a['id']])
    check('not-wildcard', {'keyword': 'qa%s2s'}, [])
    check('quote-literal', {'keyword': "' OR 1=1 --"}, [])
    check('no-match', {'keyword': 'unknown-1719'}, [])
    check('blank', {'keyword': '  '}, both)
    check('exact-id', {'id': a['id']}, [a['id']])
    check('exact-vpc', {'vpcid': first['vpc']['id']}, [a['id']])
    check('exact-id-and-keyword', {'id': a['id'], 'keyword': 'Plain'}, [])
    check('exact-vpc-and-keyword', {'vpcid': second['vpc']['id'], 'keyword': '한글'}, [])
    check('owner-and-keyword', {'domainid': a['domainid'], 'account': 'admin', 'keyword': 'Plain'}, [b['id']])
    check('other-owner-and-keyword', {'domainid': a['domainid'], 'account': 'system', 'keyword': '한글'}, [])
    page1 = mold.call('listVpnGateways', {'listall': 'true', 'keyword': f'qa-s2s1719-{cluster}', 'page': 1, 'pagesize': 1})['listvpngatewaysresponse']
    page2 = mold.call('listVpnGateways', {'listall': 'true', 'keyword': f'qa-s2s1719-{cluster}', 'page': 2, 'pagesize': 1})['listvpngatewaysresponse']
    assert page1['count'] == page2['count'] == 2
    assert {page1['vpngateway'][0]['id'], page2['vpngateway'][0]['id']} == set(both)
    results.append({'name': 'paging-count', 'page1': page1, 'page2': page2, 'passed': True})
    projects = json.loads((OUT / f'{cluster}-projects-before.json').read_text())
    project, original = next((pid, data['listVpnGateways']) for pid, data in projects.items() if items(data['listVpnGateways']))
    expected = [g['id'] for g in items(original)]
    check('project-isolation', {'projectid': project}, expected)
    check('keyword-cannot-escape-project', {'projectid': project, 'keyword': '한글'}, [])
    check('projectid-minus-one', {'projectid': '-1'}, expected + both)
    check('keyword-cannot-escape-project-all', {'projectid': '-1', 'keyword': '한글'}, [a['id']])
    bad = mold.call('listVpnGateways', {'id': 'not-a-uuid'})
    assert next(iter(bad.values())).get('errorcode')
    results.append({'name': 'invalid-uuid-rejected', 'response': bad, 'passed': True})
    save(f'{cluster}-api-search.json', results)
    print(cluster, len(results), 'API cases passed', flush=True)
