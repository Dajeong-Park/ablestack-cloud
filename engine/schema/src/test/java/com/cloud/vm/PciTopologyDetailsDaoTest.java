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

import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Map;
import java.util.HashMap;
import javax.sql.DataSource;
import com.mysql.cj.jdbc.MysqlDataSource;
import com.cloud.agent.api.to.VirtualMachineTO;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.uservm.UserVm;
import com.cloud.utils.db.TransactionLegacy;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.dao.VMInstanceDao;
import com.cloud.vm.dao.VMInstanceDetailsDaoImpl;
import com.google.gson.Gson;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.backup.BackupVO;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.junit.Before;
import org.junit.After;
import org.junit.Test;
import org.junit.Assume;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class PciTopologyDetailsDaoTest {
    private Field datasource;
    private DataSource previous;
    private TransactionLegacy transaction;
    private VMInstanceDetailsDaoImpl details;
    private VMInstanceVO vm;
    private VMInstanceDao instances;

    @Before public void setup() throws Exception {
        String url = System.getProperty("pci.topology.test.url");
        Assume.assumeTrue("Dedicated local test database required", url != null);
        assertTrue(url.startsWith("jdbc:mysql://127.0.0.1:13346/cloud?"));
        MysqlDataSource ds = new MysqlDataSource(); ds.setURL(url); ds.setUser("root");
        try(Connection c = ds.getConnection(); Statement statement = c.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS vm_instance_details (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,"
                    + "vm_id BIGINT UNSIGNED NOT NULL,name VARCHAR(255) NOT NULL,value VARCHAR(5120),display TINYINT NOT NULL DEFAULT 1,UNIQUE KEY uk(vm_id,name))");
            statement.execute("DELETE FROM vm_instance_details");
        }
        datasource = TransactionLegacy.class.getDeclaredField("s_ds"); datasource.setAccessible(true);
        previous = (DataSource) datasource.get(null); datasource.set(null, ds);
        transaction = TransactionLegacy.open(TransactionLegacy.CLOUD_DB);
        details = new VMInstanceDetailsDaoImpl();
        vm = mock(VMInstanceVO.class);
        when(vm.getId()).thenReturn(1436L); when(vm.getUuid()).thenReturn("uuid-1436");
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(vm.getType()).thenReturn(VirtualMachine.Type.User);
        when(vm.getLastHostId()).thenReturn(null);
        instances = mock(VMInstanceDao.class); when(instances.findById(1436L)).thenReturn(vm);
        details.addDetail(1436, "rootDiskController", "scsi", true);
        details.addDetail(1436, "UEFI", "LEGACY", true);
        details.addDetail(1436, VmDetailConstants.DEPLOY_VM, "true", false);
    }

    @After public void close() throws Exception {
        if(transaction != null) transaction.close();
        if(datasource != null) datasource.set(null, previous);
    }

    private VirtualMachineTO request() {
        VirtualMachineTO request = new VirtualMachineTO(1436, "i-2-1436-VM", VirtualMachine.Type.User,
                4, 1000, 8192, 8192, null, "Windows Server 2025", false, false, null);
        request.setUuid("uuid-1436"); request.setArch("x86_64");
        request.setDetails(Map.of("UEFI", "LEGACY", "rootDiskController", "scsi", "dynamicRequestDetail", "kept"));
        return request;
    }

    @Test public void firstStartPersistsBeforeSendThenPinsObservedMachineWithoutLosingOtherDetails() {
        VirtualMachineTO request = request();
        PciTopologyDetails.prepareStartProfile(request, vm, details);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
        assertEquals("kept", request.getDetails().get("dynamicRequestDetail"));
        Map<String, String> answer = new HashMap<>(request.getDetails());
        answer.put(PciTopologyProfile.OBSERVED_KEY, PciTopologyProfile.WINDOWS_Q35_16.id() + ":16");
        answer.put(PciTopologyProfile.OBSERVED_MACHINE_KEY, "pc-q35-rhel9.8.0");
        request.setDetails(answer);
        // Actual Gson wire representation must preserve the profile and observation fields.
        VirtualMachineTO received = new Gson().fromJson(new Gson().toJson(request), VirtualMachineTO.class);
        PciTopologyDetails.saveStartedProfile(received, instances, details);
        PciTopologyDetails.saveStartedProfile(received, instances, details);
        var fresh = new VMInstanceDetailsDaoImpl().listDetailsKeyPairs(1436);
        assertEquals("scsi", fresh.get("rootDiskController"));
        assertEquals("LEGACY", fresh.get("UEFI"));
        assertEquals("pc-q35-rhel9.8.0", fresh.get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
        assertFalse(fresh.containsKey(PciTopologyProfile.OBSERVED_KEY));
        assertFalse(fresh.containsKey("dynamicRequestDetail"));
        assertEquals(6, fresh.size());
        assertFalse(details.findDetail(1436L, PciTopologyProfile.PROFILE_KEY).isDisplay());
        VirtualMachineTO stale = request();
        PciTopologyDetails.prepareStartProfile(stale, vm, details);
        assertEquals("pc-q35-rhel9.8.0", stale.getDetails().get(VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
        assertFalse(stale.getDetails().containsKey(PciTopologyProfile.OBSERVED_KEY));
    }

    @Test public void untaggedExistingInstanceIsNotMigratedAndStoredProfileCannotBeChangedByHost() {
        when(vm.getLastHostId()).thenReturn(13L);
        details.removeDetail(1436L, VmDetailConstants.DEPLOY_VM);
        VirtualMachineTO old = request();
        PciTopologyDetails.prepareStartProfile(old, vm, details);
        assertEquals("true", old.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY));
        assertNull(PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
        when(vm.getLastHostId()).thenReturn(null);
        details.addDetail(1436, VmDetailConstants.DEPLOY_VM, "true", false);
        VirtualMachineTO current = request();
        PciTopologyDetails.prepareStartProfile(current, vm, details);
        var bad = PciTopologyProfile.LEGACY_AUTO.withDetails(current.getDetails());
        bad.put(PciTopologyProfile.OBSERVED_KEY, PciTopologyProfile.LEGACY_AUTO.id() + ":3");
        bad.put(PciTopologyProfile.OBSERVED_MACHINE_KEY, "pc-q35-rhel9.8.0");
        current.setDetails(bad);
        assertThrows(CloudRuntimeException.class, () -> PciTopologyDetails.saveStartedProfile(current, instances, details));
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
        assertEquals("scsi", details.findDetail(1436L, "rootDiskController").getValue());
    }

    @Test public void missingHostProofAndForeignVmBindingCannotBeCommitted() {
        VirtualMachineTO current = request();
        PciTopologyDetails.prepareStartProfile(current, vm, details);
        assertThrows(CloudRuntimeException.class, () -> PciTopologyDetails.saveStartedProfile(current, instances, details));
        var map = new HashMap<>(current.getDetails());
        map.put(PciTopologyProfile.OBSERVED_KEY, PciTopologyProfile.WINDOWS_Q35_16.id()+":16");
        map.put(PciTopologyProfile.OBSERVED_MACHINE_KEY,"pc-q35-rhel9.8.0");current.setDetails(map);
        current.setUuid("foreign-instance");
        assertThrows(CloudRuntimeException.class, () -> PciTopologyDetails.saveStartedProfile(current, instances, details));
        assertNull(details.findDetail(1436L, VmDetailConstants.KVM_GUEST_OS_MACHINE_TYPE));
    }

    @Test public void backupRestorationUsesSourceProfileAndOldBackupsUseExplicitLegacyAuto() {
        BackupDao backups = mock(BackupDao.class);
        BackupVO backup = mock(BackupVO.class); when(backups.findById(1L)).thenReturn(backup);
        UserVm target = mock(UserVm.class); when(target.getId()).thenReturn(1436L);
        when(target.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(backup.getDetail(ApiConstants.VM_SETTINGS)).thenReturn(new Gson().toJson(
                PciTopologyProfile.WINDOWS_Q35_16.withDetails(Map.of("rootDiskController","scsi"))));
        PciTopologyDetails.inheritBackupProfile(target, 1, backups, details);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
        when(backup.getDetail(ApiConstants.VM_SETTINGS)).thenReturn("{\"rootDiskController\":\"scsi\",\"UEFI\":\"LEGACY\"}");
        PciTopologyDetails.inheritBackupProfile(target, 1, backups, details);
        assertEquals(PciTopologyProfile.LEGACY_AUTO, PciTopologyProfile.fromDetails(new VMInstanceDetailsDaoImpl().listDetailsKeyPairs(1436)));
        assertEquals("scsi", details.findDetail(1436L, "rootDiskController").getValue());
    }

    @Test public void deploymentMarkerDistinguishesFirstStartFromClearedMigrationHistory() {
        when(vm.getLastHostId()).thenReturn(13L);
        VirtualMachineTO first = request();
        PciTopologyDetails.prepareStartProfile(first, vm, details);
        assertEquals(PciTopologyProfile.WINDOWS_Q35_16, PciTopologyProfile.fromDetails(first.getDetails()));
        details.removeDetail(1436L, PciTopologyProfile.PROFILE_KEY);
        details.removeDetail(1436L, PciTopologyProfile.VERSION_KEY);
        details.removeDetail(1436L, VmDetailConstants.DEPLOY_VM);
        when(vm.getLastHostId()).thenReturn(null);
        VirtualMachineTO migrated = request();
        PciTopologyDetails.prepareStartProfile(migrated, vm, details);
        assertEquals("true", migrated.getDetails().get(PciTopologyProfile.PRESERVE_EXISTING_KEY));
        assertNull(PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
    }

    @Test public void biosBackupCannotAcquireAQ35Profile() {
        BackupDao backups = mock(BackupDao.class);
        BackupVO backup = mock(BackupVO.class); when(backups.findById(1L)).thenReturn(backup);
        when(backup.getDetail(ApiConstants.VM_SETTINGS)).thenReturn("{\"rootDiskController\":\"scsi\"}");
        UserVm target = mock(UserVm.class); when(target.getId()).thenReturn(1436L);
        when(target.getHypervisorType()).thenReturn(HypervisorType.KVM);
        PciTopologyDetails.inheritBackupProfile(target, 1, backups, details);
        assertNull(PciTopologyProfile.fromDetails(details.listDetailsKeyPairs(1436)));
        assertEquals("scsi", details.findDetail(1436L, "rootDiskController").getValue());
    }
}
