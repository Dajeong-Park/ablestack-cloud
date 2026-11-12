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

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertThrows;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import org.junit.Test;

public class RevocationHttpClientTest {
    private void denied(String uri) { assertThrows(IllegalStateException.class, () -> RevocationHttpClient.uri(uri)); }
    private void blocked(String origin, String address, String allow) throws Exception {
        RevocationHttpClient client = new RevocationHttpClient(allow);
        assertThrows(IllegalStateException.class, () -> client.validateAddresses(URI.create(origin), new InetAddress[] {InetAddress.getByName(address)}));
    }
    @Test public void rejectsNonHttpSchemesCredentialsAndFragments() {
        for (String uri : new String[] {"file:///etc/passwd", "ldap://ca.example/", "http://user:password@ca.example/a", "http://ca.example/a#fragment", "http://ca.example:0/a", "http://ca.example:65536/a"}) { denied(uri); }
    }
    @Test public void blocksLoopbackEvenIfAllowed() throws Exception { blocked("http://127.0.0.1:80/a", "127.0.0.1", "http://127.0.0.1"); }
    @Test public void blocksMetadataLinkLocalEvenIfAllowed() throws Exception { blocked("http://169.254.169.254/a", "169.254.169.254", "http://169.254.169.254"); }
    @Test public void blocksUnspecifiedAndMulticast() throws Exception {
        blocked("http://0.0.0.0/a", "0.0.0.0", "http://0.0.0.0"); blocked("http://224.0.0.1/a", "224.0.0.1", "http://224.0.0.1");
    }
    @Test public void blocksPrivateAddressByDefault() throws Exception { blocked("http://10.10.31.10:20683/a", "10.10.31.10", ""); }
    @Test public void permitsOnlyExactAdminConfiguredOrigin() throws Exception {
        RevocationHttpClient client = new RevocationHttpClient("http://10.10.31.10:20683");
        client.validateAddresses(URI.create("http://10.10.31.10:20683/a"), new InetAddress[] {InetAddress.getByName("10.10.31.10")});
        blocked("http://10.10.31.10:20684/a", "10.10.31.10", "http://10.10.31.10:20683");
        blocked("https://10.10.31.10:20683/a", "10.10.31.10", "http://10.10.31.10:20683");
    }
    @Test public void validatesEveryResolvedAddress() throws Exception {
        RevocationHttpClient client = new RevocationHttpClient("");
        assertThrows(IllegalStateException.class, () -> client.validateAddresses(URI.create("http://ca.example/a"), new InetAddress[] {InetAddress.getByName("1.1.1.1"), InetAddress.getByName("127.0.0.1")}));
    }
    @Test public void rejectsPathInAllowlist() { assertThrows(IllegalStateException.class, () -> new RevocationHttpClient("http://10.10.31.10:20683/private")); }
    @Test public void boundsBodyWithoutContentLength() {
        RevocationHttpClient client = new RevocationHttpClient("");
        assertThrows(IOException.class, () -> client.read(new ByteArrayInputStream(new byte[RevocationHttpClient.MAX_BYTES + 1])));
    }
    @Test public void readsSmallPublicResponse() throws Exception {
        assertArrayEquals(new byte[] {1, 2, 3}, new RevocationHttpClient("").read(new ByteArrayInputStream(new byte[] {1, 2, 3})));
    }
}
