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

package com.cloud.security;

import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;

@Entity
@Table(name = "security_check")
public class SecurityCheckVO implements SecurityCheck {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private long id;

    @Column(name = "mshost_id")
    private long msHostId;

    @Column(name = "check_result")
    private boolean checkResult;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "check_date")
    private Date checkDate;

    @Column(name = "check_failed_list", length = 16777215)
    private String checkFailedList;

    @Column(name = "type")
    private String type;

    @Column(name = "service")
    private String service;

    @Override
    public long getId() {
        return id;
    }

    @Override
    public long getMsHostId() {
        return msHostId;
    }

    @Override
    public boolean getCheckResult() {
        return checkResult;
    }

    @Override
    public Date getCheckDate() {
        return checkDate;
    }

    @Override
    public String getCheckFailedList() {
        return checkFailedList;
    }

    @Override
    public String getType() {
        return type;
    }

    @Override
    public String getService() {
        return service;
    }

    public void setMsHostId(long msHostId) {
        this.msHostId = msHostId;
    }

    public void setCheckResult(boolean checkResult) {
        this.checkResult = checkResult;
    }

    public void setCheckDate(Date checkDate) {
        this.checkDate = checkDate;
    }

    public void setCheckFailedList(String checkFailedList) {
        this.checkFailedList = checkFailedList;
    }

    public void setType(String type) {
        this.type = type;
    }

    public void setService(String service) {
        this.service = service;
    }

    protected SecurityCheckVO() {
    }

    public SecurityCheckVO(long msHostId, boolean checkResult, String checkFailedList, String type, String service) {
        this.msHostId = msHostId;
        this.checkResult = checkResult;
        this.checkFailedList = checkFailedList;
        this.type = type;
        this.service = service;
    }

    @Override
    public String toString() {
        return super.toString() +
                ", check result: " + checkResult +
                ", check date: " + checkDate +
                ", check failed list: " + checkFailedList;
    }
}
