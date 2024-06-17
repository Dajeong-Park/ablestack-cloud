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
package com.cloud.dr.cluster.dao;

import com.cloud.dr.cluster.DisasterRecoveryClusterVmMapVO;
import com.cloud.utils.db.GenericDaoBase;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import org.springframework.stereotype.Component;

import java.util.List;


@Component
public class DisasterRecoveryClusterVmMapDaoImpl extends GenericDaoBase<DisasterRecoveryClusterVmMapVO, Long> implements DisasterRecoveryClusterVmMapDao {

    private final SearchBuilder<DisasterRecoveryClusterVmMapVO> drSearch;
    private final SearchBuilder<DisasterRecoveryClusterVmMapVO> vmSearch;

    public DisasterRecoveryClusterVmMapDaoImpl() {
        drSearch = createSearchBuilder();
        drSearch.and("drClusterId", drSearch.entity().getDrClusterId(), SearchCriteria.Op.EQ);
        drSearch.done();

        vmSearch =  createSearchBuilder();
        vmSearch.and("drClusterId", vmSearch.entity().getDrClusterId(), SearchCriteria.Op.EQ);
        vmSearch.and("virtualMachineId", vmSearch.entity().getVirtualMachineId(), SearchCriteria.Op.EQ);
        vmSearch.done();
    }
    @Override
    public List<DisasterRecoveryClusterVmMapVO> listByDisasterRecoveryClusterId(long drClusterId) {
        SearchCriteria<DisasterRecoveryClusterVmMapVO> sc = drSearch.create();
        sc.setParameters("drClusterId", drClusterId);
        return listBy(sc, null);
    }

    @Override
    public List<DisasterRecoveryClusterVmMapVO> listByDisasterRecoveryVmId(long drClusterId, long vmId) {
        SearchCriteria<DisasterRecoveryClusterVmMapVO> sc = vmSearch.create();
        sc.setParameters("drClusterId", drClusterId);
        sc.setParameters("virtualMachineId", vmId);
        return listBy(sc, null);
    }
}