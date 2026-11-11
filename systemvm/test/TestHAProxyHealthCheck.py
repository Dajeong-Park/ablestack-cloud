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

import importlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'debian/root/health_checks'))
checker = importlib.import_module('haproxy_check')


class TestHAProxyHealthCheck(unittest.TestCase):
    def setUp(self):
        self.rule = {'sourceIp': '192.0.2.10', 'sourcePortStart': '443', 'sourcePortEnd': '443',
                     'destPortStart': '22', 'destPortEnd': '22', 'vmIps': '10.0.0.2',
                     'algorithm': 'roundrobin', 'keepAliveEnabled': 'false', 'stickiness': '',
                     'maxconn': '2048', 'idletimeout': '0'}
        self.name = 'listen 192_0_2_10-443'
        self.section = {'bind': ['192.0.2.10:443'], 'balance': ['roundrobin'],
                        'server': ['192_0_2_10-443_0 10.0.0.2:22 check']}
        self.sections = {'global': {'maxconn': ['2048']}, 'defaults': {}, self.name: self.section}

    def check(self):
        return checker.checkLoadBalance([self.rule], self.sections)

    def test_tcp_exact_bind(self):
        self.assertTrue(self.check())

    def test_ssl_bind_options(self):
        for suffix in (' ssl crt /certificate.pem alpn h2,http/1.1 ssl-min-ver TLSv1.2',
                       '   alpn h2,http/1.1   crt /certificate.pem   ssl',
                       '\tssl\tcrt\t/certificate.pem\tciphers\tECDHE-RSA-AES128-GCM-SHA256'):
            with self.subTest(suffix=suffix):
                self.section['bind'] = ['192.0.2.10:443' + suffix]
                self.assertTrue(self.check())

    def test_wrong_endpoint_rejected(self):
        for endpoint in ('192.0.2.11:443', '192.0.2.10:444', '0.0.0.0:443', '*:443', '192.0.2.10:443-444'):
            with self.subTest(endpoint=endpoint):
                self.section['bind'] = [endpoint + ' ssl crt /certificate.pem']
                self.assertFalse(self.check())

    def test_missing_bind_rejected(self):
        del self.section['bind']
        self.assertFalse(self.check())

    def test_empty_or_invalid_bind_rejected(self):
        for bind in ('', '   ', '192.0.2.10', '192.0.2.10:0', '192.0.2.10:65536', '192.0.2.10:4-3',
                     '[192.0.2.10:443', '192.0.2.10:443,'):
            with self.subTest(bind=bind):
                self.section['bind'] = [bind]
                self.assertFalse(self.check())

    def test_extra_bind_line_rejected(self):
        self.section['bind'].append('192.0.2.11:443 ssl crt /certificate.pem')
        self.assertFalse(self.check())

    def test_extra_comma_endpoint_rejected(self):
        self.section['bind'] = ['192.0.2.10:443,192.0.2.11:443 ssl crt /certificate.pem']
        self.assertFalse(self.check())

    def test_equivalent_repeated_endpoint_does_not_hide_different_endpoint(self):
        self.section['bind'] = ['192.0.2.10:443', 'ipv4@192.0.2.10:443']
        self.assertTrue(self.check())
        self.section['bind'].append('192.0.2.11:443')
        self.assertFalse(self.check())

    def test_family_prefix(self):
        for bind in ('ipv4@192.0.2.10:443', 'ip@192.0.2.10:443'):
            self.section['bind'] = [bind]
            self.assertTrue(self.check())
        self.section['bind'] = ['ipv6@192.0.2.10:443']
        self.assertFalse(self.check())

    def test_port_range(self):
        self.rule.update(sourcePortStart='8000', sourcePortEnd='8002')
        self.sections['listen 192_0_2_10-8000-8002'] = self.sections.pop(self.name)
        self.section.update(bind=['192.0.2.10:8000-8002 ssl crt /certificate.pem'], server=['192_0_2_10-8000-8002_0 10.0.0.2:22'])
        self.assertTrue(self.check())
        self.section['bind'] = ['192.0.2.10:8000-8003']
        self.assertFalse(self.check())

    def test_ipv6_bind_and_backend(self):
        self.rule.update(sourceIp='2001:0db8::1', vmIps='2001:db8::2')
        self.sections['listen 2001:0db8::1-443'] = self.sections.pop(self.name)
        self.section['server'] = ['2001:0db8::1-443_0 [2001:db8::2]:22 ssl verify none check']
        for bind in ('[2001:db8::1]:443', '2001:db8::1:443', 'ipv6@2001:db8::1:443'):
            self.section['bind'] = [bind + ' ssl crt /certificate.pem']
            self.assertTrue(self.check())
        self.section['bind'] = ['[2001:db8::3]:443 ssl crt /certificate.pem']
        self.assertFalse(self.check())

    def test_missing_section_rejected(self):
        del self.sections[self.name]
        self.assertFalse(self.check())

    def test_missing_backend_rejected(self):
        del self.section['server']
        self.assertFalse(self.check())

    def test_wrong_backend_ip_port_or_name_rejected(self):
        for server in ('192_0_2_10-443_0 10.0.0.3:22', '192_0_2_10-443_0 10.0.0.2:23',
                       'other_pool_0 10.0.0.2:22', '192_0_2_10-443_0'):
            with self.subTest(server=server):
                self.section['server'] = [server]
                self.assertFalse(self.check())

    def test_multiple_expected_backends(self):
        self.rule['vmIps'] = '10.0.0.2   10.0.0.3'
        self.assertFalse(self.check())
        self.section['server'].append('192_0_2_10-443_1 10.0.0.3:22 ssl verify none check')
        self.assertTrue(self.check())

    def test_unassigned_rule_still_checks_bind(self):
        self.rule['vmIps'] = ''
        del self.section['server']
        self.assertTrue(self.check())
        del self.section['bind']
        self.assertFalse(self.check())

    def test_missing_or_wrong_algorithm_rejected(self):
        self.section['balance'] = ['leastconn']
        self.assertFalse(self.check())
        del self.section['balance']
        self.assertFalse(self.check())

    def test_http_and_stickiness_modes_remain_checked(self):
        self.rule['stickiness'] = 'LbCookie'
        self.assertFalse(self.check())
        self.section['mode'] = ['http']
        self.assertTrue(self.check())

    def test_parser_whitespace_comments_no_blank_separators_and_eof(self):
        text = ('# comment\nglobal\n\tmaxconn\t2048\ndefaults # defaults comment\n mode tcp\nlisten\t192_0_2_10-443 # listener\n'
                '\tbind\t192.0.2.10:443 ssl crt /certificate.pem\n balance roundrobin\n server 192_0_2_10-443_0 10.0.0.2:22')
        parsed = checker.parseConfig(text.splitlines())
        self.assertEqual(parsed['global']['maxconn'], ['2048'])
        self.assertEqual(parsed['defaults']['mode'], ['tcp'])
        self.assertTrue(checker.checkLoadBalance([self.rule], parsed))

    def test_parser_keeps_all_bind_lines(self):
        self.assertEqual(checker.parseConfig(['listen example', ' bind 192.0.2.1:80', ' bind 192.0.2.2:80'])['listen example']['bind'],
                         ['192.0.2.1:80', '192.0.2.2:80'])

    def test_maxconn_and_idle_timeout_checks_remain(self):
        self.assertTrue(checker.checkMaxconn(self.rule, self.sections))
        self.sections['global']['maxconn'] = ['1024']
        self.assertFalse(checker.checkMaxconn(self.rule, self.sections))
        self.assertTrue(checker.checkIdletimeout(self.rule, self.sections))
        self.rule['idletimeout'] = '5000'
        self.assertFalse(checker.checkIdletimeout(self.rule, self.sections))
        self.sections['defaults']['timeout'] = ['client 5000', 'server 5000']
        self.assertTrue(checker.checkIdletimeout(self.rule, self.sections))

    @patch('subprocess.run')
    def test_syntax_is_check_only_and_bounded(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, 'Configuration file is valid')
        self.assertTrue(checker.checkSyntax('/tmp/config with spaces.cfg'))
        args, kwargs = run.call_args
        self.assertEqual(args[0], ['/usr/sbin/haproxy', '-c', '-f', '/tmp/config with spaces.cfg'])
        self.assertEqual(kwargs['timeout'], 10)
        self.assertNotIn('shell', kwargs)

    @patch('subprocess.run')
    def test_invalid_syntax_rejected(self, run):
        run.return_value = subprocess.CompletedProcess([], 1, 'unknown keyword')
        self.assertFalse(checker.checkSyntax('/tmp/config.cfg'))

    @patch('subprocess.run', side_effect=subprocess.TimeoutExpired('haproxy', 10))
    def test_syntax_timeout_rejected(self, run):
        self.assertFalse(checker.checkSyntax('/tmp/config.cfg'))

    @patch('subprocess.run', side_effect=OSError('haproxy unavailable'))
    def test_missing_binary_rejected(self, run):
        self.assertFalse(checker.checkSyntax('/tmp/config.cfg'))

    def text(self):
        return ('global\n maxconn 2048\ndefaults\n mode tcp\nlisten 192_0_2_10-443\n bind 192.0.2.10:443 ssl crt /certificate.pem\n'
                ' balance roundrobin\n server 192_0_2_10-443_0 10.0.0.2:22\n')

    @patch.object(checker, 'checkSyntax', return_value=True)
    def test_validate_combines_syntax_and_expected_configuration(self, syntax):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'haproxy.cfg'
            file.write_text(self.text())
            self.assertTrue(checker.validateConfiguration([self.rule], str(file)))
            file.write_text(self.text().replace('bind 192.0.2.10:443', 'bind 192.0.2.11:443'))
            self.assertFalse(checker.validateConfiguration([self.rule], str(file)))
            file.write_text('')
            self.assertFalse(checker.validateConfiguration([self.rule], str(file)))

    @patch.object(checker, 'checkSyntax', return_value=True)
    def test_unreadable_config_rejected(self, syntax):
        self.assertFalse(checker.validateConfiguration([self.rule], '/nonexistent/qa/config.cfg'))

    @patch.object(checker, 'checkSyntax', return_value=False)
    def test_failed_syntax_never_reports_semantic_success(self, syntax):
        self.assertFalse(checker.validateConfiguration([self.rule], '/nonexistent/qa/config.cfg'))

    @patch.object(checker, 'getHealthChecksData', return_value=None)
    @patch.object(checker, 'checkSyntax')
    def test_no_lb_data_preserves_skip_contract(self, syntax, data):
        with self.assertRaises(SystemExit) as result:
            checker.main()
        self.assertEqual(result.exception.code, 0)
        syntax.assert_not_called()

    @patch.object(checker, 'getHealthChecksData')
    @patch.object(checker, 'validateConfiguration')
    def test_cli_exit_status_follows_validation(self, validate, data):
        data.return_value = [self.rule]
        for passed, status in ((True, 0), (False, 1)):
            validate.return_value = passed
            with self.assertRaises(SystemExit) as result:
                checker.main()
            self.assertEqual(result.exception.code, status)
