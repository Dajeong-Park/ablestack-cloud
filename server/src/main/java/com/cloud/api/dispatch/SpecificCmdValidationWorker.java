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

import java.util.Map;

import javax.inject.Inject;

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.command.user.loadbalancer.AssignCertToLoadBalancerCmd;
import org.apache.cloudstack.api.command.user.loadbalancer.RemoveCertFromLoadBalancerCmd;
import org.apache.cloudstack.context.CallContext;

import com.cloud.exception.PermissionDeniedException;
import com.cloud.network.rules.LoadBalancer;
import com.cloud.projects.Project;
import com.cloud.projects.ProjectService;
import com.cloud.user.Account;
import com.cloud.user.AccountService;
import com.cloud.utils.db.EntityManager;

/**
 * This worker validates parameters in a semantic way, that is of
 * course specific for each {@link BaseCmd}, so actually it delegates
 * the validation on the {@link BaseCmd} itself
 *
 */
public class SpecificCmdValidationWorker implements DispatchWorker {

    @Inject
    private AccountService accountService;
    @Inject
    private EntityManager entityManager;
    @Inject
    private ProjectService projectService;

    @SuppressWarnings("unchecked")
    @Override
    public void handle(final DispatchTask task) {
        validateLoadBalancerCertificateAccess(task.getCmd(), task.getParams());
        task.getCmd().validateSpecificParameters(task.getParams());
    }

    private void validateLoadBalancerCertificateAccess(BaseCmd command, Map<String, String> params) {
        Long loadBalancerId;
        String apiName;
        if (command instanceof AssignCertToLoadBalancerCmd) {
            loadBalancerId = ((AssignCertToLoadBalancerCmd) command).getLbRuleId();
            apiName = "assignCertToLoadBalancer";
        } else if (command instanceof RemoveCertFromLoadBalancerCmd) {
            loadBalancerId = ((RemoveCertFromLoadBalancerCmd) command).getLbRuleId();
            apiName = "removeCertFromLoadBalancer";
        } else {
            return;
        }

        LoadBalancer loadBalancer = entityManager.findById(LoadBalancer.class, loadBalancerId);
        if (loadBalancer == null) {
            throw new ServerApiException(ApiErrorCode.PARAM_ERROR, "The load balancer is not available.");
        }
        Account owner = accountService.getAccount(loadBalancer.getAccountId());
        if (owner == null) {
            throw new ServerApiException(ApiErrorCode.UNAUTHORIZED, "The load balancer owner is not available.");
        }
        Project project = owner.getType() == Account.Type.PROJECT
                ? projectService.findByProjectAccountId(owner.getId()) : null;
        if (owner.getType() == Account.Type.PROJECT && project == null) {
            throw new ServerApiException(ApiErrorCode.UNAUTHORIZED, "The load balancer project is not available.");
        }
        String requestedProject = params.get(ApiConstants.PROJECT_ID);
        if (requestedProject != null && (project == null || !project.getUuid().equalsIgnoreCase(requestedProject))) {
            throw new ServerApiException(ApiErrorCode.UNAUTHORIZED, "The specified project does not match the load balancer.");
        }

        // This chain runs before job creation and again before execution. Derive
        // the authorization context from the LB, never from an optional hint.
        CallContext context = CallContext.current();
        context.setProject(project);
        context.setApiName(apiName);
        try {
            accountService.checkAccess(context.getCallingAccount(), null, true, apiName, loadBalancer);
        } catch (PermissionDeniedException e) {
            throw new ServerApiException(ApiErrorCode.UNAUTHORIZED, "The command is not available for this load balancer.");
        }
        if (project != null) {
            params.put(ApiConstants.PROJECT_ID, project.getUuid());
        }
    }
}
