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
// specific language govening permissions and limitations
// under the License.

package org.apache.cloudstack.storage.sharedfs;

import com.cloud.agent.AgentManager;
import com.cloud.agent.api.SharedFSComputeAnswer;
import com.cloud.agent.api.SharedFSComputeCommand;
import com.cloud.agent.api.StorageServiceHostAnswer;
import com.cloud.agent.api.StorageServiceHostCommand;
import com.cloud.capacity.Capacity;
import com.cloud.capacity.CapacityManager;
import com.cloud.capacity.CapacityVO;
import com.cloud.capacity.dao.CapacityDao;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.host.HostVO;
import com.cloud.host.dao.HostDao;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.offering.ServiceOffering;
import com.cloud.service.ServiceOfferingVO;
import com.cloud.service.dao.ServiceOfferingDao;
import com.cloud.storage.Storage;
import com.cloud.storage.VMTemplateVO;
import com.cloud.storage.Volume;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.dao.VMTemplateDao;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.upgrade.dao.EuropaSharedFSComputeUpgrade;
import com.cloud.upgrade.dao.EuropaSharedFSDeletionUpgrade;
import com.cloud.upgrade.dao.EuropaStorageConfigurationUpgrade;
import com.cloud.user.AccountVO;
import com.cloud.user.AccountManager;
import com.cloud.user.ResourceLimitService;
import com.cloud.user.dao.AccountDao;
import com.cloud.utils.db.TransactionLegacy;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.UserVmManager;
import com.cloud.vm.UserVmVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.dao.UserVmDao;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mysql.cj.jdbc.MysqlDataSource;
import org.apache.cloudstack.api.command.user.storage.sharedfs.ChangeSharedFSServiceOfferingCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.jobs.AsyncJobExecutionContext;
import org.apache.cloudstack.storage.dataservice.StorageServiceInstanceVO;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceInstanceDaoImpl;
import org.apache.cloudstack.storage.dataservice.dao.StorageServiceRuntimeUpgradeDao;
import org.apache.cloudstack.storage.sharedfs.dao.SharedFSComputeOperationDaoImpl;
import org.apache.cloudstack.storage.sharedfs.dao.SharedFSDao;
import org.junit.Assume;
import org.junit.Test;
import org.mockito.MockedStatic;

import javax.sql.DataSource;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class SharedFSComputeReservationDaoTest {
    @Test
    public void newReservationIsPersistedAndTransitionsBeforeHostDispatch() throws Exception {
        String url = System.getProperty("configuration.dao.test.url");
        Assume.assumeTrue("Dedicated local database required", url != null);
        assertTrue(url.startsWith("jdbc:mysql://127.0.0.1:13344/cloud?"));
        MysqlDataSource datasource = new MysqlDataSource();
        datasource.setURL(url);
        datasource.setUser("root");
        datasource.setScrollTolerantForwardOnly(true);
        try (Connection connection = datasource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS resource_reservation (id BIGINT UNSIGNED NOT NULL PRIMARY KEY)");
            try (InputStream input = StorageServiceInstanceVO.class.getResourceAsStream("/META-INF/db/schema-europa-4.23-s4.sql")) {
                assertNotNull(input);
                String schema = new String(input.readAllBytes(), StandardCharsets.UTF_8);
                int start = schema.indexOf("CREATE TABLE IF NOT EXISTS `cloud`.`storage_service_instance`");
                assertTrue(start >= 0);
                String table = schema.substring(start, schema.indexOf(';', start));
                statement.execute(table.replace("  PRIMARY KEY", "  current_runtime_bundle_id BIGINT UNSIGNED NULL,\n"
                        + "  previous_runtime_bundle_id BIGINT UNSIGNED NULL,\n"
                        + "  runtime_state VARCHAR(32) NULL,\n"
                        + "  runtime_verified_at DATETIME NULL,\n  PRIMARY KEY"));
            }
            EuropaStorageConfigurationUpgrade.migrate(connection);
            EuropaSharedFSDeletionUpgrade.migrate(connection);
            EuropaSharedFSComputeUpgrade.migrate(connection);
        }

        Field field = TransactionLegacy.class.getDeclaredField("s_ds");
        field.setAccessible(true);
        DataSource previous = (DataSource) field.get(null);
        field.set(null, datasource);
        try (TransactionLegacy ignored = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
                MockedStatic<CallContext> calls = mockStatic(CallContext.class);
                MockedStatic<AsyncJobExecutionContext> jobs = mockStatic(AsyncJobExecutionContext.class)) {
            jobs.when(AsyncJobExecutionContext::getCurrentExecutionContext).thenReturn(null);
            CallContext call = mock(CallContext.class);
            AccountVO owner = mock(AccountVO.class);
            calls.when(CallContext::current).thenReturn(call);
            when(call.getCallingAccount()).thenReturn(owner);

            SharedFSComputeCoordinator coordinator = new SharedFSComputeCoordinator();
            SharedFSComputeOperationDaoImpl operations = spy(new SharedFSComputeOperationDaoImpl());
            coordinator.operations = operations;
            AtomicReference<String> submittedPlan = new AtomicReference<>();
            doAnswer(invocation -> {
                SharedFSComputeOperationVO operation = invocation.getArgument(0);
                submittedPlan.set(operation.getPlanJson());
                return invocation.callRealMethod();
            }).when(operations).persist(any(SharedFSComputeOperationVO.class));
            coordinator.sharedFiles = mock(SharedFSDao.class);
            coordinator.vms = mock(UserVmDao.class);
            coordinator.templates = mock(VMTemplateDao.class);
            coordinator.hosts = mock(HostDao.class);
            coordinator.volumes = mock(VolumeDao.class);
            coordinator.offerings = mock(ServiceOfferingDao.class);
            StorageServiceInstanceDaoImpl instances = spy(new StorageServiceInstanceDaoImpl());
            coordinator.instances = instances;
            coordinator.upgrades = mock(StorageServiceRuntimeUpgradeDao.class);
            coordinator.accounts = mock(AccountManager.class);
            coordinator.accountDao = mock(AccountDao.class);
            coordinator.zones = mock(DataCenterDao.class);
            coordinator.agents = mock(AgentManager.class);
            coordinator.limits = mock(ResourceLimitService.class);
            coordinator.capacityManager = mock(CapacityManager.class);
            coordinator.capacities = mock(CapacityDao.class);

            SharedFSVO fs = mock(SharedFSVO.class);
            UserVmVO vm = mock(UserVmVO.class);
            VMTemplateVO template = mock(VMTemplateVO.class);
            HostVO host = mock(HostVO.class);
            VolumeVO root = mock(VolumeVO.class);
            ServiceOfferingVO current = offering(51L, 2);
            ServiceOfferingVO target = offering(52L, 4);
            long vmId = UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE;
            StorageServiceInstanceVO fixture = new StorageServiceInstanceVO("compute-fixture", null, 1L, 2L, 9L, 51L, "fixture");
            fixture.setVmId(vmId);
            long instanceId = instances.persist(fixture).getId();
            AtomicReference<StorageServiceInstanceVO> lookupBeforeLock = new AtomicReference<>();
            doAnswer(invocation -> {
                StorageServiceInstanceVO loaded = (StorageServiceInstanceVO) invocation.callRealMethod();
                if (loaded.getActiveLifecycleOperationUuid() == null) {
                    lookupBeforeLock.set(loaded);
                }
                return loaded;
            }).when(instances).findByVmId(vmId);
            doAnswer(invocation -> {
                StorageServiceInstanceVO locked = (StorageServiceInstanceVO) invocation.callRealMethod();
                assertNotNull(lookupBeforeLock.get());
                assertNotSame(lookupBeforeLock.get(), locked);
                assertEquals(instanceId, locked.getId());
                assertNull(locked.getActiveLifecycleOperationUuid());
                return locked;
            }).when(instances).lockRow(instanceId, true);

            when(coordinator.sharedFiles.findById(11L)).thenReturn(fs);
            when(fs.getId()).thenReturn(11L);
            when(fs.getVmId()).thenReturn(vmId);
            when(fs.getAccountId()).thenReturn(2L);
            when(fs.getState()).thenReturn(SharedFS.State.Ready);
            when(fs.getServiceOfferingId()).thenReturn(51L);
            when(coordinator.vms.findById(vmId)).thenReturn(vm);
            when(vm.getId()).thenReturn(vmId);
            when(vm.getUuid()).thenReturn("compute-vm");
            when(vm.getInstanceName()).thenReturn("i-compute");
            when(vm.getUserVmType()).thenReturn(UserVmManager.SHAREDFSVM);
            when(vm.getState()).thenReturn(VirtualMachine.State.Running);
            when(vm.getHostId()).thenReturn(41L);
            when(vm.getTemplateId()).thenReturn(61L);
            when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
            when(vm.isDynamicallyScalable()).thenReturn(true);
            when(vm.getServiceOfferingId()).thenReturn(51L);
            when(coordinator.templates.findByIdIncludingRemoved(61L)).thenReturn(template);
            when(template.getUuid()).thenReturn("compute-template");
            when(template.isDynamicallyScalable()).thenReturn(true);
            when(template.getTemplateType()).thenReturn(Storage.TemplateType.SHAREDFS);
            when(coordinator.hosts.findById(41L)).thenReturn(host);
            when(host.getId()).thenReturn(41L);
            when(host.getClusterId()).thenReturn(9L);
            when(host.checkHostServiceOfferingAndTemplateTags(eq(target), eq(template), anySet())).thenReturn(true);
            when(coordinator.volumes.findByInstance(vmId)).thenReturn(List.of(root));
            when(root.getVolumeType()).thenReturn(Volume.Type.ROOT);
            when(root.getProvisioningType()).thenReturn(Storage.ProvisioningType.SPARSE);
            when(root.getUuid()).thenReturn("compute-root");
            when(root.getSize()).thenReturn(8L * 1024 * 1024 * 1024);
            when(coordinator.offerings.findByIdIncludingRemoved(vmId, 51L)).thenReturn(current);
            when(coordinator.offerings.findById(52L)).thenReturn(target);
            when(coordinator.accountDao.findById(2L)).thenReturn(owner);
            when(coordinator.capacityManager.checkIfHostHasCpuCapability(host, 4, 2000)).thenReturn(true);
            when(coordinator.capacityManager.getClusterOverProvisioningFactor(9L, Capacity.CAPACITY_TYPE_CPU)).thenReturn(1f);
            mockCapacity(coordinator, Capacity.CAPACITY_TYPE_CPU, 71L, 200000L);
            mockCapacity(coordinator, Capacity.CAPACITY_TYPE_CPU_CORE, 72L, 48L);

            String requestId = UUID.randomUUID().toString();
            JsonObject hostView = JsonParser.parseString("{\"cpus\":{"
                    + "\"0\":{\"qom-path\":\"/machine/unattached/device[0]\",\"type\":\"host-x86_64-cpu\",\"vcpus-count\":1,"
                    + "\"props\":{\"socket-id\":0,\"core-id\":0,\"thread-id\":0,\"node-id\":0}},"
                    + "\"1\":{\"qom-path\":\"/machine/unattached/device[2]\",\"type\":\"host-x86_64-cpu\",\"vcpus-count\":1,"
                    + "\"props\":{\"socket-id\":0,\"core-id\":1,\"thread-id\":0,\"node-id\":0}}},"
                    + "\"domainId\":4,\"diskFingerprint\":\"" + "b".repeat(64) + "\",\"dimms\":{},\"slots\":16,"
                    + "\"memoryKiB\":4194304,\"maxCpus\":48,\"maxMemoryKiB\":67108864}").getAsJsonObject();
            assertTrue(hostView.toString().length() > 255);
            AtomicBoolean reservedObserved = new AtomicBoolean();
            String guestView = "{\"success\":true,\"observation\":{\"vmUuid\":\"compute-vm\",\"bootId\":\"same-boot\","
                    + "\"profile\":\"kvm-x86-64-acpi-v1\",\"cpus\":{\"0\":{\"online\":true},\"1\":{\"online\":true}}}}";
            when(coordinator.agents.easySend(eq(41L), any(StorageServiceHostCommand.class))).thenAnswer(callInfo ->
                    new StorageServiceHostAnswer(callInfo.getArgument(1), true, null, guestView));
            when(coordinator.agents.easySend(eq(41L), any(SharedFSComputeCommand.class))).thenAnswer(callInfo -> {
                SharedFSComputeCommand command = callInfo.getArgument(1);
                SharedFSComputeOperationVO observed = operations.findByRequest(11L, requestId);
                if (command.getBefore() == null) {
                    if (observed != null) {
                        assertEquals("RESERVED", observed.getState());
                        assertEquals(submittedPlan.get(), observed.getPlanJson());
                        reservedObserved.set(true);
                    }
                    return new SharedFSComputeAnswer(command, hostView);
                }
                assertNotNull(observed);
                assertTrue(reservedObserved.get());
                assertEquals("HOST_APPLYING", observed.getState());
                assertNull(lookupBeforeLock.get().getActiveLifecycleOperationUuid());
                assertEquals(observed.getUuid(), instances.findByVmId(vmId).getActiveLifecycleOperationUuid());
                assertEquals(2L, observed.getCoreDelta());
                assertTrue(submittedPlan.get().length() > 255);
                assertEquals(submittedPlan.get(), observed.getPlanJson());
                assertEquals(hostView.toString(), observed.getObservedJson());
                assertEquals(hostView, command.getBefore());
                return new SharedFSComputeAnswer(command, "COMPUTE_HOST_TEST_STOP");
            });

            JsonObject plan = coordinator.status(11L, 52L, Map.of(), null);
            assertEquals("PLANNED", plan.get("state").getAsString());
            ChangeSharedFSServiceOfferingCmd command = mock(ChangeSharedFSServiceOfferingCmd.class);
            when(command.getId()).thenReturn(11L);
            when(command.getServiceOfferingId()).thenReturn(52L);
            when(command.getRequestId()).thenReturn(requestId);
            when(command.getPlanFingerprint()).thenReturn(plan.get("planfingerprint").getAsString());
            when(command.getPlanExpires()).thenReturn(plan.get("planexpires").getAsLong());
            when(command.getCustomComputeParameters()).thenReturn(Map.of());

            CloudRuntimeException expected = assertThrows(CloudRuntimeException.class, () -> coordinator.execute(command));
            assertTrue(expected.getMessage(), expected.getMessage().startsWith("COMPUTE_HOST_TEST_STOP"));
            SharedFSComputeOperationVO pending = coordinator.operations.findByRequest(11L, requestId);
            assertEquals("RECOVERY_REQUIRED", pending.getState());
            assertEquals("COMPUTE_HOST_TEST_STOP", pending.getFirstFailure());
            assertEquals(submittedPlan.get(), pending.getPlanJson());
            assertEquals(hostView.toString(), pending.getObservedJson());
            verify(coordinator.limits).reserveSharedFSCompute(owner, pending.getUuid(), 2L, 0L, current, target, template);
        } finally {
            field.set(null, previous);
        }
    }

    private static ServiceOfferingVO offering(long id, int cores) {
        ServiceOfferingVO offering = mock(ServiceOfferingVO.class);
        when(offering.getId()).thenReturn(id);
        when(offering.getUuid()).thenReturn("offering-" + id);
        when(offering.getCpu()).thenReturn(cores);
        when(offering.getRamSize()).thenReturn(4096);
        when(offering.getSpeed()).thenReturn(2000);
        when(offering.isDynamicScalingEnabled()).thenReturn(true);
        when(offering.isOfferHA()).thenReturn(true);
        when(offering.getState()).thenReturn(ServiceOffering.State.Active);
        return offering;
    }

    private static void mockCapacity(SharedFSComputeCoordinator coordinator, short type, long id, long total) {
        CapacityVO row = mock(CapacityVO.class);
        when(row.getId()).thenReturn(id);
        when(row.getTotalCapacity()).thenReturn(total);
        when(coordinator.capacities.findByHostIdType(41L, type)).thenReturn(row);
        when(coordinator.capacities.lockRow(id, true)).thenReturn(row);
        when(coordinator.capacities.update(id, row)).thenReturn(true);
    }
}
