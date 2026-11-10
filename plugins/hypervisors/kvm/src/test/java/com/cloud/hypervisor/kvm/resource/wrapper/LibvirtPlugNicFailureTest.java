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

package com.cloud.hypervisor.kvm.resource.wrapper;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloud.agent.api.Answer;
import com.cloud.agent.api.PlugNicCommand;
import com.cloud.agent.api.to.NicTO;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.hypervisor.kvm.resource.LibvirtVMDef;
import com.cloud.hypervisor.kvm.resource.VifDriver;
import com.cloud.vm.VirtualMachine;

import org.junit.Before;
import org.junit.Test;
import org.libvirt.Connect;
import org.libvirt.Domain;
import org.libvirt.LibvirtException;

import java.util.Collections;

public class LibvirtPlugNicFailureTest {
    private LibvirtComputingResource resource;
    private Domain domain;
    private VifDriver driver;
    private LibvirtVMDef.InterfaceDef iface;
    private PlugNicCommand cmd;

    @Before
    public void setup() throws Exception {
        resource = mock(LibvirtComputingResource.class);
        domain = mock(Domain.class);
        driver = mock(VifDriver.class);
        iface = mock(LibvirtVMDef.InterfaceDef.class);
        NicTO nic = mock(NicTO.class);
        when(nic.getMac()).thenReturn("02:00:00:00:00:01");
        cmd = new PlugNicCommand(nic, "i-2-100-VM", VirtualMachine.Type.User);
        LibvirtUtilitiesHelper helper = mock(LibvirtUtilitiesHelper.class);
        Connect conn = mock(Connect.class);
        when(resource.getLibvirtUtilitiesHelper()).thenReturn(helper);
        when(helper.getConnectionByVmName(cmd.getVmName())).thenReturn(conn);
        when(resource.getDomain(conn, cmd.getVmName())).thenReturn(domain);
        when(resource.getInterfaces(conn, cmd.getVmName())).thenReturn(Collections.emptyList());
        when(domain.getXMLDesc(0)).thenReturn("<domain><os><type machine='pc-i440fx-rhel7.6.0'>hvm</type></os><devices/></domain>");
        when(resource.getVifDriver(nic.getType(), nic.getName())).thenReturn(driver);
        when(driver.plug(nic, "Other PV", "", null)).thenReturn(iface);
        when(iface.toString()).thenReturn("<interface/>");
    }

    @Test
    public void pciExhaustionReturnsSpecificRecoveryAndReleasesOnlyFailedVif() throws Exception {
        LibvirtException error = mock(LibvirtException.class);
        when(error.getMessage()).thenReturn("internal error: No more available PCI slots");
        doThrow(error).when(domain).attachDevice(anyString());
        Answer a = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertFalse(a.getResult());
        assertTrue(a.getDetails().contains("No more available PCI slots"));
        assertTrue(a.getDetails().contains("Stop and start the VM in Mold"));
        verify(driver).unplug(iface, false);
        verify(domain).free();
    }

    @Test
    public void otherLibvirtErrorIsNotMisclassifiedAsSlotExhaustion() throws Exception {
        LibvirtException error = mock(LibvirtException.class);
        when(error.getMessage()).thenReturn("permission denied");
        doThrow(error).when(domain).attachDevice(anyString());
        Answer a = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertFalse(a.getResult());
        assertFalse(a.getDetails().contains("Stop and start"));
        verify(driver).unplug(iface, false);
    }

    @Test
    public void successfulAttachRetainsVif() {
        Answer a = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertTrue(a.getResult());
        verify(driver, never()).unplug(any(), anyBoolean());
    }

    @Test
    public void vifCleanupErrorCannotMaskOriginalSlotError() throws Exception {
        LibvirtException error = mock(LibvirtException.class);
        when(error.getMessage()).thenReturn("No more available PCI slots");
        doThrow(error).when(domain).attachDevice(anyString());
        doThrow(new RuntimeException("cleanup unavailable")).when(driver).unplug(iface, false);
        Answer a = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertFalse(a.getResult());
        assertTrue(a.getDetails().contains("No more available PCI slots"));
        verify(domain).free();
    }

    @Test
    public void observedCapacityBlocksBeforePreparingAnyVif() throws Exception {
        when(domain.getXMLDesc(0)).thenReturn("<domain><os><type machine='q35'>hvm</type></os><devices>"
                + "<controller type='pci' model='pcie-root-port' index='1'/>"
                + "<interface><address type='pci' bus='1' slot='0' function='0'/></interface></devices></domain>");
        Answer answer = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertFalse(answer.getResult());
        assertTrue(answer.getDetails().contains("PCI_TOPOLOGY_HOTPLUG_CAPACITY"));
        verify(driver, never()).plug(any(), anyString(), anyString(), any());
        verify(domain, never()).attachDevice(anyString());
        verify(domain).free();
    }

    @Test
    public void duplicateMacRemainsIdempotentEvenWhenCapacityIsUnavailable() throws Exception {
        LibvirtVMDef.InterfaceDef existing = mock(LibvirtVMDef.InterfaceDef.class);
        String targetMac = cmd.getNic().getMac();
        when(existing.getMacAddress()).thenReturn(targetMac);
        when(resource.getInterfaces(any(Connect.class), eq(cmd.getVmName()))).thenReturn(Collections.singletonList(existing));
        when(domain.getXMLDesc(0)).thenReturn("not read for an already present NIC");
        Answer answer = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertTrue(answer.getResult());
        verify(domain, never()).getXMLDesc(0);
        verify(domain, never()).attachDevice(anyString());
    }

    @Test
    public void aLiveFreePortAllowsTheExistingAttachPath() throws Exception {
        when(domain.getXMLDesc(0)).thenReturn("<domain><os><type machine='q35'>hvm</type></os><devices>"
                + "<controller type='pci' model='pcie-root-port' index='1'/></devices></domain>");
        Answer answer = new LibvirtPlugNicCommandWrapper().execute(cmd, resource);
        assertTrue(answer.getResult());
        verify(domain).attachDevice("<interface/>");
        verify(driver, never()).unplug(any(), anyBoolean());
    }

    @Test
    public void routerCommandsKeepTheirExistingInspectionAndAttachBehavior() throws Exception {
        PlugNicCommand router = new PlugNicCommand(cmd.getNic(), cmd.getVmName(), VirtualMachine.Type.DomainRouter);
        Answer answer = new LibvirtPlugNicCommandWrapper().execute(router, resource);
        assertTrue(answer.getResult());
        verify(domain, never()).getXMLDesc(0);
        verify(domain).attachDevice("<interface/>");
    }
}
