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
package com.cloud.kubernetes.version;

import com.cloud.cpu.CPU;
import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.event.ActionEvent;
import com.cloud.kubernetes.cluster.KubernetesClusterService;
import com.cloud.kubernetes.version.dao.KubernetesSupportedVersionDao;
import com.cloud.storage.VMTemplateVO;
import com.cloud.storage.dao.VMTemplateDao;
import com.cloud.template.TemplateApiService;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.utils.component.ComponentContext;
import org.apache.cloudstack.api.command.admin.kubernetes.version.GetUploadParamsForKubernetesSupportedVersionCmd;
import org.apache.cloudstack.api.command.user.iso.GetUploadParamsForIsoCmd;
import org.apache.cloudstack.api.response.GetUploadParamsResponse;
import org.apache.cloudstack.context.CallContext;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.UUID;

public class KubernetesLocalUploadTest {
    @Test
    public void validatesArchitectureBeforeAllocation() {
        GetUploadParamsForKubernetesSupportedVersionCmd command = new GetUploadParamsForKubernetesSupportedVersionCmd();
        Assert.assertEquals(CPU.CPUArch.amd64, command.getArch());
        for (String arch : new String[]{"x86_64", "aarch64", "s390x"}) {
            ReflectionTestUtils.setField(command, "arch", arch);
            Assert.assertEquals(arch, command.getArch().getType());
        }
        for (String invalid : new String[]{"i686", "unknown"}) {
            ReflectionTestUtils.setField(command, "arch", invalid);
            Assert.assertThrows(com.cloud.exception.InvalidParameterValueException.class, command::getArch);
        }
    }

    @Test
    public void localReceiptUsesCatalogEventAndActualVersionUuid() throws Exception {
        ActionEvent event = KubernetesVersionManagerImpl.class.getMethod("registerKubernetesSupportedVersionForPostUpload",
                GetUploadParamsForKubernetesSupportedVersionCmd.class).getAnnotation(ActionEvent.class);
        Assert.assertNotNull(event);
        Assert.assertEquals("KUBERNETES.VERSION.ADD", event.eventType());
        for (CPU.CPUArch arch : new CPU.CPUArch[]{CPU.CPUArch.amd64, CPU.CPUArch.arm64}) {
            verifyUpload(arch);
        }
    }

    private void verifyUpload(CPU.CPUArch arch) throws Exception {
        ReflectionTestUtils.setField(KubernetesClusterService.KubernetesServiceEnabled, "_defaultValue", "true");
        KubernetesVersionManagerImpl manager = new KubernetesVersionManagerImpl();
        TemplateApiService templates = Mockito.mock(TemplateApiService.class);
        VMTemplateDao isoDao = Mockito.mock(VMTemplateDao.class);
        KubernetesSupportedVersionDao versions = Mockito.mock(KubernetesSupportedVersionDao.class);
        DataCenterDao zones = Mockito.mock(DataCenterDao.class);
        AccountManager accounts = Mockito.mock(AccountManager.class);
        for (Object[] entry : new Object[][]{{"templateService", templates}, {"templateDao", isoDao},
                {"kubernetesSupportedVersionDao", versions}, {"dataCenterDao", zones}, {"accountManager", accounts}}) {
            ReflectionTestUtils.setField(manager, (String) entry[0], entry[1]);
        }
        Account system = Mockito.mock(Account.class);
        Mockito.when(system.getAccountName()).thenReturn("system");
        Mockito.when(system.getDomainId()).thenReturn(1L);
        Mockito.when(accounts.getSystemAccount()).thenReturn(system);
        Mockito.when(zones.findById(1L)).thenReturn(Mockito.mock(DataCenterVO.class));
        String isoUuid = UUID.randomUUID().toString();
        GetUploadParamsResponse ticket = new GetUploadParamsResponse();
        ticket.setId(UUID.fromString(isoUuid));
        Mockito.when(templates.registerIsoForPostUpload(Mockito.any())).thenReturn(ticket);
        VMTemplateVO iso = Mockito.mock(VMTemplateVO.class);
        Mockito.when(iso.getId()).thenReturn(42L);
        Mockito.when(isoDao.findByUuid(isoUuid)).thenReturn(iso);
        Mockito.when(versions.persist(Mockito.any(KubernetesSupportedVersionVO.class))).thenAnswer(call -> call.getArgument(0));
        GetUploadParamsForKubernetesSupportedVersionCmd command = Mockito.mock(GetUploadParamsForKubernetesSupportedVersionCmd.class);
        Mockito.when(command.getName()).thenReturn("qa-local");
        Mockito.when(command.getSemanticVersion()).thenReturn("1.30.0");
        Mockito.when(command.getZoneId()).thenReturn(1L);
        Mockito.when(command.getMinimumCpu()).thenReturn(2);
        Mockito.when(command.getMinimumRamSize()).thenReturn(2048);
        Mockito.when(command.getArch()).thenReturn(arch);
        CallContext context = Mockito.mock(CallContext.class);
        try (MockedStatic<ComponentContext> inject = Mockito.mockStatic(ComponentContext.class);
             MockedStatic<CallContext> calls = Mockito.mockStatic(CallContext.class)) {
            calls.when(CallContext::current).thenReturn(context);
            inject.when(() -> ComponentContext.inject(Mockito.any(GetUploadParamsForIsoCmd.class))).thenAnswer(call -> call.getArgument(0));
            Assert.assertSame(ticket, manager.registerKubernetesSupportedVersionForPostUpload(command));
            ArgumentCaptor<GetUploadParamsForIsoCmd> child = ArgumentCaptor.forClass(GetUploadParamsForIsoCmd.class);
            Mockito.verify(templates).registerIsoForPostUpload(child.capture());
            Assert.assertEquals(arch, child.getValue().getArch());
            Assert.assertEquals("system", child.getValue().getAccountName());
            ArgumentCaptor<KubernetesSupportedVersionVO> parent = ArgumentCaptor.forClass(KubernetesSupportedVersionVO.class);
            Mockito.verify(versions).persist(parent.capture());
            Assert.assertEquals(42L, parent.getValue().getIsoId());
            Mockito.verify(context).putContextParameter(KubernetesSupportedVersion.class, parent.getValue().getUuid());
        }
    }
}
