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



package org.apache.cloudstack.api.command.user.template;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.command.user.iso.GetUploadParamsForIsoCmd;
import org.apache.cloudstack.api.response.GetUploadParamsResponse;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.cloud.template.TemplateApiService;

public class LocalTemplateUploadCmdTest {
    @Test
    public void allZonesSystemTemplateReachesUploadService() throws Exception {
        GetUploadParamsForTemplateCmd cmd = new GetUploadParamsForTemplateCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", -1L);
        ReflectionTestUtils.setField(cmd, "osTypeId", 1L);
        ReflectionTestUtils.setField(cmd, "templateType", "SYSTEM");
        TemplateApiService service = mock(TemplateApiService.class);
        ReflectionTestUtils.setField(cmd, "_templateService", service);
        when(service.registerTemplateForPostUpload(cmd)).thenReturn(new GetUploadParamsResponse());
        cmd.execute();
        verify(service).registerTemplateForPostUpload(cmd);
        assertEquals("SYSTEM", cmd.getTemplateType());
        assertFalse(cmd.isKvdoEnable());
    }

    @Test
    public void allZonesIsoReachesUploadService() throws Exception {
        GetUploadParamsForIsoCmd cmd = new GetUploadParamsForIsoCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", -1L);
        TemplateApiService service = mock(TemplateApiService.class);
        ReflectionTestUtils.setField(cmd, "_templateService", service);
        when(service.registerIsoForPostUpload(cmd)).thenReturn(new GetUploadParamsResponse());
        cmd.execute();
        verify(service).registerIsoForPostUpload(cmd);
    }

    @Test(expected = ServerApiException.class)
    public void missingTemplateZoneIsRejected() {
        new GetUploadParamsForTemplateCmd().execute();
    }

    @Test(expected = ServerApiException.class)
    public void missingIsoZoneIsRejected() throws Exception {
        new GetUploadParamsForIsoCmd().execute();
    }

    @Test(expected = ServerApiException.class)
    public void invalidTemplateZoneIsRejected() {
        GetUploadParamsForTemplateCmd cmd = new GetUploadParamsForTemplateCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", -2L);
        cmd.execute();
    }

    @Test(expected = ServerApiException.class)
    public void invalidIsoZoneIsRejected() throws Exception {
        GetUploadParamsForIsoCmd cmd = new GetUploadParamsForIsoCmd();
        ReflectionTestUtils.setField(cmd, "zoneId", 0L);
        cmd.execute();
    }
}
