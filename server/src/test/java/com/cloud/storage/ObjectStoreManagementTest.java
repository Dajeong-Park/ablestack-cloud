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
package com.cloud.storage;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.any;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import com.cloud.storage.dao.BucketDao;
import com.cloud.exception.InvalidParameterValueException;
import org.apache.cloudstack.api.command.admin.storage.UpdateObjectStoragePoolCmd;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationDao;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
public class ObjectStoreManagementTest {
    private final StorageManagerImpl service = new StorageManagerImpl();
    private final ObjectStoreDao stores = mock(ObjectStoreDao.class);
    private final BucketDao buckets = mock(BucketDao.class);
    private final BucketQuotaOperationDao quota = mock(BucketQuotaOperationDao.class);
    private final ObjectStoreVO store = mock(ObjectStoreVO.class);
    private final UpdateObjectStoragePoolCmd cmd = mock(UpdateObjectStoragePoolCmd.class);
    public ObjectStoreManagementTest() {
        ReflectionTestUtils.setField(service,"_objectStoreDao",stores); ReflectionTestUtils.setField(service,"_bucketDao",buckets); ReflectionTestUtils.setField(service,"bucketQuotaOperations",quota);
        when(cmd.getDetails()).thenReturn(null); when(cmd.getSize()).thenReturn(null);
        when(stores.findById(7L)).thenReturn(store); when(stores.createForUpdate(7L)).thenReturn(mock(ObjectStoreVO.class)); when(store.getAllocatedSize()).thenReturn(3L*1073741824); when(store.getTotalSize()).thenReturn(20L*1073741824); when(store.getProviderName()).thenReturn("Glue"); when(buckets.listByObjectStoreId(7L)).thenReturn(List.of());
    }
    private Object update() {
        try { var method = StorageManagerImpl.class.getDeclaredMethod("updateObjectStoreLocked",Long.class,UpdateObjectStoragePoolCmd.class); method.setAccessible(true); return method.invoke(service,7L,cmd);
        } catch (InvocationTargetException failure) { throw (RuntimeException)failure.getCause();
        } catch (ReflectiveOperationException failure) { throw new AssertionError(failure); }
    }
    @Test public void omittedSizePreservesTwentyGiBAndDoesNotProbeConnection() {
        when(cmd.getName()).thenReturn("renamed"); assertSame(store,update());
        var changed=stores.createForUpdate(7L); verify(changed).setName("renamed"); verify(changed,never()).setTotalSize(any()); verify(changed,never()).setUrl(any());
    }
    @Test public void rejectsNegativeOverflowAndBelowCommittedPlusReserved() {
        when(quota.reservedBytesForStore(7L)).thenReturn(1073741824L);
        for (long value : new long[]{-1,8589934592L,3}) {
            when(cmd.getSize()).thenReturn(value); try { update(); fail(); } catch (InvalidParameterValueException expected) { }
        }
        verify(stores,never()).update(anyLong(),any());
    }
    @Test public void zeroDisablesTrackingWithoutChangingAllocation() {
        when(cmd.getSize()).thenReturn(0L); update(); verify(stores.createForUpdate(7L)).setTotalSize(0L); verify(stores.createForUpdate(7L),never()).setAllocatedSize(any());
    }
}
