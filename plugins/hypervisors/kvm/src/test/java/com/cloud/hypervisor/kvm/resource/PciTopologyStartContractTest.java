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

import com.cloud.hypervisor.kvm.resource.wrapper.LibvirtStartCommandWrapper;
import com.cloud.hypervisor.kvm.resource.wrapper.LibvirtUtilitiesHelper;

import com.cloud.agent.api.Answer;
import com.cloud.agent.api.StartAnswer;
import com.cloud.agent.api.StartCommand;
import com.cloud.agent.api.to.DiskTO;
import com.cloud.agent.api.to.NicTO;
import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.hypervisor.kvm.storage.KVMStoragePoolManager;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.PciTopologyProfile;
import com.google.gson.Gson;
import java.util.Map;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.libvirt.Connect;
import org.libvirt.Domain;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

public class PciTopologyStartContractTest {
    private LibvirtComputingResource resource;
    private LibvirtKvmAgentHook transformer;
    private KVMStoragePoolManager pools;
    private StartCommand command;
    private VirtualMachineTO spec;
    private Domain observed;
    private MockedStatic<?> startGuard;

    @Before public void setup() throws Exception {
        resource = mock(LibvirtComputingResource.class);
        transformer = mock(LibvirtKvmAgentHook.class);
        pools = mock(KVMStoragePoolManager.class);
        spec = new VirtualMachineTO(1436,"i-2-1436-VM",VirtualMachine.Type.User,4,1000,8192,8192,
                null,"Windows Server 2025",false,false,null);
        spec.setUuid("uuid-1436");spec.setDisks(new DiskTO[0]);spec.setNics(new NicTO[0]);
        spec.setDetails(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("UEFI","LEGACY")));
        command = mock(StartCommand.class);
        when(command.getVirtualMachine()).thenReturn(spec);
        when(command.getHostIp()).thenReturn("127.0.0.1");
        LibvirtVMDef vm = new LibvirtVMDef();vm.setHvsType("kvm");vm.setDomainName(spec.getName());
        var guest = new LibvirtVMDef.GuestDef();guest.setGuestType(LibvirtVMDef.GuestDef.GuestType.KVM);guest.setMachineType("q35");
        var devices = new LibvirtVMDef.DevicesDef();devices.setGuestType(LibvirtVMDef.GuestDef.GuestType.KVM);
        vm.addComp(guest);vm.addComp(devices);
        when(resource.createVMFromSpec(spec)).thenReturn(vm);
        when(resource.getStoragePoolMgr()).thenReturn(pools);
        when(pools.connectPhysicalDisksViaVmSpec(spec,false)).thenReturn(true);
        var helper = mock(LibvirtUtilitiesHelper.class);
        var connection = mock(Connect.class);
        when(resource.getLibvirtUtilitiesHelper()).thenReturn(helper);
        when(helper.getConnectionByType("kvm")).thenReturn(connection);
        observed = mock(Domain.class);
        when(resource.getDomain(connection,spec.getName())).thenReturn(observed);
        when(observed.getXMLDesc(0)).thenReturn(observedXml(16));
        when(resource.getTransformer()).thenReturn(transformer);
        when(transformer.handle(any())).thenAnswer(call -> ((Object[])call.getRawArguments()[0])[0]);
        when(resource.getStartHook()).thenReturn(mock(LibvirtKvmAgentHook.class));
        // The package-private backup guard has its own tests; avoid accessing host state here.
        startGuard = mockStatic(Class.forName("com.cloud.hypervisor.kvm.resource.wrapper.LibvirtAblestackStoppedBackupGuard"));
    }

    @After public void teardown() {
        if (startGuard != null) startGuard.close();
    }

    private String observedXml(int ports) {
        StringBuilder xml = new StringBuilder("<domain type='kvm'><os><type machine='pc-q35-rhel9.8.0'>hvm</type></os><devices>");
        for(int i=0;i<ports;i++) xml.append("<controller type='pci' model='pcie-root-port' index='")
            .append(i+1).append("'><target hotplug='on'/></controller>");
        return xml.append("</devices></domain>").toString();
    }

    @Test public void finalXmlThenLiveObservationAreTheSourceOfTheSerializedStartReceipt() throws Exception {
        Answer answer = new LibvirtStartCommandWrapper().execute(command,resource);
        assertTrue(answer.getDetails(),answer.getResult());
        var xml = ArgumentCaptor.forClass(String.class);
        verify(resource).startVM(any(),eq(spec.getName()),xml.capture());
        assertEquals(16,PciTopologyInspector.rootPorts(PciTopologyInspector.parse(xml.getValue())));
        StartAnswer wire = new Gson().fromJson(new Gson().toJson(answer),StartAnswer.class);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16.id()+":16",wire.getVirtualMachine().getDetails().get(PciTopologyProfile.OBSERVED_KEY));
        assertEquals("pc-q35-rhel9.8.0",wire.getVirtualMachine().getDetails().get(PciTopologyProfile.OBSERVED_MACHINE_KEY));
        verify(observed).free();
        verify(pools,never()).disconnectPhysicalDisksViaVmSpec(any());
    }

    @Test public void aTransformCannotSilentlyReplaceTheTopologyBeforeStart() throws Exception {
        doReturn(observedXml(32)).when(transformer).handle(any());
        Answer answer = new LibvirtStartCommandWrapper().execute(command,resource);
        assertFalse(answer.getResult());assertTrue(answer.getDetails().contains("PCI_TOPOLOGY_HOOK_CHANGED"));
        verify(resource,never()).startVM(any(),anyString(),anyString());
        verify(pools).disconnectPhysicalDisksViaVmSpec(spec);
        assertFalse(spec.getDetails().containsKey(PciTopologyProfile.OBSERVED_KEY));
    }

    @Test public void mismatchedObservedPortsCannotProduceAnAcceptedReceipt() throws Exception {
        when(observed.getXMLDesc(0)).thenReturn(observedXml(32));
        Answer answer = new LibvirtStartCommandWrapper().execute(command,resource);
        assertFalse(answer.getResult());assertTrue(answer.getDetails().contains("PCI_TOPOLOGY_OBSERVATION_CHANGED"));
        verify(resource).handleVmStartFailure(any(),eq(spec.getName()),any());
        verify(observed).free();
        assertFalse(spec.getDetails().containsKey(PciTopologyProfile.OBSERVED_KEY));
    }
}
