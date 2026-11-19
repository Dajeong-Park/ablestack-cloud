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

import com.cloud.dc.dao.DataCenterDao;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.kubernetes.cluster.KubernetesClusterService;
import com.cloud.kubernetes.version.dao.KubernetesSupportedVersionDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.utils.Pair;
import com.cloud.utils.db.Filter;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import org.apache.cloudstack.api.command.user.kubernetes.version.ListKubernetesSupportedVersionsCmd;
import org.apache.cloudstack.api.response.KubernetesSupportedVersionResponse;
import org.apache.cloudstack.api.response.ListResponse;
import org.apache.cloudstack.context.CallContext;
import org.junit.Assert;
import org.junit.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class KubernetesVersionPagingTest {
    private KubernetesSupportedVersionVO row(long id, String version) {
        KubernetesSupportedVersionVO value = Mockito.mock(KubernetesSupportedVersionVO.class);
        Mockito.when(value.getId()).thenReturn(id);
        Mockito.when(value.getUuid()).thenReturn("version-" + id);
        Mockito.when(value.getName()).thenReturn("Name-" + id);
        Mockito.when(value.getSemanticVersion()).thenReturn(version);
        Mockito.when(value.getMinimumCpu()).thenReturn(2);
        Mockito.when(value.getMinimumRamSize()).thenReturn(2048);
        return value;
    }

    @Test
    public void numericMinimumIsAppliedBeforeCountAndPageAcrossOriginalPageBoundary() {
        List<KubernetesSupportedVersionVO> candidates = new ArrayList<>();
        for (int i = 1; i <= 40; i++) {
            candidates.add(row(i, i <= 30 ? "1.29." + i : "1.36." + i));
        }
        Pair<List<KubernetesSupportedVersionVO>, Integer> first = KubernetesVersionCatalog.page(candidates, "1.36.0", 0L, 5L, null, null);
        Assert.assertEquals(Integer.valueOf(10), first.second());
        Assert.assertEquals(31L, first.first().get(0).getId());
        Pair<List<KubernetesSupportedVersionVO>, Integer> last = KubernetesVersionCatalog.page(candidates, "1.36.0", 5L, 5L, null, null);
        Assert.assertEquals(36L, last.first().get(0).getId());
        Assert.assertEquals(40L, last.first().get(4).getId());
        Assert.assertTrue(KubernetesVersionCatalog.page(candidates, "1.36.0", 50L, 5L, null, null).first().isEmpty());
        Assert.assertEquals(Integer.valueOf(0), KubernetesVersionCatalog.page(candidates, "2.0.0", 0L, 5L, null, null).second());
    }

    @Test
    public void globalNumericSortAndStableTieBreakDoNotSortOnlyTheCurrentPage() {
        List<KubernetesSupportedVersionVO> rows = Arrays.asList(row(11, "1.29.11"), row(10, "1.29.10"), row(9, "1.29.9"), row(8, "1.29.10"));
        Assert.assertEquals(9L, KubernetesVersionCatalog.page(rows, null, 0L, 1L, "semanticversion", "asc").first().get(0).getId());
        Assert.assertEquals(8L, KubernetesVersionCatalog.page(rows, null, 1L, 1L, "semanticversion", "asc").first().get(0).getId());
        Assert.assertEquals(11L, KubernetesVersionCatalog.page(rows, null, 0L, 1L, "semanticversion", "desc").first().get(0).getId());
        Assert.assertEquals(Integer.valueOf(4), KubernetesVersionCatalog.page(rows, "1.11.0", 0L, 10L, null, null).second());
        Assert.assertThrows(IllegalArgumentException.class, () -> KubernetesVersionCatalog.page(rows, "1.29", 0L, 5L, null, null));
    }

    @Test
    public void actualManagerFetchesUnpagedCatalogAndGroupsKeywordWithOtherPredicates() throws Exception {
        Fixture f = new Fixture();
        List<KubernetesSupportedVersionVO> rows = new ArrayList<>();
        for (int i = 1; i <= 40; i++) {
            rows.add(row(i, i <= 30 ? "1.29." + i : "1.36." + i));
        }
        Mockito.when(f.dao.searchAndCount(Mockito.any(), Mockito.any())).thenAnswer(call -> {
            Filter filter = call.getArgument(1);
            Assert.assertNull("No DB offset may precede the numeric filter", filter.getOffset());
            Assert.assertNull("No DB limit may precede the numeric filter", filter.getLimit());
            return new Pair<>(rows, rows.size());
        });
        Mockito.when(f.cmd.getMinimumSemanticVersion()).thenReturn("1.36.0");
        Mockito.when(f.cmd.getKeyword()).thenReturn("Name");
        Mockito.when(f.cmd.getStartIndex()).thenReturn(5L);
        Mockito.when(f.cmd.getPageSizeVal()).thenReturn(5L);
        try (MockedStatic<CallContext> calls = Mockito.mockStatic(CallContext.class)) {
            calls.when(CallContext::current).thenReturn(f.context);
            ListResponse<KubernetesSupportedVersionResponse> result = f.manager.listKubernetesSupportedVersions(f.cmd);
            Assert.assertEquals(Integer.valueOf(10), result.getCount());
            Assert.assertEquals("version-36", result.getResponses().get(0).getId());
            Mockito.verify(f.criteria).addAnd(Mockito.eq("name"), Mockito.eq(SearchCriteria.Op.SC), Mockito.any(SearchCriteria.class));
            Mockito.verify(f.criteria, Mockito.never()).addOr(Mockito.eq("uuid"), Mockito.any(), Mockito.any());
        }
    }

    @Test
    public void invalidMinimumIdAndConflictingMinimumsNeverBecomeBroadSuccessfulReads() {
        Fixture f = new Fixture();
        Mockito.when(f.cmd.getMinimumKubernetesVersionId()).thenReturn(999L);
        Assert.assertThrows(InvalidParameterValueException.class, () -> f.manager.listKubernetesSupportedVersions(f.cmd));
        Mockito.verify(f.dao, Mockito.never()).searchAndCount(Mockito.any(), Mockito.any());
        Mockito.when(f.cmd.getMinimumSemanticVersion()).thenReturn("1.30.0");
        Assert.assertThrows(com.cloud.utils.exception.CloudRuntimeException.class, () -> f.manager.listKubernetesSupportedVersions(f.cmd));
    }

    @Test
    public void commandRejectsUnadvertisedSortFieldsAndDirections() {
        ListKubernetesSupportedVersionsCmd command = new ListKubernetesSupportedVersionsCmd();
        ReflectionTestUtils.setField(command, "sortKey", "isourl");
        Assert.assertThrows(IllegalArgumentException.class, command::getSortKey);
        ReflectionTestUtils.setField(command, "sortOrder", "random");
        Assert.assertThrows(IllegalArgumentException.class, command::getSortOrder);
    }

    private static class Fixture {
        final KubernetesVersionManagerImpl manager = new KubernetesVersionManagerImpl();
        final KubernetesSupportedVersionDao dao = Mockito.mock(KubernetesSupportedVersionDao.class);
        final SearchCriteria<KubernetesSupportedVersionVO> criteria = Mockito.mock(SearchCriteria.class);
        final ListKubernetesSupportedVersionsCmd cmd = Mockito.mock(ListKubernetesSupportedVersionsCmd.class);
        final CallContext context = Mockito.mock(CallContext.class);

        Fixture() {
            Mockito.when(cmd.getMinimumKubernetesVersionId()).thenReturn(null);
            ReflectionTestUtils.setField(KubernetesClusterService.KubernetesServiceEnabled, "_defaultValue", "true");
            ReflectionTestUtils.setField(manager, "kubernetesSupportedVersionDao", dao);
            ReflectionTestUtils.setField(manager, "dataCenterDao", Mockito.mock(DataCenterDao.class));
            ReflectionTestUtils.setField(manager, "templateJoinDao", Mockito.mock(com.cloud.api.query.dao.TemplateJoinDao.class));
            AccountManager accounts = Mockito.mock(AccountManager.class);
            ReflectionTestUtils.setField(manager, "accountManager", accounts);
            Account account = Mockito.mock(Account.class);
            Mockito.when(context.getCallingAccount()).thenReturn(account);
            Mockito.when(accounts.isRootAdmin(Mockito.anyLong())).thenReturn(true);
            SearchBuilder<KubernetesSupportedVersionVO> builder = Mockito.mock(SearchBuilder.class);
            Mockito.when(dao.createSearchBuilder()).thenReturn(builder);
            Mockito.when(builder.entity()).thenReturn(Mockito.mock(KubernetesSupportedVersionVO.class));
            Mockito.when(builder.create()).thenReturn(criteria);
            Mockito.when(dao.createSearchCriteria()).thenAnswer(call -> Mockito.mock(SearchCriteria.class));
        }
    }
}
