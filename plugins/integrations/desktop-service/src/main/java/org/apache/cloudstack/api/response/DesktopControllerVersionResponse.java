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

package org.apache.cloudstack.api.response;

import java.util.Date;
import java.util.List;

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseResponse;
import org.apache.cloudstack.api.EntityReference;

import com.cloud.desktop.version.DesktopControllerVersion;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;

@SuppressWarnings("unused")
@EntityReference(value = {DesktopControllerVersion.class})
public class DesktopControllerVersionResponse extends BaseResponse {
    @SerializedName(ApiConstants.ID)
    @Param(description = "the id of the Desktop Controller Version")
    private String id;

    @SerializedName(ApiConstants.NAME)
    @Param(description = "Name of the Desktop Controller Version")
    private String name;

    @SerializedName(ApiConstants.DESCRIPTION)
    @Param(description = "the description of the Desktop Controller Version")
    private String description;

    @SerializedName(ApiConstants.VERSION)
    @Param(description = "Desktop version")
    private String version;

    @SerializedName(ApiConstants.DESKTOP_TEMPLATES)
    @Param(description = "the list of templates associated with this Desktop")
    private List<TemplateResponse> templates;

    @SerializedName(ApiConstants.DESKTOP_DC_TEMPLATE)
    @Param(description = "the dc template associated with this Desktop")
    private List<TemplateResponse> dcTemplate;

    @SerializedName(ApiConstants.DESKTOP_WORKS_TEMPLATE)
    @Param(description = "the dc template associated with this Desktop")
    private List<TemplateResponse> worksTemplate;

    @SerializedName(ApiConstants.ZONE_ID)
    @Param(description = "the id of the zone in which Desktop Controller Version is available")
    private String zoneId;

    @SerializedName(ApiConstants.ZONE_NAME)
    @Param(description = "the name of the zone in which Desktop Controller Version is available")
    private String zoneName;

    @SerializedName(ApiConstants.DESKTOP_CONTROLLER_VERSION_UPLOADTYPE)
    @Param(description = "the upload type of the Desktop Controller Version")
    private String uploadType;

    @SerializedName(ApiConstants.STATE)
    @Param(description = "the enabled or disabled state of the Desktop Controller Version")
    private String state;

    @SerializedName(ApiConstants.CREATED)
    @Param(description = "the date this template was created")
    private Date created;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public void setTemplates(List<TemplateResponse> templates) {
        this.templates = templates;
    }

    public List<TemplateResponse> getTemplates() {
        return templates;
    }

    public List<TemplateResponse> getDcTemplate() {
        return dcTemplate;
    }

    public void setDcTemplate(List<TemplateResponse> dcTemplate) {
        this.dcTemplate = dcTemplate;
    }

    public List<TemplateResponse> getWorksTemplate() {
        return worksTemplate;
    }

    public void setWorksTemplate(List<TemplateResponse> worksTemplate) {
        this.worksTemplate = worksTemplate;
    }

    public String getZoneId() {
        return zoneId;
    }

    public void setZoneId(String zoneId) {
        this.zoneId = zoneId;
    }

    public String getZoneName() {
        return zoneName;
    }

    public void setZoneName(String zoneName) {
        this.zoneName = zoneName;
    }

    public String getUploadType() {
        return uploadType;
    }

    public void setUploadType(String uploadType) {
        this.uploadType = uploadType;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public void setCreated(Date created) {
        this.created = created;
    }
}
