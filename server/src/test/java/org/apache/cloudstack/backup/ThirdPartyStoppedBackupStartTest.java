// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.backup;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cloud.agent.AgentManager;
import com.cloud.agent.api.Answer;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.storage.Volume;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.vm.VMInstanceVO;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.dao.VMInstanceDao;
import com.google.gson.Gson;
import org.apache.cloudstack.backup.dao.BackupDao;
import org.apache.cloudstack.backup.dao.BackupDetailsDao;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class ThirdPartyStoppedBackupStartTest {
    private final ThirdPartyBackupVolumeServiceImpl service = spy(new ThirdPartyBackupVolumeServiceImpl());
    private final ThirdPartyBackupVolumeService.Lease lease = mock(ThirdPartyBackupVolumeService.Lease.class);
    private final BackupDao backups = mock(BackupDao.class);
    private final BackupDetailsDao details = mock(BackupDetailsDao.class);
    private final AgentManager agents = mock(AgentManager.class);
    private final VMInstanceVO vm = mock(VMInstanceVO.class);
    private final BackupVO backup = mock(BackupVO.class);
    private final Map<String, String> saved = new HashMap<>();
    private ThirdPartyBackupStart.Operation start;

    @Before public void setup() {
        VMInstanceDao vms = mock(VMInstanceDao.class);
        ReflectionTestUtils.setField(service, "vmDao", vms);
        ReflectionTestUtils.setField(service, "backupDao", backups);
        ReflectionTestUtils.setField(service, "backupDetailsDao", details);
        ReflectionTestUtils.setField(service, "agentManager", agents);
        when(vms.findById(10L)).thenReturn(vm);
        when(vm.getType()).thenReturn(VirtualMachine.Type.User);
        when(vm.getHypervisorType()).thenReturn(HypervisorType.KVM);
        when(vm.getDataCenterId()).thenReturn(1L);
        when(backup.getId()).thenReturn(2L);
        when(backup.getUuid()).thenReturn("backup-1");
        when(backups.listByVmId(1L, 10L)).thenReturn(List.of(backup));
        when(details.findDetail(eq(2L), anyString())).thenAnswer(call -> {
            String value = saved.get(call.getArgument(1));
            return value == null ? null : new BackupDetailVO(2L, call.getArgument(1), value, false);
        });
        doAnswer(call -> { saved.put(call.getArgument(1), call.getArgument(2)); return null; })
                .when(details).addDetail(eq(2L), anyString(), anyString(), eq(false));
        doReturn(lease).when(service).acquireLifecycle(10L);
        start = new ThirdPartyBackupStart.Operation();
        start.state = "PREPARING";
        start.createdAt = 1;
        start.plan = new ThirdPartyBackupStart.Plan();
        start.plan.jobId = "backup-1";
        start.plan.hostId = 4;
        start.plan.backupPath = "/staging/ablestack-netbackup/vm/point";
        start.plan.protectStoppedSource = true;
        engine("RBD_DIFF");
    }

    private void engine(String engine) {
        start.plan.manifest = ThirdPartyBackupManifest.create("ablestack-netbackup", "backup-1", "vm", "point", "FULL",
                "host-4", start.plan.backupPath, engine,
                List.of(new Backup.VolumeInfo("volume-1", "root", Volume.Type.ROOT, 1073741824L, 0L, null, null, null)), null, null);
        saved.put(ThirdPartyBackupStart.DETAIL_KEY, new Gson().toJson(start));
    }

    private void proof(boolean released, String phase) throws Exception {
        ThirdPartyBackupStart.SourceProof proof = new ThirdPartyBackupStart.SourceProof();
        proof.plan = new Gson().fromJson(new Gson().toJson(start.plan), ThirdPartyBackupStart.Plan.class);
        proof.released = released;
        proof.phase = phase;
        when(agents.send(eq(4L), any(AblestackVolumeStagingCommand.class)))
                .thenAnswer(call -> new Answer(call.getArgument(1), true, new Gson().toJson(proof)));
    }

    @Test public void rbdPreparationBlocksAndClosesLifecycleLease() throws Exception {
        proof(false, "PROTECTED");
        assertThrows(CloudRuntimeException.class, () -> service.guardVmStart(10L));
        verify(lease).close();
    }

    @Test public void allRbdSnapshotsPermitStartDuringBackupAndCacheExactProof() throws Exception {
        when(backup.getStatus()).thenReturn(Backup.Status.BackingUp);
        proof(true, "SNAPSHOTS_COMPLETE");
        ThirdPartyBackupVolumeService.Lease held = service.guardVmStart(10L);
        verify(lease, never()).close();
        held.close();
        service.guardVmStart(10L).close();
        verify(agents).send(eq(4L), any(AblestackVolumeStagingCommand.class));
    }

    @Test public void qcow2CannotUseRbdSnapshotProof() throws Exception {
        engine("QCOW2");
        proof(true, "SNAPSHOTS_COMPLETE");
        assertThrows(CloudRuntimeException.class, () -> service.guardVmStart(10L));
    }

    @Test public void failedQcow2RequiresConfirmedDummyCleanup() throws Exception {
        engine("QCOW2");
        when(backup.getStatus()).thenReturn(Backup.Status.Failed);
        proof(false, "PROTECTED");
        assertThrows(CloudRuntimeException.class, () -> service.guardVmStart(10L));
        proof(true, "SOURCE_CLEANED");
        service.guardVmStart(10L).close();
    }

    @Test public void unreachableWorkerAndMissingProofFailClosed() throws Exception {
        when(agents.send(eq(4L), any(AblestackVolumeStagingCommand.class))).thenReturn(null);
        assertThrows(CloudRuntimeException.class, () -> service.guardVmStart(10L));
        verify(lease).close();
    }

    @Test public void proofFromDifferentHostCannotReleaseSource() throws Exception {
        ThirdPartyBackupStart.SourceProof proof = new ThirdPartyBackupStart.SourceProof();
        proof.plan = new Gson().fromJson(new Gson().toJson(start.plan), ThirdPartyBackupStart.Plan.class);
        proof.plan.hostId = 99;
        proof.released = true;
        proof.phase = "SOURCE_CLEANED";
        when(agents.send(eq(4L), any(AblestackVolumeStagingCommand.class)))
                .thenAnswer(call -> new Answer(call.getArgument(1), true, new Gson().toJson(proof)));
        assertThrows(CloudRuntimeException.class, () -> service.guardVmStart(10L));
    }

    @Test public void canceledUnstartedAttemptRequiresPermanentFence() throws Exception {
        when(backup.getStatus()).thenReturn(Backup.Status.Canceled);
        proof(true, "UNSTARTED_FENCED");
        service.guardVmStart(10L).close();
    }

    @Test public void runningSourceBackupDoesNotBlockStart() {
        start.plan.protectStoppedSource = false;
        saved.put(ThirdPartyBackupStart.DETAIL_KEY, new Gson().toJson(start));
        service.guardVmStart(10L).close();
        verifyNoInteractions(agents);
    }

    @Test public void systemVmStartDoesNotAcquireBackupLifecycle() {
        when(vm.getType()).thenReturn(VirtualMachine.Type.ConsoleProxy);
        service.guardVmStart(10L).close();
        verify(service, never()).acquireLifecycle(10L);
        verifyNoInteractions(agents);
    }
}
