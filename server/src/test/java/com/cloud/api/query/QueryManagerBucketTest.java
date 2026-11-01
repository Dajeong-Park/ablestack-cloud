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

package com.cloud.api.query;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.command.user.bucket.ListBucketsCmd;
import org.apache.cloudstack.api.response.ObjectStoreResponse;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.storage.BucketVO;
import com.cloud.storage.dao.BucketDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.AccountVO;
import com.cloud.user.User;
import com.cloud.user.UserVO;
import com.cloud.utils.Pair;
import com.cloud.utils.db.Filter;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.exception.CloudRuntimeException;

public class QueryManagerBucketTest {
    private QueryManagerImpl manager;
    private BucketDao buckets;
    private AccountManager accounts;
    private SearchBuilder<BucketVO> builder;
    private SearchCriteria<BucketVO> criteria;
    private ListBucketsCmd command;
    private BucketVO first;
    private BucketVO second;

    @Before
    public void setup() {
        manager = new QueryManagerImpl(); buckets = mock(BucketDao.class); accounts = mock(AccountManager.class);
        ReflectionTestUtils.setField(manager, "bucketDao", buckets); ReflectionTestUtils.setField(manager, "accountMgr", accounts);
        AccountVO account = new AccountVO("bucket-query", 1L, null, Account.Type.ADMIN, UUID.randomUUID().toString()); account.setId(1L);
        CallContext.register(new UserVO(1L, "bucket-query", "unused", "Bucket", "Query", "test@example.invalid", "UTC", UUID.randomUUID().toString(), User.Source.UNKNOWN), account);
        when(accounts.isRootAdmin(1L)).thenReturn(true);
        builder = mock(SearchBuilder.class, Mockito.RETURNS_SELF); criteria = mock(SearchCriteria.class);
        when(builder.entity()).thenReturn(mock(BucketVO.class)); when(builder.create()).thenReturn(criteria); when(buckets.createSearchBuilder()).thenReturn(builder);
        command = spy(new ListBucketsCmd()); doReturn(2L).when(command).getStartIndex(); doReturn(2L).when(command).getPageSizeVal();
        first = mock(BucketVO.class); when(first.getId()).thenReturn(7L); second = mock(BucketVO.class); when(second.getId()).thenReturn(9L);
        when(buckets.searchAndCount(eq(criteria), any(Filter.class))).thenReturn(new Pair<>(Arrays.asList(first, second), 6));
        when(buckets.searchByIds(any(Long[].class))).thenReturn(Arrays.asList(second, first));
    }

    @After public void cleanup() { CallContext.unregister(); }
    private Pair<List<BucketVO>, Integer> lookup() { return ReflectionTestUtils.invokeMethod(manager, "searchForBucketsInternal", command); }

    @Test public void uuidParameterResolvesObjectStoreEntityAndKeepsAdminAuthorization() throws Exception {
        Parameter annotation = ListBucketsCmd.class.getDeclaredField("objectStorageId").getAnnotation(Parameter.class);
        assertEquals(ObjectStoreResponse.class, annotation.entityType()[0]);
        assertArrayEquals(new org.apache.cloudstack.acl.RoleType[]{org.apache.cloudstack.acl.RoleType.Admin}, annotation.authorized());
    }
    @Test public void storeIsIntersectedWithIdsNameKeywordAndAclBeforePaging() {
        doReturn(42L).when(command).getObjectStorageId(); doReturn("exact").when(command).getBucketName(); doReturn("part").when(command).getKeyword(); doReturn(Arrays.asList(7L, 9L)).when(command).getIds();
        SearchCriteria<BucketVO> keyword = mock(SearchCriteria.class); when(buckets.createSearchCriteria()).thenReturn(keyword);
        doAnswer(call -> { ((List<Long>)call.getArgument(4)).add(3L); return null; }).when(accounts).buildACLSearchParameters(any(), any(), any(), any(), anyList(), any(), anyBoolean(), anyBoolean());
        Pair<List<BucketVO>, Integer> result = lookup();
        // Binding a parameter without declaring its SearchBuilder condition silently ignores IDs in SQL.
        verify(builder).and(eq("idIN"), any(), eq(SearchCriteria.Op.IN));
        verify(criteria).setParameters("objectStoreId", 42L); verify(criteria).setParameters("name", "exact"); verify(criteria).setParameters("idIN", 7L, 9L);
        verify(criteria).addAnd("name", SearchCriteria.Op.SC, keyword); verify(keyword).addOr("name", SearchCriteria.Op.LIKE, "%part%");
        verify(accounts).buildACLSearchCriteria(eq(criteria), any(), anyBoolean(), eq(Collections.singletonList(3L)), any());
        ArgumentCaptor<Filter> filter = ArgumentCaptor.forClass(Filter.class); verify(buckets).searchAndCount(eq(criteria), filter.capture());
        assertEquals(Long.valueOf(2L), filter.getValue().getOffset()); assertEquals(Long.valueOf(2L), filter.getValue().getLimit());
        assertEquals(Arrays.asList(first, second), result.first()); assertEquals(Integer.valueOf(6), result.second());
    }
    @Test public void normalQueryRetainsAclAndDoesNotAddAStorePredicateValue() {
        lookup(); verify(criteria, never()).setParameters(eq("objectStoreId"), any()); verify(accounts).buildACLSearchCriteria(eq(criteria), any(), anyBoolean(), anyList(), any());
    }
    @Test public void emptyPageRetainsTotalAndDoesNotHydrateAllBuckets() {
        when(buckets.searchAndCount(eq(criteria), any(Filter.class))).thenReturn(new Pair<>(Collections.emptyList(), 6));
        Pair<List<BucketVO>, Integer> result = lookup(); assertTrue(result.first().isEmpty()); assertEquals(Integer.valueOf(6), result.second()); verify(buckets, never()).searchByIds(any(Long[].class));
    }
    @Test public void nonRootStoreFilterIsRejectedBeforeAnyBucketLookup() {
        when(accounts.isRootAdmin(1L)).thenReturn(false); doReturn(42L).when(command).getObjectStorageId();
        try { lookup(); fail("Root-only filter must not broaden permissions"); } catch (PermissionDeniedException expected) { verifyNoInteractions(buckets); }
    }
    @Test public void idAndIdsRemainMutuallyExclusive() {
        doReturn(7L).when(command).getId(); doReturn(Collections.singletonList(9L)).when(command).getIds();
        try { lookup(); fail("id and ids must remain mutually exclusive"); } catch (com.cloud.exception.InvalidParameterValueException expected) { verify(buckets, never()).searchAndCount(any(), any()); }
    }
    @Test public void queryFailurePropagatesWithoutUnfilteredFallback() {
        doReturn(42L).when(command).getObjectStorageId(); when(buckets.searchAndCount(eq(criteria), any(Filter.class))).thenThrow(new CloudRuntimeException("read unavailable"));
        try { lookup(); fail("Failure must remain a failure"); } catch (CloudRuntimeException expected) { verify(buckets, never()).searchByIds(any(Long[].class)); }
    }
}
