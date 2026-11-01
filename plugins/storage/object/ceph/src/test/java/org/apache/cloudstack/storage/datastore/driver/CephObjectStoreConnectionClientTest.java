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
import static org.junit.Assert.assertTrue;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.Executors;
import com.sun.net.httpserver.HttpServer;
import com.google.gson.Gson;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
public class CephObjectStoreConnectionClientTest {
    private HttpServer server;
    private volatile int status = 200;
    private volatile String body = "[]";
    private volatile String observed = "";
    private volatile long delay;
    private String url;
    private final Map<String, String> keys = Map.of("accesskey", "test-access", "secretkey", "test-secret");
    private java.util.concurrent.ExecutorService executor;
    @Before public void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool(); server.setExecutor(executor);
        server.createContext("/prefix/admin/bucket", exchange -> {
            observed = exchange.getRequestMethod() + " " + exchange.getRequestURI() + " " + exchange.getRequestHeaders().getFirst("Authorization");
            try {
                Thread.sleep(delay); byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status, bytes.length); exchange.getResponseBody().write(bytes);
            } catch (Exception cancelled) { /* Deadline cancellation may close the socket. */
            } finally { exchange.close(); }
        }); server.start(); url = "http://127.0.0.1:" + server.getAddress().getPort() + "/prefix/";
    }
    @After public void stop() { server.stop(0); executor.shutdownNow(); }
    private String check(long timeout) { return new Gson().toJsonTree(new CephObjectStoreConnectionClient(timeout).check(url, keys)).getAsJsonObject().get("status").getAsString(); }
    @Test public void requiresStructuredReadOnlyResponse() {
        assertEquals("Connected", check(2000)); assertTrue(observed.startsWith("GET /prefix/admin/bucket?format=json AWS4-HMAC-SHA256 "));
        body = "{}"; assertEquals("Unknown", check(2000)); body = "x".repeat(1048577); assertEquals("Unknown", check(2000));
    }
    @Test public void distinguishesHttpFailures() {
        status = 401; assertEquals("AuthFailed", check(2000));
        status = 403; assertEquals("AccessDenied", check(2000));
        status = 503; assertEquals("Unreachable", check(2000));
        status = 504; assertEquals("Unreachable", check(2000));
    }
    @Test public void boundsDeadlineAndRecovers() {
        delay = 2000; long start = System.nanoTime(); assertEquals("Unreachable", check(150));
        assertTrue("Deadline must bound a stalled endpoint", (System.nanoTime() - start) / 1000000 < 1800);
        delay = 0; assertEquals("Connected", check(2000));
    }
}
