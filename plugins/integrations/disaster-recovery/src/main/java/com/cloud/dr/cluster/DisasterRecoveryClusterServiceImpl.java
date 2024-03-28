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
package com.cloud.dr.cluster;

import java.util.EnumSet;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;
import java.io.File;

import javax.inject.Inject;

import com.cloud.api.ApiDBUtils;
import com.cloud.api.query.dao.UserVmJoinDao;
import com.cloud.api.query.vo.UserVmJoinVO;
import com.cloud.cluster.dao.ManagementServerHostDao;
import com.cloud.cluster.ManagementServerHostVO;
import com.cloud.dr.cluster.dao.DisasterRecoveryClusterDao;
import com.cloud.dr.cluster.dao.DisasterRecoveryClusterVmMapDao;
import com.cloud.event.ActionEvent;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.user.Account;
import com.cloud.user.AccountService;
import com.cloud.utils.db.Filter;
import com.cloud.utils.db.SearchBuilder;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionStatus;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.script.Script;
import com.cloud.utils.net.NetUtils;
import com.cloud.utils.component.ManagerBase;
import com.cloud.utils.exception.CloudRuntimeException;

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ResponseObject;
import org.apache.cloudstack.api.command.admin.dr.GetDisasterRecoveryClusterListCmd;
import org.apache.cloudstack.api.command.admin.dr.UpdateDisasterRecoveryClusterCmd;
import org.apache.cloudstack.api.command.admin.dr.CreateDisasterRecoveryClusterCmd;
import org.apache.cloudstack.api.response.ListResponse;
import org.apache.cloudstack.api.response.ScvmIpAddressResponse;
import org.apache.cloudstack.api.command.admin.dr.ConnectivityTestsDisasterRecoveryClusterCmd;
import org.apache.cloudstack.api.command.admin.glue.ListScvmIpAddressCmd;
import org.apache.cloudstack.api.response.UserVmResponse;
import org.apache.cloudstack.api.response.dr.cluster.GetDisasterRecoveryClusterListResponse;
import org.apache.cloudstack.utils.identity.ManagementServerNode;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.framework.config.ConfigKey;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

public class DisasterRecoveryClusterServiceImpl extends ManagerBase implements DisasterRecoveryClusterService {

    @Inject
    private ManagementServerHostDao msHostDao;
    @Inject
    private DisasterRecoveryClusterDao disasterRecoveryClusterDao;
    @Inject
    private DisasterRecoveryClusterVmMapDao disasterRecoveryClusterVmMapDao;
    @Inject
    protected UserVmJoinDao userVmJoinDao;
    @Inject
    protected AccountService accountService;
    protected static Logger LOGGER = LogManager.getLogger(DisasterRecoveryClusterServiceImpl.class);

    @Override
    @ActionEvent(eventType = DisasterRecoveryClusterEventTypes.EVENT_DR_TEST_CONNECT, eventDescription = "disaster recovery cluster connection testing")
    public boolean connectivityTestsDisasterRecovery(final ConnectivityTestsDisasterRecoveryClusterCmd cmd) {
        if (!DisasterRecoveryServiceEnabled.value()) {
            throw new CloudRuntimeException("Disaster Recovery Service plugin is disabled");
        }
        String moldProtocol = cmd.getDrClusterProtocol();
        String moldIp = cmd.getDrClusterIp();
        String moldPort = cmd.getDrClusterPort();
        String apiKey = cmd.getApiKey();
        String secretKey = cmd.getSecretKey();

        String moldUrl = moldProtocol + "://" + moldIp + ":" + moldPort + "/client/api/";
        String moldCommand = "listScvmIpAddress";
        String moldMethod = "GET";

        String response = DisasterRecoveryClusterUtil.moldListScvmIpAddressAPI(moldUrl, moldCommand, moldMethod, apiKey, secretKey);
        if (response != null || response != "") {
            String[] array = response.split(",");
            for(int i=0; i < array.length; i++) {
                String glueIp = array[i];
                String glueUrl = "https://" + glueIp + ":8080/api/v1"; // glue-api 프로토콜과 포트 확정 시 변경 예정
                String glueCommand = "/glue";
                String glueMethod = "GET";
                String glueStatus = DisasterRecoveryClusterUtil.glueStatusAPI(glueUrl, glueCommand, glueMethod);
                if (glueStatus != null) {
                    if (glueStatus.contains("HEALTH_OK")) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    @Override
    public ListResponse<ScvmIpAddressResponse> listScvmIpAddressResponse(ListScvmIpAddressCmd cmd) {
        List<ScvmIpAddressResponse> responses = new ArrayList<>();
        ScvmIpAddressResponse response = new ScvmIpAddressResponse();
        String ipList = Script.runSimpleBashScript("cat /etc/hosts | grep -E 'scvm1-mngt|scvm2-mngt|scvm3-mngt' | awk '{print $1}' | tr '\n' ','");
        ipList = ipList.replaceAll(",$", "");
        response.setObjectName("scvmipaddress");
        response.setIpAddress(ipList);
        responses.add(response);
        ListResponse<ScvmIpAddressResponse> listResponse = new ListResponse<>();
        listResponse.setResponses(responses);
        return listResponse;
    }

    @Override
    public ListResponse<GetDisasterRecoveryClusterListResponse> listDisasterRecoveryClusterResponse(GetDisasterRecoveryClusterListCmd cmd) {
        Long id = cmd.getId();
        String name = cmd.getName();
        List<GetDisasterRecoveryClusterListResponse> responsesList = new ArrayList<>();
        Filter searchFilter = new Filter(DisasterRecoveryClusterVO.class, "id", true, cmd.getStartIndex(), cmd.getPageSizeVal());
        SearchBuilder<DisasterRecoveryClusterVO> sb = this.disasterRecoveryClusterDao.createSearchBuilder();

        sb.and("id", sb.entity().getId(), SearchCriteria.Op.EQ);
        sb.and("name", sb.entity().getName(), SearchCriteria.Op.EQ);
        sb.and("keyword", sb.entity().getName(), SearchCriteria.Op.LIKE);
        SearchCriteria<DisasterRecoveryClusterVO> sc = sb.create();
        String keyword = cmd.getKeyword();
        if (keyword != null){
            sc.setParameters("keyword", "%" + keyword + "%");
        }
        if (id != null) {
            sc.setParameters("id", id);
        }
        if (name != null) {
            sc.setParameters("name", name);
        }
        if(keyword != null){
            sc.addOr("id", SearchCriteria.Op.LIKE, "%" + keyword + "%");
            sc.addOr("name", SearchCriteria.Op.LIKE, "%" + keyword + "%");
            sc.addOr("uuid", SearchCriteria.Op.LIKE, "%" + keyword + "%");
            sc.setParameters("keyword", "%" + keyword + "%");
        }
        List <DisasterRecoveryClusterVO> results = disasterRecoveryClusterDao.search(sc, searchFilter);
        for (DisasterRecoveryClusterVO result : results) {
            GetDisasterRecoveryClusterListResponse automationControllerResponse = setDisasterRecoveryClusterListResultResponse(result.getId());
            responsesList.add(automationControllerResponse);
        }
        ListResponse<GetDisasterRecoveryClusterListResponse> response = new ListResponse<>();
        response.setResponses(responsesList);
        return response;
    }

    public GetDisasterRecoveryClusterListResponse setDisasterRecoveryClusterListResultResponse(long clusterId) {
        DisasterRecoveryClusterVO drcluster = disasterRecoveryClusterDao.findById(clusterId);
        GetDisasterRecoveryClusterListResponse response = new GetDisasterRecoveryClusterListResponse();
        response.setObjectName("disasterrecoverycluster");
        response.setId(drcluster.getUuid());
        response.setName(drcluster.getName());
        response.setDrClusterUuid(drcluster.getDrClusterUuid());
        response.setDrClusterIp(drcluster.getDrClusterIp());
        response.setDrClusterPort(drcluster.getDrClusterPort());
        response.setDrClusterPort(drcluster.getDrClusterProtocol());
        response.setDrClusterType(drcluster.getDrClusterType());
        response.setDrClusterStatus(drcluster.getDrClusterStatus());
        response.setApiKey(drcluster.getApiKey());
        response.setSecretKey(drcluster.getSecretKey());
        response.setCreated(drcluster.getCreated());

        String ipList = Script.runSimpleBashScript("cat /etc/hosts | grep -E 'scvm1-mngt|scvm2-mngt|scvm3-mngt' | awk '{print $1}' | tr '\n' ','");
        ipList = ipList.replaceAll(",$", "");
        String[] array = ipList.split(",");
        for (int i=0; i < array.length; i++) {
            String glueIp = array[i];
            String glueUrl = "https://" + glueIp + ":8080/api/v1"; // glue-api 프로토콜과 포트 확정 시 변경 예정
            String glueCommand = "/mirror";
            String glueMethod = "GET";
            String daemonHealth = DisasterRecoveryClusterUtil.glueMirrorStatusAPI(glueUrl, glueCommand, glueMethod);
            if (daemonHealth != null) {
                if (daemonHealth.contains("OK")) {
                    response.setMirroringAgentStatus(DisasterRecoveryCluster.MirroringAgentStatus.Enabled.toString());
                    break;
                } else {
                    response.setMirroringAgentStatus(DisasterRecoveryCluster.MirroringAgentStatus.Disabled.toString());
                    break;
                }
            } else {
                response.setMirroringAgentStatus(DisasterRecoveryCluster.MirroringAgentStatus.Error.toString());
                break;
            }
        }
        List<UserVmResponse> disasterRecoveryClusterVmResponses = new ArrayList<UserVmResponse>();
        List<DisasterRecoveryClusterVmMapVO> drClusterVmList = disasterRecoveryClusterVmMapDao.listByDisasterRecoveryClusterId(drcluster.getId());
        ResponseObject.ResponseView respView = ResponseObject.ResponseView.Restricted;
        Account caller = CallContext.current().getCallingAccount();
        if (accountService.isRootAdmin(caller.getId())) {
            respView = ResponseObject.ResponseView.Full;
        }
        String responseName = "drclustervmlist";
        if (drClusterVmList != null && !drClusterVmList.isEmpty()) {
            for (DisasterRecoveryClusterVmMapVO vmMapVO : drClusterVmList) {
                UserVmJoinVO userVM = userVmJoinDao.findById(vmMapVO.getVmId());
                if (userVM != null) {
                    UserVmResponse cvmResponse = ApiDBUtils.newUserVmResponse(respView, responseName, userVM, EnumSet.of(ApiConstants.VMDetails.nics), caller);
                    disasterRecoveryClusterVmResponses.add(cvmResponse);
                }
            }
        }
        response.setDisasterRecoveryClusterVms(disasterRecoveryClusterVmResponses);
        return response;
    }

    @Override
    public GetDisasterRecoveryClusterListResponse updateDisasterRecoveryCluster(UpdateDisasterRecoveryClusterCmd cmd) throws CloudRuntimeException {
        if (!DisasterRecoveryClusterService.DisasterRecoveryServiceEnabled.value()) {
            throw new CloudRuntimeException("Disaster Recovery plugin is disabled");
        }
        final Long drClusterId = cmd.getId();
        DisasterRecoveryCluster.DrClusterStatus drClusterStatus = null;
        DisasterRecoveryCluster.MirroringAgentStatus mirroringAgentStatus = null;
        DisasterRecoveryClusterVO drcluster = disasterRecoveryClusterDao.findById(drClusterId);
        if (drcluster == null) {
            throw new InvalidParameterValueException("Invalid Disaster Recovery id specified");
        }
        try {
            drClusterStatus = DisasterRecoveryCluster.DrClusterStatus.valueOf(cmd.getDrClusterStatus());
            mirroringAgentStatus = DisasterRecoveryCluster.MirroringAgentStatus.valueOf(cmd.getMirroringAgentStatus());
        } catch (IllegalArgumentException iae) {
            throw new InvalidParameterValueException(String.format("Invalid value for %s parameter", ApiConstants.STATE));
        }
        if (!drClusterStatus.equals(drcluster.getDrClusterStatus()) && !mirroringAgentStatus.equals(drcluster.getMirroringAgentStatus())) {
            drcluster = disasterRecoveryClusterDao.createForUpdate(drcluster.getId());
            drcluster.setDrClusterStatus(String.valueOf(drcluster));
            if (!disasterRecoveryClusterDao.update(drcluster.getId(), drcluster)) {
                throw new CloudRuntimeException(String.format("Failed to update Disaster Recovery ID: %s", drcluster.getUuid()));
            }
            drcluster = disasterRecoveryClusterDao.findById(drClusterId);
        }
        return setDisasterRecoveryClusterListResultResponse(drcluster.getId());
    }

    @Override
    public DisasterRecoveryCluster createDisasterRecoveryCluster(CreateDisasterRecoveryClusterCmd cmd) throws CloudRuntimeException {
        if (!DisasterRecoveryServiceEnabled.value()) {
            throw new CloudRuntimeException("Disaster Recovery Service plugin is disabled");
        }
        validateDisasterRecoveryClusterCreateParameters(cmd);
        ManagementServerHostVO msHost = msHostDao.findByMsid(ManagementServerNode.getManagementServerId());
        // secondary cluster info
        String secProtocol = cmd.getDrClusterProtocol();
        String secIp = cmd.getDrClusterIp();
        String secPort = cmd.getDrClusterPort();
        String secApiKey = cmd.getApiKey();
        String secSecretKey = cmd.getSecretKey();
        String secClusterName = cmd.getName();
        String secClusterType = cmd.getDrClusterType();

        // primary cluster info
        String[] properties = getServerProperties();
        String priProtocol = properties[1];
        String priIp = msHost.getServiceIP();
        String priPort = properties[0];
        UserAccount user = accountService.getActiveUserAccount("admin", 1L);
        String priApiKey = user.getApiKey();
        String priSecretKey = user.getSecretKey();

        // primary cluster createDisasterRecoveryClusterAPI request prepare
        String priUrl = secProtocol + "://" + secIp + ":" + secPort + "/client/api/";
        String priCommand = "createDisasterRecoveryCluster";
        String priMethod = "POST";
        Map<String, String> moldParams = new HashMap<>();
        moldParams.put("name", secClusterName);
        moldParams.put("drClusterType", secClusterType);
        moldParams.put("drClusterIp", priIp);
        moldParams.put("drClusterPort", priPort);
        moldParams.put("drClusterProtocol", priProtocol);
        moldParams.put("apiKey", priApiKey);
        moldParams.put("secretKey", priSecretKey);

        // primary cluster : glue-api mirror setup, primary cluster db update, mold-api secondary dr cluster create
        if (secClusterType.equals("primary")) {
            String secUrl = secProtocol + "://" + secIp + ":" + secPort + "/client/api/";
            String secCommand = "listScvmIpAddress";
            String secMethod = "GET";
            String secResponse = DisasterRecoveryClusterUtil.moldListScvmIpAddressAPI(secUrl, secCommand, secMethod, secApiKey, secSecretKey);
            String[] array = secResponse.split(",");
            for (int i=0; i < array.length; i++) {
                String glueIp = array[i];
                String glueUrl = "https://" + glueIp + ":8080/api/v1"; // glue-api 프로토콜과 포트 확정 시 변경 예정
                String glueCommand = "/mirror";
                String glueMethod = "POST";
                Map<String, String> glueParams = new HashMap<>();
                glueParams.put("localClusterName", "local");
                glueParams.put("remoteClusterName", "remote");
                glueParams.put("mirrorPool", "rbd");
                glueParams.put("host", glueIp);
                File privateKey = (File) cmd.getPrivateKey();
                boolean result = DisasterRecoveryClusterUtil.glueMirrorSetupAPI(glueUrl, glueCommand, glueMethod, glueParams, privateKey);
                // mirror setup 성공
                if (result) {
                    DisasterRecoveryClusterVO cluster = Transaction.execute(new TransactionCallback<DisasterRecoveryClusterVO>() {
                        @Override
                        public DisasterRecoveryClusterVO doInTransaction(TransactionStatus status) {
                            DisasterRecoveryClusterVO newCluster = new DisasterRecoveryClusterVO(msHost.getId(), secClusterName, "secondary", secProtocol, secIp,
                                    secPort, secApiKey, secSecretKey, DisasterRecoveryCluster.DrClusterStatus.Enabled.toString(), DisasterRecoveryCluster.MirroringAgentStatus.Enabled.toString());
                            disasterRecoveryClusterDao.persist(newCluster);
                            return newCluster;
                        }
                    });
                    // secondary cluster createDisasterRecoveryCluster API 요청
                    String priResponse = DisasterRecoveryClusterUtil.moldCreateDisasterRecoveryClusterAPI(priUrl, priCommand, priMethod, priApiKey, priSecretKey);
                    // 
                }
            }
            // 에러
            DisasterRecoveryClusterVO cluster = Transaction.execute(new TransactionCallback<DisasterRecoveryClusterVO>() {
                @Override
                public DisasterRecoveryClusterVO doInTransaction(TransactionStatus status) {
                    DisasterRecoveryClusterVO newCluster = new DisasterRecoveryClusterVO(msHost.getId(), secClusterName, "secondary", secProtocol, secIp,
                            secPort, secApiKey, secSecretKey, DisasterRecoveryCluster.DrClusterStatus.Error.toString(), DisasterRecoveryCluster.MirroringAgentStatus.Error.toString());
                    disasterRecoveryClusterDao.persist(newCluster);
                    return newCluster;
                }
            });
            String priResponse = DisasterRecoveryClusterUtil.moldCreateDisasterRecoveryClusterAPI(priUrl, priCommand, priMethod, priApiKey, priSecretKey);
            return cluster;
        } else {
            // secondary cluster : secondary cluster db update
            DisasterRecoveryClusterVO cluster = Transaction.execute(new TransactionCallback<DisasterRecoveryClusterVO>() {
                @Override
                public DisasterRecoveryClusterVO doInTransaction(TransactionStatus status) {
                    DisasterRecoveryClusterVO newCluster = new DisasterRecoveryClusterVO(msHost.getId(), secClusterName, "primary", secProtocol,secIp,
                    secPort, secApiKey, secSecretKey, DisasterRecoveryCluster.DrClusterStatus.Enabled.toString(), DisasterRecoveryCluster.MirroringAgentStatus.Enabled.toString());
                    disasterRecoveryClusterDao.persist(newCluster);
                    return newCluster;
                }
            });
            return cluster;
        }   
    }

    private void validateDisasterRecoveryClusterCreateParameters(final CreateDisasterRecoveryClusterCmd cmd) throws CloudRuntimeException {
        final String name = cmd.getName();
        final String type = cmd.getDrClusterType();
        final String protocol = cmd.getDrClusterProtocol();
        final String ip = cmd.getDrClusterIp();
        final String port = cmd.getDrClusterPort();
        final String apiKey = cmd.getApiKey();
        final String secretKey = cmd.getSecretKey();
        final File privateKey = cmd.getPrivateKey();

        if (name == null || name.isEmpty()) {
            throw new InvalidParameterValueException("Invalid name for the disaster recovery cluster name:" + name);
        }
        if (type.equalsIgnoreCase("primary")) {
            if (!privateKey.exists()) {
                throw new InvalidParameterValueException("Invalid private key for the disaster recovery cluster private key:" + privateKey);
            }
        }
        if (protocol == null || protocol.isEmpty()) {
            throw new InvalidParameterValueException("Invalid protocol for the disaster recovery cluster protocol:" + protocol);
        }
        if (!protocol.equalsIgnoreCase("http") || !protocol.equalsIgnoreCase("https")) {
            throw new InvalidParameterValueException("Invalid protocol: " + protocol);
        }
        if (ip == null || ip.isEmpty()) {
            throw new InvalidParameterValueException("Invalid ip for the disaster recovery cluster ip:" + ip);
        }
        if (!NetUtils.isValidIp4(ip)) {
            throw new InvalidParameterValueException("Invalid ip address: " + ip);
        }
        if (port == null || port.isEmpty()) {
            throw new InvalidParameterValueException("Invalid port for the disaster recovery cluster port:" + port);
        }
        if ((Integer.parseInt(port) < 0) || (Integer.parseInt(port) > 65535)) {
            throw new InvalidParameterValueException("Invalid port range " + port);
        }
        if (apiKey == null || apiKey.isEmpty()) {
            throw new InvalidParameterValueException("Invalid api key for the disaster recovery cluster api key:" + apiKey);
        }
        if (secretKey == null || secretKey.isEmpty()) {
            throw new InvalidParameterValueException("Invalid secret key for the disaster recovery cluster secret key:" + secretKey);
        }
    }

    private String[] getServerProperties() {
        String[] serverInfo = null;
        final String HTTP_PORT = "http.port";
        final String HTTPS_ENABLE = "https.enable";
        final String HTTPS_PORT = "https.port";
        final File confFile = PropertiesUtil.findConfigFile("server.properties");
        try {
            InputStream is = new FileInputStream(confFile);
            String port = null;
            String protocol = null;
            final Properties properties = ServerProperties.getServerProperties(is);
            if (properties.getProperty(HTTPS_ENABLE).equals("true")){
                port = properties.getProperty(HTTPS_PORT);
                protocol = "https://";
            } else {
                port = properties.getProperty(HTTP_PORT);
                protocol = "http://";
            }
            serverInfo = new String[]{port, protocol};
        } catch (final IOException e) {
            logger.warn("Failed to read configuration from server.properties file", e);
        }
        return serverInfo;
    }

    @Override
    public GetDisasterRecoveryClusterListResponse createDisasterRecoveryClusterResponse(long clusterId) {
        DisasterRecoveryClusterVO drcluster = disasterRecoveryClusterDao.findById(clusterId);
        GetDisasterRecoveryClusterListResponse response = new GetDisasterRecoveryClusterListResponse();
        response.setObjectName("disasterrecoverycluster");
        response.setId(drcluster.getUuid());
        response.setName(drcluster.getName());
        response.setDrClusterIp(drcluster.getDrClusterIp());
        response.setDrClusterPort(drcluster.getDrClusterPort());
        response.setDrClusterPort(drcluster.getDrClusterProtocol());
        response.setDrClusterType(drcluster.getDrClusterType());
        response.setDrClusterStatus(drcluster.getDrClusterStatus());
        response.setMirroringAgentStatus(drcluster.getMirroringAgentStatus());
        response.setApiKey(drcluster.getApiKey());
        response.setSecretKey(drcluster.getSecretKey());
        response.setCreated(drcluster.getCreated());
        return response;
    }

    @Override
    public List<Class<?>> getCommands() {
        List<Class<?>> cmdList = new ArrayList<Class<?>>();
        if (!DisasterRecoveryServiceEnabled.value()) {
            return cmdList;
        }
        cmdList.add(ListScvmIpAddressCmd.class);
        cmdList.add(ConnectivityTestsDisasterRecoveryClusterCmd.class);
        cmdList.add(GetDisasterRecoveryClusterListCmd.class);
        cmdList.add(UpdateDisasterRecoveryClusterCmd.class);
        cmdList.add(CreateDisasterRecoveryClusterCmd.class);
        return cmdList;
    }

    @Override
    public String getConfigComponentName() {
        return DisasterRecoveryClusterService.class.getSimpleName();
    }

    @Override
    public ConfigKey<?>[] getConfigKeys() {
        return new ConfigKey<?>[] {
                DisasterRecoveryServiceEnabled
        };
    }
}
