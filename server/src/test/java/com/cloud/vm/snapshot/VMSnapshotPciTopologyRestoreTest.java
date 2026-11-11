// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.vm.snapshot;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.service.ServiceOfferingVO;
import com.cloud.service.dao.ServiceOfferingDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.db.TransactionCallbackWithExceptionNoReturn;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.PciTopologyProfile;
import com.cloud.vm.UserVmVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VmDetailConstants;
import com.cloud.vm.dao.UserVmDao;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.cloud.vm.snapshot.dao.VMSnapshotDao;
import com.cloud.vm.snapshot.dao.VMSnapshotDetailsDao;
import org.apache.cloudstack.backup.BackupSnapshotGuard;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.subsystem.api.storage.StorageStrategyFactory;
import org.apache.cloudstack.engine.subsystem.api.storage.VMSnapshotStrategy;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class VMSnapshotPciTopologyRestoreTest {
    private final VMSnapshotManagerImpl manager = new VMSnapshotManagerImpl();
    private final VMInstanceDetailsDao details = mock(VMInstanceDetailsDao.class);
    private final VMSnapshotDetailsDao snapshotDetails = mock(VMSnapshotDetailsDao.class);
    private final VMSnapshotStrategy strategy = mock(VMSnapshotStrategy.class);
    private final VMSnapshotVO snapshot = mock(VMSnapshotVO.class);
    private final UserVmVO vm = mock(UserVmVO.class);
    private final Map<String, String> stored = new HashMap<>();
    private Map<String, String> source;
    private MockedStatic<Transaction> transactions;

    @Before public void setup() {
        CallContext.register(mock(User.class), mock(Account.class));
        transactions = mockStatic(Transaction.class, call -> {
            Object callback = call.getArgument(0);
            if (callback instanceof TransactionCallback) return ((TransactionCallback<?>) callback).doInTransaction(null);
            if (callback instanceof TransactionCallbackWithExceptionNoReturn) {
                ((TransactionCallbackWithExceptionNoReturn<?>) callback).doInTransactionWithoutResult(null);
            }
            return null;
        });
        VMSnapshotDao snapshots = mock(VMSnapshotDao.class);
        when(snapshots.findById(2L)).thenReturn(snapshot);
        when(snapshot.getId()).thenReturn(2L);
        when(snapshot.getVmId()).thenReturn(77L);
        when(snapshot.getState()).thenReturn(VMSnapshot.State.Ready);
        when(snapshot.getType()).thenReturn(VMSnapshot.Type.Disk);
        when(snapshot.getServiceOfferingId()).thenReturn(1L);
        when(vm.getId()).thenReturn(77L);
        when(vm.getState()).thenReturn(VirtualMachine.State.Stopped);
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(vm.getServiceOfferingId()).thenReturn(1L);
        UserVmDao vms = mock(UserVmDao.class);
        when(vms.findById(77L)).thenReturn(vm);
        BackupSnapshotGuard guard = mock(BackupSnapshotGuard.class);
        when(guard.acquire(77L)).thenReturn(mock(BackupSnapshotGuard.Lease.class));
        StorageStrategyFactory strategies = mock(StorageStrategyFactory.class);
        when(strategies.getVmSnapshotStrategy(snapshot)).thenReturn(strategy);
        ServiceOfferingDao offerings = mock(ServiceOfferingDao.class);
        ServiceOfferingVO offering = mock(ServiceOfferingVO.class);
        when(offerings.findById(1L)).thenReturn(offering);
        when(offerings.findByIdIncludingRemoved(77L, 1L)).thenReturn(offering);
        ReflectionTestUtils.setField(manager, "_vmSnapshotDao", snapshots);
        ReflectionTestUtils.setField(manager, "_userVMDao", vms);
        ReflectionTestUtils.setField(manager, "backupSnapshotGuard", guard);
        ReflectionTestUtils.setField(manager, "backupDao", mock(BackupDao.class));
        ReflectionTestUtils.setField(manager, "_accountMgr", mock(AccountManager.class));
        ReflectionTestUtils.setField(manager, "storageStrategyFactory", strategies);
        ReflectionTestUtils.setField(manager, "_serviceOfferingDao", offerings);
        ReflectionTestUtils.setField(manager, "_vmInstanceDetailsDao", details);
        ReflectionTestUtils.setField(manager, "_vmSnapshotDetailsDao", snapshotDetails);
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of()));
        source = PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of(
                VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE, "pc-q35-rhel9.4.0"));
        when(snapshotDetails.listDetails(2L)).thenAnswer(call -> source.entrySet().stream()
                .map(entry -> new VMSnapshotDetailsVO(2L, entry.getKey(), entry.getValue(), false)).collect(Collectors.toList()));
        doAnswer(call -> { stored.put(call.getArgument(1), call.getArgument(2)); return null; })
                .when(details).addDetail(eq(77L), anyString(), anyString(), eq(false));
    }

    @After public void close() { transactions.close(); CallContext.unregister(); }

    private void revert() { ReflectionTestUtils.invokeMethod(manager, "orchestrateRevertToVMSnapshot", 2L); }

    @Test public void successfulRevertRestoresTheSnapshotPciProfileAfterTheDisks() {
        when(strategy.revertVMSnapshot(snapshot)).thenAnswer(call -> {
            assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
            return true;
        });
        revert();
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(stored));
        assertEquals("pc-q35-rhel9.4.0", stored.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
    }

    @Test public void unsuccessfulRevertRetainsTheCurrentProfile() {
        when(strategy.revertVMSnapshot(snapshot)).thenReturn(false);
        assertThrows(CloudRuntimeException.class, this::revert);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        verifyNoInteractions(details);
    }

    @Test public void committedDisksKeepTheirProfileWhenLaterOfferingFinalizationFails() {
        when(strategy.revertVMSnapshot(snapshot)).thenReturn(true);
        ServiceOfferingDao offerings = (ServiceOfferingDao) ReflectionTestUtils.getField(manager, "_serviceOfferingDao");
        when(offerings.findByIdIncludingRemoved(77L, 1L)).thenThrow(new CloudRuntimeException("Offering update failed"));
        assertThrows(CloudRuntimeException.class, this::revert);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(stored));
    }

    @Test public void invalidSnapshotProfileIsRejectedBeforeRevertingDisks() {
        source.put(PciTopologyProfile.VERSION_KEY, "99");
        assertThrows(IllegalArgumentException.class, this::revert);
        verifyNoInteractions(strategy, details);
    }

    @Test public void preProfileQ35SnapshotUsesTheSameLegacyFallbackAsBackupRestore() {
        source = new HashMap<>(Map.of("UEFI", "LEGACY"));
        when(strategy.revertVMSnapshot(snapshot)).thenReturn(true);
        revert();
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(stored));
    }
}
