// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
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
package org.apache.cloudstack.backup;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class BackupVolumeChainState {
    private String volumeUuid;
    private String backupEngine;
    private List<String> chainFiles = new ArrayList<>();

    public BackupVolumeChainState() {
    }

    public BackupVolumeChainState(String volumeUuid, String backupEngine, List<String> chainFiles) {
        this.volumeUuid = volumeUuid;
        this.backupEngine = backupEngine;
        if (chainFiles != null) {
            this.chainFiles = new ArrayList<>(chainFiles);
        }
    }

    public String getVolumeUuid() {
        return volumeUuid;
    }

    public void setVolumeUuid(String volumeUuid) {
        this.volumeUuid = volumeUuid;
    }

    public String getBackupEngine() {
        return backupEngine;
    }

    public void setBackupEngine(String backupEngine) {
        this.backupEngine = backupEngine;
    }

    public List<String> getChainFiles() {
        return chainFiles == null ? Collections.emptyList() : chainFiles;
    }

    public void setChainFiles(List<String> chainFiles) {
        this.chainFiles = chainFiles;
    }
}
