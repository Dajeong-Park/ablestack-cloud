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

import com.cloud.security.SecurityCheckVO;
import com.cloud.utils.db.GenericDao;

public interface SecurityCheckDao extends GenericDao<SecurityCheckVO, Long> {
    /**
     * @param msHostId
     * @return Returns all the security checks in the database for the given management server id
     */
    List<SecurityCheckVO> getSecurityChecks(long msHostId);

     /**
     * @param msHostId
     * @param checkName
     * @return returns the check result for the msHostId, the check name.
     */
    SecurityCheckVO getSecurityCheckResult(long msHostId, String checkName);
}
