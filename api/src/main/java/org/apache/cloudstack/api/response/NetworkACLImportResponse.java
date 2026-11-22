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
package org.apache.cloudstack.api.response;

import java.util.List;
import java.util.Map;

import org.apache.cloudstack.api.BaseResponse;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;

public class NetworkACLImportResponse extends BaseResponse {
    @SerializedName("importedrules")
    @Param(description = "Rules persisted by the import")
    private final List<NetworkACLItemResponse> importedRules;

    @SerializedName("failedrows")
    @Param(description = "Validation errors keyed by the submitted rule index")
    private final Map<String, String> failedRows;

    @SerializedName("successcount")
    @Param(description = "Number of rules persisted")
    private final int successCount;

    @SerializedName("failurecount")
    @Param(description = "Number of rules rejected")
    private final int failureCount;

    @SerializedName("applied")
    @Param(description = "Whether the persisted rules were applied to associated networks and private gateways")
    private final boolean applied;

    public NetworkACLImportResponse(List<NetworkACLItemResponse> importedRules, Map<String, String> failedRows, boolean applied) {
        this.importedRules = importedRules;
        this.failedRows = failedRows;
        this.successCount = importedRules.size();
        this.failureCount = failedRows.size();
        this.applied = applied;
    }
}
