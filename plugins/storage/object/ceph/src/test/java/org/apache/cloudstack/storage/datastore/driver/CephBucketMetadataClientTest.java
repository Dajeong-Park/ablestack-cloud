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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import java.util.Date;
import java.util.Map;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.GetObjectMetadataRequest;
import com.amazonaws.services.s3.model.AmazonS3Exception;
import org.apache.cloudstack.api.response.BucketObjectMetadataResponse.Status;
import org.junit.Test;

public class CephBucketMetadataClientTest {
    private final AmazonS3 s3 = mock(AmazonS3.class);
    private final CephBucketMetadataClient client = new CephBucketMetadataClient(s3);
    private ObjectMetadata object(long size) {
        var value = new ObjectMetadata(); value.setContentLength(size); value.setLastModified(new Date(100000));
        value.setHeader("ETag", "\"etag\""); value.setContentType("text/plain; charset=utf-8");
        value.setUserMetadata(Map.of("note", "<img src=x onerror=alert(1)>")); return value;
    }
    @Test public void standardHeadReturnsOnlyAllowlistedFieldsAndLiteralMetadata() {
        var data = object(5); data.setHeader("Authorization", "provider-secret"); data.setHeader("x-amz-request-id", "private");
        when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenReturn(data);
        var response = client.head("bucket", "한글 공백 + %2F #?&.txt", null);
        assertEquals(Status.Available, response.getStatus()); assertEquals(Long.valueOf(5), response.getSizeBytes());
        assertEquals("etag", response.getEtag()); assertEquals(data.getUserMetadata(), response.getMetadata());
        String json = new com.google.gson.Gson().toJson(response); assertFalse(json.contains("provider-secret")); assertFalse(json.contains("request-id"));
        var capture = org.mockito.ArgumentCaptor.forClass(GetObjectMetadataRequest.class); verify(s3).getObjectMetadata(capture.capture());
        assertEquals("한글 공백 + %2F #?&.txt", capture.getValue().getKey()); assertNull(capture.getValue().getVersionId());
        verify(s3, never()).listObjectsV2(any(com.amazonaws.services.s3.model.ListObjectsV2Request.class));
    }
    @Test public void zeroBytesWithNoMetadataIsSuccessfulNotMissing() {
        var data = object(0); data.setUserMetadata(Map.of()); when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenReturn(data);
        var response = client.head("bucket", "zero", null); assertEquals(Status.Available, response.getStatus()); assertEquals(Long.valueOf(0), response.getSizeBytes()); assertTrue(response.getMetadata().isEmpty());
    }
    @Test public void exactVersionIsForwardedAndVerified() {
        var data = object(5); data.setHeader("x-amz-version-id", "v+%2F/?"); when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenReturn(data);
        assertEquals(Status.Available, client.head("bucket", "key", "v+%2F/?").getStatus());
        var request = org.mockito.ArgumentCaptor.forClass(GetObjectMetadataRequest.class); verify(s3).getObjectMetadata(request.capture()); assertEquals("v+%2F/?", request.getValue().getVersionId());
        assertEquals(Status.Unavailable, client.head("bucket", "key", "different").getStatus());
    }
    @Test public void failuresAreTypedAndNeverContainProviderDiagnostics() {
        for (int http : new int[]{403,404,405,408,500,501,504}) {
            var error = new AmazonS3Exception("secret provider diagnostics"); error.setStatusCode(http); when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenThrow(error);
            var result = client.head("bucket", "key", "version");
            Status expected = http == 403 ? Status.Forbidden : http == 404 || http == 405 ? Status.NotFound : http == 408 || http == 504 ? Status.Timeout : http == 501 ? Status.Unsupported : Status.Unavailable;
            assertEquals(expected, result.getStatus()); assertNull(result.getMetadata()); assertFalse(new com.google.gson.Gson().toJson(result).contains("secret"));
        }
    }
    @Test public void transportTimeoutIsDistinctAndCauseInspectionIsBounded() {
        when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenThrow(new com.amazonaws.SdkClientException("private", new java.net.SocketTimeoutException()));
        assertEquals(Status.Timeout, client.head("bucket", "key", null).getStatus());
        when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenThrow(new IllegalStateException("private")); assertEquals(Status.Unavailable, client.head("bucket", "key", null).getStatus());
    }
    @Test public void incompleteOrOversizedResponseCannotBecomeEmptySuccess() {
        for (int kind = 0; kind < 5; kind++) {
            var data = object(5);
            if (kind == 0) data.setHeader("ETag", null);
            if (kind == 1) data.setLastModified(null);
            if (kind == 2) data.setContentLength(-1);
            if (kind == 3) data.setUserMetadata(Map.of("note", "a".repeat(32769)));
            if (kind == 4) data.setHeader("x-amz-missing-meta", 1);
            when(s3.getObjectMetadata(any(GetObjectMetadataRequest.class))).thenReturn(data); assertEquals(Status.Unavailable, client.head("bucket", "key", null).getStatus());
        }
    }
    @Test public void realSdkEncodesUtf8KeyAndVersionExactlyOnceInOneHead() throws Exception {
        var requests = new java.util.concurrent.CopyOnWriteArrayList<String>();
        var server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            requests.add(exchange.getRequestMethod()+" "+exchange.getRequestURI().getRawPath()+"?"+exchange.getRequestURI().getRawQuery());
            var headers = exchange.getResponseHeaders(); headers.set("Content-Length", "5"); headers.set("ETag", "\"etag\"");
            headers.set("Last-Modified", "Sun, 01 Nov 2026 00:00:00 GMT"); headers.set("Content-Type", "text/plain"); headers.set("x-amz-meta-note", "standard-head"); headers.set("x-amz-version-id", "v+%2F/?");
            exchange.sendResponseHeaders(200, -1); exchange.close();
        }); server.start();
        AmazonS3 real = null;
        try {
            real = com.amazonaws.services.s3.AmazonS3ClientBuilder.standard().enablePathStyleAccess()
                    .withEndpointConfiguration(new com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration("http://127.0.0.1:"+server.getAddress().getPort(), "us-east-1"))
                    .withCredentials(new com.amazonaws.auth.AWSStaticCredentialsProvider(new com.amazonaws.auth.BasicAWSCredentials("mock-access", "mock-secret")))
                    .withClientConfiguration(new com.amazonaws.ClientConfiguration().withMaxErrorRetry(0).withConnectionTimeout(2000).withSocketTimeout(2000)).build();
            String key = "한글 공백 + %2F #?&.txt", version = "v+%2F/?";
            var result = new CephBucketMetadataClient(real).head("bucket", key, version); assertEquals(Status.Available, result.getStatus());
            assertEquals(1, requests.size()); String request = requests.get(0); assertTrue(request.startsWith("HEAD "));
            String[] target = request.substring(5).split("\\?", 2);
            assertEquals("/bucket/"+key, java.net.URLDecoder.decode(target[0], java.nio.charset.StandardCharsets.UTF_8));
            assertEquals("versionId="+version, java.net.URLDecoder.decode(target[1], java.nio.charset.StandardCharsets.UTF_8));
        } finally { if (real != null) real.shutdown(); server.stop(0); }
    }
}
