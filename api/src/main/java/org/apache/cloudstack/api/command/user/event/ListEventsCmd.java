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

import java.util.Date;

import org.apache.cloudstack.api.APICommand;
import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseListProjectAndAccountResourcesCmd;
import org.apache.cloudstack.api.Parameter;
import org.apache.cloudstack.api.response.EventResponse;
import org.apache.cloudstack.api.response.ListResponse;

import com.cloud.event.Event;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.utils.UuidUtils;

@APICommand(name = "listEvents", description = "A command to list events.", responseObject = EventResponse.class, entityType = {Event.class},
        requestHasSensitiveInfo = false, responseHasSensitiveInfo = false)
public class ListEventsCmd extends BaseListProjectAndAccountResourcesCmd {


    /////////////////////////////////////////////////////
    //////////////// API parameters /////////////////////
    /////////////////////////////////////////////////////

    @Parameter(name = ApiConstants.ID, type = CommandType.UUID, entityType = EventResponse.class, description = "The ID of the event")
    private Long id;

    @Parameter(name = "eventuuid", type = CommandType.STRING, length = 36,
            description = "Filter by the exact event UUID. A valid UUID without a visible matching event returns an empty result.")
    private String eventUuid;

    @Parameter(name = ApiConstants.SORT_KEY, type = CommandType.STRING,
            description = "Set to created to sort all matching events by creation time before paging.")
    private String sortKey;

    @Parameter(name = "sortorder", type = CommandType.STRING,
            description = "With sortkey=created, asc or desc (default desc). Event ID is the tie-breaker in the same direction.")
    private String sortOrder;

    @Parameter(name = ApiConstants.DURATION, type = CommandType.INTEGER, description = "The duration of the event")
    private Integer duration;

    @Parameter(name = ApiConstants.END_DATE,
               type = CommandType.DATE,
               description = "The end date range of the list you want to retrieve (use format \"yyyy-MM-dd\" or the new format \"yyyy-MM-dd HH:mm:ss\")")
    private Date endDate;

    @Parameter(name = ApiConstants.ENTRY_TIME, type = CommandType.INTEGER, description = "The time the event was entered")
    private Integer entryTime;

    @Parameter(name = ApiConstants.LEVEL, type = CommandType.STRING, description = "The event level (INFO, WARN, ERROR)")
    private String level;

    @Parameter(name = ApiConstants.START_DATE,
               type = CommandType.DATE,
               description = "The start date range of the list you want to retrieve (use format \"yyyy-MM-dd\" or the new format \"yyyy-MM-dd HH:mm:ss\")")
    private Date startDate;

    @Parameter(name = ApiConstants.TYPE, type = CommandType.STRING, description = "The event type (see event types)")
    private String type;

    @Parameter(name = ApiConstants.START_ID, type = CommandType.UUID, entityType = EventResponse.class, description = "An event ID used to find its operation and related stages, including the parent when visible")
    private Long startId;

    @Parameter(name = "timeline", type = CommandType.BOOLEAN, description = "With startid, list the operation in chronological order. "
            + "When archived is omitted, include active and archived stages.")
    private Boolean timeline;

    @Parameter(name = ApiConstants.RESOURCE_ID, type = CommandType.STRING, description = "The ID of the resource associated with the event", since="4.17.0")
    private String resourceId;

    @Parameter(name = ApiConstants.RESOURCE_TYPE, type = CommandType.STRING, description = "The type of the resource associated with the event", since="4.17.0")
    private String resourceType;

    @Parameter(name = ApiConstants.ARCHIVED, type = CommandType.BOOLEAN, description = "True to list archived events otherwise false", since="4.19.0")
    private Boolean archived;

    @Parameter(name = ApiConstants.STATE, type = CommandType.STRING, description = "The state of the events", since="4.21.0")
    private String state;

    /////////////////////////////////////////////////////
    /////////////////// Accessors ///////////////////////
    /////////////////////////////////////////////////////

    public Long getId() {
        return id;
    }

    public String getEventUuid() {
        return eventUuid;
    }

    public boolean isCreatedOrder() {
        return isTimeline() || "created".equals(sortKey);
    }

    public boolean isCreatedOrderAscending() {
        return isTimeline() || "asc".equals(sortOrder);
    }

    public Integer getDuration() {
        return duration;
    }

    public Date getEndDate() {
        return endDate;
    }

    public Integer getEntryTime() {
        return entryTime;
    }

    public String getLevel() {
        return level;
    }

    public Date getStartDate() {
        return startDate;
    }

    public String getType() {
        return type;
    }

    public Long getStartId() {
        return startId;
    }

    public String getResourceId() {
        return resourceId;
    }

    public String getResourceType() {
        return resourceType;
    }

    public boolean getArchived() {
        return Boolean.TRUE.equals(archived);
    }

    public boolean hasArchivedFilter() {
        return archived != null;
    }

    public boolean isTimeline() {
        return Boolean.TRUE.equals(timeline);
    }

    public String getState() {
        return state;
    }

    /////////////////////////////////////////////////////
    /////////////// API Implementation///////////////////
    /////////////////////////////////////////////////////

    @Override
    public void execute() {
        if (isTimeline() && startId == null) {
            throw new InvalidParameterValueException("startid is required when timeline is true.");
        }
        if (eventUuid != null && !UuidUtils.isUuid(eventUuid)) {
            throw new InvalidParameterValueException("eventuuid must be a valid UUID.");
        }
        if (startDate != null && endDate != null && startDate.after(endDate)) {
            throw new InvalidParameterValueException("startdate must be on or before enddate.");
        }
        if ((sortKey != null && !"created".equals(sortKey)) || (sortOrder != null
                && (!"created".equals(sortKey) || !("asc".equals(sortOrder) || "desc".equals(sortOrder))))) {
            throw new InvalidParameterValueException("Use sortkey=created with sortorder=asc or desc.");
        }
        if (isTimeline() && "desc".equals(sortOrder)) {
            throw new InvalidParameterValueException("Event timelines use chronological order.");
        }
        ListResponse<EventResponse> response = _queryService.searchForEvents(this);
        response.setResponseName(getCommandName());
        setResponseObject(response);
    }
}
