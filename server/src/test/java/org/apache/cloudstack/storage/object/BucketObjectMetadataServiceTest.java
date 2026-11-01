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
package org.apache.cloudstack.storage.object;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;
import com.cloud.storage.BucketVO;
import com.cloud.storage.DataStoreRole;
import com.cloud.storage.dao.BucketDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import org.apache.cloudstack.api.response.BucketObjectMetadataResponse;
import org.apache.cloudstack.api.response.BucketObjectMetadataResponse.Status;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStore;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreDriver;
import org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

public class BucketObjectMetadataServiceTest {
    private final BucketApiServiceImpl service = new BucketApiServiceImpl();
    private final BucketDao buckets = mock(BucketDao.class);
    private final AccountManager accounts = mock(AccountManager.class);
    private final DataStoreManager stores = mock(DataStoreManager.class);
    private final DataStore store = mock(DataStore.class);
    private final DataStoreDriver driver = mock(DataStoreDriver.class, withSettings().extraInterfaces(BucketObjectStoreProvider.class));
    private final Account caller = mock(Account.class);
    private final BucketVO bucket = new BucketVO(2, 3, 4, "bucket", 1, false, false, false, "Private");
    public BucketObjectMetadataServiceTest() {
        bucket.setState(Bucket.State.Created); when(buckets.findByUuid("uuid")).thenReturn(bucket);
        when(stores.getDataStore(4, DataStoreRole.Object)).thenReturn(store); when(store.getDriver()).thenReturn(driver);
        ReflectionTestUtils.setField(service, "_bucketDao", buckets); ReflectionTestUtils.setField(service, "_accountMgr", accounts); ReflectionTestUtils.setField(service, "_dataStoreMgr", stores);
    }
    @Test public void ownerAndStoreComeFromAuthorizedBucketNotCallerOrInputs() {
        var result = new BucketObjectMetadataResponse("한글 + %2F", null, Status.Available);
        when(((BucketObjectStoreProvider)driver).objectMetadata(bucket,"한글 + %2F",null)).thenReturn(result);
        assertSame(result, service.getObjectMetadata("uuid", caller, "한글 + %2F", null));
        verify(accounts).checkAccess(caller,null,true,bucket); verify(stores).getDataStore(bucket.getObjectStoreId(),DataStoreRole.Object);
        verify(buckets,never()).update(anyLong(),any());
    }
    @Test public void deniedCallerCannotProbeProviderOrJoinAnotherRequest() {
        doThrow(new PermissionDeniedException("denied")).when(accounts).checkAccess(caller,null,true,bucket);
        try { service.getObjectMetadata("uuid",caller,"key",null); fail(); } catch (PermissionDeniedException expected) { }
        verifyNoInteractions(stores,driver);
    }
    @Test public void missingOrNonCreatedBucketDoesNotReachProvider() {
        try { service.getObjectMetadata("missing",caller,"key",null); fail(); } catch (InvalidParameterValueException expected) { }
        bucket.setState(Bucket.State.Allocated);
        try { service.getObjectMetadata("uuid",caller,"key",null); fail(); } catch (InvalidParameterValueException expected) { }
        verifyNoInteractions(stores,driver);
    }
    @Test public void invalidInputCannotCreateRequestOrNormalizeIntoAnotherObject() {
        for (String key : new String[]{"", "한".repeat(342), "bad\0key", "\ud800"}) {
            try { service.getObjectMetadata("uuid",caller,key,null); fail(); } catch (InvalidParameterValueException expected) { }
        }
        try { service.getObjectMetadata("uuid",caller,"key",""); fail(); } catch (InvalidParameterValueException expected) { }
        verifyNoInteractions(stores,driver);
    }
    @Test public void unsupportedProviderIsExplicitAndDoesNotReturnListingMetadata() {
        when(store.getDriver()).thenReturn(mock(DataStoreDriver.class)); assertEquals(Status.Unsupported,service.getObjectMetadata("uuid",caller,"key",null).getStatus());
    }
    @Test public void providerFailureAndMismatchedResponseAreSanitized() {
        when(((BucketObjectStoreProvider)driver).objectMetadata(bucket,"key",null)).thenThrow(new IllegalStateException("private-key"));
        var failed=service.getObjectMetadata("uuid",caller,"key",null); assertEquals(Status.Unavailable,failed.getStatus()); assertFalse(new com.google.gson.Gson().toJson(failed).contains("private-key"));
        doReturn(new BucketObjectMetadataResponse("other",null,Status.Available)).when((BucketObjectStoreProvider)driver).objectMetadata(bucket,"key",null);
        assertEquals(Status.Unavailable,service.getObjectMetadata("uuid",caller,"key",null).getStatus());
    }
}
