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
package com.cloud.hypervisor.kvm.resource;

import com.cloud.vm.PciTopologyProfile;

/** Immutable rendering contract, not the occupancy of a running guest. */
public final class PciTopologyPlan {
    private final PciTopologyProfile profile;
    private final int bootPortDemand;
    private final int nicHeadroom;

    public PciTopologyPlan(PciTopologyProfile profile, int bootPortDemand, int nicHeadroom) {
        if (profile == null || bootPortDemand < 0 || nicHeadroom < 0) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_PLAN_INVALID");
        }
        if (profile != PciTopologyProfile.LEGACY_AUTO && bootPortDemand + nicHeadroom > profile.rootPorts()) {
            throw new IllegalArgumentException("PCI_TOPOLOGY_CAPACITY: required " + (bootPortDemand + nicHeadroom)
                    + " ports exceeds profile " + profile.id() + " capacity " + profile.rootPorts());
        }
        this.profile = profile;
        this.bootPortDemand = bootPortDemand;
        this.nicHeadroom = nicHeadroom;
    }

    public PciTopologyProfile profile() { return profile; }
    public int rootPorts() { return profile.rootPorts(); }
    public int bootPortDemand() { return bootPortDemand; }
    public int nicHeadroom() { return nicHeadroom; }
}
