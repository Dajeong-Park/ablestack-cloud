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
package org.apache.cloudstack.network.ssl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

/** Request-local limits and pinned DNS for untrusted certificate CRL/AIA URLs. */
class RevocationHttpClient {
    static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final ThreadPoolExecutor DNS = new ThreadPoolExecutor(2, 2, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(16), task -> {
                Thread thread = new Thread(task, "ssl-revocation-dns");
                thread.setDaemon(true);
                return thread;
            });
    private final Set<String> allowedInternal = new HashSet<>();
    private final long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
    private int downloads;
    private int bytes;

    RevocationHttpClient(String allowedOrigins) {
        if (allowedOrigins != null) {
            for (String entry : allowedOrigins.split(",")) {
                if (!entry.isBlank()) {
                    URI uri = uri(entry.trim());
                    if (uri.getRawQuery() != null || !(uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))) {
                        throw failure("ENDPOINT_BLOCKED");
                    }
                    allowedInternal.add(origin(uri));
                }
            }
        }
    }

    static IllegalStateException failure(String category) {
        return new IllegalStateException("Invalid certificate chain: revocation " + category);
    }

    static URI uri(String value) {
        try {
            URI uri = new URI(value);
            if (value.length() > 2048 || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null
                    || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || uri.getPort() == 0 || uri.getPort() > 65535) {
                throw failure("ENDPOINT_BLOCKED");
            }
            return uri;
        } catch (URISyntaxException | NullPointerException e) {
            throw failure("ENDPOINT_BLOCKED");
        }
    }

    private static String origin(URI uri) {
        int port = uri.getPort() < 0 ? ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80) : uri.getPort();
        return uri.getScheme().toLowerCase(Locale.ROOT) + "://" + uri.getHost().toLowerCase(Locale.ROOT) + ":" + port;
    }

    InetAddress[] addresses(URI uri) throws IOException {
        Future<InetAddress[]> pending = DNS.submit(() -> InetAddress.getAllByName(uri.getHost()));
        try {
            InetAddress[] resolved = pending.get(Math.min(2000, remaining()), TimeUnit.MILLISECONDS);
            validateAddresses(uri, resolved);
            return resolved;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Revocation DNS unavailable");
        } finally {
            pending.cancel(true);
        }
    }

    void validateAddresses(URI uri, InetAddress[] resolved) {
        if (resolved.length == 0) {
            throw failure("ENDPOINT_BLOCKED");
        }
        for (InetAddress address : resolved) {
            byte[] raw = address.getAddress();
            boolean internalV6 = raw.length == 16 && (raw[0] & 0xfe) == 0xfc;
            if (address.isLoopbackAddress() || address.isAnyLocalAddress() || address.isLinkLocalAddress() || address.isMulticastAddress()
                    || ((address.isSiteLocalAddress() || internalV6) && !allowedInternal.contains(origin(uri)))) {
                throw failure("ENDPOINT_BLOCKED");
            }
        }
    }

    private int remaining() throws IOException {
        long millis = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime());
        if (millis <= 0) {
            throw new IOException("Revocation deadline exceeded");
        }
        return (int)Math.min(3000, millis);
    }

    byte[] fetch(String address, byte[] request) throws IOException {
        if (++downloads > 16) {
            throw new IOException("Revocation request limit exceeded");
        }
        URI uri = uri(address);
        InetAddress[] resolved = addresses(uri);
        RequestConfig config = RequestConfig.custom().setConnectTimeout(remaining()).setSocketTimeout(remaining())
                .setConnectionRequestTimeout(remaining()).build();
        try (CloseableHttpClient client = HttpClients.custom().setDefaultRequestConfig(config)
                .setDnsResolver(host -> Arrays.copyOf(resolved, resolved.length)).disableRedirectHandling().disableAutomaticRetries()
                .disableCookieManagement().disableContentCompression().build()) {
            HttpRequestBase method;
            if (request == null) {
                method = new HttpGet(uri);
                method.setHeader("Accept", "application/pkix-crl");
            } else {
                HttpPost post = new HttpPost(uri);
                post.setEntity(new ByteArrayEntity(request));
                post.setHeader("Content-Type", "application/ocsp-request");
                post.setHeader("Accept", "application/ocsp-response");
                method = post;
            }
            try (CloseableHttpResponse response = client.execute(method)) {
                if (response.getStatusLine().getStatusCode() != 200 || response.getEntity() == null
                        || response.containsHeader("Content-Encoding")) {
                    throw new IOException("Revocation HTTP response unavailable");
                }
                if (response.getEntity().getContentLength() > MAX_BYTES) {
                    throw new IOException("Revocation response too large");
                }
                try (InputStream stream = response.getEntity().getContent()) {
                    return read(stream);
                }
            } finally {
                method.releaseConnection();
            }
        }
    }

    byte[] read(InputStream stream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            remaining();
            bytes += count;
            if (out.size() + count > MAX_BYTES || bytes > 8 * MAX_BYTES / 2) {
                throw new IOException("Revocation response limit exceeded");
            }
            out.write(buffer, 0, count);
        }
        return out.toByteArray();
    }
}
