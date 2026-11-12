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

package com.cloud.upgrade.dao;
import java.sql.Connection;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import com.cloud.utils.db.ScriptRunner;
import com.cloud.utils.exception.CloudRuntimeException;
public final class EuropaSmbServiceNamesUpgrade {
    public static final String KEY="europa-storage-smb-service-names-v1";
    private EuropaSmbServiceNamesUpgrade(){}
    public static void migrate(Connection conn){
        try(InputStream input=EuropaSmbServiceNamesUpgrade.class.getClassLoader().getResourceAsStream("META-INF/db/schema-sharedfs-1466-smb-names.sql")){
            if(input==null)throw new CloudRuntimeException("Missing SMB service name migration");
            new ScriptRunner(conn,false,true).runScript(new InputStreamReader(input,StandardCharsets.UTF_8));
        }catch(Exception error){throw new CloudRuntimeException("Unable to create SMB service name registry",error);}
    }
}
