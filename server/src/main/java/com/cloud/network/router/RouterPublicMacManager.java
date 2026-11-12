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

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import javax.inject.Inject;

import org.apache.cloudstack.network.router.deployment.RouterDeploymentDefinition;
import org.apache.cloudstack.resourcedetail.UserIpAddressDetailVO;
import org.apache.cloudstack.resourcedetail.dao.UserIpAddressDetailsDao;

import com.cloud.network.IpAddress;
import com.cloud.network.Network;
import com.cloud.network.Networks.TrafficType;
import com.cloud.network.dao.IPAddressDao;
import com.cloud.network.dao.IPAddressVO;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.vpc.Vpc;
import com.cloud.network.vpc.dao.VpcDao;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.DomainRouterVO;
import com.cloud.vm.NicVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.dao.DomainRouterDao;
import com.cloud.vm.dao.NicDao;
import com.google.gson.Gson;
import com.google.gson.JsonParseException;

/** Retains an observed router MAC only for the same Public IP allocation and owner scope. */
public class RouterPublicMacManager {
    public static final String DETAIL = "router.public.nic.mac.v1";
    private static final Gson GSON = new Gson();

    @Inject
    IPAddressDao ipAddresses;
    @Inject
    UserIpAddressDetailsDao details;
    @Inject
    DomainRouterDao routers;
    @Inject
    NetworkDao networks;
    @Inject
    VpcDao vpcs;
    @Inject
    NicDao nics;

    public void preserve(DomainRouterVO router) {
        if (router.getRole() != VirtualRouter.Role.VIRTUAL_ROUTER || !validMac(router.getPublicMacAddress())
                || (router.getState() != VirtualMachine.State.Running && router.getState() != VirtualMachine.State.Stopped
                    && router.getState() != VirtualMachine.State.Stopping)) {
            return;
        }
        List<IPAddressVO> candidates = new ArrayList<>();
        if (router.getVpcId() != null) {
            Vpc vpc = vpcs.findById(router.getVpcId());
            if (vpc == null || vpc.getAccountId() != router.getAccountId()) {
                return;
            }
            candidates.addAll(ipAddresses.listByAssociatedVpc(vpc.getId(), true));
        } else {
            for (Long id : routers.getRouterNetworks(router.getId())) {
                Network network = networks.findById(id);
                if (network != null && network.getGuestType() == Network.GuestType.Isolated && network.getVpcId() == null
                        && network.getAccountId() == router.getAccountId()) {
                    candidates.addAll(ipAddresses.listByAssociatedNetwork(id, true));
                }
            }
        }
        for (NicVO nic : nics.listByVmId(router.getId())) {
            if (nic.getRemoved() != null || nic.getInstanceId() != router.getId() || nic.getVmType() != VirtualMachine.Type.DomainRouter
                    || !Objects.equals(nic.getIPv4Address(), router.getPublicIpAddress())
                    || !router.getPublicMacAddress().equalsIgnoreCase(nic.getMacAddress())) {
                continue;
            }
            Network publicNetwork = networks.findById(nic.getNetworkId());
            for (IPAddressVO candidate : candidates) {
                if (allocated(candidate) && Objects.equals(candidate.getAddress().addr(), nic.getIPv4Address())
                        && publicNetwork != null && publicNetwork.getTrafficType() == TrafficType.Public
                        && Objects.equals(candidate.getSourceNetworkId(), nic.getNetworkId())) {
                    preserve(candidate, nic.getMacAddress());
                    return;
                }
            }
        }
    }

    private void preserve(IPAddressVO observed, String mac) {
        Transaction.execute((TransactionCallback<Void>) status -> {
            IPAddressVO current = ipAddresses.lockRow(observed.getId(), true);
            if (!allocated(current) || !sameAllocation(observed, current)) {
                throw new CloudRuntimeException("Public IP allocation changed before router MAC preservation");
            }
            // Legacy allocations have no receipt. Mint one only after verifying the live router/NIC ownership.
            if (current.getAllocationGeneration() == null || current.getAllocationGeneration().isEmpty()) {
                current.setAllocationGeneration(UUID.randomUUID().toString());
                if (!ipAddresses.update(current.getId(), current)) {
                    throw new CloudRuntimeException("Unable to initialize the Public IP allocation receipt");
                }
            }
            details.addDetail(current.getId(), DETAIL, GSON.toJson(new Receipt(current, mac.toLowerCase(java.util.Locale.ROOT))), false);
            return null;
        });
    }

    public String findRetainedMac(Network publicNetwork, RouterDeploymentDefinition deployment) {
        if (deployment.getSourceNatIP() == null || deployment.getSourceNatIP().ip() == null) {
            return null;
        }
        IPAddressVO observed = deployment.getSourceNatIP().ip();
        return Transaction.execute((TransactionCallback<String>) status -> {
            IPAddressVO current = ipAddresses.lockRow(observed.getId(), true);
            if (!allocated(current) || !sameAllocation(observed, current) || !matchesScope(current, publicNetwork, deployment)
                    || current.getAllocationGeneration() == null || current.getAllocationGeneration().isEmpty()) {
                return null;
            }
            UserIpAddressDetailVO detail = details.findDetail(current.getId(), DETAIL);
            if (detail == null) {
                return null;
            }
            Receipt receipt;
            try {
                receipt = GSON.fromJson(detail.getValue(), Receipt.class);
            } catch (JsonParseException ex) {
                throw new CloudRuntimeException("Invalid retained Public NIC MAC receipt", ex);
            }
            if (receipt == null || !receipt.matches(current)) {
                return null; // A released/reassigned IP must never inherit an earlier allocation's MAC.
            }
            if (!validMac(receipt.mac)) {
                throw new CloudRuntimeException("Invalid MAC in the retained Public NIC receipt");
            }
            return receipt.mac;
        });
    }

    private boolean matchesScope(IPAddressVO ip, Network publicNetwork, RouterDeploymentDefinition deployment) {
        if (publicNetwork == null || publicNetwork.getTrafficType() != TrafficType.Public
                || !Objects.equals(ip.getSourceNetworkId(), publicNetwork.getId()) || ip.getDataCenterId() != publicNetwork.getDataCenterId()
                || deployment.getOwner() == null || ip.getAccountId() != deployment.getOwner().getId()) {
            return false;
        }
        Vpc vpc = deployment.getVpc();
        if (vpc != null) {
            return Objects.equals(ip.getVpcId(), vpc.getId()) && ip.getAccountId() == vpc.getAccountId() && ip.getDataCenterId() == vpc.getZoneId();
        }
        Network network = deployment.getGuestNetwork();
        return network != null && network.getGuestType() == Network.GuestType.Isolated && network.getVpcId() == null && ip.getVpcId() == null
                && Objects.equals(ip.getAssociatedWithNetworkId(), network.getId()) && ip.getAccountId() == network.getAccountId()
                && ip.getDataCenterId() == network.getDataCenterId();
    }

    private static boolean allocated(IPAddressVO ip) {
        return ip != null && ip.getRemoved() == null && ip.isSourceNat() && ip.getAllocatedTime() != null
                && ip.getAllocatedToAccountId() != null && ip.getAllocatedInDomainId() != null
                && (ip.getState() == IpAddress.State.Allocated || ip.getState() == IpAddress.State.Allocating);
    }

    private static boolean sameAllocation(IPAddressVO a, IPAddressVO b) {
        return new Receipt(a, null).matches(b);
    }

    private static boolean validMac(String mac) {
        return mac != null && mac.matches("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}") && !"00:00:00:00:00:00".equals(mac)
                && (Integer.parseInt(mac.substring(0, 2), 16) & 1) == 0;
    }

    private static final class Receipt {
        private int version;
        private final String ipUuid;
        private final String allocationGeneration;
        private final Long account;
        private final Long domain;
        private final Long network;
        private final Long vpc;
        private final Long publicNetwork;
        private final long vlan;
        private final long zone;
        private final String address;
        private final String mac;

        private Receipt(IPAddressVO ip, String mac) {
            version = 1;
            ipUuid = ip.getUuid();
            allocationGeneration = ip.getAllocationGeneration();
            account = ip.getAllocatedToAccountId();
            domain = ip.getAllocatedInDomainId();
            network = ip.getAssociatedWithNetworkId();
            vpc = ip.getVpcId();
            publicNetwork = ip.getSourceNetworkId();
            vlan = ip.getVlanId();
            zone = ip.getDataCenterId();
            address = ip.getAddress().addr();
            this.mac = mac;
        }

        private boolean matches(IPAddressVO ip) {
            return version == 1 && Objects.equals(ipUuid, ip.getUuid()) && Objects.equals(allocationGeneration, ip.getAllocationGeneration())
                    && Objects.equals(account, ip.getAllocatedToAccountId()) && Objects.equals(domain, ip.getAllocatedInDomainId())
                    && Objects.equals(network, ip.getAssociatedWithNetworkId()) && Objects.equals(vpc, ip.getVpcId())
                    && Objects.equals(publicNetwork, ip.getSourceNetworkId()) && vlan == ip.getVlanId() && zone == ip.getDataCenterId()
                    && Objects.equals(address, ip.getAddress().addr());
        }
    }
}
