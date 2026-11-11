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

package com.cloud.vm;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cloud.agent.api.to.NicTO;
import com.cloud.agent.AgentManager;
import com.cloud.agent.manager.Commands;
import com.cloud.deploy.DeployDestination;
import com.cloud.exception.OperationTimedoutException;
import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.exception.ResourceUnavailableException;
import com.cloud.host.Host;
import com.cloud.host.HostVO;
import com.cloud.host.dao.HostDao;
import com.cloud.hypervisor.HypervisorGuru;
import com.cloud.hypervisor.HypervisorGuruManager;
import com.cloud.network.Network;
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.dao.NetworkDetailsDao;
import com.cloud.utils.db.EntityManager;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.dao.NicDao;
import com.cloud.vm.dao.NicDetailsDao;
import com.cloud.vm.dao.VMInstanceDao;

import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.orchestration.service.NetworkOrchestrationService;
import org.apache.cloudstack.framework.jobs.Outcome;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.concurrent.ExecutionException;

public class NicHotplugFailureTest {
    private VirtualMachineManagerImpl manager;
    private VMInstanceVO vm;
    private NetworkVO network;
    private NetworkOrchestrationService networks;
    private NicDao nics;
    private NicDetailsDao nicDetails;
    private NicProfile added;
    private HostVO host;

    @Before
    public void setup() {
        manager = spy(new VirtualMachineManagerImpl());
        vm = mock(VMInstanceVO.class);
        network = mock(NetworkVO.class);
        host = mock(HostVO.class);
        when(vm.getId()).thenReturn(10L);
        when(vm.getHostId()).thenReturn(1L);
        when(vm.getState()).thenReturn(VirtualMachine.State.Running);
        when(vm.getType()).thenReturn(VirtualMachine.Type.User);
        when(network.getId()).thenReturn(20L);
        when(host.getId()).thenReturn(1L);
        VMInstanceDao vms = mock(VMInstanceDao.class);
        when(vms.findById(10L)).thenReturn(vm);
        ReflectionTestUtils.setField(manager, "_vmDao", vms);
        nics = mock(NicDao.class);
        nicDetails = mock(NicDetailsDao.class);
        ReflectionTestUtils.setField(manager, "_nicDetailsDao", nicDetails);
        ReflectionTestUtils.setField(manager, "_nicsDao", nics);
        when(nics.listByVmId(10L)).thenReturn(Collections.emptyList());
        when(nics.findById(100L)).thenReturn(mock(NicVO.class));
        EntityManager entities = mock(EntityManager.class);
        ReflectionTestUtils.setField(manager, "_entityMgr", entities);
        HostDao hosts = mock(HostDao.class);
        when(hosts.findById(1L)).thenReturn(host);
        ReflectionTestUtils.setField(manager, "_hostDao", hosts);
        networks = mock(NetworkOrchestrationService.class);
        ReflectionTestUtils.setField(manager, "_networkMgr", networks);
        added = new NicProfile();
        added.setId(100L);
        HypervisorGuruManager gurus = mock(HypervisorGuruManager.class);
        HypervisorGuru guru = mock(HypervisorGuru.class);
        when(gurus.getGuru(any())).thenReturn(guru);
        when(guru.implement(any())).thenReturn(mock(VirtualMachineTO.class));
        ReflectionTestUtils.setField(manager, "_hvGuruMgr", gurus);
        doReturn(mock(NicTO.class)).when(manager).toNicTO(any(), any());
        com.cloud.user.User user = mock(com.cloud.user.User.class);
        com.cloud.user.Account account = mock(com.cloud.user.Account.class);
        CallContext.register(user, account);
    }

    @After
    public void finish() {
        CallContext.unregister();
        Thread.interrupted();
    }

    private NicProfile orchestrate() throws Throwable {
        Method m =
                VirtualMachineManagerImpl.class.getDeclaredMethod(
                        "orchestrateAddVmToNetwork",
                        VirtualMachine.class,
                        Network.class,
                        NicProfile.class);
        m.setAccessible(true);
        try {
            return (NicProfile) m.invoke(manager, vm, network, new NicProfile());
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    @Test
    public void backendRejectionFailsWorkAndRemovesOnlyNewNic() throws Throwable {
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(true))).thenReturn(added);
        ResourceUnavailableException failure =
                new ResourceUnavailableException("No more available PCI slots", Host.class, 1L);
        doThrow(failure).when(manager).plugNic(any(), any(), any(), any(), any());
        NicVO row = mock(NicVO.class);
        when(nics.findById(100L)).thenReturn(row);
        try {
            orchestrate();
            fail("host rejection must fail VM work");
        } catch (ResourceUnavailableException actual) {
            assertSame(failure, actual);
        }
        verify(networks).removeNic(any(), eq(row));
    }

    @Test
    public void booleanRejectionCannotBecomeSucceededNull() throws Throwable {
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(true))).thenReturn(added);
        doReturn(false).when(manager).plugNic(any(), any(), any(), any(), any());
        try {
            orchestrate();
            fail("false hotplug must throw");
        } catch (ResourceUnavailableException expected) {
            assertTrue(expected.getMessage().contains("rejected"));
        }
    }

    @Test
    public void cleanupFailureIsSuppressedUnderActualHostError() throws Throwable {
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(true))).thenReturn(added);
        ResourceUnavailableException failure =
                new ResourceUnavailableException("No more available PCI slots", Host.class, 1L);
        doThrow(failure).when(manager).plugNic(any(), any(), any(), any(), any());
        doThrow(new RuntimeException("DHCP cleanup failed"))
                .when(networks)
                .removeNic(any(), any(Nic.class));
        try {
            orchestrate();
            fail("host failure must propagate");
        } catch (ResourceUnavailableException actual) {
            assertSame(failure, actual);
            assertEquals(1, actual.getSuppressed().length);
        }
    }

    @Test
    public void stoppedAdditionDoesNotContactHost() throws Throwable {
        when(vm.getState()).thenReturn(VirtualMachine.State.Stopped);
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(false)))
                .thenReturn(added);
        assertSame(added, orchestrate());
        verify(manager, never()).plugNic(any(), any(), any(), any(), any());
    }

    @Test
    public void unknownHostOutcomeKeepsReservationForReconciliation() throws Throwable {
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(true))).thenReturn(added);
        ResourceUnavailableException failure = new VirtualMachineManagerImpl.NicHotplugOutcomeUnknownException("reply lost", 1L);
        doThrow(failure).when(manager).plugNic(any(), any(), any(), any(), any());
        try {
            orchestrate();
            fail();
        } catch (ResourceUnavailableException actual) {
            assertSame(failure, actual);
        }
        verify(networks, never()).removeNic(any(), any(Nic.class));
        verify(nicDetails).addDetail(100L, "hotplug.outcome", "Unknown", false);
    }

    @Test
    public void conversionFailureBeforeHotplugReleasesNewNic() throws Throwable {
        when(networks.createNicForVm(eq(network), any(), any(), any(), eq(true))).thenReturn(added);
        doThrow(new RuntimeException("conversion failed")).when(manager).toNicTO(any(), any());
        try {
            orchestrate();
            fail();
        } catch (RuntimeException expected) { }
        verify(manager, never()).plugNic(any(), any(), any(), any(), any());
        verify(networks).removeNic(any(), any(Nic.class));
    }

    @Test
    public void missingHostReplyIsAnUnknownOutcome() throws Exception {
        AgentManager agents = mock(AgentManager.class);
        assertUnknownReply(agents);
    }

    @Test
    public void hostTimeoutIsAnUnknownOutcome() throws Exception {
        AgentManager agents = mock(AgentManager.class);
        doThrow(new OperationTimedoutException(null, 1L, 1L, 30, false)).when(agents).send(eq(1L), any(Commands.class));
        assertUnknownReply(agents);
    }

    private void assertUnknownReply(AgentManager agents) throws Exception {
        ReflectionTestUtils.setField(manager, "_agentMgr", agents);
        ReflectionTestUtils.setField(manager, "networkDetailsDao", mock(NetworkDetailsDao.class));
        VirtualMachineTO machine = mock(VirtualMachineTO.class);
        when(machine.getId()).thenReturn(10L);
        DeployDestination destination = mock(DeployDestination.class);
        when(destination.getHost()).thenReturn(host);
        try {
            manager.plugNic(network, mock(NicTO.class), machine, mock(ReservationContext.class), destination);
            fail();
        } catch (VirtualMachineManagerImpl.NicHotplugOutcomeUnknownException expected) {
            assertTrue(expected.getMessage().contains("reconcile"));
        }
    }

    @Test
    public void serializedFailureSurvivesFailedJobJoin() throws Exception {
        Outcome<VirtualMachine> outcome = mock(Outcome.class);
        when(outcome.get())
                .thenThrow(new ExecutionException("work failed", new RuntimeException()));
        ResourceUnavailableException failure =
                new ResourceUnavailableException("No more available PCI slots", Host.class, 1L);
        doThrow(failure)
                .when(manager)
                .retrieveResultFromJobOutcomeAndThrowExceptionIfNeeded(outcome);
        try {
            manager.retrieveAddedNicFromOutcome(outcome, "vm-uuid");
            fail();
        } catch (ResourceUnavailableException actual) {
            assertSame(failure, actual);
        }
    }

    @Test
    public void successOutcomeReturnsNicProfile() throws Exception {
        Outcome<VirtualMachine> outcome = mock(Outcome.class);
        doReturn(added)
                .when(manager)
                .retrieveResultFromJobOutcomeAndThrowExceptionIfNeeded(outcome);
        assertSame(added, manager.retrieveAddedNicFromOutcome(outcome, "vm-uuid"));
        verify(outcome).get();
    }

    @Test
    public void missingResultHasActionableFailure() throws Exception {
        Outcome<VirtualMachine> outcome = mock(Outcome.class);
        doReturn(null).when(manager).retrieveResultFromJobOutcomeAndThrowExceptionIfNeeded(outcome);
        try {
            manager.retrieveAddedNicFromOutcome(outcome, "vm-uuid");
            fail();
        } catch (CloudRuntimeException actual) {
            assertTrue(actual.getMessage().contains("refresh"));
            assertFalse(actual.getMessage().contains("null job"));
        }
    }

    @Test
    public void interruptedWaitPreservesInterruptFlag() throws Exception {
        Outcome<VirtualMachine> outcome = mock(Outcome.class);
        when(outcome.get()).thenThrow(new InterruptedException());
        try {
            manager.retrieveAddedNicFromOutcome(outcome, "vm-uuid");
            fail();
        } catch (CloudRuntimeException actual) {
            assertTrue(Thread.currentThread().isInterrupted());
        }
    }
}
