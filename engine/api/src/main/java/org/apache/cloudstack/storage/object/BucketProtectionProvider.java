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
import java.util.Map;
import org.apache.cloudstack.api.response.BucketProtectionResponse;
import com.cloud.utils.exception.CloudRuntimeException;
/** Optional provider contract: absence of support is never interpreted as protection being off. */
public interface BucketProtectionProvider {
    default Map<String, String> protectionCapabilities(long storeId) {
        return Map.of("encryption", "Unknown", "versioning", "Unknown", "objectlocking", "Unknown", "reason", "PROVIDER_NOT_VERIFIED");
    }
    default BucketProtectionResponse readBucketProtection(Bucket bucket) {
        throw new CloudRuntimeException("PROTECTION_READ_UNSUPPORTED");
    }
}
