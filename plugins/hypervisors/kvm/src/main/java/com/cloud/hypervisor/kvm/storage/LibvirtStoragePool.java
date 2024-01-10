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
package com.cloud.hypervisor.kvm.storage;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Map;

import org.apache.log4j.Logger;
import org.joda.time.Duration;
import org.libvirt.StoragePool;

import org.apache.cloudstack.utils.qemu.QemuImg.PhysicalDiskFormat;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.apache.commons.lang3.builder.ToStringStyle;

import com.cloud.agent.api.to.HostTO;
import com.cloud.agent.properties.AgentProperties;
import com.cloud.agent.properties.AgentPropertiesFileHandler;
import com.cloud.hypervisor.kvm.resource.KVMHABase.HAStoragePool;
import com.cloud.storage.Storage;
import com.cloud.storage.Storage.StoragePoolType;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.utils.script.OutputInterpreter;
import com.cloud.utils.script.Script;

public class LibvirtStoragePool implements KVMStoragePool {
    private static final Logger s_logger = Logger.getLogger(LibvirtStoragePool.class);
    protected String uuid;
    protected long capacity;
    protected long used;
    protected long available;
    protected String name;
    protected String localPath;
    protected PhysicalDiskFormat defaultFormat;
    protected StoragePoolType type;
    protected StorageAdaptor _storageAdaptor;
    protected StoragePool _pool;
    protected String authUsername;
    protected String authSecret;
    protected String sourceHost;
    protected int sourcePort;

    protected String sourceDir;

    public LibvirtStoragePool(String uuid, String name, StoragePoolType type, StorageAdaptor adaptor, StoragePool pool) {
        this.uuid = uuid;
        this.name = name;
        this.type = type;
        this._storageAdaptor = adaptor;
        this.capacity = 0;
        this.used = 0;
        this.available = 0;
        this._pool = pool;
    }

    public void setCapacity(long capacity) {
        this.capacity = capacity;
    }

    @Override
    public long getCapacity() {
        return this.capacity;
    }

    public void setUsed(long used) {
        this.used = used;
    }

    public void setAvailable(long available) {
        this.available = available;
    }

    @Override
    public long getUsed() {
        return this.used;
    }

    @Override
    public long getAvailable() {
        return this.available;
    }

    public StoragePoolType getStoragePoolType() {
        return this.type;
    }

    public String getName() {
        return this.name;
    }

    @Override
    public String getUuid() {
        return this.uuid;
    }

    @Override
    public PhysicalDiskFormat getDefaultFormat() {
        if (getStoragePoolType() == StoragePoolType.CLVM || getStoragePoolType() == StoragePoolType.RBD || getStoragePoolType() == StoragePoolType.PowerFlex) {
            return PhysicalDiskFormat.RAW;
        } else {
            return PhysicalDiskFormat.QCOW2;
        }
    }

    @Override
    public KVMPhysicalDisk createPhysicalDisk(String name,
            PhysicalDiskFormat format, Storage.ProvisioningType provisioningType, long size, byte[] passphrase) {
        return this._storageAdaptor
                .createPhysicalDisk(name, this, format, provisioningType, size, passphrase);
    }

    @Override
    public KVMPhysicalDisk createPhysicalDisk(String name, Storage.ProvisioningType provisioningType, long size, byte[] passphrase) {
        return this._storageAdaptor.createPhysicalDisk(name, this,
                this.getDefaultFormat(), provisioningType, size, passphrase);
    }

    @Override
    public KVMPhysicalDisk getPhysicalDisk(String volumeUid) {
        KVMPhysicalDisk disk = null;
        String volumeUuid = volumeUid;
        if ( volumeUid.contains("/") ) {
            String[] tokens = volumeUid.split("/");
            volumeUuid = tokens[tokens.length -1];
        }
        try {
            disk = this._storageAdaptor.getPhysicalDisk(volumeUuid, this);
        } catch (CloudRuntimeException e) {
            if ((this.getStoragePoolType() != StoragePoolType.NetworkFilesystem) && (this.getStoragePoolType() != StoragePoolType.Filesystem)) {
                throw e;
            }
        }

        if (disk != null) {
            return disk;
        }
        s_logger.debug("find volume bypass libvirt volumeUid " + volumeUid);
        //For network file system or file system, try to use java file to find the volume, instead of through libvirt. BUG:CLOUDSTACK-4459
        String localPoolPath = this.getLocalPath();
        File f = new File(localPoolPath + File.separator + volumeUuid);
        if (!f.exists()) {
            s_logger.debug("volume: " + volumeUuid + " not exist on storage pool");
            throw new CloudRuntimeException("Can't find volume:" + volumeUuid);
        }
        disk = new KVMPhysicalDisk(f.getPath(), volumeUuid, this);
        disk.setFormat(PhysicalDiskFormat.QCOW2);
        disk.setSize(f.length());
        disk.setVirtualSize(f.length());
        s_logger.debug("find volume bypass libvirt disk " + disk.toString());
        return disk;
    }

    @Override
    public boolean connectPhysicalDisk(String name, Map<String, String> details) {
        return true;
    }

    @Override
    public boolean disconnectPhysicalDisk(String uuid) {
        return true;
    }

    @Override
    public boolean deletePhysicalDisk(String uuid, Storage.ImageFormat format) {
        return this._storageAdaptor.deletePhysicalDisk(uuid, this, format);
    }

    @Override
    public List<KVMPhysicalDisk> listPhysicalDisks() {
        return this._storageAdaptor.listPhysicalDisks(this.uuid, this);
    }

    @Override
    public boolean refresh() {
        return this._storageAdaptor.refresh(this);
    }

    @Override
    public boolean isExternalSnapshot() {
        if (this.type == StoragePoolType.CLVM || type == StoragePoolType.RBD) {
            return true;
        }
        return false;
    }

    @Override
    public String getLocalPath() {
        return this.localPath;
    }

    public void setLocalPath(String localPath) {
        this.localPath = localPath;
    }

    @Override
    public String getAuthUserName() {
        return this.authUsername;
    }

    public void setAuthUsername(String authUsername) {
        this.authUsername = authUsername;
    }

    @Override
    public String getAuthSecret() {
        return this.authSecret;
    }

    public void setAuthSecret(String authSecret) {
        this.authSecret = authSecret;
    }

    @Override
    public String getSourceHost() {
        return this.sourceHost;
    }

    public void setSourceHost(String host) {
        this.sourceHost = host;
    }

    @Override
    public int getSourcePort() {
        return this.sourcePort;
    }

    public void setSourcePort(int port) {
        this.sourcePort = port;
    }

    @Override
    public String getSourceDir() {
        return this.sourceDir;
    }

    public void setSourceDir(String dir) {
        this.sourceDir = dir;
    }

    @Override
    public StoragePoolType getType() {
        return this.type;
    }

    public StoragePool getPool() {
        return this._pool;
    }

    public void setPool(StoragePool pool) {
        this._pool = pool;
    }


    @Override
    public boolean delete() {
        try {
            return this._storageAdaptor.deleteStoragePool(this);
        } catch (Exception e) {
            s_logger.debug("Failed to delete storage pool", e);
        }
        return false;
    }

    @Override
    public boolean createFolder(String path) {
        return this._storageAdaptor.createFolder(this.uuid, path, this.type == StoragePoolType.Filesystem ? this.localPath : null);
    }

    @Override
    public boolean supportsConfigDriveIso() {
        if (this.type == StoragePoolType.NetworkFilesystem) {
            return true;
        }
        return false;
    }

    @Override
    public Map<String, String> getDetails() {
        return null;
    }

    @Override
    public boolean isPoolSupportHA() {
        return type == StoragePoolType.NetworkFilesystem;
    }

    public String getHearthBeatPath() {
        if (type == StoragePoolType.NetworkFilesystem) {
            String kvmScriptsDir = AgentPropertiesFileHandler.getPropertyValue(AgentProperties.KVM_SCRIPTS_DIR);
            return Script.findScript(kvmScriptsDir, "kvmheartbeat.sh");
        }
        return null;
    }


    public String createHeartBeatCommand(HAStoragePool primaryStoragePool, String hostPrivateIp, boolean hostValidation) {
        Script cmd = new Script(primaryStoragePool.getPool().getHearthBeatPath(), HeartBeatUpdateTimeout, s_logger);
        cmd.add("-i", primaryStoragePool.getPoolIp());
        cmd.add("-p", primaryStoragePool.getPoolMountSourcePath());
        cmd.add("-m", primaryStoragePool.getMountDestPath());

        if (hostValidation) {
            cmd.add("-h", hostPrivateIp);
        }

        if (!hostValidation) {
            cmd.add("-c");
        }

        return cmd.execute();
    }

    public String createRbdHeartBeatCommand(HAStoragePool primaryStoragePool, String hostPrivateIp, boolean hostValidation, String heartBeatPathRbd) {
        ProcessBuilder processBuilder = new ProcessBuilder();
        processBuilder.command().add("python3");
        processBuilder.command().add(heartBeatPathRbd);
        processBuilder.command().add("-i");
        processBuilder.command().add(primaryStoragePool.getPoolSourceHost());
        processBuilder.command().add("-p");
        processBuilder.command().add(primaryStoragePool.getPoolMountSourcePath());
        processBuilder.command().add("-n");
        processBuilder.command().add(primaryStoragePool.getPoolAuthUserName());
        processBuilder.command().add("-s");
        processBuilder.command().add(primaryStoragePool.getPoolAuthSecret());

        if (hostValidation) {
            processBuilder.command().add("-v");
            processBuilder.command().add(hostPrivateIp);
        }
        Process process = null;
        try {
            process = processBuilder.start();
            BufferedReader bfr = new BufferedReader(new InputStreamReader(process.getInputStream()));
            return bfr.readLine();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }

    public String createClvmHeartBeatCommand(HAStoragePool clvmStoragePool, String hostPrivateIp, boolean hostValidation, String heartBeatPathClvm, long heartBeatUpdateTimeout) {
        Script cmd = new Script(heartBeatPathClvm, heartBeatUpdateTimeout, s_logger);
        cmd.add("-p", clvmStoragePool.getPoolMountSourcePath());

        if (hostValidation) {
            cmd.add("-h", hostPrivateIp);
        }

        if (!hostValidation) {
            cmd.add("-c");
        }
        return cmd.execute();
    }

    @Override
    public String toString() {
        return new ToStringBuilder(this, ToStringStyle.JSON_STYLE).append("uuid", getUuid()).append("path", getLocalPath()).toString();
    }

    @Override
    public String getStorageNodeId() {
        return null;
    }

    @Override
    public Boolean checkingHeartBeat(HAStoragePool pool, HostTO host) {
        boolean validResult = false;
        String hostIp = host.getPrivateNetwork().getIp();
        Script cmd = new Script(getHearthBeatPath(), HeartBeatCheckerTimeout, s_logger);
        cmd.add("-i", pool.getPoolIp());
        cmd.add("-p", pool.getPoolMountSourcePath());
        cmd.add("-m", pool.getMountDestPath());
        cmd.add("-h", hostIp);
        cmd.add("-r");
        cmd.add("-t", String.valueOf(HeartBeatUpdateFreq / 1000));
        OutputInterpreter.OneLineParser parser = new OutputInterpreter.OneLineParser();
        String result = cmd.execute(parser);
        String parsedLine = parser.getLine();

        s_logger.debug(String.format("Checking heart beat with KVMHAChecker [{command=\"%s\", result: \"%s\", log: \"%s\", pool: \"%s\"}].", cmd.toString(), result, parsedLine,
                pool.getPoolIp()));

        if (result == null && parsedLine.contains("DEAD")) {
            s_logger.warn(String.format("Checking heart beat with KVMHAChecker command [%s] returned [%s]. [%s]. It may cause a shutdown of host IP [%s].", cmd.toString(),
                    result, parsedLine, hostIp));
        } else {
            validResult = true;
        }
        return validResult;
    }

    @Override
    public Boolean vmActivityCheck(HAStoragePool pool, HostTO host, Duration activityScriptTimeout, String volumeUUIDListString, String vmActivityCheckPath, long duration) {
        Script cmd = new Script(vmActivityCheckPath, activityScriptTimeout.getStandardSeconds(), s_logger);
        cmd.add("-i", pool.getPoolIp());
        cmd.add("-p", pool.getPoolMountSourcePath());
        cmd.add("-m", pool.getMountDestPath());
        cmd.add("-h", host.getPrivateNetwork().getIp());
        cmd.add("-u", volumeUUIDListString);
        cmd.add("-t", String.valueOf(String.valueOf(System.currentTimeMillis() / 1000)));
        cmd.add("-d", String.valueOf(duration));
        OutputInterpreter.OneLineParser parser = new OutputInterpreter.OneLineParser();

        String result = cmd.execute(parser);
        String parsedLine = parser.getLine();

        s_logger.debug(String.format("Checking heart beat with KVMHAVMActivityChecker [{command=\"%s\", result: \"%s\", log: \"%s\", pool: \"%s\"}].", cmd.toString(), result, parsedLine, pool.getPoolIp()));

        if (result == null && parsedLine.contains("DEAD")) {
            s_logger.warn(String.format("Checking heart beat with KVMHAVMActivityChecker command [%s] returned [%s]. It is [%s]. It may cause a shutdown of host IP [%s].", cmd.toString(), result, parsedLine, host.getPrivateNetwork().getIp()));
            return false;
        } else {
            return true;
        }
    }

    @Override
    public Boolean vmActivityRbdCheck(HAStoragePool pool, HostTO host, Duration activityScriptTimeout, String volumeUUIDListString, String vmActivityCheckPath, long duration) {
        String parsedLine = "";
        String command = "";
        ProcessBuilder processBuilder = new ProcessBuilder();
        processBuilder.command().add("python3");
        processBuilder.command().add(vmActivityCheckPath);
        processBuilder.command().add("-i");
        processBuilder.command().add(pool.getPoolSourceHost());
        processBuilder.command().add("-p");
        processBuilder.command().add(pool.getPoolMountSourcePath());
        processBuilder.command().add("-n");
        processBuilder.command().add(pool.getPoolAuthUserName());
        processBuilder.command().add("-s");
        processBuilder.command().add(pool.getPoolAuthSecret());
        processBuilder.command().add("-v");
        processBuilder.command().add(host.getPrivateNetwork().getIp());
        processBuilder.command().add("-u");
        processBuilder.command().add(volumeUUIDListString);

        command = processBuilder.command().toString();
        Process process = null;
        try {
            process = processBuilder.start();
            BufferedReader bfr = new BufferedReader(new InputStreamReader(process.getInputStream()));
            parsedLine = bfr.readLine();
        } catch (IOException e) {
            e.printStackTrace();
        }
        s_logger.debug(String.format("Checking heart beat with KVMHAVMActivityChecker [{command=\"%s\", log: \"%s\", pool: \"%s\"}].", command, parsedLine, pool.getMonHost()));

        if (parsedLine.contains("DEAD")) {
            s_logger.warn(String.format("Checking heart beat with KVMHAVMActivityChecker command [%s] returned [%s]. It is [%s]. It may cause a shutdown of host IP [%s].", processBuilder.command().toString(), result, parsedLine, host.getPrivateNetwork().getIp()));
            return false;
        } else {
            return true;
        }
    }

    @Override
    public Boolean vmActivityClvmCheck(HAStoragePool pool, HostTO host, Duration activityScriptTimeout, String volumeUUIDListString, String vmActivityCheckPath, long duration) {
        String parsedLine = "";
        Script cmd = new Script(vmActivityCheckPath, activityScriptTimeout.getStandardSeconds(), s_logger);
        cmd.add("-h", host.getPublicNetwork().getIp());
        cmd.add("-u", volumeUUIDListString);
        cmd.add("-t", String.valueOf(String.valueOf(System.currentTimeMillis() / 1000)));
        cmd.add("-d", String.valueOf(duration));

        OutputInterpreter.OneLineParser parser = new OutputInterpreter.OneLineParser();

        String result = cmd.execute(parser);
        parsedLine = parser.getLine();

        s_logger.debug(String.format("Checking heart beat with KVMHAVMActivityChecker [{command=\"%s\", result: \"%s\", log: \"%s\", pool: \"%s\"}].", cmd.toString(), result, parsedLine, pool.getPoolIp()));
        if (result == null && parsedLine.contains("DEAD")) {
            s_logger.warn(String.format("Checking heart beat with KVMHAVMActivityChecker command [%s] returned [%s]. It is [%s]. It may cause a shutdown of host IP [%s].", cmd.toString(), result, parsedLine, host.getPrivateNetwork().getIp()));
            return false;
        } else {
            return true;
        }
    }
}
