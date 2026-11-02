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
package org.apache.cloudstack.storage.object;

import org.apache.cloudstack.acl.ControlledEntity;
import org.apache.cloudstack.api.Identity;
import org.apache.cloudstack.api.InternalIdentity;

import java.util.Date;

public interface Bucket extends ControlledEntity, Identity, InternalIdentity {

    long getObjectStoreId();

    Date getCreated();

    State getState();

    void setName(String name);

    /** Logical provider usage in KiB; the existing size unit is unchanged. */
    Long getSize();

    default Date getUsageLastUpdated() { return null; }
    default Date getUsageLastAttempt() { return null; }
    default Long getUsageLastAttemptMs() { return getUsageLastAttempt() == null ? null : getUsageLastAttempt().getTime(); }
    default String getUsageStatus() { return "Unknown"; }
    default String getUsageSource() { return null; }

    static String usageStatus(String stored, Date updated, Date now) {
        if ("Error".equals(stored)) return "Error";
        if (updated == null || !"Fresh".equals(stored)) return "Unknown";
        long age = now.getTime() - updated.getTime();
        return age >= 0 && age <= 3600000L ? "Fresh" : "Stale";
    }

    Integer getQuota();

    boolean isVersioning();

    boolean isEncryption();
    default String getProtectionSnapshot() { return null; }

    boolean isObjectLock();

    String getPolicy();

    String getBucketURL();

    String getAccessKey();

    String getSecretKey();

    public enum State {
        Allocated, Created, Destroyed;
        @Override
        public String toString() {
            return this.name();
        }

        public boolean equals(String status) {
            return this.toString().equalsIgnoreCase(status);
        }
    }
}
