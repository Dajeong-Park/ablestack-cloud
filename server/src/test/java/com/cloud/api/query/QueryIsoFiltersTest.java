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
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.Test;
import com.cloud.api.query.vo.TemplateJoinVO;
import com.cloud.storage.Storage;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.db.SearchCriteria.Op;

public class QueryIsoFiltersTest {
    @Test
    public void explicitFalseIsDistinctFromLegacyTrueAndOmitted() {
        assertEquals(Boolean.FALSE, QueryManagerImpl.isoReadinessFilter(false));
        assertNull(QueryManagerImpl.isoReadinessFilter(true));
        assertNull(QueryManagerImpl.isoReadinessFilter(null));
    }

    @Test
    @SuppressWarnings("unchecked")
    public void omittedConditionsLeaveTheOriginalCriteriaUnchanged() {
        SearchBuilder<TemplateJoinVO> builder = mock(SearchBuilder.class);
        SearchCriteria<TemplateJoinVO> criteria = mock(SearchCriteria.class);
        when(builder.create()).thenReturn(criteria);
        assertSame(criteria, QueryManagerImpl.isoSearchCriteria(builder, null, null));
        verify(builder, never()).and(anyString(), any(), any(Op.class));
        verify(criteria, never()).setParameters(anyString(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    public void bothPublicValuesUseAnIndependentNarrowingCondition() {
        for (Boolean value : new Boolean[] {Boolean.TRUE, Boolean.FALSE}) {
            SearchBuilder<TemplateJoinVO> builder = mock(SearchBuilder.class);
            SearchCriteria<TemplateJoinVO> criteria = mock(SearchCriteria.class);
            TemplateJoinVO entity = mock(TemplateJoinVO.class);
            when(builder.entity()).thenReturn(entity);
            when(builder.create()).thenReturn(criteria);
            assertSame(criteria, QueryManagerImpl.isoSearchCriteria(builder, value, null));
            verify(builder).and(eq("isoPublicFilter"), eq(false), eq(Op.EQ));
            verify(criteria).setParameters("isoPublicFilter", value);
            verify(criteria, never()).setParameters(eq("publicTemplate"), any());
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    public void notReadyExcludesPerHostToolsBeforeCountAndPagination() {
        SearchBuilder<TemplateJoinVO> builder = mock(SearchBuilder.class);
        SearchCriteria<TemplateJoinVO> criteria = mock(SearchCriteria.class);
        TemplateJoinVO entity = mock(TemplateJoinVO.class);
        when(builder.entity()).thenReturn(entity);
        when(builder.create()).thenReturn(criteria);
        QueryManagerImpl.isoSearchCriteria(builder, null, false);
        verify(builder).and("isoNotPerHost", null, Op.NEQ);
        verify(criteria).setParameters("isoNotPerHost", Storage.TemplateType.PERHOST);
        verify(criteria, never()).setParameters(eq("publicTemplate"), any());
    }
}
