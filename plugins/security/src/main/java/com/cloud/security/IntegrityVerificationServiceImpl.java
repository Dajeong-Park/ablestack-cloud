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

import com.cloud.alert.AlertManager;
import com.cloud.cluster.ManagementServerHostVO;
import com.cloud.cluster.dao.ManagementServerHostDao;
import com.cloud.event.ActionEvent;
import com.cloud.event.ActionEventUtils;
import com.cloud.event.EventTypes;
import com.cloud.security.dao.IntegrityVerificationDao;
import com.cloud.utils.component.ManagerBase;
import com.cloud.utils.component.PluggableService;
import com.cloud.utils.concurrency.NamedThreadFactory;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.api.command.admin.GetIntegrityVerificationCmd;
import org.apache.cloudstack.api.command.admin.RunIntegrityVerificationCmd;
import org.apache.cloudstack.api.response.GetIntegrityVerificationResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.config.ConfigKey;
import org.apache.cloudstack.framework.config.Configurable;
import org.apache.cloudstack.managed.context.ManagedContextRunnable;
import org.apache.cloudstack.management.ManagementServerHost;
import org.apache.cloudstack.utils.identity.ManagementServerNode;
import org.apache.commons.lang3.StringUtils;
import org.apache.log4j.Logger;

import javax.inject.Inject;
import javax.naming.ConfigurationException;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class IntegrityVerificationServiceImpl extends ManagerBase implements PluggableService, IntegrityVerificationService, Configurable {

    private static final Logger LOGGER = Logger.getLogger(IntegrityVerificationServiceImpl.class);

    private static final ConfigKey<Integer> IntegrityVerificationInterval = new ConfigKey<>("Advanced", Integer.class,
            "integrity.verification.interval", "0",
            "The interval integrity verification background tasks in seconds", false);

    @Inject
    private IntegrityVerificationDao integrityVerificationDao;
    @Inject
    private ManagementServerHostDao msHostDao;
    @Inject
    private AlertManager alertManager;
    ScheduledExecutorService executor;

    @Override
    public boolean configure(String name, Map<String, Object> params) throws ConfigurationException {
        executor = Executors.newScheduledThreadPool(1, new NamedThreadFactory("IntegrityVerifier"));
        return true;
    }

    @Override
    public boolean start() {
        if(IntegrityVerificationInterval.value() != 0) {
            executor.scheduleAtFixedRate(new IntegrityVerificationTask(), 0, IntegrityVerificationInterval.value(), TimeUnit.SECONDS);
        }
        return true;
    }
    protected class IntegrityVerificationTask extends ManagedContextRunnable {
        @Override
        protected void runInContext() {
            try {
                integrityVerification();
            } catch (Exception e) {
                LOGGER.error("Exception in Integrity Verification : "+ e);
            }
        }

        private void integrityVerification() {
            ActionEventUtils.onStartedActionEvent(CallContext.current().getCallingUserId(), CallContext.current().getCallingAccountId(), EventTypes.EVENT_INTEGRITY_VERIFICATION,
                    "running integrity verification on management server", new Long(0), null, true, 0);

            String[] filePaths = {
                    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/INSTALL.md",
                    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/ISSUE_TEMPLATE.md",
                    "/Users/hongwookryu/repository/GitHub/stardom3645/ablestack-cloud/LICENSE"
            };
            try {
                extractHashValuesAndStoreInDB(filePaths);
            } catch (Exception e) {
                e.printStackTrace();
                LOGGER.error("Failed to execute integrity verifier for management server: "+e);
            }
        }
        private void extractHashValuesAndStoreInDB(String[] filePaths) throws NoSuchAlgorithmException {
            ManagementServerHostVO msHost = msHostDao.findByMsid(ManagementServerNode.getManagementServerId());
            try {
                for (String filePath : filePaths) {
                    File file = new File(filePath);
                    String verificationMessage;
                    if (!file.exists() || file.isDirectory()) {
                        verificationMessage = "The integrity of the file could not be verified. at last verification.";
                        System.err.println("Invalid file path: " + filePath);
                    } else {
                        String comparisonHashValue = calculateHash(file, "SHA-512"); // Change the algorithm to "SHA-256"
                        boolean verificationResult = false;
                        verificationMessage = "The integrity of the file has been verified.";
                        System.out.println("File: " + file.getAbsolutePath() + ", Hash: " + comparisonHashValue);

                        // Save the hash value to the database
                        updateIntegrityVerificationResult(msHost.getId(), filePath, comparisonHashValue, verificationResult, verificationMessage);
                    }
                }
            } catch (NoSuchAlgorithmException e) {
                throw new RuntimeException(e);
            }
        }
        private String calculateHash(File file, String algorithm) throws NoSuchAlgorithmException {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            try (DigestInputStream dis = new DigestInputStream(new FileInputStream(file), md)) {
                // Read the file to update the digest
                while (dis.read() != -1) ;
            } catch (FileNotFoundException e) {
                throw new RuntimeException(e);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }

            byte[] hashBytes = md.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte hashByte : hashBytes) {
                String hex = Integer.toHexString(0xFF & hashByte);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        }
    }

    @Override
    public List<GetIntegrityVerificationResponse> listIntegrityVerifications(GetIntegrityVerificationCmd cmd) {
        long mshostId = cmd.getMsHostId();
        List<IntegrityVerification> result = new ArrayList<>(integrityVerificationDao.getIntegrityVerifications(mshostId));
        List<GetIntegrityVerificationResponse> responses = new ArrayList<>(result.size());
        for (IntegrityVerification ivResult : result) {
            GetIntegrityVerificationResponse integrityVerificationResponse = new GetIntegrityVerificationResponse();
            integrityVerificationResponse.setObjectName("integrity_verification");
            integrityVerificationResponse.setFilePath(ivResult.getFilePath());
            integrityVerificationResponse.setVerificationResult(ivResult.getVerificationResult());
            integrityVerificationResponse.setVerificationDate(ivResult.getVerificationDate());
            integrityVerificationResponse.setVerificationDetails(ivResult.getParsedVerificationDetails());
            responses.add(integrityVerificationResponse);
        }
        return responses;
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_INTEGRITY_VERIFICATION, eventDescription = "running integrity verification on management server", async = true)
    public boolean runIntegrityVerificationCommand(final RunIntegrityVerificationCmd cmd) {
        Long mshostId = cmd.getMsHostId();
        ManagementServerHost msHost = msHostDao.findById(mshostId);
        ProcessBuilder processBuilder = new ProcessBuilder();
        processBuilder.command("plugins/security/scripts/integrity_verification.sh");
        Process process = null;
        try {
            process = processBuilder.start();
            StringBuffer output = new StringBuffer();
            BufferedReader bfr = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = bfr.readLine()) != null) {
                String[] temp = line.split(",");
                String filePath = temp[0];
                String verificationResult = temp[1];
                String verificationMessage;
                if ("false".equals(verificationResult)) {
                    verificationMessage = "The integrity of the file could not be verified. at last verification.";
                    alertManager.sendAlert(AlertManager.AlertType.ALERT_TYPE_MANAGMENT_NODE, 0, new Long(0), "Management server node " + msHost.getServiceIP() + " integrity verification failed: "+ filePath + " could not be verified. at last verification.", "");
                } else {
                    verificationMessage = "The integrity of the file has been verified.";
                }
                String comparisonHashValue="ddd";
                updateIntegrityVerificationResult(msHost.getId(), filePath, comparisonHashValue, Boolean.parseBoolean(verificationResult), verificationMessage);
                output.append(line).append('\n');
            }
            if (output.toString().contains("false")) {
                return false;
            } else {
                return true;
            }
        } catch (IOException e) {
            throw new CloudRuntimeException("Failed to execute integrity verification command for management server: "+msHost.getId() +e);
        }
    }

    private void updateIntegrityVerificationResult(final long msHostId, String filePath, String comparisonHashValue, boolean verificationResult, String verificationMessage) {
        boolean newIntegrityVerificationEntry = false;
        IntegrityVerificationVO connectivityVO = integrityVerificationDao.getIntegrityVerificationResult(msHostId, filePath);
        if (connectivityVO == null) {
            connectivityVO = new IntegrityVerificationVO(msHostId, filePath);
            newIntegrityVerificationEntry = true;
        }
        connectivityVO.setVerificationResult(verificationResult);
        connectivityVO.setComparisonHashValue(comparisonHashValue);
        connectivityVO.setVerificationDate(new Date());
        if (StringUtils.isNotEmpty(verificationMessage)) {
            connectivityVO.setVerificationDetails(verificationMessage.getBytes(com.cloud.utils.StringUtils.getPreferredCharset()));
        }
        if (newIntegrityVerificationEntry) {
            integrityVerificationDao.persist(connectivityVO);
        } else {
            integrityVerificationDao.update(connectivityVO.getId(), connectivityVO);
        }
    }

    @Override
    public List<Class<?>> getCommands() {
        List<Class<?>> cmdList = new ArrayList<>();
        cmdList.add(RunIntegrityVerificationCmd.class);
        cmdList.add(GetIntegrityVerificationCmd.class);
        return cmdList;
    }

    @Override
    public String getConfigComponentName() {
        return IntegrityVerificationServiceImpl.class.getSimpleName();
    }

    @Override
    public ConfigKey<?>[] getConfigKeys() {
        return new ConfigKey<?>[]{
                IntegrityVerificationInterval
        };
    }
}
