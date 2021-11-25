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

package com.cloud.desktop.version;


import org.apache.cloudstack.api.command.user.desktop.version.AddDesktopMasterVersionCmd;
import org.apache.cloudstack.api.command.user.desktop.version.DeleteDesktopMasterVersionCmd;
import org.apache.cloudstack.api.command.user.desktop.version.ListDesktopControllerVersionsCmd;
import org.apache.cloudstack.api.command.user.desktop.version.ListDesktopMasterVersionsCmd;
import org.apache.cloudstack.api.command.user.desktop.version.UpdateDesktopMasterVersionCmd;
import org.apache.cloudstack.api.command.admin.desktop.AddDesktopControllerVersionCmd;
import org.apache.cloudstack.api.command.admin.desktop.DeleteDesktopControllerVersionCmd;
import org.apache.cloudstack.api.command.admin.desktop.UpdateDesktopControllerVersionCmd;
import org.apache.cloudstack.api.response.DesktopControllerVersionResponse;
import org.apache.cloudstack.api.response.DesktopMasterVersionResponse;
import org.apache.cloudstack.api.response.ListResponse;

import com.cloud.utils.component.PluggableService;
import com.cloud.utils.exception.CloudRuntimeException;

public interface DesktopVersionService extends PluggableService {
    static final String MIN_DESKTOP_CONTOLLER_VERSION = "1.0.0";
    static final String MIN_DESKTOP_MASTER_VERSION = "1.0.0";
    ListResponse<DesktopControllerVersionResponse> listDesktopControllerVersions(ListDesktopControllerVersionsCmd cmd);
    ListResponse<DesktopMasterVersionResponse> listDesktopMasterVersions(ListDesktopMasterVersionsCmd cmd);
    DesktopControllerVersionResponse addDesktopControllerVersion(AddDesktopControllerVersionCmd cmd);
    boolean deleteDesktopContollerVersion(DeleteDesktopControllerVersionCmd cmd) throws CloudRuntimeException;
    DesktopControllerVersionResponse updateDesktopControllerVersion(UpdateDesktopControllerVersionCmd cmd) throws CloudRuntimeException;
    DesktopMasterVersionResponse addDesktopMasterVersion(AddDesktopMasterVersionCmd cmd);
    boolean deleteDesktopMasterVersion(DeleteDesktopMasterVersionCmd cmd) throws CloudRuntimeException;
    DesktopMasterVersionResponse updateDesktopMasterVersion(UpdateDesktopMasterVersionCmd cmd) throws CloudRuntimeException;
}