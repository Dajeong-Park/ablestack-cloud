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
package com.cloud.ftctl;

import com.cloud.agent.AgentManager;
import com.cloud.agent.api.Command;
import com.cloud.agent.api.FtctlActionAnswer;
import com.cloud.agent.api.FtctlActionCommand;
import com.cloud.agent.api.FtctlEventsAnswer;
import com.cloud.agent.api.FtctlEventsCommand;
import com.cloud.agent.api.FtctlStatusAnswer;
import com.cloud.agent.api.FtctlStatusCommand;
import com.cloud.agent.api.FtctlSyncAnswer;
import com.cloud.agent.api.FtctlSyncClusterCommand;
import com.cloud.agent.api.FtctlSyncProfileCommand;
import com.cloud.event.dao.EventDao;
import com.cloud.exception.AgentUnavailableException;
import com.cloud.exception.OperationTimedoutException;
import com.cloud.ftctl.dao.FtctlProtectionDao;
import com.cloud.ftctl.dao.FtctlProtectionVolumeDao;
import com.cloud.host.DetailVO;
import com.cloud.host.Host;
import com.cloud.host.HostVO;
import com.cloud.host.dao.HostDao;
import com.cloud.host.dao.HostDetailsDao;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.storage.ScopeType;
import com.cloud.storage.Volume;
import com.cloud.storage.VolumeApiService;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.user.Account;
import com.cloud.user.AccountVO;
import com.cloud.user.UserVO;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.NicVO;
import com.cloud.vm.VMInstanceDetailVO;
import com.cloud.vm.UserVmManager;
import com.cloud.vm.UserVmService;
import com.cloud.vm.UserVmVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VirtualMachineProfile;
import com.cloud.vm.VmDetailConstants;
import com.cloud.vm.dao.NicDao;
import com.cloud.vm.dao.UserVmDao;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.cloud.utils.Pair;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.cloudstack.storage.datastore.db.PrimaryDataStoreDao;
import org.apache.cloudstack.storage.datastore.db.StoragePoolVO;
import org.apache.cloudstack.api.command.admin.ftctl.GetFtctlCheckCmd;
import org.apache.cloudstack.api.command.admin.ftctl.GetFtctlEventsCmd;
import org.apache.cloudstack.api.command.admin.ftctl.GetFtctlHealthCmd;
import org.apache.cloudstack.api.command.admin.ftctl.GetFtctlProtectionCmd;
import org.apache.cloudstack.api.command.admin.ftctl.RegisterFtctlProtectionCmd;
import org.apache.cloudstack.api.response.ftctl.FtctlActionResponse;
import org.apache.cloudstack.api.response.ftctl.FtctlCheckResponse;
import org.apache.cloudstack.api.response.ftctl.FtctlEventResponse;
import org.apache.cloudstack.api.response.ftctl.FtctlEventsResponse;
import org.apache.cloudstack.api.response.ftctl.FtctlHealthResponse;
import org.apache.cloudstack.api.response.ftctl.FtctlProtectionResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.outofbandmanagement.OutOfBandManagement;
import org.apache.cloudstack.outofbandmanagement.OutOfBandManagementService;
import org.apache.cloudstack.outofbandmanagement.dao.OutOfBandManagementDao;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.MockitoJUnitRunner;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RunWith(MockitoJUnitRunner.class)
public class FtctlServiceImplTest {

    @Mock
    private VMInstanceDetailsDao vmInstanceDetailsDao;
    @Mock
    private UserVmDao userVmDao;
    @Mock
    private NicDao nicDao;
    @Mock
    private UserVmManager userVmManager;
    @Mock
    private UserVmService userVmService;
    @Mock
    private AgentManager agentManager;
    @Mock
    private HostDetailsDao hostDetailsDao;
    @Mock
    private HostDao hostDao;
    @Mock
    private PrimaryDataStoreDao primaryDataStoreDao;
    @Mock
    private OutOfBandManagementDao outOfBandManagementDao;
    @Mock
    private OutOfBandManagementService outOfBandManagementService;
    @Mock
    private FtctlProtectionProvisioningService ftctlProtectionProvisioningService;
    @Mock
    private FtctlProtectionDao ftctlProtectionDao;
    @Mock
    private FtctlProtectionVolumeDao ftctlProtectionVolumeDao;
    @Mock
    private VolumeDao volumeDao;
    @Mock
    private VolumeApiService volumeApiService;
    @Mock
    private EventDao eventDao;

    @InjectMocks
    private FtctlServiceImpl ftctlService;

    private UserVmVO userVm;
    private final Map<String, String> vmDetails = new HashMap<>();
    private final Map<String, String> hostDetails = new HashMap<>();

    @Before
    public void setup() throws Exception {
        userVm = Mockito.mock(UserVmVO.class);
        Mockito.when(userVm.getId()).thenReturn(101L);
        Mockito.when(userVm.getUuid()).thenReturn("vm-uuid");
        Mockito.when(userVm.getInstanceName()).thenReturn("vm-name");
        Mockito.lenient().when(userVm.getDisplayName()).thenReturn("Primary VM");
        Mockito.lenient().when(userVm.getHostName()).thenReturn("vm-name");
        Mockito.lenient().when(userVm.getAccountId()).thenReturn(501L);
        Mockito.when(userVm.getHostId()).thenReturn(201L);
        Mockito.lenient().when(userVm.getState()).thenReturn(VirtualMachine.State.Running);
        Mockito.lenient().when(userVm.getDataCenterId()).thenReturn(401L);
        Mockito.when(userVmDao.findById(101L)).thenReturn(userVm);
        Mockito.lenient().when(userVmDao.createForUpdate()).thenReturn(Mockito.mock(UserVmVO.class));
        Mockito.lenient().when(userVmDao.update(Mockito.anyLong(), Mockito.any(UserVmVO.class))).thenReturn(true);

        Mockito.lenient().doAnswer(invocation -> {
            Long vmId = invocation.getArgument(0);
            String key = invocation.getArgument(1);
            String value = invocation.getArgument(2);
            vmDetails.put(vmId + ":" + key, value);
            return null;
        }).when(vmInstanceDetailsDao).addDetail(Mockito.anyLong(), Mockito.anyString(), Mockito.anyString(), Mockito.anyBoolean());

        Mockito.lenient().doAnswer(invocation -> {
            Long vmId = invocation.getArgument(0);
            String key = invocation.getArgument(1);
            vmDetails.remove(vmId + ":" + key);
            return null;
        }).when(vmInstanceDetailsDao).removeDetail(Mockito.anyLong(), Mockito.anyString());

        Mockito.lenient().when(vmInstanceDetailsDao.findDetail(Mockito.anyLong(), Mockito.anyString())).thenAnswer(invocation -> {
            Long vmId = invocation.getArgument(0);
            String key = invocation.getArgument(1);
            String value = vmDetails.get(vmId + ":" + key);
            if (value == null) {
                return null;
            }
            VMInstanceDetailVO detail = Mockito.mock(VMInstanceDetailVO.class);
            Mockito.when(detail.getValue()).thenReturn(value);
            return detail;
        });

        Mockito.lenient().when(hostDetailsDao.findDetail(Mockito.anyLong(), Mockito.anyString())).thenAnswer(invocation -> {
            Long hostId = invocation.getArgument(0);
            String key = invocation.getArgument(1);
            String value = hostDetails.get(hostId + ":" + key);
            if (value == null) {
                return null;
            }
            DetailVO detail = Mockito.mock(DetailVO.class);
            Mockito.when(detail.getValue()).thenReturn(value);
            return detail;
        });

        Mockito.lenient().when(ftctlProtectionProvisioningService.prepareProtection(Mockito.any())).thenAnswer(invocation -> {
            FtctlProtectionProvisioningRequest request = invocation.getArgument(0);
            return new FtctlProtectionProvisioningContext(
                    FtctlProtectionProvisioningService.BACKEND_LIBVIRT_MANAGED,
                    FtctlProtectionProvisioningService.STATE_READY,
                    request.getSecondaryVmName(),
                    null);
        });
    }

    @Test
    public void testGetFtctlEventsReadsQemuRuntimeEvents() throws Exception {
        GetFtctlEventsCmd cmd = new GetFtctlEventsCmd();
        setField(cmd, "virtualMachineId", 101L);
        setField(cmd, "limit", 10);

        String itemsJson = "[" +
                "{\"ts\":\"2026-05-10T00:00:01+09:00\",\"vm\":\"vm-name\",\"stage\":\"runtime\",\"event\":\"state.update\",\"result\":\"ok\",\"details\":{\"state\":\"syncing\"}}," +
                "{\"ts\":\"2026-05-10T00:00:02+09:00\",\"vm\":\"vm-name\",\"stage\":\"blockcopy\",\"event\":\"blockcopy.progress\",\"result\":\"ok\",\"details\":{\"direction\":\"forward\",\"percent\":40.0,\"copied_bytes\":40,\"total_bytes\":100,\"ready\":false}}" +
                "]";
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class)))
                .thenReturn(new FtctlEventsAnswer(new FtctlEventsCommand("vm-name", 10), true, "OK",
                        "ok", "vm-name", 2, itemsJson));

        FtctlEventsResponse response = ftctlService.getFtctlEvents(cmd);

        Assert.assertEquals(Long.valueOf(101L), response.getVirtualMachineId());
        Assert.assertEquals("vm-name", response.getVmName());
        Assert.assertEquals("ok", response.getResult());
        Assert.assertEquals(Integer.valueOf(2), response.getCount());
        Assert.assertEquals(Double.valueOf(40.0), response.getSyncProgressPercent());
        Assert.assertTrue(response.getLatestProgress().contains("\"direction\":\"forward\""));

        List<FtctlEventResponse> events = response.getEvents();
        Assert.assertEquals(2, events.size());
        Assert.assertEquals("runtime", events.get(0).getStage());
        Assert.assertEquals("blockcopy.progress", events.get(1).getEvent());
        Assert.assertEquals("ok", events.get(1).getResult());
        Assert.assertTrue(events.get(1).getDetails().contains("\"percent\":40.0"));
        Mockito.verify(eventDao, Mockito.never()).lockEventsForArchiveOrDelete(Mockito.any(), Mockito.anyString(), Mockito.any(), Mockito.any(), Mockito.anyList());
    }

    @Test
    public void testGetFtctlCheckParsesAnswer() throws Exception {
        GetFtctlCheckCmd cmd = new GetFtctlCheckCmd();
        setField(cmd, "virtualMachineId", 101L);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmName("i-2-309-VM");
        protection.setActiveSide("secondary");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        vmDetails.put("101:ftctl.check.result", "ok");
        vmDetails.put("101:ftctl.check.inventory.result", "healthy");
        vmDetails.put("101:ftctl.check.primary.rc", "0");
        vmDetails.put("101:ftctl.check.peer.rc", "1");
        vmDetails.put("101:ftctl.check.peer.domain.expected", "false");
        vmDetails.put("101:ftctl.check.standby.domain.state", "not-defined-expected");

        FtctlCheckResponse response = ftctlService.getFtctlCheck(cmd);

        Assert.assertEquals(Long.valueOf(101L), getFieldValue(response, "virtualMachineId"));
        Assert.assertEquals("vm-name", getFieldValue(response, "vmName"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals("healthy", getFieldValue(response, "inventoryResult"));
        Assert.assertEquals(Integer.valueOf(0), getFieldValue(response, "primaryRc"));
        Assert.assertEquals(Integer.valueOf(1), getFieldValue(response, "peerRc"));
        Assert.assertEquals(Boolean.FALSE, getFieldValue(response, "peerDomainExpected"));
        Assert.assertEquals("not-defined-expected", getFieldValue(response, "standbyDomainState"));
        Assert.assertEquals("cloud-managed", getFieldValue(response, "provisioningBackend"));

        Mockito.verify(agentManager).send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class));
    }

    @Test
    public void testGetFtctlHealthParsesAnswer() throws Exception {
        GetFtctlHealthCmd cmd = new GetFtctlHealthCmd();
        setField(cmd, "virtualMachineId", 101L);

        vmDetails.put("101:ftctl.health.result", "ok");
        vmDetails.put("101:ftctl.health.uri", "qemu+ssh://10.0.0.11/system");
        vmDetails.put("101:ftctl.health.rc", "0");

        FtctlHealthResponse response = ftctlService.getFtctlHealth(cmd);

        Assert.assertEquals(Long.valueOf(101L), getFieldValue(response, "virtualMachineId"));
        Assert.assertEquals(Long.valueOf(201L), getFieldValue(response, "hostId"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals("qemu+ssh://10.0.0.11/system", getFieldValue(response, "uri"));
        Assert.assertEquals(Integer.valueOf(0), getFieldValue(response, "rc"));
        Mockito.verify(agentManager).send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class));
    }

    @Test
    public void testExecuteFtctlActionRefreshesRuntimeState() throws Exception {
        FtctlActionCommand actionCommand = new FtctlActionCommand(FtctlActionCommand.Action.PAUSE_PROTECTION, "vm-name");
        FtctlActionAnswer actionAnswer = new FtctlActionAnswer(actionCommand, true, "OK",
                FtctlActionCommand.Action.PAUSE_PROTECTION, "ok", 0, "paused");
        FtctlStatusCommand statusCommand = new FtctlStatusCommand("vm-name");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(statusCommand, true, "OK", "ok", "vm-name",
                "ft", "protected", "mirroring", "primary", "paused", "clear", "",
                "2026-04-18T16:55:00+09:00", 2, 0);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenAnswer(invocation -> {
            Command command = invocation.getArgument(1);
            return command instanceof FtctlStatusCommand ? statusAnswer : actionAnswer;
        });

        FtctlActionResponse response = ftctlService.executeFtctlAction(101L, FtctlActionCommand.Action.PAUSE_PROTECTION, false);

        Assert.assertEquals(Long.valueOf(101L), getFieldValue(response, "virtualMachineId"));
        Assert.assertEquals("vm-name", getFieldValue(response, "vmName"));
        Assert.assertEquals("PAUSE_PROTECTION", getFieldValue(response, "action"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals(Integer.valueOf(0), getFieldValue(response, "exitCode"));
        Assert.assertEquals("paused", getFieldValue(response, "output"));
        Assert.assertEquals("ft", getFieldValue(response, "mode"));
        Assert.assertEquals("protected", getFieldValue(response, "protectionState"));
        Assert.assertEquals("mirroring", getFieldValue(response, "transportState"));
        Assert.assertEquals("primary", getFieldValue(response, "activeSide"));
        Assert.assertEquals("paused", getFieldValue(response, "adminState"));
        Assert.assertEquals("clear", getFieldValue(response, "fencingState"));

        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.protection.state", "protected", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.transport.state", "mirroring", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.active.side", "primary", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.admin.state", "paused", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.fencing.state", "clear", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.mode", "ft", true);
        Mockito.verify(ftctlProtectionDao).update(Mockito.eq(0L), Mockito.same(protection));
        Assert.assertEquals("ft", protection.getMode());
        Assert.assertEquals("protected", protection.getProtectionState());
        Assert.assertEquals("mirroring", protection.getTransportState());
        Assert.assertEquals("primary", protection.getActiveSide());
        Assert.assertEquals("paused", protection.getAdminState());
        Assert.assertEquals("clear", protection.getFencingState());
    }

    @Test
    public void testRuntimeStateSyncPersistsAgentStatusForActiveProtection() throws Exception {
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setMode("ha");
        protection.setProtectionState("syncing");
        protection.setTransportState("copying");
        protection.setActiveSide("primary");
        protection.setAdminState("active");
        protection.setFencingState("clear");
        Mockito.when(ftctlProtectionDao.listActive()).thenReturn(Collections.singletonList(protection));
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "protected", "mirroring", "primary", "active", "clear", "",
                "2026-05-10T14:09:28+09:00", 0, 0);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenReturn(statusAnswer);

        ftctlService.syncActiveProtectionRuntimeStates();

        Mockito.verify(agentManager).send(Mockito.eq(201L), Mockito.any(FtctlStatusCommand.class));
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.protection.state", "protected", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.transport.state", "mirroring", true);
        Mockito.verify(ftctlProtectionDao).update(Mockito.eq(0L), Mockito.same(protection));
        Assert.assertEquals("protected", protection.getProtectionState());
        Assert.assertEquals("mirroring", protection.getTransportState());
    }

    @Test
    public void testCloudManagedFailoverMonitorConvertsRepeatedCandidateToManualRequired() throws Exception {
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        setField(protection, "id", 801L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProvisioningState(FtctlProtectionProvisioningService.STATE_READY);
        protection.setProtectionState("protected");
        protection.setTransportState("mirroring");
        protection.setActiveSide("primary");
        protection.setAdminState("active");
        protection.setFencingState("clear");
        protection.setFencingPolicy("manual-block");
        Mockito.when(ftctlProtectionDao.listActive()).thenReturn(Collections.singletonList(protection));
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        vmDetails.put("101:ftctl.last.error", "cloud_managed_failover_candidate");

        ftctlService.reconcileCloudManagedFailovers();

        Assert.assertEquals("failover_suspect", protection.getProtectionState());
        Assert.assertEquals("cloud_managed_failover_suspect", protection.getLastError());
        Assert.assertEquals("1", vmDetails.get("101:ftctl.auto.failover.failure.count"));

        ftctlService.reconcileCloudManagedFailovers();

        Assert.assertEquals("failover_required", protection.getProtectionState());
        Assert.assertEquals("mirroring", protection.getTransportState());
        Assert.assertEquals("primary", protection.getActiveSide());
        Assert.assertEquals("required", protection.getFencingState());
        Assert.assertEquals("cloud_managed_failover_manual_required", protection.getLastError());
        Assert.assertEquals("2", vmDetails.get("101:ftctl.auto.failover.failure.count"));
        Assert.assertEquals("manual-required", vmDetails.get("101:ftctl.fencing.result"));
        Assert.assertEquals("automatic_fencing_requires_ipmi_policy", vmDetails.get("101:ftctl.fencing.reason"));
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
    }

    @Test
    public void testExecuteFailoverActionRecordsReadyMarkerBeforeManualFence() throws Exception {
        FtctlActionCommand actionCommand = new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name");
        FtctlActionAnswer actionAnswer = new FtctlActionAnswer(actionCommand, true, "OK",
                FtctlActionCommand.Action.FAILOVER, "ok", 0, "manual-fencing-required");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "mirroring", "primary", "active", "required", "manual_fencing_required",
                "2026-05-07T22:35:00+09:00", 0, 1, 100.0d, 1024L, 1024L, true,
                "forward", "2026-05-07T22:35:00+09:00", "{\"ready\":true}");
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenAnswer(invocation -> {
            Command command = invocation.getArgument(1);
            return command instanceof FtctlStatusCommand ? statusAnswer : actionAnswer;
        });

        ftctlService.executeFtctlAction(101L, FtctlActionCommand.Action.FAILOVER, false);

        Assert.assertEquals("true", vmDetails.get("101:ftctl.failover.ready"));
        Assert.assertNotNull(vmDetails.get("101:ftctl.failover.ready.updated"));
        Assert.assertNull(vmDetails.get("101:ftctl.failover.ready.sync.percent"));
        Assert.assertNull(vmDetails.get("101:ftctl.failover.ready.sync.json"));
    }

    @Test
    public void testExecuteFtctlActionRetriesLockedAction() throws Exception {
        FtctlActionCommand actionCommand = new FtctlActionCommand(FtctlActionCommand.Action.PAUSE_PROTECTION, "vm-name");
        FtctlActionAnswer lockedAnswer = new FtctlActionAnswer(actionCommand, false,
                "{\"command\":\"pause\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/lock\"}",
                FtctlActionCommand.Action.PAUSE_PROTECTION, "locked", 20,
                "{\"command\":\"pause\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/lock\"}");
        FtctlActionAnswer actionAnswer = new FtctlActionAnswer(actionCommand, true, "OK",
                FtctlActionCommand.Action.PAUSE_PROTECTION, "ok", 0, "paused");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ft", "protected", "mirroring", "primary", "paused", "clear", "",
                "2026-05-06T09:00:00+09:00", 0, 0);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(lockedAnswer)
                .thenReturn(actionAnswer)
                .thenReturn(statusAnswer);

        FtctlActionResponse response = ftctlService.executeFtctlAction(101L, FtctlActionCommand.Action.PAUSE_PROTECTION, false);

        Assert.assertEquals("PAUSE_PROTECTION", getFieldValue(response, "action"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals("paused", getFieldValue(response, "adminState"));
        Mockito.verify(agentManager, Mockito.times(3)).send(Mockito.eq(201L), Mockito.any(Command.class));
    }

    @Test
    public void testReleaseFtctlProtectionExpungesStandbyVolumesAndRemovesRows() throws Exception {
        UserVO caller = new UserVO();
        AccountVO account = new AccountVO("admin", 1L, "ROOT", Account.Type.ADMIN, "account-uuid");
        CallContext.register(caller, account);
        try {
            UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
            Mockito.when(secondaryVm.getId()).thenReturn(202L);
            Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-uuid");
            Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Stopped);
            Mockito.when(secondaryVm.getRemoved()).thenReturn(null);
            Mockito.when(userVmDao.findById(202L)).thenReturn(secondaryVm);

            FtctlProtectionVO protection = new FtctlProtectionVO(101L);
            setField(protection, "id", 801L);
            protection.setSecondaryVmId(202L);
            protection.setBackendMode("remote-nbd");
            protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
            protection.setActiveSide("primary");
            Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

            FtctlProtectionVolumeVO rootMapping = new FtctlProtectionVolumeVO(801L, 301L);
            setField(rootMapping, "id", 901L);
            rootMapping.setSecondaryVolumeId(401L);
            rootMapping.setDiskLabel("root-0");
            FtctlProtectionVolumeVO dataMapping = new FtctlProtectionVolumeVO(801L, 302L);
            setField(dataMapping, "id", 902L);
            dataMapping.setSecondaryVolumeId(402L);
            dataMapping.setDiskLabel("data-1");
            Mockito.when(ftctlProtectionVolumeDao.listActiveByProtectionId(801L)).thenReturn(List.of(rootMapping, dataMapping));

            VolumeVO rootVolume = Mockito.mock(VolumeVO.class);
            Mockito.when(rootVolume.getId()).thenReturn(401L);
            Mockito.when(rootVolume.getInstanceId()).thenReturn(202L);
            Mockito.when(rootVolume.getState()).thenReturn(Volume.State.Ready);
            Mockito.when(rootVolume.getRemoved()).thenReturn(null);

            VolumeVO dataVolume = Mockito.mock(VolumeVO.class);
            Mockito.when(dataVolume.getId()).thenReturn(402L);
            Mockito.when(dataVolume.getInstanceId()).thenReturn(202L);
            Mockito.when(dataVolume.getState()).thenReturn(Volume.State.Ready);
            Mockito.when(dataVolume.getRemoved()).thenReturn(null);

            Mockito.when(volumeDao.findByInstance(202L)).thenReturn(List.of(rootVolume, dataVolume));
            Mockito.when(volumeDao.findById(401L)).thenReturn(rootVolume);
            Mockito.when(volumeDao.findById(402L)).thenReturn(dataVolume);
            Mockito.when(volumeApiService.destroyVolume(Mockito.anyLong(), Mockito.eq(account), Mockito.eq(true), Mockito.eq(true)))
                    .thenReturn(rootVolume);
            Mockito.when(userVmManager.expunge(secondaryVm)).thenReturn(true);

            FtctlActionCommand actionCommand = new FtctlActionCommand(FtctlActionCommand.Action.UNPROTECT, "vm-name");
            FtctlActionAnswer actionAnswer = new FtctlActionAnswer(actionCommand, true, "OK",
                    FtctlActionCommand.Action.UNPROTECT, "ok", 0,
                    "{\"result\":\"ok\",\"remote_nbd_required\":true,\"remote_nbd_released\":true}");
            FtctlStatusCommand statusCommand = new FtctlStatusCommand("vm-name");
            FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(statusCommand, true, "OK", "ok", "vm-name",
                    "ha", "disabled", "stopped", "primary", "inactive", "clear", "",
                    "2026-05-04T09:30:00+09:00", 0, 0);
            Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                    .thenReturn(actionAnswer)
                    .thenReturn(statusAnswer);

            FtctlActionResponse response = ftctlService.releaseFtctlProtection(101L, true);

            Assert.assertEquals("UNPROTECT", getFieldValue(response, "action"));
            Assert.assertEquals("disabled", getFieldValue(response, "protectionState"));
            Mockito.verify(userVmService).destroyVm(202L, true);
            Mockito.verify(userVmManager).expunge(secondaryVm);
            Mockito.verify(volumeDao).detachVolume(401L);
            Mockito.verify(volumeDao).detachVolume(402L);
            Mockito.verify(volumeApiService).destroyVolume(401L, account, true, true);
            Mockito.verify(volumeApiService).destroyVolume(402L, account, true, true);
            Mockito.verify(ftctlProtectionVolumeDao).remove(901L);
            Mockito.verify(ftctlProtectionVolumeDao).remove(902L);
            Mockito.verify(ftctlProtectionDao).remove(801L);
            ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
            Mockito.verify(agentManager, Mockito.atLeastOnce()).send(Mockito.eq(201L), commandCaptor.capture());
            FtctlActionCommand capturedAction = null;
            for (Command command : commandCaptor.getAllValues()) {
                if (command instanceof FtctlActionCommand) {
                    capturedAction = (FtctlActionCommand) command;
                    break;
                }
            }
            Assert.assertNotNull(capturedAction);
            Assert.assertEquals(240, capturedAction.getWait());
        } finally {
            CallContext.unregister();
        }
    }

    @Test
    public void testConfirmFtctlFenceStartsSecondaryAndContinuesFailover() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");

        UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
        Mockito.when(secondaryVm.getId()).thenReturn(401L);
        Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-vm-uuid");
        Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        Mockito.when(userVmDao.findById(401L)).thenReturn(secondaryVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("shared-blockcopy");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "mirroring", "primary", "active", "manual-fenced", "manual_fencing_required",
                "2026-05-03T00:55:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "start-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "mirroring", "primary", "active", "manual-fenced", "",
                "2026-05-03T00:55:30+09:00", 0, 1);
        FtctlActionAnswer failoverAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER, "ok", 0, "failed-over");
        FtctlStatusAnswer failoverStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-03T00:56:00+09:00", 0, 2);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus)
                .thenReturn(failoverAnswer)
                .thenReturn(failoverStatus);
        Mockito.when(userVmManager.startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull()))
                .thenReturn(new Pair<>(secondaryVm, new HashMap<>()));

        FtctlActionResponse response = ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("FENCE_CONFIRM", getFieldValue(response, "action"));
        Assert.assertEquals("failed_over", getFieldValue(response, "protectionState"));
        Assert.assertEquals("failed_over", getFieldValue(response, "transportState"));
        Assert.assertEquals("secondary", getFieldValue(response, "activeSide"));
        Assert.assertEquals("manual-fenced", getFieldValue(response, "fencingState"));
        Assert.assertEquals("", getFieldValue(response, "lastError"));
        Mockito.verify(userVmManager).startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull());

        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(6)).send(Mockito.eq(201L), commandCaptor.capture());
        List<Command> commands = commandCaptor.getAllValues();
        Assert.assertEquals(FtctlActionCommand.Action.FENCE_CONFIRM, ((FtctlActionCommand) commands.get(0)).getAction());
        Assert.assertTrue(commands.get(1) instanceof FtctlStatusCommand);
        Assert.assertEquals(FtctlActionCommand.Action.FAILOVER_PREPARE, ((FtctlActionCommand) commands.get(2)).getAction());
        Assert.assertTrue(((FtctlActionCommand) commands.get(2)).isForce());
        Assert.assertTrue(commands.get(3) instanceof FtctlStatusCommand);
        Assert.assertEquals(FtctlActionCommand.Action.FAILOVER, ((FtctlActionCommand) commands.get(4)).getAction());
        Assert.assertTrue(((FtctlActionCommand) commands.get(4)).isForce());
        Assert.assertTrue(commands.get(5) instanceof FtctlStatusCommand);
    }

    @Test
    public void testConfirmFtctlFenceReturnsFinalStateWhenFailoverContinuationIsLockedAfterConvergence() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");

        UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
        Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-vm-uuid");
        Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Running);
        Mockito.when(userVmDao.findById(401L)).thenReturn(secondaryVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProvisioningState(FtctlProtectionProvisioningService.STATE_READY);
        protection.setProtectionState("failing_over");
        protection.setTransportState("mirroring");
        protection.setActiveSide("primary");
        protection.setAdminState("active");
        protection.setFencingState("manual-fenced");
        protection.setLastError("manual_fencing_required");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-06T09:05:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "already-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-06T09:05:30+09:00", 0, 1);
        FtctlActionAnswer lockedFailover = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name"), false,
                "{\"command\":\"failover\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/lock\"}",
                FtctlActionCommand.Action.FAILOVER, "locked", 20,
                "{\"command\":\"failover\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/lock\"}");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus)
                .thenAnswer(invocation -> {
                    protection.setProtectionState("failed_over");
                    protection.setTransportState("failed_over");
                    protection.setActiveSide("secondary");
                    protection.setAdminState("active");
                    protection.setFencingState("manual-fenced");
                    protection.setLastError("");
                    return lockedFailover;
                });

        FtctlActionResponse response = ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("FENCE_CONFIRM", getFieldValue(response, "action"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals(Integer.valueOf(0), getFieldValue(response, "exitCode"));
        Assert.assertEquals("failed_over", getFieldValue(response, "protectionState"));
        Assert.assertEquals("failed_over", getFieldValue(response, "transportState"));
        Assert.assertEquals("secondary", getFieldValue(response, "activeSide"));
        Assert.assertEquals("manual-fenced", getFieldValue(response, "fencingState"));
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
        Mockito.verify(nicDao, Mockito.never()).update(Mockito.anyLong(), Mockito.any(NicVO.class));
        Mockito.verify(agentManager, Mockito.times(5)).send(Mockito.eq(201L), Mockito.any(Command.class));
    }

    @Test
    public void testConfirmFtctlFenceReturnsFinalStateWhenFenceConfirmIsLockedAfterConvergence() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("shared-blockcopy");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProtectionState("failing_over");
        protection.setTransportState("mirroring");
        protection.setActiveSide("primary");
        protection.setAdminState("active");
        protection.setFencingState("required");
        protection.setLastError("manual_fencing_required");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer lockedConfirm = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), false,
                "{\"command\":\"fence-confirm\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/locks/vm-name.lock\"}",
                FtctlActionCommand.Action.FENCE_CONFIRM, "locked", 20,
                "{\"command\":\"fence-confirm\",\"result\":\"locked\",\"lock_file\":\"/run/ablestack-vm-ftctl/locks/vm-name.lock\"}");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenAnswer(invocation -> {
                    protection.setProtectionState("failed_over");
                    protection.setTransportState("failed_over");
                    protection.setActiveSide("secondary");
                    protection.setAdminState("active");
                    protection.setFencingState("manual-fenced");
                    protection.setLastError("");
                    return lockedConfirm;
                });

        FtctlActionResponse response = ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("FENCE_CONFIRM", getFieldValue(response, "action"));
        Assert.assertEquals("ok", getFieldValue(response, "result"));
        Assert.assertEquals(Integer.valueOf(0), getFieldValue(response, "exitCode"));
        Assert.assertEquals("failed_over", getFieldValue(response, "protectionState"));
        Assert.assertEquals("failed_over", getFieldValue(response, "transportState"));
        Assert.assertEquals("secondary", getFieldValue(response, "activeSide"));
        Assert.assertEquals("manual-fenced", getFieldValue(response, "fencingState"));
        Mockito.verify(agentManager, Mockito.times(1)).send(Mockito.eq(201L), Mockito.any(Command.class));
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
    }

    @Test
    public void testConfirmFtctlFenceHandsOffCloudManagedNicIdentityBeforeStartingSecondary() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");

        UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
        Mockito.when(secondaryVm.getId()).thenReturn(401L);
        Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-vm-uuid");
        Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        Mockito.when(userVmDao.findById(401L)).thenReturn(secondaryVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("shared-blockcopy");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        NicVO primaryNic = nic(425L, 101L, 204L, 0, "00:50:56:b5:5c:28", "10.10.254.90");
        primaryNic.setIPv4Gateway("10.10.0.1");
        primaryNic.setIPv4Netmask("255.255.0.0");
        NicVO secondaryNic = nic(453L, 401L, 204L, 0, "02:01:00:cc:00:64", "10.10.254.242");
        secondaryNic.setIPv4Gateway("10.10.0.1");
        secondaryNic.setIPv4Netmask("255.255.0.0");
        Mockito.when(nicDao.listByVmIdOrderByDeviceId(101L)).thenReturn(List.of(primaryNic));
        Mockito.when(nicDao.listByVmIdOrderByDeviceId(401L)).thenReturn(List.of(secondaryNic));

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "mirroring", "primary", "active", "manual-fenced", "manual_fencing_required",
                "2026-05-03T00:55:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "start-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "mirroring", "primary", "active", "manual-fenced", "",
                "2026-05-03T00:55:30+09:00", 0, 1);
        FtctlActionAnswer failoverAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER, "ok", 0, "failed-over");
        FtctlStatusAnswer failoverStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-03T00:56:00+09:00", 0, 2);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus)
                .thenReturn(failoverAnswer)
                .thenReturn(failoverStatus);
        Mockito.when(userVmManager.startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                        Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull()))
                .thenReturn(new Pair<>(secondaryVm, new HashMap<>()));

        ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("02:01:00:cc:00:64", primaryNic.getMacAddress());
        Assert.assertEquals("10.10.254.242", primaryNic.getIPv4Address());
        Assert.assertEquals("00:50:56:b5:5c:28", secondaryNic.getMacAddress());
        Assert.assertEquals("10.10.254.90", secondaryNic.getIPv4Address());
        Assert.assertEquals("secondary-owned", vmDetails.get("101:ftctl.nic.identity.state"));

        InOrder inOrder = Mockito.inOrder(nicDao, userVmManager);
        inOrder.verify(nicDao).update(425L, primaryNic);
        inOrder.verify(nicDao).update(453L, secondaryNic);
        inOrder.verify(userVmManager).startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull());
    }

    @Test
    public void testConfirmFtctlFenceRejectsCopyingTransportBeforeSecondaryStart() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("shared-blockcopy");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "copying", "primary", "active", "manual-fenced", "manual_fencing_required",
                "2026-05-03T00:55:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "not-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failing_over", "copying", "primary", "active", "manual-fenced", "blockcopy_not_ready_for_failover",
                "2026-05-03T00:55:30+09:00", 0, 1);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus);

        try {
            ftctlService.confirmFtctlFence(101L);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("requires transport state mirroring or failed_over"));
        }

        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(4)).send(Mockito.eq(201L), commandCaptor.capture());
        List<Command> commands = commandCaptor.getAllValues();
        Assert.assertEquals(FtctlActionCommand.Action.FENCE_CONFIRM, ((FtctlActionCommand) commands.get(0)).getAction());
        Assert.assertTrue(commands.get(1) instanceof FtctlStatusCommand);
        Assert.assertEquals(FtctlActionCommand.Action.FAILOVER_PREPARE, ((FtctlActionCommand) commands.get(2)).getAction());
        Assert.assertTrue(commands.get(3) instanceof FtctlStatusCommand);
    }

    @Test
    public void testConfirmFtctlFenceAllowsTransientTransportWithReadyMarker() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");
        vmDetails.put("101:ftctl.failover.ready", "true");

        UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
        Mockito.when(secondaryVm.getId()).thenReturn(401L);
        Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-vm-uuid");
        Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        Mockito.when(userVmDao.findById(401L)).thenReturn(secondaryVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("ha");
        protection.setBackendMode("remote-nbd");
        protection.setProtectionState("error");
        protection.setTransportState("transient_loss");
        protection.setActiveSide("primary");
        protection.setAdminState("active");
        protection.setFencingState("manual-fenced");
        protection.setLastError("blockcopy_not_ready_for_failover");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "error", "transient_loss", "primary", "active", "manual-fenced", "blockcopy_not_ready_for_failover",
                "2026-05-07T22:36:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "start-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "error", "transient_loss", "primary", "active", "manual-fenced", "blockcopy_not_ready_for_failover",
                "2026-05-07T22:36:30+09:00", 0, 1);
        FtctlActionAnswer failoverAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER, "ok", 0, "failed-over");
        FtctlStatusAnswer failoverStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-07T22:37:00+09:00", 0, 2);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus)
                .thenReturn(failoverAnswer)
                .thenReturn(failoverStatus);
        Mockito.when(userVmManager.startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                        Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull()))
                .thenReturn(new Pair<>(secondaryVm, new HashMap<>()));

        FtctlActionResponse response = ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("failed_over", getFieldValue(response, "protectionState"));
        Assert.assertEquals("failed_over", getFieldValue(response, "transportState"));
        Mockito.verify(userVmManager).startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull());
        Assert.assertNull(vmDetails.get("101:ftctl.failover.ready"));
    }

    @Test
    public void testConfirmFtctlFenceRejectsRunningPrimary() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Running);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        try {
            ftctlService.confirmFtctlFence(101L);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("requires primary VM"));
        }
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
    }

    @Test
    public void testConfirmFtctlFenceStartsSameMoldDrSecondary() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.peer.host.id", "202");
        vmDetails.put("101:ftctl.dr.peer.site.type", "local-mold");

        UserVmVO secondaryVm = Mockito.mock(UserVmVO.class);
        Mockito.when(secondaryVm.getId()).thenReturn(401L);
        Mockito.when(secondaryVm.getUuid()).thenReturn("secondary-vm-uuid");
        Mockito.when(secondaryVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        Mockito.when(userVmDao.findById(401L)).thenReturn(secondaryVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        NicVO primaryNic = nic(425L, 101L, 204L, 0, "00:50:56:b5:5c:28", "10.10.254.90");
        NicVO secondaryNic = nic(453L, 401L, 204L, 0, "02:01:00:cc:00:64", "10.10.254.242");
        Mockito.when(nicDao.listByVmIdOrderByDeviceId(101L)).thenReturn(List.of(primaryNic));
        Mockito.when(nicDao.listByVmIdOrderByDeviceId(401L)).thenReturn(List.of(secondaryNic));

        FtctlActionAnswer confirmAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FENCE_CONFIRM, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FENCE_CONFIRM, "ok", 0, "manual-fenced");
        FtctlStatusAnswer confirmStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "failing_over", "mirroring", "primary", "active", "manual-fenced", "manual_fencing_required",
                "2026-05-14T20:10:00+09:00", 0, 1);
        FtctlActionAnswer prepareAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER_PREPARE, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER_PREPARE, "ok", 0, "start-ready");
        FtctlStatusAnswer prepareStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "failing_over", "mirroring", "primary", "active", "manual-fenced", "",
                "2026-05-14T20:10:30+09:00", 0, 1);
        FtctlActionAnswer failoverAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILOVER, "vm-name"), true, "OK",
                FtctlActionCommand.Action.FAILOVER, "ok", 0, "failed-over");
        FtctlStatusAnswer failoverStatus = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "failed_over", "failed_over", "secondary", "active", "manual-fenced", "",
                "2026-05-14T20:11:00+09:00", 0, 2);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(confirmAnswer)
                .thenReturn(confirmStatus)
                .thenReturn(prepareAnswer)
                .thenReturn(prepareStatus)
                .thenReturn(failoverAnswer)
                .thenReturn(failoverStatus);
        Mockito.when(userVmManager.startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                        Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull()))
                .thenReturn(new Pair<>(secondaryVm, new HashMap<>()));

        FtctlActionResponse response = ftctlService.confirmFtctlFence(101L);

        Assert.assertEquals("failed_over", getFieldValue(response, "protectionState"));
        Assert.assertEquals("secondary", getFieldValue(response, "activeSide"));
        Mockito.verify(userVmManager).startVirtualMachine(Mockito.eq(401L), Mockito.eq(202L),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.isNull());
    }

    @Test
    public void testConfirmFtctlFenceRemoteMoldRequiresOneTimeCredentials() throws Exception {
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        vmDetails.put("101:ftctl.dr.peer.site.type", "remote-mold");
        vmDetails.put("101:ftctl.dr.remote.mold.api.url", "http://remote.example/client/api");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.id", "remote-vm-uuid");

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        try {
            ftctlService.confirmFtctlFence(101L);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("requires remote Mold API URL, API key, and secret key"));
        }

        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
    }

    @Test
    public void testDrRemoteMoldFailbackStoresTransientContextDuringReverseSync() throws Exception {
        vmDetails.put("101:ftctl.dr.peer.site.type", "remote-mold");
        vmDetails.put("101:ftctl.dr.remote.mold.api.url", "http://remote.example/client/api");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.id", "remote-vm-uuid");

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        setField(protection, "id", 801L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProtectionState("failed_over");
        protection.setTransportState("failed_over");
        protection.setActiveSide("secondary");
        protection.setFencingState("clear");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlActionAnswer actionAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.FAILBACK_SYNC, "vm-name"),
                true, "OK", FtctlActionCommand.Action.FAILBACK_SYNC, "ok", 0, "reverse-sync-started");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "failing_back", "reverse_syncing", "secondary", "active", "clear", "",
                "2026-05-16T17:10:00+09:00", 0, 0);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenAnswer(invocation -> {
            Command command = invocation.getArgument(1);
            return command instanceof FtctlStatusCommand ? statusAnswer : actionAnswer;
        });

        FtctlActionResponse response = ftctlService.failbackFtctlProtection(101L, true, "original-primary",
                "http://remote.example/client/api", "api-key", "secret-key", null, null, null);

        Assert.assertEquals("FAILBACK", getFieldValue(response, "action"));
        Map<?, ?> contexts = (Map<?, ?>) getFieldValue(ftctlService, "cloudManagedFailbackContexts");
        Assert.assertTrue(contexts.containsKey(801L));
        Assert.assertFalse(vmDetails.containsValue("api-key"));
        Assert.assertFalse(vmDetails.containsValue("secret-key"));
    }

    @Test
    public void testDrRemoteMoldFailbackRefreshesRuntimeBeforeRestartingReverseSync() throws Exception {
        vmDetails.put("101:ftctl.dr.peer.site.type", "remote-mold");
        vmDetails.put("101:ftctl.dr.remote.mold.api.url", "http://remote.example/client/api");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.id", "remote-vm-uuid");

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        setField(protection, "id", 803L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProtectionState("failed_over");
        protection.setTransportState("failed_over");
        protection.setActiveSide("secondary");
        protection.setFencingState("clear");
        protection.setAdminState("active");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "failing_back", "reverse_syncing", "secondary", "active", "clear", "reverse_sync_pending",
                "2026-05-16T17:20:00+09:00", 0, 0);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenAnswer(invocation -> {
            Command command = invocation.getArgument(1);
            if (command instanceof FtctlStatusCommand) {
                return statusAnswer;
            }
            throw new AssertionError("FAILBACK_SYNC must not be restarted when runtime reverse sync is already active");
        });

        FtctlActionResponse response = ftctlService.failbackFtctlProtection(101L, true, "original-primary",
                "http://remote.example/client/api", "api-key", "secret-key", null, null, null);

        Assert.assertEquals("FAILBACK", getFieldValue(response, "action"));
        Assert.assertEquals("failing_back", getFieldValue(response, "protectionState"));
        Assert.assertEquals("reverse_syncing", getFieldValue(response, "transportState"));
        Assert.assertEquals("cloud-managed failback already in progress", getFieldValue(response, "output"));
        Map<?, ?> contexts = (Map<?, ?>) getFieldValue(ftctlService, "cloudManagedFailbackContexts");
        Assert.assertTrue(contexts.containsKey(803L));
    }

    @Test
    public void testDrRemoteMoldFailbackMissingContextMarksCutbackRequired() throws Exception {
        vmDetails.put("101:ftctl.dr.peer.site.type", "remote-mold");
        vmDetails.put("101:ftctl.dr.remote.mold.api.url", "http://remote.example/client/api");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.id", "remote-vm-uuid");

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        setField(protection, "id", 802L);
        protection.setMode("dr");
        protection.setBackendMode("remote-nbd");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setProtectionState("failing_back");
        protection.setTransportState("reverse_sync_ready");
        protection.setActiveSide("secondary");
        protection.setFencingState("clear");
        protection.setAdminState("active");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        invokeContinueCloudManagedFailbackAfterReverseSync(userVm, protection, null, false);

        Assert.assertEquals("failing_back", protection.getProtectionState());
        Assert.assertEquals("reverse_sync_cutback_required", protection.getTransportState());
        Assert.assertEquals("secondary", protection.getActiveSide());
        Assert.assertEquals("cloud_managed_failback_context_required", protection.getLastError());
        Assert.assertEquals("reverse_sync_cutback_required", vmDetails.get("101:ftctl.last.transport.state"));
        Assert.assertEquals("cloud_managed_failback_context_required", vmDetails.get("101:ftctl.last.error"));
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
        Mockito.verify(userVmManager, Mockito.never()).startVirtualMachine(Mockito.anyLong(), Mockito.<Long>any(),
                Mockito.<Map<VirtualMachineProfile.Param, Object>>any(), Mockito.<String>any());
    }

    @Test
    public void testGetFtctlProtectionForStandbyVmReturnsPrimaryManagedView() throws Exception {
        UserVmVO standbyVm = Mockito.mock(UserVmVO.class);
        Mockito.when(standbyVm.getId()).thenReturn(401L);
        Mockito.lenient().when(standbyVm.getDisplayName()).thenReturn("Standby VM");
        Mockito.when(userVmDao.findById(401L)).thenReturn(standbyVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setSecondaryVmName("Standby VM");
        Mockito.when(ftctlProtectionDao.findActiveBySecondaryVmId(401L)).thenReturn(protection);

        vmDetails.put("101:ftctl.enabled", "true");
        vmDetails.put("101:ftctl.mode", "ha");
        vmDetails.put("101:ftctl.backend.mode", "shared-blockcopy");
        vmDetails.put("101:ftctl.last.protection.state", "protected");
        vmDetails.put("101:ftctl.last.transport.state", "mirroring");
        vmDetails.put("101:ftctl.last.active.side", "primary");
        vmDetails.put("101:ftctl.last.admin.state", "active");
        vmDetails.put("101:ftctl.last.fencing.state", "clear");

        GetFtctlProtectionCmd cmd = new GetFtctlProtectionCmd();
        setField(cmd, "virtualMachineId", 401L);

        FtctlProtectionResponse response = ftctlService.getFtctlProtection(cmd);

        Assert.assertEquals(Long.valueOf(401L), getFieldValue(response, "virtualMachineId"));
        Assert.assertEquals("standby", getFieldValue(response, "protectionRole"));
        Assert.assertEquals(Long.valueOf(101L), getFieldValue(response, "primaryVirtualMachineId"));
        Assert.assertEquals("Primary VM", getFieldValue(response, "primaryVirtualMachineName"));
        Assert.assertEquals(Long.valueOf(401L), getFieldValue(response, "secondaryVirtualMachineId"));
        Assert.assertEquals("Standby VM", getFieldValue(response, "secondaryVmName"));
        Assert.assertEquals("protected", getFieldValue(response, "protectionState"));
        Assert.assertEquals("mirroring", getFieldValue(response, "transportState"));
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
        Mockito.verify(ftctlProtectionDao, Mockito.never()).update(Mockito.anyLong(), Mockito.same(protection));
    }

    @Test
    public void testGetFtctlProtectionProjectsRemoteMoldReplicaSnapshot() throws Exception {
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        protection.setSecondaryVmName("i-2-20-VM");
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlProtectionVolumeVO rootMapping = new FtctlProtectionVolumeVO(0L, 301L);
        rootMapping.setDiskLabel("root-0");
        rootMapping.setSecondaryDiskPath("/dev/rbd/rbd/remote-root");
        Mockito.when(ftctlProtectionVolumeDao.listActiveByProtectionId(0L)).thenReturn(Collections.singletonList(rootMapping));
        VolumeVO primaryRoot = Mockito.mock(VolumeVO.class);
        Mockito.when(primaryRoot.getDeviceId()).thenReturn(0L);
        Mockito.when(volumeDao.findById(301L)).thenReturn(primaryRoot);

        vmDetails.put("101:ftctl.dr.peer.site.type", "remote-mold");
        vmDetails.put("101:ftctl.provisioning.backend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        vmDetails.put("101:ftctl.provisioning.state", FtctlProtectionProvisioningService.STATE_READY);
        vmDetails.put("101:ftctl.dr.remote.replica.vm.id", "remote-vm-uuid");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.name", "dr-w22-01-standby");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.state", "Stopped");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.host.id", "3");
        vmDetails.put("101:ftctl.dr.remote.replica.vm.host.name", "ablecube32-1");
        vmDetails.put("101:ftctl.dr.remote.replica.volume.301.id", "remote-root-volume-uuid");
        vmDetails.put("101:ftctl.dr.remote.replica.volume.301.name", "dr-w22-01-standby-root");
        vmDetails.put("101:ftctl.dr.remote.replica.volume.301.path", "/dev/rbd/rbd/remote-root");
        vmDetails.put("101:ftctl.dr.remote.replica.volume.301.state", "Ready");

        GetFtctlProtectionCmd cmd = new GetFtctlProtectionCmd();
        setField(cmd, "virtualMachineId", 101L);

        FtctlProtectionResponse response = ftctlService.getFtctlProtection(cmd);

        Assert.assertEquals("remote-vm-uuid", getFieldValue(response, "secondaryVirtualMachineUuid"));
        Assert.assertEquals("dr-w22-01-standby", getFieldValue(response, "secondaryVirtualMachineDisplayName"));
        Assert.assertEquals("Stopped", getFieldValue(response, "secondaryVirtualMachineState"));
        Assert.assertEquals(Long.valueOf(3L), getFieldValue(response, "secondaryVirtualMachineHostId"));
        Assert.assertEquals("ablecube32-1", getFieldValue(response, "secondaryVirtualMachineHostName"));
        List<?> secondaryVolumes = (List<?>) getFieldValue(response, "secondaryVolumes");
        Assert.assertEquals(1, secondaryVolumes.size());
        Assert.assertEquals("remote-root-volume-uuid", getFieldValue(secondaryVolumes.get(0), "id"));
        Assert.assertEquals("Ready", getFieldValue(secondaryVolumes.get(0), "state"));
    }

    @Test
    public void testGetFtctlProtectionProjectsRemoteMoldStandbyVmWithoutLocalProtectionRow() throws Exception {
        UserVmVO standbyVm = Mockito.mock(UserVmVO.class);
        Mockito.when(standbyVm.getId()).thenReturn(451L);
        Mockito.when(standbyVm.getUuid()).thenReturn("remote-standby-vm-uuid");
        Mockito.when(standbyVm.getInstanceName()).thenReturn("i-2-21-VM");
        Mockito.lenient().when(standbyVm.getDisplayName()).thenReturn("dr-w22-01-standby");
        Mockito.lenient().when(standbyVm.getHostName()).thenReturn("dr-w22-01-standby");
        Mockito.when(standbyVm.getState()).thenReturn(VirtualMachine.State.Stopped);
        Mockito.when(standbyVm.getHostId()).thenReturn(null);
        Mockito.when(standbyVm.getLastHostId()).thenReturn(301L);
        Mockito.when(userVmDao.findById(451L)).thenReturn(standbyVm);

        HostVO host = Mockito.mock(HostVO.class);
        Mockito.when(host.getName()).thenReturn("ablecube32-1");
        Mockito.when(hostDao.findById(301L)).thenReturn(host);

        vmDetails.put("451:ftctl.remote.replica.vm", "true");
        vmDetails.put("451:ftctl.standby.vm", "true");
        vmDetails.put("451:ftctl.remote.source.vm.uuid", "source-vm-uuid");
        vmDetails.put("451:ftctl.remote.source.vm.name", "dr-w22-01");
        vmDetails.put("451:ftctl.remote.source.vm.instance.name", "i-2-381-VM");

        VolumeVO rootVolume = Mockito.mock(VolumeVO.class);
        Mockito.when(rootVolume.getId()).thenReturn(551L);
        Mockito.when(rootVolume.getUuid()).thenReturn("remote-root-volume-uuid");
        Mockito.when(rootVolume.getName()).thenReturn("dr-w22-01-standby-root");
        Mockito.when(rootVolume.getPath()).thenReturn("/dev/rbd/rbd/remote-root");
        Mockito.when(rootVolume.getVolumeType()).thenReturn(Volume.Type.ROOT);
        Mockito.when(rootVolume.getDeviceId()).thenReturn(0L);
        Mockito.when(rootVolume.getState()).thenReturn(Volume.State.Ready);
        Mockito.when(rootVolume.getRemoved()).thenReturn(null);

        VolumeVO dataVolume = Mockito.mock(VolumeVO.class);
        Mockito.when(dataVolume.getId()).thenReturn(552L);
        Mockito.when(dataVolume.getUuid()).thenReturn("remote-data-volume-uuid");
        Mockito.when(dataVolume.getName()).thenReturn("dr-w22-01-standby-data-1");
        Mockito.when(dataVolume.getPath()).thenReturn("/dev/rbd/rbd/remote-data");
        Mockito.when(dataVolume.getVolumeType()).thenReturn(Volume.Type.DATADISK);
        Mockito.when(dataVolume.getDeviceId()).thenReturn(1L);
        Mockito.when(dataVolume.getState()).thenReturn(Volume.State.Ready);
        Mockito.when(dataVolume.getRemoved()).thenReturn(null);
        Mockito.when(volumeDao.findByInstance(451L)).thenReturn(List.of(rootVolume, dataVolume));

        GetFtctlProtectionCmd protectionCmd = new GetFtctlProtectionCmd();
        setField(protectionCmd, "virtualMachineId", 451L);

        FtctlProtectionResponse protectionResponse = ftctlService.getFtctlProtection(protectionCmd);

        Assert.assertEquals(Long.valueOf(451L), getFieldValue(protectionResponse, "virtualMachineId"));
        Assert.assertEquals("standby", getFieldValue(protectionResponse, "protectionRole"));
        Assert.assertEquals("source-vm-uuid", getFieldValue(protectionResponse, "primaryVirtualMachineUuid"));
        Assert.assertEquals("dr-w22-01", getFieldValue(protectionResponse, "primaryVirtualMachineName"));
        Assert.assertEquals(Long.valueOf(451L), getFieldValue(protectionResponse, "secondaryVirtualMachineId"));
        Assert.assertEquals("remote-standby-vm-uuid", getFieldValue(protectionResponse, "secondaryVirtualMachineUuid"));
        Assert.assertEquals("dr-w22-01-standby", getFieldValue(protectionResponse, "secondaryVirtualMachineDisplayName"));
        Assert.assertEquals("Stopped", getFieldValue(protectionResponse, "secondaryVirtualMachineState"));
        Assert.assertEquals(Long.valueOf(301L), getFieldValue(protectionResponse, "secondaryVirtualMachineHostId"));
        Assert.assertEquals("ablecube32-1", getFieldValue(protectionResponse, "secondaryVirtualMachineHostName"));
        Assert.assertEquals("true", getFieldValue(protectionResponse, "enabled"));
        Assert.assertEquals("dr", getFieldValue(protectionResponse, "mode"));
        Assert.assertEquals("remote-nbd", getFieldValue(protectionResponse, "backendMode"));
        Assert.assertEquals(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED, getFieldValue(protectionResponse, "provisioningBackend"));
        Assert.assertEquals(FtctlProtectionProvisioningService.STATE_READY, getFieldValue(protectionResponse, "provisioningState"));
        Assert.assertEquals("protected", getFieldValue(protectionResponse, "protectionState"));
        Assert.assertEquals("not_available", getFieldValue(protectionResponse, "transportState"));
        Assert.assertEquals("primary", getFieldValue(protectionResponse, "activeSide"));
        Assert.assertEquals("read-only", getFieldValue(protectionResponse, "adminState"));
        List<?> secondaryVolumes = (List<?>) getFieldValue(protectionResponse, "secondaryVolumes");
        Assert.assertEquals(2, secondaryVolumes.size());
        Assert.assertEquals("remote-root-volume-uuid", getFieldValue(secondaryVolumes.get(0), "id"));
        Assert.assertEquals("Ready", getFieldValue(secondaryVolumes.get(0), "state"));

        GetFtctlCheckCmd checkCmd = new GetFtctlCheckCmd();
        setField(checkCmd, "virtualMachineId", 451L);
        FtctlCheckResponse checkResponse = ftctlService.getFtctlCheck(checkCmd);
        Assert.assertEquals("not_available", getFieldValue(checkResponse, "result"));
        Assert.assertEquals(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED, getFieldValue(checkResponse, "provisioningBackend"));

        GetFtctlHealthCmd healthCmd = new GetFtctlHealthCmd();
        setField(healthCmd, "virtualMachineId", 451L);
        FtctlHealthResponse healthResponse = ftctlService.getFtctlHealth(healthCmd);
        Assert.assertEquals("not_available", getFieldValue(healthResponse, "result"));
        Assert.assertEquals(Long.valueOf(301L), getFieldValue(healthResponse, "hostId"));

        GetFtctlEventsCmd eventsCmd = new GetFtctlEventsCmd();
        setField(eventsCmd, "virtualMachineId", 451L);
        setField(eventsCmd, "limit", 100);
        FtctlEventsResponse eventsResponse = ftctlService.getFtctlEvents(eventsCmd);
        Assert.assertEquals("not_available", eventsResponse.getResult());
        Assert.assertEquals(Integer.valueOf(0), eventsResponse.getCount());
        Assert.assertTrue(eventsResponse.getEvents().isEmpty());
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
        Mockito.verify(ftctlProtectionDao, Mockito.never()).update(Mockito.anyLong(), Mockito.any(FtctlProtectionVO.class));
    }

    @Test
    public void testReadOnlyRuntimeApisForStandbyVmUsePrimaryRuntimeProfile() throws Exception {
        UserVmVO standbyVm = Mockito.mock(UserVmVO.class);
        Mockito.when(standbyVm.getId()).thenReturn(401L);
        Mockito.when(userVmDao.findById(401L)).thenReturn(standbyVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        protection.setSecondaryVmName("i-2-401-VM");
        protection.setActiveSide("secondary");
        protection.setProvisioningBackend(FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        Mockito.when(ftctlProtectionDao.findActiveBySecondaryVmId(401L)).thenReturn(protection);

        vmDetails.put("101:ftctl.check.result", "ok");
        vmDetails.put("101:ftctl.check.inventory.result", "healthy");
        vmDetails.put("101:ftctl.health.result", "ok");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class)))
                .thenReturn(new FtctlEventsAnswer(new FtctlEventsCommand("vm-name", 20), true, "OK",
                        "ok", "vm-name", 1,
                        "[{\"ts\":\"2026-05-10T00:00:01+09:00\",\"vm\":\"vm-name\",\"stage\":\"runtime\",\"event\":\"failover.start\",\"result\":\"ok\",\"details\":{\"message\":\"FTCTL failover precheck completed\"}}]"));

        GetFtctlCheckCmd checkCmd = new GetFtctlCheckCmd();
        setField(checkCmd, "virtualMachineId", 401L);
        FtctlCheckResponse checkResponse = ftctlService.getFtctlCheck(checkCmd);

        GetFtctlHealthCmd healthCmd = new GetFtctlHealthCmd();
        setField(healthCmd, "virtualMachineId", 401L);
        FtctlHealthResponse healthResponse = ftctlService.getFtctlHealth(healthCmd);

        GetFtctlEventsCmd eventsCmd = new GetFtctlEventsCmd();
        setField(eventsCmd, "virtualMachineId", 401L);
        setField(eventsCmd, "limit", 20);
        FtctlEventsResponse eventsResponse = ftctlService.getFtctlEvents(eventsCmd);

        Assert.assertEquals(Long.valueOf(401L), getFieldValue(checkResponse, "virtualMachineId"));
        Assert.assertEquals("vm-name", getFieldValue(checkResponse, "vmName"));
        Assert.assertEquals("ok", getFieldValue(checkResponse, "result"));
        Assert.assertEquals(Long.valueOf(401L), getFieldValue(healthResponse, "virtualMachineId"));
        Assert.assertEquals(Long.valueOf(201L), getFieldValue(healthResponse, "hostId"));
        Assert.assertEquals("ok", getFieldValue(healthResponse, "result"));
        Assert.assertEquals(Long.valueOf(401L), eventsResponse.getVirtualMachineId());
        Assert.assertEquals("vm-name", eventsResponse.getVmName());
        Assert.assertEquals(Integer.valueOf(1), eventsResponse.getCount());
        Assert.assertEquals("failover.start", eventsResponse.getEvents().get(0).getEvent());
        Mockito.verify(agentManager, Mockito.times(3)).send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class));
    }

    @Test
    public void testExecuteFtctlActionRejectsStandbyVm() {
        UserVmVO standbyVm = Mockito.mock(UserVmVO.class);
        Mockito.when(standbyVm.getId()).thenReturn(401L);
        Mockito.when(standbyVm.getUuid()).thenReturn("standby-vm-uuid");
        Mockito.when(userVmDao.findById(401L)).thenReturn(standbyVm);

        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        protection.setSecondaryVmId(401L);
        Mockito.when(ftctlProtectionDao.findActiveBySecondaryVmId(401L)).thenReturn(protection);

        try {
            ftctlService.executeFtctlAction(401L, FtctlActionCommand.Action.PAUSE_PROTECTION, false);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("managed from primary VM"));
        }
        try {
            Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
        } catch (AgentUnavailableException | OperationTimedoutException e) {
            throw new AssertionError(e);
        }
    }

    @Test
    public void testRegisterFtctlProtectionSyncsContextAndProtectsVm() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        hostDetails.put("201:ftctl.management.ip", "192.168.0.11");
        hostDetails.put("202:ftctl.libvirt.uri", "qemu+ssh://peer-ft/system");

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), true, "OK", "ok", 0, "profile-synced");
        FtctlActionCommand protectCommand = new FtctlActionCommand(FtctlActionCommand.Action.PROTECT_START, "vm-name");
        FtctlActionAnswer protectAnswer = new FtctlActionAnswer(protectCommand, true, "OK",
                FtctlActionCommand.Action.PROTECT_START, "accepted", 0, "protection job accepted");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "protected", "replicating", "primary", "running", "clear", "",
                "2026-04-18T18:10:00+09:00", 0, 0);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer)
                .thenReturn(protectAnswer)
                .thenReturn(statusAnswer);

        FtctlProtectionResponse response = ftctlService.registerFtctlProtection(cmd);

        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(4)).send(Mockito.eq(201L), commandCaptor.capture());
        List<Command> commands = commandCaptor.getAllValues();
        Assert.assertEquals(4, commands.size());
        Assert.assertTrue(commands.get(0) instanceof FtctlSyncClusterCommand);
        Assert.assertTrue(commands.get(1) instanceof FtctlSyncProfileCommand);
        Assert.assertTrue(commands.get(2) instanceof FtctlActionCommand);
        Assert.assertTrue(commands.get(3) instanceof FtctlStatusCommand);

        FtctlSyncClusterCommand clusterCommand = (FtctlSyncClusterCommand) commands.get(0);
        Assert.assertEquals("cluster-301", clusterCommand.getClusterName());
        Assert.assertEquals("201", clusterCommand.getLocalHostId());
        Assert.assertEquals("primary", clusterCommand.getLocalRole());
        Assert.assertEquals("192.168.0.11", clusterCommand.getLocalManagementIp());
        Assert.assertEquals("qemu+ssh://10.0.0.11/system", clusterCommand.getLocalLibvirtUri());
        Assert.assertEquals("202", clusterCommand.getPeerHostId());
        Assert.assertEquals("secondary", clusterCommand.getPeerRole());
        Assert.assertEquals("qemu+ssh://peer-ft/system", clusterCommand.getPeerLibvirtUri());

        FtctlSyncProfileCommand profileCommand = (FtctlSyncProfileCommand) commands.get(1);
        Assert.assertEquals("vm-name", profileCommand.getVmName());
        Assert.assertEquals("dr", profileCommand.getMode());
        Assert.assertEquals("qemu+ssh://peer-ft/system", profileCommand.getPeerUri());
        Assert.assertEquals("vm-uuid", profileCommand.getProfileName());
        Assert.assertEquals("remote-nbd", profileCommand.getBackendMode());
        Assert.assertEquals("libvirt-managed", profileCommand.getProvisioningBackend());
        Assert.assertEquals("Ready", profileCommand.getProvisioningState());
        Assert.assertEquals("secondary-local", profileCommand.getTargetStorageScope());
        Assert.assertEquals("pool-uuid", profileCommand.getTargetStoragePoolId());
        Assert.assertEquals("pool-name", profileCommand.getTargetStoragePoolName());
        Assert.assertEquals("vm-name-secondary", profileCommand.getSecondaryVmName());
        Assert.assertEquals("manual-block", profileCommand.getFencingPolicy());
        Assert.assertEquals("/data/secondary", profileCommand.getSecondaryTargetDir());
        Assert.assertEquals("10.0.0.12:10809", profileCommand.getRemoteNbdExportAddr());

        FtctlActionCommand capturedProtectCommand = (FtctlActionCommand) commands.get(2);
        Assert.assertEquals(FtctlActionCommand.Action.PROTECT_START, capturedProtectCommand.getAction());
        Assert.assertEquals("vm-name", capturedProtectCommand.getVmName());
        Assert.assertEquals("dr", capturedProtectCommand.getMode());
        Assert.assertEquals("qemu+ssh://peer-ft/system", capturedProtectCommand.getPeerUri());
        Assert.assertEquals("remote-nbd", capturedProtectCommand.getContextParam("ftctl.backend.mode"));
        Assert.assertEquals("libvirt-managed", capturedProtectCommand.getContextParam("ftctl.provisioning.backend"));
        Assert.assertEquals("manual-block", capturedProtectCommand.getContextParam("ftctl.fencing.policy"));

        Assert.assertEquals(Long.valueOf(101L), getFieldValue(response, "virtualMachineId"));
        Assert.assertEquals("true", getFieldValue(response, "enabled"));
        Assert.assertEquals("dr", getFieldValue(response, "mode"));
        Assert.assertEquals("remote-nbd", getFieldValue(response, "backendMode"));
        Assert.assertEquals("libvirt-managed", getFieldValue(response, "provisioningBackend"));
        Assert.assertEquals("Ready", getFieldValue(response, "provisioningState"));
        Assert.assertEquals("pool-uuid", getFieldValue(response, "targetStoragePoolId"));
        Assert.assertEquals("pool-name", getFieldValue(response, "targetStoragePoolName"));
        Assert.assertEquals("202", getFieldValue(response, "peerHostId"));
        Assert.assertEquals("host-202", getFieldValue(response, "peerHostName"));
        Assert.assertEquals("Running", getFieldValue(response, "primaryVirtualMachineState"));
        Assert.assertEquals(Long.valueOf(201L), getFieldValue(response, "primaryVirtualMachineHostId"));
        Assert.assertEquals("host-201", getFieldValue(response, "primaryVirtualMachineHostName"));
        Assert.assertEquals("protected", getFieldValue(response, "protectionState"));
        Assert.assertEquals("replicating", getFieldValue(response, "transportState"));
        Assert.assertEquals("primary", getFieldValue(response, "activeSide"));
        Mockito.verify(ftctlProtectionDao).update(Mockito.eq(0L), Mockito.any(FtctlProtectionVO.class));
        Assert.assertEquals("dr", protection.getMode());
        Assert.assertEquals("protected", protection.getProtectionState());
        Assert.assertEquals("replicating", protection.getTransportState());
        Assert.assertEquals("primary", protection.getActiveSide());

        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.enabled", "true", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.backend.mode", "remote-nbd", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.provisioning.backend", "libvirt-managed", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.provisioning.state", "Ready", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.target.storage.pool.id", "pool-uuid", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.target.storage.pool.name", "pool-name", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.peer.host.id", "202", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.protection.state", "protected", true);
    }

    @Test
    public void testRegisterCloudManagedRemoteNbdRejectsRelativeDiskMap() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        setField(cmd, "networkIds", "network-uuid");
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        Mockito.doReturn(new FtctlProtectionProvisioningContext(
                FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED,
                FtctlProtectionProvisioningService.STATE_READY,
                "i-2-401-VM",
                "sda=relative-target.qcow2"))
                .when(ftctlProtectionProvisioningService).prepareProtection(Mockito.any());

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("absolute Cloud-managed path"));
        }
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
    }

    @Test
    public void testRegisterFtCloudManagedAppliesLifecycleGuardAndRestoresOnFailure() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "mode", "ft");
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        setField(cmd, "xcoloPortAllocationMode", "manual");
        setField(cmd, "xcoloProxyEndpoint", "tcp:10.0.0.11:9001");
        setField(cmd, "xcoloNbdEndpoint", "tcp:10.0.0.12:10809");
        setField(cmd, "xcoloMigrateUri", "tcp:10.0.0.12:9000");
        vmDetails.put("101:" + VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-i440fx-9.2");
        Mockito.when(userVm.isHaEnabled()).thenReturn(true);
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        Mockito.doReturn(new FtctlProtectionProvisioningContext(
                FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED,
                FtctlProtectionProvisioningService.STATE_READY,
                "i-2-401-VM",
                "sda=/var/lib/libvirt/images/standby-root.qcow2"))
                .when(ftctlProtectionProvisioningService).prepareProtection(Mockito.any());

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), true, "OK", "ok", 0, "profile-synced");
        FtctlActionAnswer protectAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.PROTECT_START, "vm-name"), false, "runtime validation failed",
                FtctlActionCommand.Action.PROTECT_START, "runtime validation failed", 1, "runtime validation failed");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer)
                .thenReturn(protectAnswer);

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertNotNull(e.getMessage());
        }

        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.lifecycle.guard", "ft-cloud-managed-protecting", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.lifecycle.guard.original.ha.enabled", "true", true);
        Mockito.verify(vmInstanceDetailsDao, Mockito.atLeastOnce()).removeDetail(101L, "ftctl.lifecycle.guard");
        Mockito.verify(vmInstanceDetailsDao, Mockito.atLeastOnce()).removeDetail(101L, "ftctl.lifecycle.guard.original.ha.enabled");
        Mockito.verify(userVmDao, Mockito.atLeastOnce()).update(Mockito.eq(101L), Mockito.any(UserVmVO.class));
        Assert.assertNull(vmDetails.get("101:ftctl.lifecycle.guard"));
    }

    @Test
    public void testRegisterFtProtectionRejectsMissingMachineContractBeforeProvisioning() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "mode", "ft");
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        setField(cmd, "xcoloPortAllocationMode", "manual");
        setField(cmd, "xcoloProxyEndpoint", "tcp:10.0.0.11:9001");
        setField(cmd, "xcoloNbdEndpoint", "tcp:10.0.0.12:10809");
        setField(cmd, "xcoloMigrateUri", "tcp:10.0.0.12:9000");

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("ft_unsupported_machine_type"));
            Assert.assertTrue(e.getMessage().contains("FT compatibility"));
        }

        Mockito.verify(ftctlProtectionProvisioningService, Mockito.never()).prepareProtection(Mockito.any());
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
    }

    @Test
    public void testRegisterFtProtectionRejectsQ35MachineContractBeforeProvisioning() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "mode", "ft");
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        setField(cmd, "xcoloPortAllocationMode", "manual");
        setField(cmd, "xcoloProxyEndpoint", "tcp:10.0.0.11:9001");
        setField(cmd, "xcoloNbdEndpoint", "tcp:10.0.0.12:10809");
        setField(cmd, "xcoloMigrateUri", "tcp:10.0.0.12:9000");
        vmDetails.put("101:" + VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-9.2");

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("ft_unsupported_machine_type"));
            Assert.assertTrue(e.getMessage().contains("pc-q35-9.2"));
        }

        Mockito.verify(ftctlProtectionProvisioningService, Mockito.never()).prepareProtection(Mockito.any());
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
    }

    @Test
    public void testParseRemoteReplicaResourcesAcceptsFlatPayload() {
        Object resources = parseRemoteReplicaResources("{" +
                "\"prepareftctldrreplicaresourcesresponse\":{" +
                "\"remotevirtualmachineid\":\"remote-vm-uuid\"," +
                "\"remotevirtualmachinename\":\"dr-w22-01-standby\"," +
                "\"remotevirtualmachineinstancename\":\"i-2-16-VM\"," +
                "\"remotevirtualmachinestate\":\"Stopped\"," +
                "\"remotevirtualmachinehostid\":\"3\"," +
                "\"remotevirtualmachinehostname\":\"ablecube32-1\"," +
                "\"diskmap\":\"sda=rbd/root;sdb=rbd/data\"," +
                "\"volume\":[" +
                "{\"id\":\"root-volume-uuid\",\"name\":\"root\",\"path\":\"rbd/root\",\"state\":\"Ready\",\"disklabel\":\"root-0\",\"sourcevolumeid\":\"479\",\"sourcedisktarget\":\"sda\"}," +
                "{\"id\":\"data-volume-uuid\",\"name\":\"data\",\"path\":\"rbd/data\",\"state\":\"Ready\",\"disklabel\":\"data-1\",\"sourcevolumeid\":\"480\",\"sourcedisktarget\":\"sdb\"}" +
                "]" +
                "}" +
                "}");

        Assert.assertEquals("remote-vm-uuid", getFieldValue(resources, "vmId"));
        Assert.assertEquals("dr-w22-01-standby", getFieldValue(resources, "name"));
        Assert.assertEquals("i-2-16-VM", getFieldValue(resources, "instanceName"));
        Assert.assertEquals("Stopped", getFieldValue(resources, "state"));
        Assert.assertEquals("3", getFieldValue(resources, "hostId"));
        Assert.assertEquals("ablecube32-1", getFieldValue(resources, "hostName"));
        Assert.assertEquals("sda=rbd/root;sdb=rbd/data", getFieldValue(resources, "diskMap"));
        List<?> volumes = (List<?>) getFieldValue(resources, "volumes");
        Assert.assertEquals(2, volumes.size());
        Assert.assertEquals("479", getFieldValue(volumes.get(0), "sourceVolumeId"));
        Assert.assertEquals("rbd/root", getFieldValue(volumes.get(0), "path"));
        Assert.assertEquals("Ready", getFieldValue(volumes.get(0), "state"));
    }

    @Test
    public void testParseRemoteReplicaResourcesAcceptsNestedPayloadAndRebuildsDiskMap() {
        Object resources = parseRemoteReplicaResources("{" +
                "\"prepareftctldrreplicaresourcesresponse\":{" +
                "\"ftctldrreplicaresources\":{" +
                "\"remotevirtualmachineid\":\"remote-vm-uuid\"," +
                "\"remotevirtualmachinename\":\"dr-w22-01-standby\"," +
                "\"remotevirtualmachineinstancename\":\"i-2-16-VM\"," +
                "\"remotevirtualmachinestate\":\"Stopped\"," +
                "\"remotevirtualmachinehostid\":\"3\"," +
                "\"remotevirtualmachinehostname\":\"ablecube32-1\"," +
                "\"volume\":[" +
                "{\"ftctldrreplicavolume\":{\"id\":\"root-volume-uuid\",\"name\":\"root\",\"path\":\"rbd/root\",\"state\":\"Ready\",\"disklabel\":\"root-0\",\"sourcevolumeid\":\"479\",\"sourcedisktarget\":\"sda\"}}," +
                "{\"ftctldrreplicavolume\":{\"id\":\"data-volume-uuid\",\"name\":\"data\",\"path\":\"rbd/data\",\"state\":\"Ready\",\"disklabel\":\"data-1\",\"sourcevolumeid\":\"480\",\"sourcedisktarget\":\"sdb\"}}" +
                "]" +
                "}" +
                "}" +
                "}");

        Assert.assertEquals("remote-vm-uuid", getFieldValue(resources, "vmId"));
        Assert.assertEquals("Stopped", getFieldValue(resources, "state"));
        Assert.assertEquals("ablecube32-1", getFieldValue(resources, "hostName"));
        Assert.assertEquals("sda=rbd/root;sdb=rbd/data", getFieldValue(resources, "diskMap"));
        List<?> volumes = (List<?>) getFieldValue(resources, "volumes");
        Assert.assertEquals(2, volumes.size());
        Assert.assertEquals("root-volume-uuid", getFieldValue(volumes.get(0), "id"));
        Assert.assertEquals("sda", getFieldValue(volumes.get(0), "sourceDiskTarget"));
        Assert.assertEquals("rbd/data", getFieldValue(volumes.get(1), "path"));
        Assert.assertEquals("Ready", getFieldValue(volumes.get(1), "state"));
    }

    @Test
    public void testParseRemoteReplicaResourcesRejectsIncompleteVolumeMetadata() {
        try {
            parseRemoteReplicaResources("{" +
                    "\"prepareftctldrreplicaresourcesresponse\":{" +
                    "\"ftctldrreplicaresources\":{" +
                    "\"remotevirtualmachineid\":\"remote-vm-uuid\"," +
                    "\"diskmap\":\"sda=rbd/root\"," +
                    "\"volume\":[{\"ftctldrreplicavolume\":{\"id\":\"root-volume-uuid\",\"sourcevolumeid\":\"479\",\"sourcedisktarget\":\"sda\"}}]" +
                    "}" +
                    "}" +
                    "}");
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("incomplete FTCTL DR replica volume metadata"));
        }
    }

    @Test
    public void testRegisterFtctlProtectionNormalizesHostStorageToRemoteNbd() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "mode", "ha");
        setField(cmd, "backendMode", "shared-blockcopy");
        setField(cmd, "secondaryTargetDir", null);
        setField(cmd, "remoteNbdExportAddr", null);
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), true, "OK", "ok", 0, "profile-synced");
        FtctlActionCommand protectCommand = new FtctlActionCommand(FtctlActionCommand.Action.PROTECT_START, "vm-name");
        FtctlActionAnswer protectAnswer = new FtctlActionAnswer(protectCommand, true, "OK",
                FtctlActionCommand.Action.PROTECT_START, "accepted", 0, "protection job accepted");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ha", "protected", "replicating", "primary", "running", "clear", "",
                "2026-04-18T18:10:00+09:00", 0, 0);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer)
                .thenReturn(protectAnswer)
                .thenReturn(statusAnswer);

        ftctlService.registerFtctlProtection(cmd);

        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(4)).send(Mockito.eq(201L), commandCaptor.capture());
        FtctlSyncProfileCommand profileCommand = (FtctlSyncProfileCommand) commandCaptor.getAllValues().get(1);
        Assert.assertEquals("remote-nbd", profileCommand.getBackendMode());
        Assert.assertEquals("secondary-local", profileCommand.getTargetStorageScope());
        Assert.assertEquals("/var/lib/libvirt/images", profileCommand.getSecondaryTargetDir());
        Assert.assertEquals("10.0.0.12:10809", profileCommand.getRemoteNbdExportAddr());

        FtctlActionCommand capturedProtectCommand = (FtctlActionCommand) commandCaptor.getAllValues().get(2);
        Assert.assertEquals("remote-nbd", capturedProtectCommand.getContextParam("ftctl.backend.mode"));
        Assert.assertEquals("secondary-local", capturedProtectCommand.getContextParam("ftctl.target.storage.scope"));

        ArgumentCaptor<FtctlProtectionProvisioningRequest> requestCaptor = ArgumentCaptor.forClass(FtctlProtectionProvisioningRequest.class);
        Mockito.verify(ftctlProtectionProvisioningService).prepareProtection(requestCaptor.capture());
        Assert.assertEquals("remote-nbd", requestCaptor.getValue().getBackendMode());
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.backend.mode", "remote-nbd", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.secondary.target.dir", "/var/lib/libvirt/images", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.remote.nbd.export.addr", "10.0.0.12:10809", true);
    }

    @Test
    public void testRegisterFtCloudManagedClusterStorageDefaultsToRemoteNbd() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "mode", "ft");
        setField(cmd, "backendMode", null);
        setField(cmd, "targetStorageScope", "cluster");
        setField(cmd, "secondaryTargetDir", null);
        setField(cmd, "remoteNbdExportAddr", null);
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED);
        setField(cmd, "networkIds", "network-uuid");
        setField(cmd, "xcoloPortAllocationMode", "manual");
        setField(cmd, "xcoloProxyEndpoint", "tcp:10.0.0.12:9000");
        setField(cmd, "xcoloNbdEndpoint", "tcp:10.0.0.12:10809");
        setField(cmd, "xcoloMigrateUri", "tcp:10.0.0.12:9998");
        vmDetails.put("101:" + VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-i440fx-9.2");

        StoragePoolVO clusterPool = mockStoragePool();
        Mockito.when(clusterPool.getPath()).thenReturn("rbd");
        Mockito.when(primaryDataStoreDao.findById(501L)).thenReturn(clusterPool);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        Mockito.doReturn(new FtctlProtectionProvisioningContext(
                FtctlProtectionProvisioningService.BACKEND_CLOUD_MANAGED,
                FtctlProtectionProvisioningService.STATE_READY,
                "i-2-401-VM",
                "sda=/dev/rbd/rbd/standby-root"))
                .when(ftctlProtectionProvisioningService).prepareProtection(Mockito.any());

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), true, "OK", "ok", 0, "profile-synced");
        FtctlActionAnswer protectAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.PROTECT_START, "vm-name"), true, "OK",
                FtctlActionCommand.Action.PROTECT_START, "accepted", 0, "protection job accepted");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "ft", "protected", "replicating", "primary", "running", "clear", "",
                "2026-04-18T18:10:00+09:00", 0, 0);
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer)
                .thenReturn(protectAnswer)
                .thenReturn(statusAnswer);

        ftctlService.registerFtctlProtection(cmd);

        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(4)).send(Mockito.eq(201L), commandCaptor.capture());
        FtctlSyncProfileCommand profileCommand = (FtctlSyncProfileCommand) commandCaptor.getAllValues().get(1);
        Assert.assertEquals("remote-nbd", profileCommand.getBackendMode());
        Assert.assertEquals("secondary-local", profileCommand.getTargetStorageScope());
        Assert.assertEquals("rbd", profileCommand.getSecondaryTargetDir());
        Assert.assertEquals("10.0.0.12:10809", profileCommand.getRemoteNbdExportAddr());

        FtctlActionCommand capturedProtectCommand = (FtctlActionCommand) commandCaptor.getAllValues().get(2);
        Assert.assertEquals("remote-nbd", capturedProtectCommand.getContextParam("ftctl.backend.mode"));
        Assert.assertEquals("secondary-local", capturedProtectCommand.getContextParam("ftctl.target.storage.scope"));

        ArgumentCaptor<FtctlProtectionProvisioningRequest> requestCaptor = ArgumentCaptor.forClass(FtctlProtectionProvisioningRequest.class);
        Mockito.verify(ftctlProtectionProvisioningService).prepareProtection(requestCaptor.capture());
        Assert.assertEquals("remote-nbd", requestCaptor.getValue().getBackendMode());
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.backend.mode", "remote-nbd", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.target.storage.scope", "secondary-local", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.remote.nbd.export.addr", "10.0.0.12:10809", true);
    }

    @Test
    public void testRegisterFtctlProtectionPersistsFailureWhenProfileSyncFails() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        FtctlProtectionVO protection = new FtctlProtectionVO(101L);
        Mockito.when(ftctlProtectionDao.findActiveByPrimaryVmId(101L)).thenReturn(protection);

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), false, "ERROR", "profile failed", 2, "profile failed");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer);

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("FTCTL profile sync failed"));
        }

        Assert.assertEquals("error", protection.getProtectionState());
        Assert.assertEquals("failed", protection.getTransportState());
        Assert.assertEquals("primary", protection.getActiveSide());
        Assert.assertEquals("active", protection.getAdminState());
        Assert.assertEquals("clear", protection.getFencingState());
        Assert.assertTrue(protection.getLastError().contains("FTCTL profile sync failed"));
        Assert.assertEquals("error", vmDetails.get("101:ftctl.last.protection.state"));
        Assert.assertEquals("failed", vmDetails.get("101:ftctl.last.transport.state"));
        Assert.assertTrue(vmDetails.get("101:ftctl.last.error").contains("FTCTL profile sync failed"));
        Mockito.verify(ftctlProtectionDao).update(Mockito.eq(0L), Mockito.eq(protection));
    }

    @Test
    public void testRegisterFtctlProtectionDefaultsToCloudManagedBeforeAgentSyncWhenProvisioningIsNotReady() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "provisioningBackend", null);
        setField(cmd, "networkIds", "network-uuid");
        Mockito.doThrow(new CloudRuntimeException("not ready")).when(ftctlProtectionProvisioningService)
                .prepareProtection(Mockito.any(FtctlProtectionProvisioningRequest.class));

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertEquals("not ready", e.getMessage());
        }

        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.provisioning.backend", "cloud-managed", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.provisioning.state", "ProvisioningFailed", true);
        Mockito.verify(vmInstanceDetailsDao).addDetail(101L, "ftctl.last.error", "not ready", true);
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
    }

    @Test
    public void testRegisterFtctlProtectionWithIpmiFencingSyncsOobmProfileFields() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        setField(cmd, "fencingPolicy", "ipmi");
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);
        OutOfBandManagement localOobm = mockOobm("10.10.10.201", "623", "admin-a", "password-a");
        OutOfBandManagement peerOobm = mockOobm("10.10.10.202", "624", "admin-b", "password-b");
        Mockito.when(outOfBandManagementDao.findByHost(201L)).thenReturn(localOobm);
        Mockito.when(outOfBandManagementDao.findByHost(202L)).thenReturn(peerOobm);

        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(new FtctlSyncClusterCommand(), true, "OK", "ok", 0, "cluster-synced");
        FtctlSyncAnswer profileAnswer = new FtctlSyncAnswer(new FtctlSyncProfileCommand(), true, "OK", "ok", 0, "profile-synced");
        FtctlActionAnswer protectAnswer = new FtctlActionAnswer(new FtctlActionCommand(FtctlActionCommand.Action.PROTECT_START, "vm-name"), true, "OK",
                FtctlActionCommand.Action.PROTECT_START, "accepted", 0, "protection job accepted");
        FtctlStatusAnswer statusAnswer = new FtctlStatusAnswer(new FtctlStatusCommand("vm-name"), true, "OK", "ok", "vm-name",
                "dr", "protected", "replicating", "primary", "running", "clear", "",
                "2026-04-18T18:10:00+09:00", 0, 0);

        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class)))
                .thenReturn(clusterAnswer)
                .thenReturn(profileAnswer)
                .thenReturn(protectAnswer)
                .thenReturn(statusAnswer);

        ftctlService.registerFtctlProtection(cmd);

        ArgumentCaptor<Command> commandCaptor = ArgumentCaptor.forClass(Command.class);
        Mockito.verify(agentManager, Mockito.times(4)).send(Mockito.eq(201L), commandCaptor.capture());
        FtctlSyncProfileCommand profileCommand = (FtctlSyncProfileCommand) commandCaptor.getAllValues().get(1);
        Assert.assertEquals("10.10.10.201", profileCommand.getFencingIpmiPrimaryHost());
        Assert.assertEquals("623", profileCommand.getFencingIpmiPrimaryPort());
        Assert.assertEquals("admin-a", profileCommand.getFencingIpmiPrimaryUser());
        Assert.assertEquals("password-a", profileCommand.getFencingIpmiPrimaryPassword());
        Assert.assertEquals("lanplus", profileCommand.getFencingIpmiPrimaryInterface());
        Assert.assertEquals("10.10.10.202", profileCommand.getFencingIpmiSecondaryHost());
        Assert.assertEquals("624", profileCommand.getFencingIpmiSecondaryPort());
        Assert.assertEquals("admin-b", profileCommand.getFencingIpmiSecondaryUser());
        Assert.assertEquals("password-b", profileCommand.getFencingIpmiSecondaryPassword());
        Assert.assertEquals("lanplus", profileCommand.getFencingIpmiSecondaryInterface());
        Mockito.verify(vmInstanceDetailsDao, Mockito.never()).addDetail(Mockito.eq(101L), Mockito.contains("password"), Mockito.anyString(), Mockito.anyBoolean());
    }

    @Test(expected = CloudRuntimeException.class)
    public void testRegisterFtctlProtectionFailsWhenClusterSyncFails() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        HostVO localHost = mockHost(201L, 301L, "10.0.0.11");
        HostVO peerHost = mockHost(202L, 301L, "10.0.0.12");
        Mockito.when(hostDao.findById(201L)).thenReturn(localHost);
        Mockito.when(hostDao.findById(202L)).thenReturn(peerHost);

        FtctlSyncClusterCommand clusterCommand = new FtctlSyncClusterCommand();
        FtctlSyncAnswer clusterAnswer = new FtctlSyncAnswer(clusterCommand, false, "cluster failed", "error", 1, "sync failed");
        Mockito.when(agentManager.send(Mockito.eq(201L), Mockito.any(Command.class))).thenReturn(clusterAnswer);

        try {
            ftctlService.registerFtctlProtection(cmd);
        } finally {
            Mockito.verify(agentManager, Mockito.times(1)).send(Mockito.eq(201L), Mockito.any(Command.class));
        }
    }

    @Test
    public void testRegisterFtctlProtectionRejectsStoppedVmBeforeProvisioning() throws Exception {
        RegisterFtctlProtectionCmd cmd = buildRegisterCmd();
        Mockito.when(userVm.getState()).thenReturn(VirtualMachine.State.Stopped);

        try {
            ftctlService.registerFtctlProtection(cmd);
            Assert.fail("Expected CloudRuntimeException");
        } catch (CloudRuntimeException e) {
            Assert.assertTrue(e.getMessage().contains("requires VM vm-uuid to be Running"));
        }

        Mockito.verify(ftctlProtectionProvisioningService, Mockito.never()).prepareProtection(Mockito.any());
        Mockito.verify(vmInstanceDetailsDao, Mockito.never()).addDetail(Mockito.eq(101L), Mockito.startsWith("ftctl."), Mockito.anyString(), Mockito.anyBoolean());
        Mockito.verify(agentManager, Mockito.never()).send(Mockito.anyLong(), Mockito.any(Command.class));
    }

    @Test(expected = CloudRuntimeException.class)
    public void testGetFtctlEventsFailsWhenVmMissing() {
        GetFtctlEventsCmd cmd = new GetFtctlEventsCmd();
        setField(cmd, "virtualMachineId", 999L);
        Mockito.when(userVmDao.findById(999L)).thenReturn(null);
        ftctlService.getFtctlEvents(cmd);
    }

    @Test
    public void testGetFtctlEventsCallsAgent() throws Exception {
        GetFtctlEventsCmd cmd = new GetFtctlEventsCmd();
        setField(cmd, "virtualMachineId", 101L);
        FtctlEventsResponse response = ftctlService.getFtctlEvents(cmd);
        Assert.assertEquals(Integer.valueOf(0), response.getCount());
        Mockito.verify(agentManager).send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class));
    }

    @Test
    public void testGetFtctlHealthFallsBackWhenRuntimeEventsUnavailable() throws Exception {
        GetFtctlHealthCmd cmd = new GetFtctlHealthCmd();
        setField(cmd, "virtualMachineId", 101L);
        FtctlHealthResponse response = ftctlService.getFtctlHealth(cmd);
        Assert.assertEquals("not_available", getFieldValue(response, "result"));
        Mockito.verify(agentManager).send(Mockito.eq(201L), Mockito.any(FtctlEventsCommand.class));
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Unable to set field " + fieldName, e);
        }
    }

    private Object getFieldValue(Object target, String fieldName) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            return field.get(target);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Unable to read field " + fieldName, e);
        }
    }

    private Object parseRemoteReplicaResources(String jsonText) {
        try {
            Method method = FtctlServiceImpl.class.getDeclaredMethod("parseRemoteReplicaResources", JsonObject.class);
            method.setAccessible(true);
            return method.invoke(ftctlService, JsonParser.parseString(jsonText).getAsJsonObject());
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof CloudRuntimeException) {
                throw (CloudRuntimeException) cause;
            }
            throw new AssertionError("Unable to parse remote replica resources", cause);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Unable to invoke parseRemoteReplicaResources", e);
        }
    }

    private void invokeContinueCloudManagedFailbackAfterReverseSync(UserVmVO primaryVm, FtctlProtectionVO protection,
                                                                    Object targetContext, boolean operatorRequested) {
        try {
            Class<?> contextClass = Class.forName("com.cloud.ftctl.FtctlServiceImpl$FailbackTargetContext");
            Method method = FtctlServiceImpl.class.getDeclaredMethod("continueCloudManagedFailbackAfterReverseSync",
                    UserVmVO.class, FtctlProtectionVO.class, contextClass, boolean.class);
            method.setAccessible(true);
            method.invoke(ftctlService, primaryVm, protection, targetContext, operatorRequested);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof CloudRuntimeException) {
                throw (CloudRuntimeException) cause;
            }
            throw new AssertionError("Unable to continue cloud-managed failback", cause);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Unable to invoke continueCloudManagedFailbackAfterReverseSync", e);
        }
    }

    private RegisterFtctlProtectionCmd buildRegisterCmd() {
        RegisterFtctlProtectionCmd cmd = new RegisterFtctlProtectionCmd();
        setField(cmd, "virtualMachineId", 101L);
        setField(cmd, "mode", "dr");
        setField(cmd, "backendMode", "remote-nbd");
        setField(cmd, "targetStorageScope", "host");
        setField(cmd, "targetStoragePoolId", 501L);
        setField(cmd, "provisioningBackend", FtctlProtectionProvisioningService.BACKEND_LIBVIRT_MANAGED);
        setField(cmd, "fencingPolicy", "manual-block");
        setField(cmd, "peerHostId", 202L);
        setField(cmd, "secondaryVmName", "vm-name-secondary");
        setField(cmd, "secondaryTargetDir", "/data/secondary");
        setField(cmd, "remoteNbdExportAddr", "10.0.0.12:10809");
        StoragePoolVO storagePool = mockStoragePool();
        Mockito.lenient().when(primaryDataStoreDao.findById(501L)).thenReturn(storagePool);
        return cmd;
    }

    private StoragePoolVO mockStoragePool() {
        StoragePoolVO storagePool = Mockito.mock(StoragePoolVO.class);
        Mockito.when(storagePool.getUuid()).thenReturn("pool-uuid");
        Mockito.when(storagePool.getName()).thenReturn("pool-name");
        Mockito.when(storagePool.getDataCenterId()).thenReturn(401L);
        Mockito.when(storagePool.getScope()).thenReturn(ScopeType.HOST);
        Mockito.when(storagePool.getPath()).thenReturn("/var/lib/libvirt/images");
        return storagePool;
    }

    private NicVO nic(long id, long instanceId, long networkId, int deviceId, String macAddress, String ip4Address) {
        NicVO nic = new NicVO("DirectNetworkGuru", instanceId, networkId, VirtualMachine.Type.User);
        setField(nic, "id", id);
        nic.setDeviceId(deviceId);
        nic.setMacAddress(macAddress);
        nic.setIPv4Address(ip4Address);
        return nic;
    }

    private HostVO mockHost(Long id, Long clusterId, String privateIp) {
        HostVO host = Mockito.mock(HostVO.class);
        Mockito.when(host.getId()).thenReturn(id);
        Mockito.when(host.getName()).thenReturn(String.format("host-%s", id));
        Mockito.when(host.getClusterId()).thenReturn(clusterId);
        Mockito.when(host.getPrivateIpAddress()).thenReturn(privateIp);
        Mockito.when(host.getType()).thenReturn(Host.Type.Routing);
        Mockito.when(host.getHypervisorType()).thenReturn(HypervisorType.KVM);
        return host;
    }

    private OutOfBandManagement mockOobm(String address, String port, String username, String password) {
        OutOfBandManagement oobm = Mockito.mock(OutOfBandManagement.class);
        Mockito.when(oobm.isEnabled()).thenReturn(true);
        Mockito.when(oobm.getDriver()).thenReturn("ipmitool");
        Mockito.when(oobm.getAddress()).thenReturn(address);
        Mockito.when(oobm.getPort()).thenReturn(port);
        Mockito.when(oobm.getUsername()).thenReturn(username);
        Mockito.when(oobm.getPassword()).thenReturn(password);
        return oobm;
    }
}
