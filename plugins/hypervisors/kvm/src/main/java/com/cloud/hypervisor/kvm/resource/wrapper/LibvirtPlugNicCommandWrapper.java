//
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
//

package com.cloud.hypervisor.kvm.resource.wrapper;

import com.cloud.agent.api.Answer;
import com.cloud.agent.api.PlugNicAnswer;
import com.cloud.agent.api.PlugNicCommand;
import com.cloud.agent.api.to.NicTO;
import com.cloud.exception.InternalErrorException;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.hypervisor.kvm.resource.PciTopologyInspector;
import com.cloud.hypervisor.kvm.resource.LibvirtVMDef.InterfaceDef;
import com.cloud.hypervisor.kvm.resource.VifDriver;
import com.cloud.resource.CommandWrapper;
import com.cloud.resource.ResourceWrapper;
import com.cloud.vm.VirtualMachine;
import org.libvirt.Connect;
import org.libvirt.Domain;
import org.libvirt.LibvirtException;

import java.util.List;

@ResourceWrapper(handles =  PlugNicCommand.class)
public final class LibvirtPlugNicCommandWrapper extends CommandWrapper<PlugNicCommand, Answer, LibvirtComputingResource> {


    @Override
    public Answer execute(final PlugNicCommand command, final LibvirtComputingResource libvirtComputingResource) {
        final NicTO nic = command.getNic();
        final String vmName = command.getVmName();
        final VirtualMachine.Type vmType = command.getVMType();
        Domain vm = null;
        VifDriver vifDriver = null;
        InterfaceDef interfaceDef = null;
        boolean attached = false;
        try {
            final LibvirtUtilitiesHelper libvirtUtilitiesHelper = libvirtComputingResource.getLibvirtUtilitiesHelper();
            final Connect conn = libvirtUtilitiesHelper.getConnectionByVmName(vmName);
            vm = libvirtComputingResource.getDomain(conn, vmName);

            final List<InterfaceDef> pluggedNics = libvirtComputingResource.getInterfaces(conn, vmName);
            Integer nicnum = 0;
            for (final InterfaceDef pluggedNic : pluggedNics) {
                if (pluggedNic.getMacAddress().equalsIgnoreCase(nic.getMac())) {
                    logger.debug("found existing nic for mac " + pluggedNic.getMacAddress() + " at index " + nicnum);
                    return new PlugNicAnswer(command, true, "success");
                }
                nicnum++;
            }
            try {
                var topology = vmType == VirtualMachine.Type.User ? PciTopologyInspector.parse(vm.getXMLDesc(0)) : null;
                if (topology != null && PciTopologyInspector.q35(topology) && PciTopologyInspector.freeHotplugPorts(topology) == 0) {
                    throw new InternalErrorException("PCI_TOPOLOGY_HOTPLUG_CAPACITY: no free hotplug root-port in the running VM. "
                            + "Use a supported cold-start topology with additional capacity; a restart alone may not add ports.");
                }
            } catch (IllegalArgumentException error) {
                throw new InternalErrorException("PCI_TOPOLOGY_INSPECTION_FAILED: " + error.getMessage());
            }
            vifDriver = libvirtComputingResource.getVifDriver(nic.getType(), nic.getName());
            interfaceDef = vifDriver.plug(nic, "Other PV", "", null);
            if (command.getDetails() != null) {
                libvirtComputingResource.setInterfaceDefQueueSettings(command.getDetails(), null, interfaceDef);
            }
            vm.attachDevice(interfaceDef.toString());
            attached = true;

            // apply default network rules on new nic
            if (vmType == VirtualMachine.Type.User && nic.isSecurityGroupEnabled()) {
                final Long vmId = Long.valueOf(vmName.split("-")[2]);
                libvirtComputingResource.applyDefaultNetworkRulesOnNic(conn, vmName, vmId, nic, false, false);
            }

            if (vmType == VirtualMachine.Type.User) {
                libvirtComputingResource.detachAndAttachConfigDriveISO(conn, vmName);
            }

            return new PlugNicAnswer(command, true, "success");
        } catch (final LibvirtException e) {
            final String msg = nicPlugFailureMessage(e);
            logger.warn(msg, e);
            return new PlugNicAnswer(command, false, msg);
        } catch (final InternalErrorException e) {
            final String msg = nicPlugFailureMessage(e);
            logger.warn(msg, e);
            return new PlugNicAnswer(command, false, msg);
        } finally {
            if (!attached && vifDriver != null && interfaceDef != null) {
                try {
                    // Undo only this failed VIF's bookkeeping; shared bridges and existing NICs stay in place.
                    vifDriver.unplug(interfaceDef, false);
                } catch (RuntimeException cleanupError) {
                    logger.warn("Unable to clean up the unattached NIC VIF", cleanupError);
                }
            }
            if (vm != null) {
                try {
                    vm.free();
                } catch (final LibvirtException l) {
                    logger.trace("Ignoring libvirt error.", l);
                }
            }
        }
    }
    static String nicPlugFailureMessage(Exception error) {
        String detail = String.valueOf(error.getMessage()).toLowerCase(java.util.Locale.ROOT);
        if (detail.contains("no more available pci slots") || detail.contains("no more available pcie slots")) {
            return "NIC hotplug failed: No more available PCI slots in the running VM. "
                    + "Stop and start the VM in Mold to prepare PCIe hotplug ports, then retry adding the NIC. "
                    + "Alternatively, add the NIC while the VM is stopped and then start it.";
        }
        return "Plug NIC failed: " + error;
    }
}
