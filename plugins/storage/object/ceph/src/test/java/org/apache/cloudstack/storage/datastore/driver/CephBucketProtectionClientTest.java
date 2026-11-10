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
package org.apache.cloudstack.storage.datastore.driver;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doReturn;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import com.amazonaws.services.s3.model.BucketVersioningConfiguration;
import com.amazonaws.services.s3.model.GetObjectLockConfigurationResult;
import com.amazonaws.services.s3.model.ObjectLockConfiguration;
import com.amazonaws.services.s3.model.GetBucketEncryptionRequest;
import com.amazonaws.services.s3.model.GetBucketEncryptionResult;
import com.amazonaws.services.s3.model.ServerSideEncryptionConfiguration;
import com.amazonaws.services.s3.model.ServerSideEncryptionRule;
import com.amazonaws.services.s3.model.ServerSideEncryptionByDefault;
import org.junit.Before;
import org.junit.Test;
public class CephBucketProtectionClientTest {
    AmazonS3 s3 = mock(AmazonS3.class);
    CephBucketProtectionClient client = new CephBucketProtectionClient(s3, "qa-protection");
    private AmazonS3Exception error(int status, String code) { var e = new AmazonS3Exception("PRIVATE_S3_MESSAGE"); e.setStatusCode(status); e.setErrorCode(code); return e; }
    @Before public void setup() {
        when(s3.getBucketVersioningConfiguration("qa-protection")).thenReturn(new BucketVersioningConfiguration().withStatus("Off"));
        when(s3.getObjectLockConfiguration(any())).thenThrow(error(404, "ObjectLockConfigurationNotFoundError"));
        when(s3.getBucketEncryption(any(GetBucketEncryptionRequest.class))).thenThrow(error(404, "ServerSideEncryptionConfigurationNotFoundError"));
    }
    @Test public void onlyKnownMissingConfigurationMeansProtectionIsDisabled() {
        var state = client.read(); assertFalse(state.getEncryption()); assertFalse(state.getVersioning()); assertFalse(state.getObjectLock()); assertEquals("Off", state.getVersioningStatus()); assertNotNull(state.getVerifiedAt());
    }
    @Test public void forbiddenEncryptionReadDoesNotReturnFalse() {
        doThrow(error(403, "AccessDenied")).when(s3).getBucketEncryption(any(GetBucketEncryptionRequest.class)); var e = assertThrows(RuntimeException.class, () -> client.read()); assertFalse(e.getMessage().contains("PRIVATE"));
    }
    @Test public void missingBucketIsNotMistakenForDisabledEncryption() {
        doThrow(error(404, "NoSuchBucket")).when(s3).getBucketEncryption(any(GetBucketEncryptionRequest.class)); assertThrows(RuntimeException.class, () -> client.read());
    }
    @Test public void unknownLockResponseDoesNotReturnFalse() {
        doReturn(new GetObjectLockConfigurationResult()).when(s3).getObjectLockConfiguration(any()); assertThrows(RuntimeException.class, () -> client.read());
    }
    @Test public void lockPermissionFailureDoesNotReturnFalse() {
        doThrow(error(403, "AccessDenied")).when(s3).getObjectLockConfiguration(any()); assertThrows(RuntimeException.class, () -> client.read());
    }
    @Test public void actualSseAndLockedVersioningAreReadTogether() {
        when(s3.getBucketVersioningConfiguration("qa-protection")).thenReturn(new BucketVersioningConfiguration().withStatus("Enabled"));
        doReturn(new GetObjectLockConfigurationResult().withObjectLockConfiguration(new ObjectLockConfiguration().withObjectLockEnabled("Enabled"))).when(s3).getObjectLockConfiguration(any());
        doReturn(new GetBucketEncryptionResult().withServerSideEncryptionConfiguration(new ServerSideEncryptionConfiguration().withRules(new ServerSideEncryptionRule().withApplyServerSideEncryptionByDefault(new ServerSideEncryptionByDefault().withSSEAlgorithm("AES256"))))).when(s3).getBucketEncryption(any(GetBucketEncryptionRequest.class));
        var state = client.read(); assertTrue(state.getEncryption()); assertTrue(state.getVersioning()); assertTrue(state.getObjectLock()); assertEquals("AES256", state.getAlgorithm());
    }
    @Test public void sseApplyUsesTheActualS3ConfigurationAndPropagatesFailure() {
        client.encryption(true); verify(s3).setBucketEncryption(argThat(r -> "AES256".equals(r.getServerSideEncryptionConfiguration().getRules().get(0).getApplyServerSideEncryptionByDefault().getSSEAlgorithm())));
        doThrow(error(503, "ServiceUnavailable")).when(s3).setBucketEncryption(any()); assertThrows(RuntimeException.class, () -> client.encryption(true));
    }
    @Test public void suspensionIsDistinctFromNeverEnabled() {
        when(s3.getBucketVersioningConfiguration("qa-protection")).thenReturn(new BucketVersioningConfiguration().withStatus("Suspended")); assertFalse(client.read().getVersioning()); assertEquals("Suspended", client.read().getVersioningStatus());
    }
}
