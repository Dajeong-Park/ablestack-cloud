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

package com.cloud.security;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.inject.Inject;
import javax.naming.ConfigurationException;

import org.apache.cloudstack.api.command.admin.GetSecurityCheckCmd;
import org.apache.cloudstack.api.command.admin.RunSecurityCheckCmd;
import org.apache.cloudstack.api.command.admin.DeleteSecurityCheckResultCmd;
import org.apache.cloudstack.api.response.GetSecurityCheckResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.config.ConfigKey;
import org.apache.cloudstack.framework.config.Configurable;
import org.apache.cloudstack.managed.context.ManagedContextRunnable;
import org.apache.cloudstack.management.ManagementServerHost;
import org.apache.cloudstack.utils.identity.ManagementServerNode;
import org.apache.log4j.Logger;

import com.cloud.alert.AlertManager;
import com.cloud.cluster.ManagementServerHostVO;
import com.cloud.cluster.dao.ManagementServerHostDao;
import com.cloud.event.ActionEvent;
import com.cloud.event.ActionEventUtils;
import com.cloud.event.EventTypes;
import com.cloud.event.EventVO;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.security.dao.SecurityCheckDao;
import com.cloud.utils.component.ManagerBase;
import com.cloud.utils.component.PluggableService;
import com.cloud.utils.concurrency.NamedThreadFactory;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.script.Script;

import java.util.stream.Collectors;

public class SecurityCheckServiceImpl extends ManagerBase implements PluggableService, SecurityCheckService, Configurable {

    private static final Logger LOGGER = Logger.getLogger(SecurityCheckServiceImpl.class);

    private static final ConfigKey<Integer> SecurityCheckInterval = new ConfigKey<>("Advanced", Integer.class,
            "security.check.interval", "1",
            "The interval security check background tasks in days", false);
    private static String runMode = "";

    @Inject
    private SecurityCheckDao securityCheckDao;
    @Inject
    private ManagementServerHostDao msHostDao;
    @Inject
    private AlertManager alertManager;
    ScheduledExecutorService executor;

    @Override
    public boolean configure(String name, Map<String, Object> params) throws ConfigurationException {
        executor = Executors.newScheduledThreadPool(1, new NamedThreadFactory("SecurityChecker"));
        return true;
    }

    @Override
    public boolean start() {
        runMode = "first";
        if(SecurityCheckInterval.value() != 0) {
            executor.scheduleAtFixedRate(new SecurityCheckTask(), 0, SecurityCheckInterval.value(), TimeUnit.DAYS);
        }
        return true;
    }

    @Override
    public boolean stop() {
        runMode = "";
        return true;
    }

    protected class SecurityCheckTask extends ManagedContextRunnable {
        @Override
        protected void runInContext() {
            try {
                securityCheck();
            } catch (Exception e) {
                LOGGER.error("Exception in security check schedule : "+ e);
            }
        }

        private void securityCheck() {
            if (runMode == "first") {
                ActionEventUtils.onStartedActionEvent(CallContext.current().getCallingUserId(), CallContext.current().getCallingAccountId(), EventTypes.EVENT_SECURITY_CHECK,
                    "security check perform on the management server when running the product", new Long(0), null, true, 0);
            } else {
                ActionEventUtils.onStartedActionEvent(CallContext.current().getCallingUserId(), CallContext.current().getCallingAccountId(), EventTypes.EVENT_SECURITY_CHECK,
                    "security check schedule perform on the management server when operating the product", new Long(0), null, true, 0);
            }
            ManagementServerHostVO msHost = msHostDao.findByMsid(ManagementServerNode.getManagementServerId());
            String path = Script.findScript("scripts/security/", "securitycheck.sh");
            if (path == null) {
                LOGGER.error("Unable to find the securitycheck script");
            }
            ProcessBuilder processBuilder = new ProcessBuilder("sh", path);
            Process process = null;
            List<Boolean> checkResults = new ArrayList<>();
            List<String> checkFailedList = new ArrayList<>();
            boolean checkFinalResult;
            try {
                process = processBuilder.start();
                BufferedReader bfr = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                while ((line = bfr.readLine()) != null) {
                    String[] temp = line.split(",");
                    String checkName = temp[0];
                    String checkResult = temp[1];
                    String checkMessage;
                    if ("false".equals(checkResult)) {
                        checkResults.add(false);
                        checkFailedList.add(checkName);
                        checkMessage = "file does not operate normally";
                        if (runMode == "first") {
                            alertManager.sendAlert(AlertManager.AlertType.ALERT_TYPE_MANAGMENT_NODE, 0, new Long(0), "Management server node " + msHost.getServiceIP() + " security check when running the product failed : "+ checkName + " " + checkMessage, "");
                        } else {
                            alertManager.sendAlert(AlertManager.AlertType.ALERT_TYPE_MANAGMENT_NODE, 0, new Long(0), "Management server node " + msHost.getServiceIP() + " security check schedule failed : "+ checkName + " " + checkMessage, "");
                        }
                    } else {
                        checkResults.add(true);
                        checkMessage = "file operates normally";
                    }
                }
                checkFinalResult = checkConditions(checkResults);
                String checkFailedListToString = checkFailedList.stream().collect(Collectors.joining(", "));
                String type = "";
                if (runMode == "first") {
                    type = "Initial";
                    ActionEventUtils.onCompletedActionEvent(CallContext.current().getCallingUserId(), CallContext.current().getCallingAccountId(), EventVO.LEVEL_INFO,
                        EventTypes.EVENT_SECURITY_CHECK, "Successfully completed security check perform on the management server when running the product", new Long(0), null, 0);
                } else {
                    type = "Routine";
                    ActionEventUtils.onCompletedActionEvent(CallContext.current().getCallingUserId(), CallContext.current().getCallingAccountId(), EventVO.LEVEL_INFO,
                        EventTypes.EVENT_SECURITY_CHECK, "Successfully completed security check schedule perform on the management server when operating the product", new Long(0), null, 0);
                }
                updateSecurityCheckResult(msHost.getId(), checkFinalResult, checkFailedListToString, type);
                runMode = "";
            } catch (IOException e) {
                runMode = "";
                LOGGER.error("Failed to execute security check schedule for management server: "+e);
            }
        }
    }

    @Override
    public List<GetSecurityCheckResponse> listSecurityChecks(GetSecurityCheckCmd cmd) {
        long mshostId = cmd.getMsHostId();
        List<SecurityCheck> result = new ArrayList<>(securityCheckDao.getSecurityChecks(mshostId));
        List<GetSecurityCheckResponse> responses = new ArrayList<>(result.size());
        for (SecurityCheck scResult : result) {
            GetSecurityCheckResponse securityCheckResponse = new GetSecurityCheckResponse();
            securityCheckResponse.setObjectName("securitychecks");
            securityCheckResponse.setId(scResult.getId());
            securityCheckResponse.setCheckResult(scResult.getCheckResult());
            securityCheckResponse.setCheckDate(scResult.getCheckDate());
            securityCheckResponse.setCheckFailedList(scResult.getCheckFailedList());
            securityCheckResponse.setType(scResult.getType());
            responses.add(securityCheckResponse);
        }
        return responses;
    }

    public static boolean checkConditions(List<Boolean> conditions) {
        for (boolean condition : conditions) {
            if (!condition) {
                return false;
            }
        }
        return true;
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_SECURITY_CHECK, eventDescription = "security check perform on the management server when operating the product", async = true)
    public boolean runSecurityCheckCommand(final RunSecurityCheckCmd cmd) {
        Long mshostId = cmd.getMsHostId();
        ManagementServerHost mshost = msHostDao.findById(mshostId);
        String path = Script.findScript("scripts/security/", "securitycheck.sh");
        if (path == null) {
            throw new CloudRuntimeException(String.format("Unable to find the securitycheck script"));
        }
        ProcessBuilder processBuilder = new ProcessBuilder("sh", path);
        Process process = null;
        List<Boolean> checkResults = new ArrayList<>();
        List<String> checkFailedList = new ArrayList<>();
        boolean checkFinalResult;
        try {
            process = processBuilder.start();
            StringBuffer output = new StringBuffer();
            BufferedReader bfr = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = bfr.readLine()) != null) {
                String[] temp = line.split(",");
                String checkName = temp[0];
                String checkResult = temp[1];
                String checkMessage;
                if ("false".equals(checkResult)) {
                    checkResults.add(false);
                    checkFailedList.add(checkName);
                    checkMessage = "file does not operate normally at last check";
                    alertManager.sendAlert(AlertManager.AlertType.ALERT_TYPE_MANAGMENT_NODE, 0, new Long(0), "Management server node " + mshost.getServiceIP() + " security check when operating the product failed : "+ checkName + " " + checkMessage, "");
                } else {
                    checkResults.add(true);
                    checkMessage = "file operates normally";
                }
                output.append(line).append('\n');
            }
            checkFinalResult = checkConditions(checkResults);
            String checkFailedListToString = checkFailedList.stream().collect(Collectors.joining(", "));
            String type = "Manual";
            updateSecurityCheckResult(mshost.getId(), checkFinalResult, checkFailedListToString, type);
            if (output.toString().contains("false")) {
                return false;
            } else {
                return true;
            }
        } catch (IOException e) {
            throw new CloudRuntimeException("Failed to execute security check command for management server: "+mshost.getId() +e);
        }
    }

    @Override
    @ActionEvent(eventType = SecurityCheckEventTypes.EVENT_SECURITY_CHECK_DELETE, eventDescription = "Deleting Security check result")
    public boolean deleteSecurityCheckResult(final DeleteSecurityCheckResultCmd cmd) {
        final Long resultId = cmd.getId();
        SecurityCheck result = securityCheckDao.findById(resultId);
        if (result == null) {
            throw new InvalidParameterValueException("Invalid security check result id specified");
        }
        return securityCheckDao.remove(result.getId());
    }

    private void updateSecurityCheckResult(long msHostId, boolean checkFinalResult, String checkFailedList, String type) {
        boolean newSecurityCheckEntry = false;
        String uuid = UUID.randomUUID().toString();
        SecurityCheckVO connectivityVO = new SecurityCheckVO(msHostId, checkFinalResult, checkFailedList, type);
        connectivityVO.setUuid(uuid);
        connectivityVO.setMsHostId(msHostId);
        connectivityVO.setCheckResult(checkFinalResult);
        connectivityVO.setCheckFailedList(checkFailedList);
        connectivityVO.setCheckDate(new Date());
        connectivityVO.setType(type);
        securityCheckDao.persist(connectivityVO);
    }

    @Override
    public List<Class<?>> getCommands() {
        List<Class<?>> cmdList = new ArrayList<>();
        cmdList.add(RunSecurityCheckCmd.class);
        cmdList.add(GetSecurityCheckCmd.class);
        cmdList.add(DeleteSecurityCheckResultCmd.class);
        return cmdList;
    }

    @Override
    public String getConfigComponentName() {
        return SecurityCheckServiceImpl.class.getSimpleName();
    }

    @Override
    public ConfigKey<?>[] getConfigKeys() {
        return new ConfigKey<?>[]{
                SecurityCheckInterval
        };
    }
}