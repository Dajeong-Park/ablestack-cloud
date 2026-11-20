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
package com.cloud.network.vpn;

import com.cloud.network.dao.IPAddressDao;
import com.cloud.network.dao.IPAddressVO;
import com.cloud.network.dao.Site2SiteVpnGatewayDao;
import com.cloud.network.dao.Site2SiteVpnGatewayVO;
import com.cloud.network.vpc.VpcVO;
import com.cloud.network.vpc.dao.VpcDao;
import com.cloud.utils.db.JoinBuilder;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;

/** Adds a bound, grouped keyword predicate without changing the caller's ACL or pagination. */
final class Site2SiteVpnGatewaySearch {
    private Site2SiteVpnGatewaySearch() { }

    static SearchCriteria<Site2SiteVpnGatewayVO> keyword(SearchBuilder<Site2SiteVpnGatewayVO> builder,
            Site2SiteVpnGatewayDao gateways, IPAddressDao addresses, VpcDao vpcs, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return null;
        }
        String pattern = "%" + keyword.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        SearchBuilder<IPAddressVO> ip = addresses.createSearchBuilder();
        builder.join("user_ip_address", ip, builder.entity().getAddrId(), ip.entity().getId(), JoinBuilder.JoinType.LEFT);
        SearchBuilder<VpcVO> vpc = vpcs.createSearchBuilder();
        builder.join("vpc", vpc, builder.entity().getVpcId(), vpc.entity().getId(), JoinBuilder.JoinType.LEFT);

        // Each nested criterion retains its own table attributes. The group is ANDed with the existing ACL.
        SearchCriteria<Site2SiteVpnGatewayVO> group = gateways.createSearchCriteria();
        group.addOr("uuid", SearchCriteria.Op.LIKE, pattern);
        SearchCriteria<IPAddressVO> ipMatch = addresses.createSearchCriteria();
        ipMatch.addAnd("address", SearchCriteria.Op.LIKE, pattern);
        group.addOr("id", SearchCriteria.Op.SC, ipMatch);
        SearchCriteria<VpcVO> vpcMatch = vpcs.createSearchCriteria();
        vpcMatch.addAnd("name", SearchCriteria.Op.LIKE, pattern);
        group.addOr("id", SearchCriteria.Op.SC, vpcMatch);
        return group;
    }
}
