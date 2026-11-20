// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
package org.apache.cloudstack.api.response;

import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;

public class KMSMigrationResponse extends SuccessResponse {
    @SerializedName("requested")
    @Param(description = "Number of distinct requested volumes")
    private int requested;

    @SerializedName("migrated")
    @Param(description = "Number of volumes migrated by this operation")
    private int migrated;

    @SerializedName("skipped")
    @Param(description = "Number already connected to the same key")
    private int skipped;

    public KMSMigrationResponse(String responseName, int requested, int migrated) {
        super(responseName);
        this.requested = requested;
        this.migrated = migrated;
        this.skipped = requested - migrated;
    }
}
