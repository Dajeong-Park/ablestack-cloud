#!/usr/bin/python3
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

"""Port-bound PVLAN policy for explicitly dedicated, fail-secure OVS bridges.

Native Linux bridges are deliberately unsupported. No NORMAL rule or physical
interface is changed here. Every update replaces only this policy's cookies in
one OpenFlow bundle. Unregistered ports and failed registrations stay closed.
The opt-in local mode has no uplink; qinq mode requires an explicit trunk.
"""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys

COOKIE = 0x1599000000000000
MASK = 0xFFFF000000000000
TABLE = 149
STATE = Path('/var/lib/cloudstack/agent/pvlan')
MAC = re.compile(r'^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$')
BRIDGE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,14}$')


def run(*args, data=None):
    p = subprocess.run(args, input=data, text=True, capture_output=True, timeout=25)
    if p.returncode:
        raise RuntimeError('%s: %s' % (args[0], (p.stderr or p.stdout).strip()))
    return p.stdout.strip()


def ovs_value(value):
    if isinstance(value, list) and value[0] == 'uuid':
        return value[1]
    if isinstance(value, list) and value[0] == 'map':
        return dict(value[1])
    if isinstance(value, list) and value[0] == 'set':
        return value[1]
    return value


def ovs_rows(table, columns):
    data = json.loads(run('ovs-vsctl', '--timeout=10', '--format=json',
                          '--columns=' + ','.join(columns), 'list', table))
    return [dict(zip(data['headings'], map(ovs_value, row))) for row in data['data']]


def bridge_config(bridge):
    if not BRIDGE.fullmatch(bridge):
        raise ValueError('Invalid PVLAN bridge name')
    row = next((x for x in ovs_rows('Bridge', ['name', 'other_config', 'fail_mode', 'controller'])
                if x['name'] == bridge), None)
    if not row or row['other_config'].get('cloudstack-pvlan-guard') != '1':
        raise ValueError('PVLAN requires an explicitly guarded dedicated OVS bridge')
    mode = row['other_config'].get('cloudstack-pvlan-mode')
    if row['fail_mode'] != 'secure' or row['controller']:
        raise ValueError('PVLAN bridge must be fail-secure without another controller')
    if mode not in ('local', 'qinq'):
        raise ValueError('PVLAN bridge must explicitly select local or qinq mode')
    trunk = row['other_config'].get('cloudstack-pvlan-trunk')
    if mode == 'qinq' and (not trunk or not BRIDGE.fullmatch(trunk)):
        raise ValueError('QinQ PVLAN requires an explicit trunk interface')
    if mode == 'local' and trunk:
        raise ValueError('Local PVLAN mode cannot have a trunk')
    return mode, trunk


def live_ports(bridge, mode, trunk):
    names = set(run('ovs-vsctl', '--timeout=10', 'list-ifaces', bridge).splitlines())
    ports = {}; identities = {}; trunk_port = None
    for row in ovs_rows('Interface', ['_uuid', 'name', 'ofport', 'external_ids', 'type']):
        name = row['name']
        if name not in names:
            continue
        port = row['ofport']
        if not isinstance(port, int) or not 0 < port < 65280:
            raise ValueError('PVLAN interface has no usable OpenFlow port: ' + name)
        if name == trunk:
            trunk_port = port
            continue
        mac = row['external_ids'].get('attached-mac', '').lower()
        if not MAC.fullmatch(mac):
            raise ValueError('Dedicated PVLAN bridge has an unmanaged interface: ' + name)
        if mac in ports:
            raise ValueError('Duplicate PVLAN MAC')
        ports[mac] = port
        identities[mac] = row['_uuid']
    if mode == 'qinq' and trunk_port is None:
        raise ValueError('PVLAN trunk is missing')
    return ports, trunk_port, identities


def valid_record(record):
    p, s, role = record['primary'], record['secondary'], record['role']
    if not isinstance(p, int) or not isinstance(s, int) or not 1 <= p <= 4094 or not 1 <= s <= 4094:
        raise ValueError('PVLAN IDs must be between 1 and 4094')
    if role not in ('I', 'C', 'P') or (role == 'P') != (p == s):
        raise ValueError('Invalid PVLAN role/primary/secondary combination')
    return record


def allowed(source, target):
    return source['primary'] == target['primary'] and (
        source['role'] == 'P' or target['role'] == 'P' or
        source['role'] == target['role'] == 'C' and source['secondary'] == target['secondary'])


def compile_flows(records, ports, trunk=None, identities=None):
    """Compile only trusted port+MAC ingress. Unknown/tagged guest ingress drops."""
    # Retained MAC membership alone must not authorize a newly created port.
    # Only an explicit Cloud add may bind the current OVS Interface identity.
    active = {mac: valid_record(r) for mac, r in records.items() if mac in ports
              and (identities is None or r.get('binding') == identities.get(mac)
                   and r.get('binding') is not None)}
    # Reject a community/isolated overlap, including retained state after restart.
    groups = {}
    for r in active.values():
        key = r['primary'], r['secondary']
        if key in groups and groups[key] != r['role']:
            raise ValueError('Conflicting PVLAN secondary roles')
        groups[key] = r['role']
    cookie = 'cookie=0x%x' % COOKIE
    lines = ['delete cookie=0x%x/0x%x' % (COOKIE, MASK),
             'add %s,table=0,priority=0,actions=drop' % cookie,
             'add %s,table=%d,priority=0,actions=drop' % (cookie, TABLE)]

    def add(table, priority, match, actions):
        lines.append('add %s,table=%d,priority=%d,%s,actions=%s' %
                     (cookie, table, priority, match, actions or 'drop'))

    for mac, src in sorted(active.items()):
        ingress = 'in_port=%d,dl_src=%s,vlan_tci=0x0000' % (ports[mac], mac)
        for dst, target in sorted(active.items()):
            if dst != mac:
                output = 'output:%d' % ports[dst] if allowed(src, target) else 'drop'
                add(0, 600, ingress + ',dl_dst=' + dst, output)
        flood = ['output:%d' % ports[dst] for dst, target in sorted(active.items())
                 if dst != mac and allowed(src, target)]
        if trunk is not None:
            # Outer primary / inner secondary; only a promiscuous source uses
            # primary as the inner tag. Guests cannot inject either tag.
            flood += ['push_vlan:0x8100', 'set_field:%d->vlan_vid' % (4096 + src['secondary']),
                      'push_vlan:0x8100', 'set_field:%d->vlan_vid' % (4096 + src['primary']),
                      'output:%d' % trunk]
        add(0, 500, ingress, ','.join(flood))

    if trunk is not None:
        for primary in sorted({r['primary'] for r in active.values()}):
            add(0, 500, 'in_port=%d,dl_vlan=%d' % (trunk, primary),
                'load:%d->NXM_NX_REG0[],pop_vlan,resubmit(,%d)' % (primary, TABLE))
            secondaries = {s for p, s in groups if p == primary} | {primary}
            for secondary in sorted(secondaries):
                role = groups.get((primary, secondary), 'I')
                source = {'primary': primary, 'secondary': secondary, 'role': role}
                match = 'in_port=%d,reg0=%d,dl_vlan=%d' % (trunk, primary, secondary)
                # Reflected/local source identities must never arrive on uplink.
                for mac in active:
                    add(TABLE, 700, match + ',dl_src=' + mac, 'drop')
                for dst, target in sorted(active.items()):
                    output = 'pop_vlan,output:%d' % ports[dst] if allowed(source, target) else 'drop'
                    add(TABLE, 600, match + ',dl_dst=' + dst, output)
                flood = ['output:%d' % ports[dst] for dst, target in sorted(active.items()) if allowed(source, target)]
                add(TABLE, 500, match, 'pop_vlan,' + ','.join(flood) if flood else 'drop')
            # Unknown secondary IDs are isolated: only promiscuous endpoints.
            flood = ['output:%d' % ports[dst] for dst, target in sorted(active.items())
                     if target['primary'] == primary and target['role'] == 'P']
            add(TABLE, 100, 'in_port=%d,reg0=%d,vlan_tci=0x1000/0x1000' % (trunk, primary),
                'pop_vlan,' + ','.join(flood) if flood else 'drop')
    return '\n'.join(lines) + '\n'


def apply(bridge, records, ports, trunk, identities=None):
    # Refuse to take over mixed/legacy bridges; never flush someone else's rules.
    flows = run('ovs-ofctl', '-O', 'OpenFlow14', 'dump-flows', bridge)
    for cookie in re.findall(r'cookie=(0x[0-9a-f]+)', flows):
        if int(cookie, 16) & MASK != COOKIE:
            raise ValueError('Dedicated PVLAN bridge contains unmanaged OpenFlow rules')
    data = compile_flows(records, ports, trunk, identities)
    run('ovs-ofctl', '-O', 'OpenFlow14', '--bundle', 'add-flows', bridge, '-', data=data)


def operate(args):
    mode, trunk_name = bridge_config(args.bridge)
    STATE.mkdir(parents=True, mode=0o700, exist_ok=True)
    path = STATE / (args.bridge + '.json')
    with (STATE / (args.bridge + '.lock')).open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        records = json.loads(path.read_text()) if path.exists() else {}
        for mac, record in records.items():
            if not MAC.fullmatch(mac):
                raise ValueError('Invalid retained PVLAN MAC')
            valid_record(record)
        ports, trunk, identities = live_ports(args.bridge, mode, trunk_name)
        if args.action in ('add', 'delete'):
            mac = (args.mac or '').lower()
            if not MAC.fullmatch(mac):
                raise ValueError('Invalid PVLAN MAC')
            if args.action == 'add':
                if mac not in ports:
                    raise ValueError('PVLAN MAC has no live OVS port')
                record = valid_record(dict(primary=args.primary, secondary=args.secondary,
                                           role=args.role, binding=identities[mac]))
                records[mac] = record
            else:
                records.pop(mac, None)
        apply(args.bridge, records, ports, trunk, identities)
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(records, sort_keys=True) + '\n')
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=('prepare', 'add', 'delete', 'status'))
    p.add_argument('-b', '--bridge')
    p.add_argument('-p', '--primary', type=int)
    p.add_argument('-s', '--secondary', type=int)
    p.add_argument('-t', '--role', choices=('I', 'C', 'P'))
    p.add_argument('-m', '--mac')
    args = p.parse_args()
    if args.action == 'status':
        ready = []
        for row in ovs_rows('Bridge', ['name', 'other_config']):
            if row['other_config'].get('cloudstack-pvlan-guard') == '1':
                args.bridge = row['name']
                try:
                    operate(args)
                    ready.append(args.bridge)
                except (RuntimeError, ValueError, OSError, subprocess.SubprocessError):
                    pass
        print(','.join(sorted(ready)))
    else:
        operate(args)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
        print('PVLAN policy rejected: ' + str(error), file=sys.stderr)
        sys.exit(1)
