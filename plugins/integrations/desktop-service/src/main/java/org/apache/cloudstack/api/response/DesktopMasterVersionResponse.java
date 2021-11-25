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

import org.apache.cloudstack.api.ApiConstants;
import org.apache.cloudstack.api.BaseResponse;
import org.apache.cloudstack.api.EntityReference;

import com.cloud.desktop.version.DesktopMasterVersion;
import com.cloud.serializer.Param;
import com.google.gson.annotations.SerializedName;

@SuppressWarnings("unused")
@EntityReference(value = {DesktopMasterVersion.class})
public class DesktopMasterVersionResponse extends BaseResponse {
    @SerializedName(ApiConstants.ID)
    @Param(description = "the id of the Desktop Master Version")
    private String id;

    @SerializedName(ApiConstants.NAME)
    @Param(description = "Name of the Desktop Master Version")
    private String name;

    @SerializedName(ApiConstants.DESCRIPTION)
    @Param(description = "the description of the Desktop Master Version")
    private String description;

    @SerializedName(ApiConstants.TEMPLATE_ID)
    @Param(description = "the id of templates associated with this Desktop")
    private String templateId;

    @SerializedName(ApiConstants.TEMPLATE_NAME)
    @Param(description = "the name of templates associated with this Desktop")
    private String templateName;

    @SerializedName(ApiConstants.DESKTOP_TEMPLATE_STATE)
    @Param(description = "the state of templates associated with this Desktop")
    private String templateState;

    @SerializedName(ApiConstants.DESKTOP_TEMPLATE_OS_TYPE)
    @Param(description = "the OS type of templates associated with this Desktop")
    private String templateOSType;

    @SerializedName(ApiConstants.VERSION)
    @Param(description = "Desktop version")
    private String version;

    @SerializedName(ApiConstants.ACCOUNT)
    @Param(description = "the account associated with the Desktop Master Version")
    private String accountName;

    @SerializedName(ApiConstants.DOMAIN_ID)
    @Param(description = "the ID of the domain in which the Desktop Master Version exists")
    private String domainId;

    @SerializedName(ApiConstants.DOMAIN)
    @Param(description = "the name of the domain in which the Desktop Master Version exists")
    private String domainName;

    @SerializedName(ApiConstants.ZONE_ID)
    @Param(description = "the id of the zone in which Desktop Master Version is available")
    private String zoneId;

    @SerializedName(ApiConstants.ZONE_NAME)
    @Param(description = "the name of the zone in which Desktop Master Version is available")
    private String zoneName;

    @SerializedName(ApiConstants.STATE)
    @Param(description = "the enabled or disabled state of the Desktop Master Version")
    private String state;

    @SerializedName(ApiConstants.DESKTOP_MASTER_VERSION_UPLOADTYPE)
    @Param(description = "the upload type of the Desktop Master Version")
    private String uploadType;

    @SerializedName(ApiConstants.DESKTOP_MASTER_TEMPLATE_TYPE)
    @Param(description = "the type of desktop master version")
    private String type;

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

    public String getTemplateId() {
        return templateId;
    }

    public void setTemplateId(String templateId) {
        this.templateId = templateId;
    }

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public String getTemplateState() {
        return templateState;
    }

    public void setTemplateState(String templateState) {
        this.templateState = templateState;
    }

    public String getTemplateOSType() {
        return templateOSType;
    }

    public void setTemplateOSType(String templateOSType) {
        this.templateOSType = templateOSType;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
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

    public void setAccountName(String accountName) {
        this.accountName = accountName;
    }

    public void setDomainId(String domainId) {
        this.domainId = domainId;
    }

    public void setDomainName(String domainName) {
        this.domainName = domainName;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getUploadType() {
        return uploadType;
    }

    public void setUploadType(String uploadType) {
        this.uploadType = uploadType;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setCreated(Date created) {
        this.created = created;
    }
}
