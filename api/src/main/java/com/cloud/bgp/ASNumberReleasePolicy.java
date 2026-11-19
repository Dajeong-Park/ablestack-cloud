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
package com.cloud.bgp;

/** Resource eligibility only; command authorization is checked separately. */
public final class ASNumberReleasePolicy {
    public static final String ELIGIBLE = "eligible";
    public static final String NOT_ALLOCATED = "notallocated";
    public static final String REQUIRED = "requiredbyoffering";
    public static final String MISSING = "missingreference";
    public static final String UNKNOWN = "unknown";

    private ASNumberReleasePolicy() {
    }

    public static String reason(ASNumber number, boolean validReference, Boolean requiredByOffering) {
        if (number == null) {
            return UNKNOWN;
        }
        if (!number.isAllocated()) {
            return NOT_ALLOCATED;
        }
        if (number.getNetworkId() != null && number.getVpcId() != null) {
            return UNKNOWN;
        }
        if (!validReference || number.getNetworkId() == null && number.getVpcId() == null) {
            return MISSING;
        }
        if (requiredByOffering == null) {
            return UNKNOWN;
        }
        return requiredByOffering ? REQUIRED : ELIGIBLE;
    }
}
