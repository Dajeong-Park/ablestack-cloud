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

package com.cloud.security.dao;

import java.util.List;

import org.springframework.stereotype.Component;

import com.cloud.security.SecurityCheckVO;
import com.cloud.utils.db.GenericDaoBase;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;

@Component
public class SecurityCheckDaoImpl extends GenericDaoBase<SecurityCheckVO, Long> implements SecurityCheckDao {
    protected SearchBuilder<SecurityCheckVO> SecurityChecksSearchBuilder;

    protected SecurityCheckDaoImpl() {
        super();
        SecurityChecksSearchBuilder = createSearchBuilder();
        SecurityChecksSearchBuilder.and("msHostId", SecurityChecksSearchBuilder.entity().getMsHostId(), SearchCriteria.Op.EQ);
        SecurityChecksSearchBuilder.and("checkName", SecurityChecksSearchBuilder.entity().getCheckName(), SearchCriteria.Op.EQ);
        SecurityChecksSearchBuilder.done();
    }

    @Override
    public List<SecurityCheckVO> getSecurityChecks(long msHostId) {
        SearchCriteria<SecurityCheckVO> sc = SecurityChecksSearchBuilder.create();
        sc.setParameters("msHostId", msHostId);
        return listBy(sc);
    }

    @Override
    public SecurityCheckVO getSecurityCheckResult(long msHostId, String checkName) {
        SearchCriteria<SecurityCheckVO> sc = SecurityChecksSearchBuilder.create();
        sc.setParameters("msHostId", msHostId);
        sc.setParameters("checkName", checkName);
        List<SecurityCheckVO> checks = listBy(sc);
        return checks.isEmpty() ? null : checks.get(0);
    }
}
