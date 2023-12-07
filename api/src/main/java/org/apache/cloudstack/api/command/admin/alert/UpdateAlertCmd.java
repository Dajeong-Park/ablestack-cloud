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
package org.apache.cloudstack.api.command.admin.alert;

import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.ApiErrorCode;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.ServerApiException;
import org.apache.cloudstack.api.response.SuccessResponse;

@APICommand(name = "updateAlert", description = "update an alert.",
        responseObject = SuccessResponse.class,
        requestHasSensitiveInfo = false, responseHasSensitiveInfo = false)
public class UpdateAlertCmd extends BaseCmd {

    @Parameter(name = ApiConstants.ID, type = CommandType.UUID, required = true,
            description = "the id of the alert")
    private Long id;

    @Parameter(name = ApiConstants.SHOW_ALERT, type = CommandType.BOOLEAN, required = true,
            description = "the alert show popup")
    private Boolean showAlert;

    public Long getId() {
        return id;
    }

    public Boolean getShowAlert() {
        return showAlert;
    }

    @Override
    public void execute() {
        if (_alertSvc.updateAlert(getId(), getShowAlert())) {
            SuccessResponse response = new SuccessResponse(getCommandName());
            this.setResponseObject(response);
        } else {
            throw new ServerApiException(ApiErrorCode.INTERNAL_ERROR, "Failed to update an alert");
        }
    }

    @Override
    public long getEntityOwnerId() {
        return 0;
    }
}
