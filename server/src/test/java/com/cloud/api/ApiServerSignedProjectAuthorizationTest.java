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
package com.cloud.api;

import java.lang.reflect.Field;
import java.net.InetAddress;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.apache.cloudstack.acl.APIChecker;
import org.apache.cloudstack.acl.ApiKeyPairManagerImpl;
import org.apache.cloudstack.acl.apikeypair.ApiKeyPair;
import org.apache.cloudstack.acl.apikeypair.ApiKeyPairPermission;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.command.user.loadbalancer.ListSslCertsCmd;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.MockedStatic;

import com.cloud.exception.PermissionDeniedException;
import com.cloud.projects.Project;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.User;
import com.cloud.user.UserVO;
import com.cloud.utils.Ternary;
import com.cloud.utils.db.TransactionLegacy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

public class ApiServerSignedProjectAuthorizationTest {
    private static final String COMMAND = "listSslCerts";
    private static final String API_KEY = "synthetic-test-api-key";
    private static final String SECRET = "synthetic-test-secret";
    private final InetAddress address = InetAddress.getLoopbackAddress();
    private ApiServer server;
    private AccountManager accounts;
    private ApiKeyPairManagerImpl keys;
    private ApiKeyPair pair;
    private UserVO user;
    private User systemUser;
    private Account account;
    private Project project;
    private APIChecker checker;
    private MockedStatic<TransactionLegacy> transactions;
    private Map<String, List<Class<?>>> commands;
    private List<Class<?>> previous;
    private final List<String> checks = new ArrayList<>();

    private void field(String name, Object value) throws Exception {
        Field field = ApiServer.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(server, value);
    }

    @Before
    @SuppressWarnings("unchecked")
    public void setup() throws Exception {
        server = spy(new ApiServer());
        accounts = mock(AccountManager.class); keys = mock(ApiKeyPairManagerImpl.class);
        user = mock(UserVO.class); account = mock(Account.class); pair = mock(ApiKeyPair.class);
        systemUser = mock(User.class); Account systemAccount = mock(Account.class);
        when(systemUser.getId()).thenReturn(1L); when(systemAccount.getId()).thenReturn(1L);
        when(user.getId()).thenReturn(12L); when(user.getAccountId()).thenReturn(7L);
        when(user.getState()).thenReturn(Account.State.ENABLED);
        when(account.getId()).thenReturn(7L); when(account.getRoleId()).thenReturn(8L);
        when(account.getState()).thenReturn(Account.State.ENABLED);
        when(pair.getSecretKey()).thenReturn(SECRET); when(pair.getId()).thenReturn(9L);
        when(accounts.findUserByApiKey(API_KEY)).thenReturn(new Ternary<>(user, account, pair));
        when(accounts.getAccount(7L)).thenReturn(account);
        when(keys.findAllPermissionsByKeyPairId(9L, 8L)).thenReturn(Collections.emptyList());
        field("accountMgr", accounts); field("keyPairManager", keys);
        doReturn(true).when(server).verifyApiKeyAccessAllowed(user, account);
        project = mock(Project.class);
        CallContext.register(systemUser, systemAccount).setProject(project);
        CallContext.current().setApiName(COMMAND);
        checker = mock(APIChecker.class);
        doAnswer(invocation -> {
            // Exercise verifyRequest's real authorization calls, not a mocked helper.
            assertSame(user, invocation.getArgument(0));
            assertSame(user, CallContext.current().getCallingUser());
            assertSame(account, CallContext.current().getCallingAccount());
            assertSame(project, CallContext.current().getProject());
            assertEquals(COMMAND, CallContext.current().getApiName());
            checks.add(invocation.getArgument(2) == null ? "account/project" : "key");
            return true;
        }).when(checker).checkAccess(eq(user), eq(COMMAND), any(), any(ApiKeyPairPermission[].class));
        server.setApiAccessCheckers(Collections.singletonList(checker));
        transactions = mockStatic(TransactionLegacy.class);
        transactions.when(() -> TransactionLegacy.open(TransactionLegacy.CLOUD_DB)).thenReturn(mock(TransactionLegacy.class));
        Field field = ApiServer.class.getDeclaredField("s_apiNameCmdClassMap"); field.setAccessible(true);
        commands = (Map<String, List<Class<?>>>)field.get(null);
        previous = commands.put(COMMAND, Collections.singletonList(ListSslCertsCmd.class));
    }

    @After
    public void cleanup() {
        if (transactions != null) transactions.close();
        CallContext.unregisterAll();
        if (commands != null) { if (previous == null) commands.remove(COMMAND); else commands.put(COMMAND, previous); }
    }

    private Map<String, Object[]> request(long expiresInSeconds) throws Exception {
        Map<String, Object[]> params = new TreeMap<>();
        params.put(ApiConstants.COMMAND, new String[]{COMMAND});
        params.put(ApiConstants.API_KEY, new String[]{API_KEY});
        params.put(ApiConstants.PROJECT_ID, new String[]{"synthetic-project"});
        params.put(ApiConstants.SIGNATURE_VERSION, new String[]{"3"});
        String expiry = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC).format(Instant.now().plusSeconds(expiresInSeconds));
        params.put(ApiConstants.EXPIRES, new String[]{expiry});
        List<String> pairs = new ArrayList<>();
        for (Map.Entry<String, Object[]> entry : params.entrySet()) {
            pairs.add(entry.getKey() + "=" + URLEncoder.encode((String)entry.getValue()[0], StandardCharsets.UTF_8).replace("+", "%20"));
        }
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        params.put(ApiConstants.SIGNATURE, new String[]{Base64.getEncoder().encodeToString(mac.doFinal(String.join("&", pairs).toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.UTF_8)))});
        return new HashMap<>(params);
    }

    @Test
    public void signedProjectAuthorizationUsesAuthenticatedCallerAndPreservesBothChecks() throws Exception {
        assertTrue(server.verifyRequest(request(60), null, address));
        assertEquals(List.of("account/project", "key"), checks);
        assertSame(project, CallContext.current().getProject());
    }

    @Test
    public void signedPersonalRequestKeepsProjectAbsentButStillChecksAccountAndKey() throws Exception {
        project = null; CallContext.current().setProject(null);
        assertTrue(server.verifyRequest(request(60), null, address));
        assertEquals(List.of("account/project", "key"), checks);
    }

    @Test
    public void invalidSignatureDoesNotRegisterCallerOrConsultAuthorization() throws Exception {
        Map<String, Object[]> params = request(60); params.put(ApiConstants.SIGNATURE, new String[]{"invalid-signature"});
        assertFalse(server.verifyRequest(params, null, address));
        assertSame(systemUser, CallContext.current().getCallingUser());
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void expiredRequestDoesNotConsultKeysOrAuthorization() throws Exception {
        assertFalse(server.verifyRequest(request(-60), null, address));
        verify(accounts, never()).findUserByApiKey(any());
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void removedKeyCannotReachAuthorization() throws Exception {
        when(pair.getRemoved()).thenReturn(new Date());
        assertFalse(server.verifyRequest(request(60), null, address));
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void expiredKeyCannotReachAuthorization() throws Exception {
        org.mockito.Mockito.doThrow(new PermissionDeniedException("expired key")).when(pair).validateDate();
        assertFalse(server.verifyRequest(request(60), null, address));
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void disabledUserCannotReachAuthorization() throws Exception {
        when(user.getState()).thenReturn(Account.State.DISABLED);
        assertFalse(server.verifyRequest(request(60), null, address));
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void disabledAccountCannotReachAuthorization() throws Exception {
        when(account.getState()).thenReturn(Account.State.DISABLED);
        assertFalse(server.verifyRequest(request(60), null, address));
        verifyNoInteractions(checker, keys);
    }

    @Test
    public void accountOrProjectDenyCannotBeOverriddenByKeyAllow() throws Exception {
        doAnswer(invocation -> { throw new PermissionDeniedException("project deny"); })
                .when(checker).checkAccess(eq(user), eq(COMMAND), any(), any(ApiKeyPairPermission[].class));
        ServerApiException error = assertThrows(ServerApiException.class, () -> server.verifyRequest(request(60), null, address));
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        verifyNoInteractions(keys);
    }

    @Test
    public void keyDenyIsStillEvaluatedAfterAccountAndProjectAllow() throws Exception {
        doAnswer(invocation -> {
            assertSame(user, CallContext.current().getCallingUser()); assertSame(project, CallContext.current().getProject());
            if (invocation.getArgument(2) != null) throw new PermissionDeniedException("key deny");
            return true;
        }).when(checker).checkAccess(eq(user), eq(COMMAND), any(), any(ApiKeyPairPermission[].class));
        ServerApiException error = assertThrows(ServerApiException.class, () -> server.verifyRequest(request(60), null, address));
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        verify(keys).findAllPermissionsByKeyPairId(anyLong(), anyLong());
    }
}
