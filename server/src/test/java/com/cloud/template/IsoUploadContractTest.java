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
package com.cloud.template;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.command.user.iso.GetUploadParamsForIsoCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.storage.datastore.db.ImageStoreDao;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;
import com.cloud.cpu.CPU;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.storage.Storage.ImageFormat;
import com.cloud.storage.Storage.TemplateType;
import com.cloud.storage.TemplateProfile;
import com.cloud.storage.upload.params.IsoUploadParams;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;

public class IsoUploadContractTest {
    @Test
    public void commandDeclaresArchitectureAndKeepsLegacyDefault() throws Exception {
        GetUploadParamsForIsoCmd cmd = new GetUploadParamsForIsoCmd();
        assertEquals(CPU.CPUArch.amd64, cmd.getArch());
        assertEquals("arch", GetUploadParamsForIsoCmd.class.getDeclaredField("arch").getAnnotation(Parameter.class).name());
        cmd.setArch("aarch64"); assertEquals(CPU.CPUArch.arm64, cmd.getArch());
        cmd.setArch("s390x"); assertEquals(CPU.CPUArch.s390x, cmd.getArch());
    }

    @Test(expected = IllegalArgumentException.class)
    public void unsupportedArchitectureIsRejected() {
        GetUploadParamsForIsoCmd cmd = new GetUploadParamsForIsoCmd(); cmd.setArch("not-an-architecture"); cmd.getArch();
    }

    @Test
    public void legacyConstructorRetainsItsExistingContract() {
        IsoUploadParams value = new IsoUploadParams(11, "iso", "display", false, false, true, 7L, 9L, false, 42, false);
        assertNull(value.getChecksum()); assertNull(value.getArch()); assertTrue(value.isIso()); assertFalse(value.isBootable());
        assertEquals("ISO", value.getFormat()); assertEquals(HypervisorType.None, value.getHypervisorType());
    }

    @Test
    public void checksumAndArchitectureReachTheProfileWithoutChangingTheChecksumWireValue() throws Exception {
        for (String checksum : new String[] {"0123456789abcdef0123456789abcdef", "{SHA-256}" + String.join("", Collections.nCopies(64, "a"))}) {
            Account owner = mock(Account.class); when(owner.getId()).thenReturn(42L);
            CallContext context = mock(CallContext.class); when(context.getCallingAccount()).thenReturn(owner); when(context.getCallingUserId()).thenReturn(11L);
            AccountManager manager = mock(AccountManager.class); when(manager.getAccount(42L)).thenReturn(owner);
            ImageStoreDao stores = mock(ImageStoreDao.class); when(stores.findRegionImageStores()).thenReturn(Collections.emptyList());
            TemplateManager templateManager = mock(TemplateManager.class); when(templateManager.validateTemplateType(any(BaseCmd.class), anyBoolean(), anyBoolean(), any(HypervisorType.class))).thenReturn(TemplateType.USER);
            CapturingAdapter adapter = new CapturingAdapter();
            ReflectionTestUtils.setField(adapter, "_accountMgr", manager); ReflectionTestUtils.setField(adapter, "_imgStoreDao", stores); java.lang.reflect.Field managerField = TemplateAdapterBase.class.getDeclaredField("templateMgr"); managerField.setAccessible(true); managerField.set(adapter, templateManager);
            GetUploadParamsForIsoCmd cmd = spy(new GetUploadParamsForIsoCmd()); doReturn(42L).when(cmd).getEntityOwnerId();
            ReflectionTestUtils.setField(cmd, "name", "checksum-iso"); ReflectionTestUtils.setField(cmd, "zoneId", 9L); ReflectionTestUtils.setField(cmd, "checksum", checksum);
            cmd.setBootable(false); cmd.setExtractable(true); cmd.setOsTypeId(7L); cmd.setArch("aarch64");
            try (MockedStatic<CallContext> scope = mockStatic(CallContext.class)) {
                scope.when(CallContext::current).thenReturn(context);
                TemplateProfile profile = adapter.prepare(cmd);
                assertEquals(checksum, profile.getCheckSum()); assertEquals(CPU.CPUArch.arm64, profile.getArch());
                assertEquals(ImageFormat.ISO, profile.getFormat()); assertFalse(profile.isBootable());
                verify(manager).checkAccess(eq(owner), isNull(), eq(true), eq(owner));
            }
        }
    }

    private static class CapturingAdapter extends HypervisorTemplateAdapter {
        @Override
        public TemplateProfile prepare(boolean iso, long userId, String name, String displayText, CPU.CPUArch arch, Integer bits, Boolean passwordEnabled,
                Boolean requiresHvm, String url, Boolean isPublic, Boolean featured, Boolean extractable, String format, Long osId, List<Long> zones,
                HypervisorType hypervisor, String checksum, Boolean bootable, String templateTag, Account owner, Map details, Boolean sshEnabled,
                String imageStoreUuid, Boolean scalable, TemplateType type, boolean direct, boolean kvdo, boolean deployAsIs, boolean forCks, Long extensionId) {
            return new TemplateProfile(null, userId, name, displayText, arch, bits, passwordEnabled, requiresHvm, url, isPublic, featured,
                    extractable, ImageFormat.valueOf(format), osId, zones, hypervisor, "owner", 1L, 42L, checksum, bootable, details, sshEnabled);
        }
    }
}
