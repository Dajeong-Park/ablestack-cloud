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
package org.apache.cloudstack.storage.datastore.driver;

import java.util.TreeMap;
import java.nio.charset.StandardCharsets;
import com.amazonaws.AmazonServiceException;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GetObjectMetadataRequest;
import org.apache.cloudstack.api.response.BucketObjectMetadataResponse;
import org.apache.cloudstack.api.response.BucketObjectMetadataResponse.Status;

/** One standard, tenant-authenticated S3 HEAD, with no listing extension or browser CORS dependency. */
public class CephBucketMetadataClient {
    private final AmazonS3 client;
    public CephBucketMetadataClient(AmazonS3 client) { this.client = client; }
    public BucketObjectMetadataResponse head(String bucket, String key, String version) {
        try {
            var request = new GetObjectMetadataRequest(bucket, key);
            if (version != null) request.setVersionId(version);
            var object = client.getObjectMetadata(request);
            if (object == null || object.getRawMetadataValue("Content-Length") == null || object.getContentLength() < 0 ||
                    object.getRawMetadataValue("x-amz-missing-meta") != null && !"0".equals(String.valueOf(object.getRawMetadataValue("x-amz-missing-meta"))) ||
                    object.getLastModified() == null || object.getETag() == null || object.getETag().isEmpty()) {
                return failed(key, version, Status.Unavailable);
            }
            if (Boolean.TRUE.equals(object.getRawMetadataValue("x-amz-delete-marker"))) return failed(key, version, Status.NotFound);
            if (version != null && !version.equals(object.getVersionId())) return failed(key, version, Status.Unavailable);
            var metadata = new TreeMap<String, String>();
            int bytes = 0;
            if (object.getUserMetadata() != null) {
                if (object.getUserMetadata().size() > 64) return failed(key, version, Status.Unavailable);
                for (var entry : object.getUserMetadata().entrySet()) {
                    if (entry.getKey() == null || entry.getValue() == null) return failed(key, version, Status.Unavailable);
                    bytes += entry.getKey().getBytes(StandardCharsets.UTF_8).length + entry.getValue().getBytes(StandardCharsets.UTF_8).length;
                    if (bytes > 32768) return failed(key, version, Status.Unavailable);
                    metadata.put(entry.getKey(), entry.getValue());
                }
            }
            String etag = object.getETag();
            if (etag.length() >= 2 && etag.startsWith("\"") && etag.endsWith("\"")) etag = etag.substring(1, etag.length() - 1);
            if (etag.isEmpty()) return failed(key, version, Status.Unavailable);
            var response = new BucketObjectMetadataResponse(key, object.getVersionId(), Status.Available);
            response.setSizeBytes(object.getContentLength()); response.setLastModified(object.getLastModified());
            response.setEtag(etag); response.setContentType(object.getContentType()); response.setMetadata(metadata);
            return response;
        } catch (AmazonServiceException failure) {
            if (failure.getStatusCode() == 404 || failure.getStatusCode() == 405 && version != null) return failed(key, version, Status.NotFound);
            if (failure.getStatusCode() == 403) return failed(key, version, Status.Forbidden);
            if (failure.getStatusCode() == 408 || failure.getStatusCode() == 504 || "RequestTimeout".equals(failure.getErrorCode())) return failed(key, version, Status.Timeout);
            if (failure.getStatusCode() == 501) return failed(key, version, Status.Unsupported);
            return failed(key, version, Status.Unavailable);
        } catch (RuntimeException failure) {
            Throwable cause = failure;
            for (int depth = 0; cause != null && depth < 16; depth++, cause = cause.getCause()) {
                if (cause instanceof java.net.SocketTimeoutException || cause instanceof com.amazonaws.http.exception.HttpRequestTimeoutException ||
                        cause instanceof com.amazonaws.http.timers.client.ClientExecutionTimeoutException) return failed(key, version, Status.Timeout);
                if (cause.getCause() == cause) break;
            }
            return failed(key, version, Status.Unavailable);
        }
    }
    private BucketObjectMetadataResponse failed(String key, String version, Status status) { return new BucketObjectMetadataResponse(key, version, status); }
}
