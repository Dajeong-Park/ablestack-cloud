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
package com.cloud.utils.db;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import com.cloud.storage.BucketVO;
import java.sql.PreparedStatement;
import java.util.Date;
import org.junit.Test;

/** Use the actual GenericDao parameter binder, not a mocked BucketDao update. */
public class BucketUsageBindingTest {
    @Test public void bothCollectionDatesProduceBoundSqlParameters() throws Exception {
        GenericDaoBase<?, ?> dao = mock(GenericDaoBase.class, CALLS_REAL_METHODS);
        for (String name : new String[] {"usageLastUpdated", "usageLastAttempt"}) {
            Attribute attribute = new Attribute(BucketVO.class, null, BucketVO.class.getDeclaredField(name), "bucket", false, false);
            PreparedStatement statement = mock(PreparedStatement.class);
            dao.prepareAttribute(1, statement, attribute, new Date(1900));
            verify(statement).setString(1, "1970-01-01 00:00:01");
        }
    }
    @Test public void separateAttemptOrderRetainsMillisecondsDespiteLegacyDateFormatting() throws Exception {
        GenericDaoBase<?, ?> dao = mock(GenericDaoBase.class, CALLS_REAL_METHODS);
        Attribute attribute = new Attribute(BucketVO.class, null, BucketVO.class.getDeclaredField("usageLastAttemptMs"), "bucket", false, false);
        PreparedStatement statement = mock(PreparedStatement.class);
        dao.prepareAttribute(1, statement, attribute, 1901L);
        verify(statement).setObject(1, 1901L);
    }
}
