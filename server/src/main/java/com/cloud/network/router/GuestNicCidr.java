// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.network.router;

import org.apache.commons.lang3.StringUtils;

import com.cloud.network.Network;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.net.NetUtils;
import com.cloud.vm.NicProfile;

final class GuestNicCidr {
    private GuestNicCidr() {
    }

    static String select(final Network network, final NicProfile nic, final String configured) {
        if (network.getGuestType() == Network.GuestType.Shared && StringUtils.contains(configured, ',')) {
            // Boot/replay this guest interface in its own subnet; other Shared subnets use IP aliases.
            for (String cidr : StringUtils.split(configured, ',')) {
                if (NetUtils.isIpWithInCidrRange(nic.getIPv4Address(), cidr.trim())) {
                    return cidr.trim();
                }
            }
            throw new CloudRuntimeException("Unable to find the Shared router guest NIC subnet in the network CIDRs");
        }
        return configured;
    }
}
