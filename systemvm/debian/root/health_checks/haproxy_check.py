#!/usr/bin/python
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

import ipaddress
import subprocess
import sys
from utility import getHealthChecksData, formatPort


def checkMaxconn(haproxyData, haCfgSections):
    if "maxconn" in haproxyData and "maxconn" in haCfgSections["global"]:
        if haproxyData["maxconn"] != haCfgSections["global"]["maxconn"][0].strip():
            print("global maxconn mismatch occurred")
            return False

    return True


def checkIdletimeout(haproxyData, haCfgSections):
    if "idletimeout" not in haproxyData:
        return True

    # Normalize idletimeout value to string for comparison
    idle_value = str(haproxyData["idletimeout"]).strip()

    # Safely get the defaults section and its timeout directives
    defaults_section = haCfgSections.get("defaults", {})
    timeout_lines = defaults_section.get("timeout", [])

    # Extract client and server timeout values from the parsed "timeout" entries
    timeout_values = {}
    for tline in timeout_lines:
        tline = tline.strip()
        if not tline:
            continue
        parts = tline.split(None, 1)
        if len(parts) < 2:
            continue
        kind, value = parts[0].strip(), parts[1].strip()
        if kind in ("client", "server"):
            timeout_values[kind] = value

    # Special handling for idletimeout == 0: there should be no client/server timeouts configured
    if idle_value == "0":
        if "client" in timeout_values or "server" in timeout_values:
            print("defaults timeout client or timeout server should be absent when idletimeout is 0")
            return False
        return True

    # Non-zero idletimeout: both client and server timeouts must be present
    if "client" not in timeout_values or "server" not in timeout_values:
        print("defaults timeout client or timeout server missing")
        return False

    if idle_value != timeout_values["client"] or idle_value != timeout_values["server"]:
        print("defaults timeout client or timeout server mismatch occurred")
        return False
    return True


def checkLoadBalance(haproxyData, haCfgSections):
    correct = True
    for lbSec in haproxyData:
        srcServer = lbSec["sourceIp"].replace('.', '_') + "-" + \
                    formatPort(lbSec["sourcePortStart"],
                               lbSec["sourcePortEnd"])
        secName = "listen " + srcServer

        if secName not in haCfgSections:
            print("Missing section for load balancing " + secName + "\n")
            correct = False
        else:
            cfgSection = haCfgSections[secName]
            try:
                expectedBind = _endpoint(lbSec["sourceIp"] + ":" + formatPort(lbSec["sourcePortStart"], lbSec["sourcePortEnd"]))
                actualBinds = {_endpoint(endpoint) for bind in cfgSection.get("bind", []) for endpoint in bind.split()[0].split(',')}
                if actualBinds != {expectedBind}:
                    print("Incorrect or missing bind endpoint for " + secName)
                    correct = False
            except (ValueError, IndexError):
                print("Invalid bind endpoint for " + secName)
                correct = False

            if "server" in cfgSection or lbSec["vmIps"].strip():
                balance = cfgSection.get("balance", [''])[0].split()
                if not balance or lbSec["algorithm"] != balance[0]:
                    print("Incorrect balance method for " + secName +
                          "Expected : " + lbSec["algorithm"] +
                          " but found " + str(cfgSection.get("balance", [])) + "\n")
                    correct = False

                if (lbSec["sourcePortStart"] == "80" and lbSec["sourcePortEnd"] == "80" and lbSec["keepAliveEnabled"] == "false") \
                        or (lbSec["stickiness"].find("AppCookie") != -1 or lbSec["stickiness"].find("LbCookie") != -1):
                    if not ("mode" in cfgSection and cfgSection["mode"][0] == "http"):
                        print("Expected HTTP mode but not found")
                        correct = False

                expectedServerIps = lbSec["vmIps"].split()
                for expectedServerIp in expectedServerIps:
                    pattern = expectedServerIp + ":" + \
                              formatPort(lbSec["destPortStart"],
                                         lbSec["destPortEnd"])
                    foundPattern = False
                    for server in cfgSection.get("server", []):
                        s = server.split()
                        try:
                            if len(s) >= 2 and s[0].startswith(srcServer + "_") and _endpoint(s[1]) == _endpoint(pattern):
                                foundPattern = True
                                break
                        except ValueError:
                            continue

                    if not foundPattern:
                        correct = False
                        print("Missing load balancing for " + pattern + ". ")

    return correct


def _endpoint(value):
    address, separator, ports = value.rpartition(':')
    if not separator:
        raise ValueError("Missing endpoint port")
    family = None
    if '@' in address:
        family, address = address.split('@', 1)
        if family not in ('ip', 'ipv4', 'ipv6'):
            raise ValueError("Unsupported address family")
    if address.startswith('[') != address.endswith(']'):
        raise ValueError("Invalid address brackets")
    ip = ipaddress.ip_address(address.removeprefix('[').removesuffix(']'))
    if family in ('ipv4', 'ipv6') and ip.version != int(family[-1]):
        raise ValueError("Address family mismatch")
    portRange = ports.split('-')
    if len(portRange) not in (1, 2) or not all(port.isdecimal() for port in portRange):
        raise ValueError("Invalid port range")
    start, end = int(portRange[0]), int(portRange[-1])
    if not 1 <= start <= end <= 65535:
        raise ValueError("Invalid port range")
    return ip, start, end


def checkSyntax(configPath):
    # Check-only mode never binds sockets, reloads HAProxy or changes its config.
    # Parsing just the endpoint must not hide invalid SSL options/certificates.
    try:
        result = subprocess.run(['/usr/sbin/haproxy', '-c', '-f', configPath], stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, universal_newlines=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired) as error:
        print("Unable to validate HAProxy configuration: " + str(error))
        return False
    if result.returncode:
        print("HAProxy configuration validation failed: " + result.stdout.strip()[:8192])
        return False
    return True


def parseConfig(lines):
    sections = {}
    current = None
    headers = {'global', 'defaults', 'listen', 'frontend', 'backend', 'resolvers', 'peers', 'userlist', 'mailers', 'cache', 'program', 'ring', 'log-forward'}
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split(None, 1)
        if parts[0] in headers:
            current = parts[0]
            if len(parts) > 1 and not parts[1].startswith('#'):
                current += ' ' + parts[1].split()[0]
            sections[current] = {}
        elif current is not None:
            sections[current].setdefault(parts[0], []).append(parts[1] if len(parts) > 1 else '')
    return sections


def validateConfiguration(haproxyData, configPath='/etc/haproxy/haproxy.cfg'):
    if not checkSyntax(configPath):
        return False
    try:
        with open(configPath, 'r') as config:
            sections = parseConfig(config)
        return all([checkMaxconn(haproxyData[0], sections), checkIdletimeout(haproxyData[0], sections), checkLoadBalance(haproxyData, sections)])
    except (OSError, ValueError, KeyError, IndexError) as error:
        print("Unable to check HAProxy configuration: " + str(error))
        return False


def main():
    haproxyData = getHealthChecksData("haproxyData")
    if not haproxyData:
        print("No data provided to check, skipping")
        sys.exit(0)
    if validateConfiguration(haproxyData):
        print("All checks pass")
        sys.exit(0)
    sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "advanced":
        main()
