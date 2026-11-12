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
// specific language govening permissions and limitations
// under the License.

package com.cloud.agent.api;

import com.google.gson.JsonObject;

/** Host observation and guarded live hardware allocation for a SharedFS VM. */
public class SharedFSComputeCommand extends Command {
    private String vmName;
    private String vmUuid;
    private JsonObject before;
    private String bootId;
    private String operationUuid;
    private int targetCpus;
    private long targetMemoryKiB;

    protected SharedFSComputeCommand() {
    }

    public SharedFSComputeCommand(String vmName, String vmUuid) {
        this.vmName = vmName;
        this.vmUuid = vmUuid;
        setWait(90);
    }

    public SharedFSComputeCommand(String vmName, String vmUuid, String operationUuid, String bootId,
                                  JsonObject before, int targetCpus, long targetMemoryKiB) {
        this(vmName, vmUuid);
        this.before = before;
        this.bootId = bootId;
        this.operationUuid = operationUuid;
        this.targetCpus = targetCpus;
        this.targetMemoryKiB = targetMemoryKiB;
    }

    public String getVmName() { return vmName; }
    public String getVmUuid() { return vmUuid; }
    public JsonObject getBefore() { return before; }
    public String getBootId() { return bootId; }
    public String getOperationUuid() { return operationUuid; }
    public int getTargetCpus() { return targetCpus; }
    public long getTargetMemoryKiB() { return targetMemoryKiB; }

    @Override
    public boolean executeInSequence() {
        return true;
    }
}
