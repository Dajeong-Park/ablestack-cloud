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

import com.cloud.utils.StringUtils;

@Entity
@Table(name = "integrity_verification_initial_hash")
public class IntegrityVerificationVO implements IntegrityVerification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false, nullable = false)
    private long id;

    @Column(name = "mshost_id", updatable = false, nullable = false)
    private long msHostId;

    @Column(name = "file_path", updatable = false, nullable = false)
    private String filePath;

    @Column(name = "initial_hash_value", updatable = false, nullable = true)
    private String initialHashValue;

    @Column(name = "comparison_hash_value", updatable = true, nullable = true)
    private String comparisonHashValue;

    @Column(name = "verification_result")
    private boolean verificationResult;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "verification_date", updatable = true, nullable = true)
    private Date verificationDate;

    @Column(name = "verification_details", updatable = true, nullable = true)
    private byte[] verificationDetails;

    public long getId() {
        return id;
    }

    @Override
    public long getMsHostId() {
        return msHostId;
    }

    @Override
    public String getFilePath() {
        return filePath;
    }

    @Override
    public String getInitialHashValue() {
        return initialHashValue;
    }

    @Override
    public String getComparisonHashValue() {
        return comparisonHashValue;
    }

    @Override
    public boolean getVerificationResult() {
        return verificationResult;
    }

    @Override
    public Date getVerificationDate() { return verificationDate; }

    @Override
    public String getParsedVerificationDetails() {
        return verificationDetails != null ? new String(verificationDetails, StringUtils.getPreferredCharset()) : "";
    }

    public byte[] getVerificationDetails() {
        return verificationDetails;
    }

    public void setComparisonHashValue(String comparisonHashValue) {
        this.comparisonHashValue = comparisonHashValue;
    }

    public void setVerificationResult(boolean verificationResult) { this.verificationResult = verificationResult; }

    public void setVerificationDate(Date verificationDate) {
        this.verificationDate = verificationDate;
    }

    public void setVerificationDetails(byte[] verificationDetails) {
        this.verificationDetails = verificationDetails;
    }

    public IntegrityVerificationVO(long mshostId, String filePath) {
        this.msHostId = mshostId;
        this.filePath = filePath;
    }

    @Override
    public String toString() {
        return super.toString() +
                "- file path: " + filePath +
                ", verification result: " + verificationResult +
                ", verification date: " + verificationDate +
                ", details: " + getParsedVerificationDetails();
    }
}
