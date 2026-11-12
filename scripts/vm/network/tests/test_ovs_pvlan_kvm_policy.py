# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pvlan_policy', Path(__file__).resolve().parents[1] / 'ovs-pvlan-kvm-policy.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


class PvlanPolicyTest(unittest.TestCase):
    def setUp(self):
        self.records = {}
        self.ports = {}
        self.identities = {}
        # Two isolated endpoints, two in one community, another community,
        # promiscuous, and a completely different primary PVLAN.
        for i, (p, s, role) in enumerate([(2860, 2870, 'I'), (2860, 2870, 'I'),
                                         (2860, 2880, 'C'), (2860, 2880, 'C'),
                                         (2860, 2881, 'C'), (2860, 2860, 'P'),
                                         (2890, 2890, 'P')], 1):
            mac = '02:15:99:00:00:%02x' % i
            self.records[mac] = dict(primary=p, secondary=s, role=role)
            self.ports[mac] = i
            self.identities[mac] = 'interface-%d' % i

    def test_forwarding_matrix_has_no_forbidden_unicast_output(self):
        lines = policy.compile_flows(self.records, self.ports).splitlines()
        # Independent expected matrix: I1 I2 C1 C1 C2 P OtherPrimary.
        expected = [{6}, {6}, {4, 6}, {3, 6}, {6}, {1, 2, 3, 4, 5}, set()]
        for src, targets in enumerate(expected, 1):
            for dst in range(1, 8):
                if src == dst:
                    continue
                match = 'in_port=%d,dl_src=02:15:99:00:00:%02x,vlan_tci=0x0000,dl_dst=02:15:99:00:00:%02x,' % (src, src, dst)
                flow = next(line for line in lines if match in line)
                self.assertTrue(flow.endswith('actions=output:%d' % dst) if dst in targets else flow.endswith('actions=drop'), flow)

    def test_unknown_ports_spoofed_macs_and_guest_tags_have_no_allow_rule(self):
        flows = policy.compile_flows(self.records, self.ports)
        self.assertNotIn('NORMAL', flows)
        for line in flows.splitlines():
            if 'output:' in line:
                self.assertIn('in_port=', line)
                self.assertIn('dl_src=', line)
                self.assertIn('vlan_tci=0x0000', line)
        self.assertIn('table=0,priority=0,actions=drop', flows)

    def test_broadcast_flood_is_bounded_to_allowed_ports(self):
        flows = policy.compile_flows(self.records, self.ports).splitlines()
        isolated = next(line for line in flows if 'priority=500,in_port=1,' in line)
        community = next(line for line in flows if 'priority=500,in_port=3,' in line)
        self.assertTrue(isolated.endswith('actions=output:6'))
        self.assertTrue(community.endswith('actions=output:4,output:6'))

    def test_disconnected_or_not_yet_registered_port_is_closed(self):
        flows = policy.compile_flows(self.records, {})
        self.assertNotIn('output:', flows)
        self.assertNotIn('in_port=', flows)

    def test_qinq_trunk_preserves_primary_secondary_and_rejects_reflection(self):
        flows = policy.compile_flows(self.records, self.ports, trunk=99)
        self.assertIn('set_field:6966->vlan_vid', flows)  # 4096+2870
        self.assertIn('set_field:6956->vlan_vid', flows)  # 4096+2860
        self.assertIn('in_port=99,dl_vlan=2860', flows)
        self.assertIn('reg0=2860,dl_vlan=2880', flows)
        self.assertIn('priority=700,in_port=99,reg0=2860', flows)

    def test_conflicting_secondary_type_is_rejected(self):
        self.records['02:15:99:00:00:02']['role'] = 'C'
        with self.assertRaises(ValueError):
            policy.compile_flows(self.records, self.ports)

    def test_invalid_ids_and_promiscuous_secondary_are_rejected(self):
        for record in [dict(primary=0, secondary=10, role='I'), dict(primary=10, secondary=4095, role='C'),
                       dict(primary=10, secondary=20, role='P'), dict(primary=10, secondary=10, role='I')]:
            with self.assertRaises(ValueError):
                policy.valid_record(record)

    def test_atomic_bundle_never_flushes_unmanaged_rules(self):
        with patch.object(policy, 'run', return_value='cookie=0x0,actions=NORMAL') as run:
            with self.assertRaises(ValueError):
                policy.apply('qa-pvlan1599', self.records, self.ports, None)
            self.assertEqual(1, run.call_count)

    def test_bundle_failure_does_not_commit_a_new_membership(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'qa-pvlan1599.json'; path.write_text('{}\n')
            args = types.SimpleNamespace(bridge='qa-pvlan1599', action='add', mac='02:15:99:00:00:01', primary=2860, secondary=2870, role='I')
            with patch.object(policy, 'STATE', Path(tmp)), patch.object(policy, 'bridge_config', return_value=('local', None)), patch.object(policy, 'live_ports', return_value=(self.ports, None, self.identities)), patch.object(policy, 'apply', side_effect=RuntimeError('bundle rejected')):
                with self.assertRaises(RuntimeError):
                    policy.operate(args)
            self.assertEqual({}, json.loads(path.read_text()))

    def test_reconnect_rebuild_and_delete_are_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'qa-pvlan1599.json'; path.write_text(json.dumps(self.records))
            args = types.SimpleNamespace(bridge='qa-pvlan1599', action='prepare', mac=None)
            with patch.object(policy, 'STATE', Path(tmp)), patch.object(policy, 'bridge_config', return_value=('local', None)), patch.object(policy, 'live_ports', return_value=(self.ports, None, self.identities)), patch.object(policy, 'apply') as apply:
                policy.operate(args); policy.operate(args)
                self.assertEqual(apply.call_args_list[0], apply.call_args_list[1])
                args.action = 'delete'; args.mac = '02:15:99:00:00:01'
                policy.operate(args); policy.operate(args)
            self.assertNotIn(args.mac, json.loads(path.read_text()))

    def test_recreated_mac_cannot_inherit_retained_promiscuous_membership(self):
        for mac, record in self.records.items():
            record['binding'] = self.identities[mac]
        mac = '02:15:99:00:00:06'
        self.identities[mac] = 'replacement-interface'
        flows = policy.compile_flows(self.records, self.ports, identities=self.identities)
        self.assertNotIn('dl_src=' + mac, flows)
        self.assertNotIn('output:6', flows)
        # Legacy state without any identity must also remain closed.
        del self.records['02:15:99:00:00:03']['binding']
        flows = policy.compile_flows(self.records, self.ports, identities=self.identities)
        self.assertNotIn('dl_src=02:15:99:00:00:03', flows)

    def test_same_interface_identity_can_remap_port_after_reconnect(self):
        for mac, record in self.records.items():
            record['binding'] = self.identities[mac]
        self.ports['02:15:99:00:00:06'] = 42
        flows = policy.compile_flows(self.records, self.ports, identities=self.identities)
        self.assertIn('in_port=42,dl_src=02:15:99:00:00:06', flows)
        self.assertIn('actions=output:42', flows)

    def test_only_explicit_add_binds_current_interface_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'qa-pvlan1599.json'; path.write_text(json.dumps(self.records))
            args = types.SimpleNamespace(bridge='qa-pvlan1599', action='prepare', mac='02:15:99:00:00:01', primary=2860, secondary=2870, role='I')
            with patch.object(policy, 'STATE', Path(tmp)), patch.object(policy, 'bridge_config', return_value=('local', None)), patch.object(policy, 'live_ports', return_value=(self.ports, None, self.identities)), patch.object(policy, 'apply'):
                policy.operate(args)
                self.assertNotIn('binding', json.loads(path.read_text())[args.mac])
                args.action = 'add'; policy.operate(args)
            self.assertEqual(self.identities[args.mac], json.loads(path.read_text())[args.mac]['binding'])

    def test_ovs_interface_uuid_is_decoded(self):
        self.assertEqual('interface-id', policy.ovs_value(['uuid', 'interface-id']))


if __name__ == '__main__':
    unittest.main()
