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

import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import com.amazonaws.DefaultRequest;
import com.amazonaws.auth.AWS4Signer;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.http.HttpMethodName;
import com.google.gson.JsonParser;
import org.apache.cloudstack.api.response.ObjectStoreConnectionResponse;
import org.apache.cloudstack.api.response.ObjectStoreConnectionResponse.Status;
import org.apache.cloudstack.api.response.ObjectStoreConnectionResponse.Reason;

/** Bounded, signed, read-only Admin Ops check. No retries, redirects, mutations or raw diagnostics. */
public class CephObjectStoreConnectionClient {
    private static final ThreadPoolExecutor WORKERS = new ThreadPoolExecutor(0, 4, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), work -> {
        Thread thread = new Thread(work, "glue-connection-check"); thread.setDaemon(true); return thread;
    });
    private final long timeoutMs;
    public CephObjectStoreConnectionClient() { this(10000); }
    CephObjectStoreConnectionClient(long timeoutMs) { this.timeoutMs = timeoutMs; }
    public ObjectStoreConnectionResponse check(String url, Map<String, String> details) {
        AtomicReference<HttpURLConnection> active = new AtomicReference<>();
        java.util.concurrent.Future<ObjectStoreConnectionResponse> task = null;
        try {
            task = WORKERS.submit(() -> request(url, details, active));
            return task.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (java.util.concurrent.RejectedExecutionException busy) { return result(Status.Unknown, Reason.Busy);
        } catch (java.util.concurrent.TimeoutException timeout) { return result(Status.Unreachable, Reason.Timeout);
        } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); return result(Status.Unknown, Reason.Unavailable);
        } catch (Exception unavailable) { return result(Status.Unknown, Reason.Unavailable);
        } finally {
            if (task != null && !task.isDone()) task.cancel(true);
            HttpURLConnection connection = active.get(); if (connection != null) connection.disconnect();
        }
    }
    private ObjectStoreConnectionResponse request(String url, Map<String, String> details, AtomicReference<HttpURLConnection> active) {
        HttpURLConnection connection = null;
        try {
            URI target = URI.create(url);
            if (!("http".equalsIgnoreCase(target.getScheme()) || "https".equalsIgnoreCase(target.getScheme())) || target.getHost() == null ||
                    target.getRawUserInfo() != null || target.getRawQuery() != null || target.getRawFragment() != null) return result(Status.Unknown, Reason.InvalidEndpoint);
            if (details == null || details.get("accesskey") == null || details.get("secretkey") == null || details.get("accesskey").isBlank() || details.get("secretkey").isBlank()) return result(Status.AuthFailed, Reason.AuthRejected);
            URI endpoint = new URI(target.getScheme(), null, target.getHost(), target.getPort(), null, null, null);
            String prefix = target.getPath() == null ? "" : target.getPath().replaceAll("/+$", "");
            DefaultRequest<Void> request = new DefaultRequest<>("s3"); request.setEndpoint(endpoint); request.setResourcePath(prefix + "/admin/bucket");
            request.setHttpMethod(HttpMethodName.GET); request.addParameter("format", "json"); request.setContent(new ByteArrayInputStream(new byte[0]));
            request.addHeader("x-amz-content-sha256", com.amazonaws.util.BinaryUtils.toHex(java.security.MessageDigest.getInstance("SHA-256").digest(new byte[0])));
            AWS4Signer signer = new AWS4Signer(false); signer.setServiceName("s3"); signer.setRegionName("us-east-1");
            signer.sign(request, new BasicAWSCredentials(details.get("accesskey"), details.get("secretkey")));
            connection = (HttpURLConnection) URI.create(endpoint.toASCIIString() + request.getResourcePath() + "?format=json").toURL().openConnection();
            active.set(connection); connection.setConnectTimeout(5000); connection.setReadTimeout(5000); connection.setInstanceFollowRedirects(false); connection.setRequestMethod("GET");
            for (var header : request.getHeaders().entrySet()) connection.setRequestProperty(header.getKey(), header.getValue());
            int code = connection.getResponseCode();
            byte[] bytes;
            java.io.InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            try (java.io.InputStream input = stream) { bytes = input == null ? new byte[0] : input.readNBytes(1048577); }
            if (code == 401) return result(Status.AuthFailed, Reason.AuthRejected);
            if (code == 403) {
                String body = new String(bytes, StandardCharsets.UTF_8);
                boolean rejected = java.util.List.of("InvalidAccessKeyId", "SignatureDoesNotMatch", "InvalidSecurityToken", "ExpiredToken").stream()
                    .anyMatch(error -> body.contains("<Code>" + error + "</Code>") || jsonErrorCode(body).equals(error));
                return result(rejected ? Status.AuthFailed : Status.AccessDenied, rejected ? Reason.AuthRejected : Reason.PermissionDenied);
            }
            if (code == 408 || code == 504) return result(Status.Unreachable, Reason.Timeout);
            if (code == 429 || code >= 500) return result(Status.Unreachable, Reason.Unavailable);
            if (code != 200 || bytes.length > 1048576) return result(Status.Unknown, Reason.UnexpectedResponse);
            if (!JsonParser.parseString(new String(bytes, StandardCharsets.UTF_8)).isJsonArray()) return result(Status.Unknown, Reason.UnexpectedResponse);
            return result(Status.Connected, Reason.Verified);
        } catch (java.net.SocketTimeoutException timeout) { return result(Status.Unreachable, Reason.Timeout);
        } catch (javax.net.ssl.SSLException tls) { return result(Status.Unreachable, Reason.Tls);
        } catch (java.io.IOException network) { return result(Status.Unreachable, Reason.Network);
        } catch (Exception invalid) { return result(Status.Unknown, Reason.UnexpectedResponse);
        } finally { if (connection != null) connection.disconnect(); }
    }
    private static String jsonErrorCode(String body) {
        try {
            var object = JsonParser.parseString(body).getAsJsonObject();
            return object.has("Code") ? object.get("Code").getAsString() : object.has("code") ? object.get("code").getAsString() : "";
        } catch (RuntimeException invalid) { return ""; }
    }
    private static ObjectStoreConnectionResponse result(Status status, Reason reason) { return ObjectStoreConnectionResponse.result(status, reason); }
}
