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
package com.cloud.api.dispatch;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.command.user.loadbalancer.AssignCertToLoadBalancerCmd;
import org.apache.cloudstack.api.command.user.loadbalancer.RemoveCertFromLoadBalancerCmd;
import org.apache.cloudstack.context.CallContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import com.cloud.exception.PermissionDeniedException;
import com.cloud.network.rules.LoadBalancer;
import com.cloud.projects.Project;
import com.cloud.projects.ProjectService;
import com.cloud.user.Account;
import com.cloud.user.AccountService;
import com.cloud.user.User;
import com.cloud.utils.db.EntityManager;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@RunWith(Parameterized.class)
public class LoadBalancerCertificateProjectAccessTest {
    private static final String PROJECT_UUID = "aaaaaaaa-0000-0000-0000-000000000001";
    private static final String OTHER_PROJECT_UUID = "bbbbbbbb-0000-0000-0000-000000000002";
    @Mock private AccountService accountService;
    @Mock private EntityManager entityManager;
    @Mock private ProjectService projectService;
    @InjectMocks private SpecificCmdValidationWorker worker = new SpecificCmdValidationWorker();
    private AutoCloseable mocks;
    private final String commandName;
    private BaseCmd command;
    private final Account caller = mock(Account.class);
    private final Account owner = mock(Account.class);
    private final Project project = mock(Project.class);
    private final LoadBalancer loadBalancer = mock(LoadBalancer.class);
    private final Map<String, String> params = new HashMap<>();

    @Parameterized.Parameters(name = "{0}")
    public static Collection<Object[]> commands() {
        return Arrays.asList(new Object[][]{{"assignCertToLoadBalancer"}, {"removeCertFromLoadBalancer"}});
    }

    public LoadBalancerCertificateProjectAccessTest(String commandName) {
        this.commandName = commandName;
    }

    @Before
    public void setUp() {
        mocks = MockitoAnnotations.openMocks(this);
        User user = mock(User.class);
        when(user.getId()).thenReturn(201L);
        when(user.getAccountId()).thenReturn(101L);
        when(caller.getId()).thenReturn(101L);
        CallContext.register(user, caller);
        // Async dispatch must not depend on an API name left by the HTTP layer.
        CallContext.current().setApiName("queryAsyncJobResult");
        when(loadBalancer.getAccountId()).thenReturn(900L);
        when(entityManager.findById(LoadBalancer.class, 71L)).thenReturn(loadBalancer);
        when(accountService.getAccount(900L)).thenReturn(owner);
        when(owner.getId()).thenReturn(900L);
        when(owner.getType()).thenReturn(Account.Type.PROJECT);
        when(projectService.findByProjectAccountId(900L)).thenReturn(project);
        when(project.getUuid()).thenReturn(PROJECT_UUID);
        if ("assignCertToLoadBalancer".equals(commandName)) {
            AssignCertToLoadBalancerCmd assign = mock(AssignCertToLoadBalancerCmd.class);
            when(assign.getLbRuleId()).thenReturn(71L);
            command = assign;
        } else {
            RemoveCertFromLoadBalancerCmd remove = mock(RemoveCertFromLoadBalancerCmd.class);
            when(remove.getLbRuleId()).thenReturn(71L);
            command = remove;
        }
    }

    @After
    public void tearDown() throws Exception {
        CallContext.unregister();
        mocks.close();
    }

    private void handle() {
        worker.handle(new DispatchTask(command, params));
    }

    private void denyByExistingPolicy() {
        doThrow(new PermissionDeniedException("project role deny")).when(accountService)
                .checkAccess(eq(caller), isNull(), eq(true), eq(commandName), eq(loadBalancer));
    }

    @Test
    public void deniedWithoutProjectIsRejectedBeforeCommandValidation() {
        denyByExistingPolicy();
        ServerApiException error = assertThrows(ServerApiException.class, this::handle);
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        assertSame(project, CallContext.current().getProject());
        assertEquals(commandName, CallContext.current().getApiName());
        verify(command, never()).validateSpecificParameters(params);
    }

    @Test
    public void deniedWithMatchingProjectUsesTheSamePolicy() {
        params.put(ApiConstants.PROJECT_ID, PROJECT_UUID);
        deniedWithoutProjectIsRejectedBeforeCommandValidation();
    }

    @Test
    public void allowedWithoutProjectBindsActualProjectForQueuedExecution() {
        handle();
        assertSame(project, CallContext.current().getProject());
        assertEquals(commandName, CallContext.current().getApiName());
        assertEquals(PROJECT_UUID, params.get(ApiConstants.PROJECT_ID));
        verify(accountService).checkAccess(caller, null, true, commandName, loadBalancer);
        verify(command).validateSpecificParameters(params);
    }

    @Test
    public void allowedMatchingProjectRemainsValid() {
        params.put(ApiConstants.PROJECT_ID, PROJECT_UUID);
        allowedWithoutProjectBindsActualProjectForQueuedExecution();
    }

    @Test
    public void uuidCaseIsNormalizedBeforeQueueing() {
        params.put(ApiConstants.PROJECT_ID, PROJECT_UUID.toUpperCase(java.util.Locale.ROOT));
        allowedWithoutProjectBindsActualProjectForQueuedExecution();
    }

    @Test
    public void unrelatedProjectIsRejectedBeforeAuthorizationOrExecution() {
        params.put(ApiConstants.PROJECT_ID, OTHER_PROJECT_UUID);
        ServerApiException error = assertThrows(ServerApiException.class, this::handle);
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        verify(accountService, never()).checkAccess(caller, null, true, commandName, loadBalancer);
        verify(command, never()).validateSpecificParameters(params);
    }

    @Test
    public void personalLoadBalancerKeepsItsOriginalAccessPolicy() {
        when(owner.getType()).thenReturn(Account.Type.NORMAL);
        CallContext.current().setProject(mock(Project.class));
        handle();
        assertNull(CallContext.current().getProject());
        assertFalse(params.containsKey(ApiConstants.PROJECT_ID));
        verify(accountService).checkAccess(caller, null, true, commandName, loadBalancer);
        verifyNoInteractions(projectService);
    }

    @Test
    public void projectContextCannotBeAppliedToPersonalLoadBalancer() {
        when(owner.getType()).thenReturn(Account.Type.NORMAL);
        unrelatedProjectIsRejectedBeforeAuthorizationOrExecution();
    }

    @Test
    public void projectAccountWithoutActiveProjectFailsClosed() {
        when(projectService.findByProjectAccountId(900L)).thenReturn(null);
        ServerApiException error = assertThrows(ServerApiException.class, this::handle);
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        verify(command, never()).validateSpecificParameters(params);
    }

    @Test
    public void missingOwnerFailsClosed() {
        when(accountService.getAccount(900L)).thenReturn(null);
        ServerApiException error = assertThrows(ServerApiException.class, this::handle);
        assertEquals(ApiErrorCode.UNAUTHORIZED, error.getErrorCode());
        verify(command, never()).validateSpecificParameters(params);
    }

    @Test
    public void missingLoadBalancerIsRejectedBeforeQueueing() {
        when(entityManager.findById(LoadBalancer.class, 71L)).thenReturn(null);
        ServerApiException error = assertThrows(ServerApiException.class, this::handle);
        assertEquals(ApiErrorCode.PARAM_ERROR, error.getErrorCode());
        verifyNoInteractions(accountService, projectService);
        verify(command, never()).validateSpecificParameters(params);
    }
}
