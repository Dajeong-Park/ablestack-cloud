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
package com.cloud.storage.snapshot;

import java.util.HashMap;
import java.util.Map;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.storage.DataStoreRole;
import com.cloud.storage.SnapshotVO;
import com.cloud.storage.Volume;
import com.cloud.storage.VolumeVO;
import com.cloud.storage.dao.SnapshotDao;
import com.cloud.storage.dao.VolumeDao;
import com.cloud.storage.dao.VolumeDetailsDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.vm.PciTopologyProfile;
import com.cloud.vm.UserVmVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VmCreationSourceService;
import com.cloud.vm.dao.UserVmDao;
import com.cloud.vm.dao.VMInstanceDetailsDao;
import com.cloud.vm.snapshot.dao.VMSnapshotDao;
import org.apache.cloudstack.backup.AblestackBackupOperationGuard;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.engine.subsystem.api.storage.SnapshotDataFactory;
import org.apache.cloudstack.engine.subsystem.api.storage.SnapshotInfo;
import org.apache.cloudstack.engine.subsystem.api.storage.SnapshotStrategy;
import org.apache.cloudstack.engine.subsystem.api.storage.StorageStrategyFactory;
import org.apache.cloudstack.snapshot.SnapshotHelper;
import org.apache.cloudstack.storage.datastore.db.SnapshotDataStoreDao;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class RootSnapshotPciTopologyRestoreTest {
    private final SnapshotManagerImpl manager = new SnapshotManagerImpl();
    private final VMInstanceDetailsDao vmDetails = mock(VMInstanceDetailsDao.class);
    private final SnapshotStrategy strategy = mock(SnapshotStrategy.class);
    private final SnapshotVO snapshot = mock(SnapshotVO.class);
    private final VolumeVO volume = mock(VolumeVO.class);
    private final Map<String, String> recorded = new HashMap<>();
    private final Map<String, String> stored = new HashMap<>();
    private SnapshotInfo info;
    private MockedStatic<Transaction> transactions;

    @Before public void setup() {
        CallContext.register(mock(User.class), mock(Account.class));
        transactions = mockStatic(Transaction.class);
        transactions.when(() -> Transaction.execute(Mockito.<TransactionCallback<Object>>any()))
                .thenAnswer(call -> call.<TransactionCallback<Object>>getArgument(0).doInTransaction(null));
        manager._snapshotDao = mock(SnapshotDao.class);
        when(manager._snapshotDao.findById(2L)).thenReturn(snapshot);
        when(snapshot.getVolumeId()).thenReturn(1L);
        when(snapshot.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(snapshot.getSize()).thenReturn(100L);
        when(volume.getId()).thenReturn(1L);
        when(volume.getInstanceId()).thenReturn(77L);
        when(volume.getVolumeType()).thenReturn(Volume.Type.ROOT);
        when(volume.getState()).thenReturn(Volume.State.Ready);
        when(volume.getDataCenterId()).thenReturn(1L);
        when(volume.getSize()).thenReturn(100L);
        manager._volsDao = mock(VolumeDao.class);
        when(manager._volsDao.findById(1L)).thenReturn(volume);
        manager._vmDao = mock(UserVmDao.class);
        UserVmVO vm = mock(UserVmVO.class);
        when(vm.getId()).thenReturn(77L);
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(vm.getState()).thenReturn(VirtualMachine.State.Stopped);
        when(manager._vmDao.findById(77L)).thenReturn(vm);
        manager._vmSnapshotDao = mock(VMSnapshotDao.class);
        manager._accountMgr = mock(AccountManager.class);
        ReflectionTestUtils.setField(manager, "allocationDetailsDao", mock(VolumeDetailsDao.class));
        ReflectionTestUtils.setField(manager, "ablestackBackupOperationGuard", mock(AblestackBackupOperationGuard.class));
        manager.snapshotHelper = mock(SnapshotHelper.class);
        when(manager.snapshotHelper.getDataStoreRole(snapshot)).thenReturn(DataStoreRole.Image);
        manager.snapshotFactory = mock(SnapshotDataFactory.class);
        info = mock(SnapshotInfo.class);
        when(manager.snapshotFactory.getSnapshotWithRoleAndZone(2L, DataStoreRole.Image, 1L)).thenReturn(info);
        manager._storageStrategyFactory = mock(StorageStrategyFactory.class);
        when(manager._storageStrategyFactory.getSnapshotStrategy(snapshot, SnapshotStrategy.SnapshotOperation.REVERT)).thenReturn(strategy);
        manager.snapshotDetailsDao = mock(com.cloud.storage.dao.SnapshotDetailsDao.class);
        when(manager.snapshotDetailsDao.listDetailsKeyPairs(2L)).thenReturn(recorded);
        manager.pciTopologyDetailsDao = vmDetails;
        ReflectionTestUtils.setField(manager, "_snapshotStoreDao", mock(SnapshotDataStoreDao.class));
        stored.putAll(PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of()));
        PciTopologyProfile.LEGACY_AUTO.withDetails(Map.of()).forEach((key, value) -> recorded.put(VmCreationSourceService.PREFIX + key, value));
        doAnswer(call -> { stored.put(call.getArgument(1), call.getArgument(2)); return null; })
                .when(vmDetails).addDetail(eq(77L), anyString(), anyString(), eq(false));
    }

    @After public void close() { transactions.close(); CallContext.unregister(); }

    @Test public void rootSnapshotRestoresItsCapturedProfileOnlyAfterStorageSuccess() {
        when(strategy.revertSnapshot(info)).thenAnswer(call -> {
            assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
            return true;
        });
        assertSame(info, manager.revertSnapshot(2L));
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(stored));
    }

    @Test public void failedRootSnapshotRestoreDoesNotChangeTheVmProfile() {
        when(strategy.revertSnapshot(info)).thenReturn(false);
        assertNull(manager.revertSnapshot(2L));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        verifyNoInteractions(vmDetails);
    }

    @Test public void dataSnapshotRestoreDoesNotChangeTheTargetVmProfile() {
        when(volume.getVolumeType()).thenReturn(Volume.Type.DATADISK);
        when(strategy.revertSnapshot(info)).thenReturn(true);
        assertSame(info, manager.revertSnapshot(2L));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(stored));
        verifyNoInteractions(vmDetails);
    }

    @Test public void invalidRootSnapshotProfileIsRejectedBeforeChangingStorage() {
        recorded.put(VmCreationSourceService.PREFIX + PciTopologyProfile.VERSION_KEY, "99");
        assertThrows(IllegalArgumentException.class, () -> manager.revertSnapshot(2L));
        verifyNoInteractions(strategy, vmDetails);
    }
}
