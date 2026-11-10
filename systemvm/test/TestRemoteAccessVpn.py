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

import copy
import importlib
import stat
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

with patch('logging.basicConfig'):
    configure = importlib.import_module('configure')
CsFile = configure.CsFile


class TestRemoteAccessVpn(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.paths = {
            'l2tp.conf': self.root / 'l2tp.conf',
            'ipsec.any.secrets': self.root / 'ipsec.any.secrets',
            'xl2tpd.conf': self.root / 'xl2tpd.conf',
            'options.xl2tpd': self.root / 'options.xl2tpd',
        }
        for path in self.paths.values():
            path.write_text('')
            path.chmod(0o600)
        self.vpn = object.__new__(configure.CsRemoteAccessVpn)
        self.vpn.VPNCONFDIR = str(self.root)
        self.vpn.config = Mock()
        self.vpn.config.has_public_network.return_value = True
        self.vpn.config.is_vpc.return_value = False
        self.vpn.fw = []
        self.address = '192.0.2.10'
        self.settings = {
            'create': True,
            'local_ip': '10.20.0.1',
            'local_cidr': '10.20.0.0/24',
            'public_interface': 'eth2',
            'ip_range': '10.30.0.2-10.30.0.8',
            'preshared_key': 'synthetic-vpn-key',
            'vpn_server_ip': self.address,
        }
        self.vpn.dbag = {self.address: self.settings}
        self.files = patch.object(configure, 'CsFile', side_effect=self.file)
        self.files.start()
        self.addCleanup(self.files.stop)
        self.helper = patch.object(configure, 'CsHelper')
        self.commands = self.helper.start()
        self.addCleanup(self.helper.stop)

    def file(self, name):
        return CsFile(str(self.paths[Path(name).name]))

    def prime(self):
        self.assertTrue(self.vpn.configure_l2tpIpsec(self.address, self.settings))
        self.commands.reset_mock()

    def snapshot(self):
        return {name: (path.read_bytes(), path.stat().st_mtime_ns, path.stat().st_ino,
                       stat.S_IMODE(path.stat().st_mode)) for name, path in self.paths.items()}

    def assert_no_restart(self):
        commands = [call.args[0] for call in self.commands.execute.call_args_list]
        self.assertNotIn('systemctl restart xl2tpd', commands)
        self.assertNotIn('systemctl stop xl2tpd', commands)
        self.assertIn('systemctl start xl2tpd', commands)

    def test_same_configuration_preserves_bytes_mtime_inode_and_mode(self):
        self.prime()
        before = self.snapshot()
        for _ in range(3):
            self.assertFalse(self.vpn.configure_l2tpIpsec(self.address, self.settings))
        self.assertEqual(before, self.snapshot())
        self.assertEqual(0o600, stat.S_IMODE(self.paths['ipsec.any.secrets'].stat().st_mode))

    def test_unrelated_updates_do_not_restart_existing_l2tp_service(self):
        self.prime()
        for _ in range(3):
            self.vpn.process()
        self.assert_no_restart()

    def test_initial_configuration_still_restarts_service(self):
        self.vpn.process()
        self.commands.execute.assert_any_call('systemctl restart xl2tpd')
        self.assertIn('synthetic-vpn-key', self.paths['ipsec.any.secrets'].read_text())

    def test_real_psk_change_is_applied_once_without_preserving_old_keys(self):
        self.prime()
        self.settings['preshared_key'] = 'replacement-synthetic-key'
        self.vpn.process()
        self.commands.execute.assert_any_call('systemctl restart xl2tpd')
        self.assertEqual(': PSK "replacement-synthetic-key"\n', self.paths['ipsec.any.secrets'].read_text())
        self.assertEqual(0o600, stat.S_IMODE(self.paths['ipsec.any.secrets'].stat().st_mode))
        self.commands.reset_mock()
        self.vpn.process()
        self.assert_no_restart()

    def test_real_range_server_and_dns_changes_are_detected_then_stable(self):
        self.prime()
        for field, value in [('ip_range', '10.30.0.20-10.30.0.28'),
                             ('vpn_server_ip', '192.0.2.11'), ('local_ip', '10.20.0.2')]:
            with self.subTest(field=field):
                changed = copy.deepcopy(self.settings)
                changed[field] = value
                self.assertTrue(self.vpn.configure_l2tpIpsec(self.address, changed))
                self.assertFalse(self.vpn.configure_l2tpIpsec(self.address, changed))
                self.assertTrue(self.vpn.configure_l2tpIpsec(self.address, self.settings))

    def test_real_left_address_change_is_detected_then_stable(self):
        self.prime()
        self.assertTrue(self.vpn.configure_l2tpIpsec('192.0.2.12', self.settings))
        self.assertFalse(self.vpn.configure_l2tpIpsec('192.0.2.12', self.settings))

    def test_service_withdrawal_still_stops_l2tp(self):
        self.prime()
        self.settings['create'] = False
        self.vpn.process()
        self.commands.execute.assert_any_call('ipsec down L2TP-PSK')
        self.commands.execute.assert_any_call('systemctl stop xl2tpd')

    def test_failed_write_does_not_claim_success_and_retry_applies_change(self):
        self.prime()
        self.settings['preshared_key'] = 'retry-synthetic-key'
        real_file = self.file

        def failing_file(name):
            file = real_file(name)
            if Path(name).name == 'ipsec.any.secrets':
                file.commit = Mock(side_effect=OSError('synthetic write failure'))
            return file

        with patch.object(configure, 'CsFile', side_effect=failing_file):
            with self.assertRaisesRegex(OSError, 'synthetic write failure'):
                self.vpn.process()
        self.commands.execute.assert_not_called()
        self.vpn.process()
        self.commands.execute.assert_any_call('systemctl restart xl2tpd')
        self.commands.reset_mock()
        self.vpn.process()
        self.assert_no_restart()


if __name__ == '__main__':
    unittest.main()
