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
package org.apache.cloudstack.storage.dataservice;

import com.cloud.api.response.ApiResponseSerializer;
import com.cloud.exception.InvalidParameterValueException;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.util.Set;
import org.apache.cloudstack.api.response.StorageConfigArtifactResponse;
import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class StorageConfigSmbParentsTest {
    private JsonObject fixture() throws Exception {
        try (InputStream in=getClass().getResourceAsStream("/storage-config/storage-1462-smb-parent-native.json")) {
            return JsonParser.parseString(new String(in.readAllBytes(),StandardCharsets.UTF_8)).getAsJsonObject();
        }
    }
    private StorageConfigArtifactStore.Artifact archive(JsonObject bundle) throws Exception {
        byte[] body=StorageConfigArchiveV1.create(bundle.getAsJsonObject("manifest"),
                bundle.getAsJsonObject("desired"),bundle.getAsJsonObject("effective"));
        ResultSet row=mock(ResultSet.class);
        when(row.getString("uuid")).thenReturn("3469c324-5926-4b2c-9eaf-51f933320adc");
        when(row.getString("kind")).thenReturn("BACKUP");
        when(row.getString("state")).thenReturn("VALIDATED");
        when(row.getString("source_uuid")).thenReturn(bundle.getAsJsonObject("manifest").get("sourceInstance").getAsString());
        when(row.getString("metadata")).thenReturn("{}");
        when(row.getString("sha256")).thenReturn(StorageConfigArchiveV1.digest(body));
        when(row.getInt("byte_count")).thenReturn(body.length);
        when(row.getLong("account_id")).thenReturn(2L);
        when(row.getLong("domain_id")).thenReturn(1L);
        when(row.getLong("zone_id")).thenReturn(13L);
        when(row.getBytes("payload")).thenReturn(body);
        return new StorageConfigArtifactStore.Artifact(row,true);
    }
    @Test public void nativeGuestEvidenceFlowsThroughReviewApprovalAndActualApiSerializer() throws Exception {
        JsonObject fixture=fixture(),observed=fixture.getAsJsonObject("response");
        StorageServiceInstanceVO target=new StorageServiceInstanceVO("target",null,1,2,13,1L,"SYSTEM_VM");
        target.setConfigurationRevision(9);
        String boot=observed.get("bootId").getAsString();
        String vm="c22d923e-1796-30cc-b5b4-9824f089cd9c";
        JsonObject empty=StorageConfigSnapshot.project(new JsonObject(),id->null);
        JsonObject mapping=new JsonObject();mapping.addProperty("10.10.13.227","10.10.13.227");
        JsonObject plan=StorageConfigRestorePlanner.review(archive(fixture.getAsJsonObject("bundle")),target,vm,boot,
                1,empty,Set.of("10.10.13.227"),mapping,Set.of("SMB"),new JsonObject(),desired->observed);
        JsonObject desired=plan.getAsJsonObject("desired");
        assertEquals(fixture.getAsJsonObject("request").get("smbParents"),StorageConfigSmbParents.requests(desired));
        JsonArray checks=plan.getAsJsonArray("smbParents");
        assertEquals(1,checks.size());
        assertTrue(checks.get(0).getAsJsonObject().get("bindingPending").getAsBoolean());
        assertTrue(checks.get(0).getAsJsonObject().get("accountPending").getAsBoolean());
        String sha=StorageConfigArchiveV1.digest(plan.toString().getBytes(StandardCharsets.UTF_8));
        StorageConfigRestorePlanner.requireApproval(plan,sha,vm,boot,target,1,false,false,null,Set.of("10.10.13.227"),value->observed);
        JsonObject altered=observed.deepCopy();
        altered.getAsJsonArray("smbParents").get(0).getAsJsonObject().addProperty("accountPending",false);
        assertThrows(InvalidParameterValueException.class,()->StorageConfigRestorePlanner.requireApproval(
                plan,sha,vm,boot,target,1,false,false,null,Set.of("10.10.13.227"),value->altered));
        for(String field:new String[]{"filesystemUuid","rootInode","inode","mountId"}) {
            JsonObject wrong=observed.deepCopy();
            wrong.getAsJsonArray("smbParents").get(0).getAsJsonObject().addProperty(field,"wrong");
            assertThrows(InvalidParameterValueException.class,()->StorageConfigSmbParents.requireProofs(desired,wrong,boot));
        }
        JsonObject missing=observed.deepCopy();missing.remove("smbParents");
        assertThrows(InvalidParameterValueException.class,()->StorageConfigSmbParents.requireProofs(desired,missing,boot));
        JsonObject result=new JsonObject();
        result.addProperty("id","06e93b12-f0d5-4238-8b83-dc3772fc4b81");result.addProperty("revision",9);
        result.addProperty("sha256",sha);result.addProperty("expires",4102444800000L);
        result.add("diff",plan.get("diff"));result.add("smbParents",checks);result.add("protocols",plan.get("protocols"));
        StorageConfigArtifactResponse response=new StorageConfigArtifactResponse(result);
        response.setResponseName("managestorageconfigartifactresponse");
        String wire=ApiResponseSerializer.toSerializedString(response,"json");
        assertEquals(checks,JsonParser.parseString(wire).getAsJsonObject()
                .getAsJsonObject("managestorageconfigartifactresponse").getAsJsonObject("storageconfigartifact")
                .getAsJsonObject("result").getAsJsonArray("smbParents"));
        String output=System.getProperty("config.smb.parent.fixture");
        if(output!=null)Files.writeString(Path.of(output),new GsonBuilder().setPrettyPrinting().create().toJson(JsonParser.parseString(wire))+"\n");
    }
    @Test public void nfsOnlyDoesNotRequireNewSmbObservationContract() {
        JsonObject desired=StorageConfigSnapshot.project(new JsonObject(),id->null);
        assertEquals(0,StorageConfigSmbParents.requests(desired).size());
        assertEquals(0,StorageConfigSmbParents.requireProofs(desired,new JsonObject(),"old-boot").size());
    }
}
