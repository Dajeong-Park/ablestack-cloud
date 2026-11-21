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

package org.apache.cloudstack.api.command.user.event;

import com.cloud.event.Event;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.user.Account;
import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.DownloadEventsResponse;
import org.apache.cloudstack.api.response.EventResponse;
import org.apache.cloudstack.context.CallContext;
import org.apache.commons.lang3.StringUtils;

import java.util.Date;
import java.util.List;

@APICommand(name = "downloadEvents", description = "Export events as CSV without changing their archive state.",
        responseObject = DownloadEventsResponse.class, entityType = {Event.class}, responseHasSensitiveInfo = true)
public class DownloadEventsCmd extends BaseCmd {

    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////

    @Parameter(name = ApiConstants.IDS,
            type = BaseCmd.CommandType.LIST,
            collectionType = BaseCmd.CommandType.UUID,
            entityType = EventResponse.class,
            description = "the IDs of the events")
    private List<Long> ids;

    @Parameter(name = ApiConstants.END_DATE, type = BaseCmd.CommandType.DATE, description = "End date range to export events"
            + " (including) this date (use format \"yyyy-MM-dd\" or the new format \"yyyy-MM-ddThh:mm:ss\")")
    private Date endDate;

    @Parameter(name = ApiConstants.START_DATE, type = BaseCmd.CommandType.DATE, description = "Start date range to export events"
            + " (including) this date (use format \"yyyy-MM-dd\" or the new format \"yyyy-MM-ddThh:mm:ss\")")
    private Date startDate;

    @Parameter(name = ApiConstants.TYPE, type = BaseCmd.CommandType.STRING, description = "Export by event type")
    private String type;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////

    public List<Long> getIds() {
        return ids;
    }

    public Date getEndDate() {
        return endDate;
    }

    public Date getStartDate() {
        return startDate;
    }

    public String getType() {
        return type;
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public long getEntityOwnerId() {
        Account account = CallContext.current().getCallingAccount();
        if (account != null) {
            return account.getId();
        }
        return Account.ACCOUNT_ID_SYSTEM;
    }

    @Override
    public void execute() {
        if ((ids == null && StringUtils.isBlank(type) && endDate == null) || (ids != null && ids.isEmpty())) {
            throw new InvalidParameterValueException("Specify event IDs, a type or an end date.");
        }
        if (startDate != null && (endDate == null || startDate.after(endDate))) {
            throw new InvalidParameterValueException("The end date must be on or after the start date.");
        }
        DownloadEventsResponse response = _mgr.downloadEvents(this);
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
