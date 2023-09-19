//
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
//

package com.cloud.utils.mold;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import com.cloud.utils.StringUtils;
import com.cloud.utils.crypt.AeadBase64Encryptor;
import com.cloud.utils.crypt.EncryptionException;
import com.cloud.utils.ssh.SSHKeysHelper;

public class SecurityCheck {
    public static void main(String[] args) throws EncryptionException, Exception {
        Map<String, String> resultMap = new HashMap<>();
        // Request (Request 및 Response에 포함된 민감한 문자열을 제거하는 프로세스가 정상적으로 동작하는지 확인)
        final String input = "name=SS1&provider=SMB&zoneid=5a60af2b-3025-4f2a-9ecc-8e33bf2b94e3&url=cifs%3A%2F%2F10.102.192.150%2FSMB-Share%2Fsowmya%2Fsecondary%3Fuser%3Dsowmya%26password%3DXXXXX%40123%26domain%3DBLR";
        final String expected = "name=SS1&provider=SMB&zoneid=5a60af2b-3025-4f2a-9ecc-8e33bf2b94e3&url=cifs%3A%2F%2F10.102.192.150%2FSMB-Share%2Fsowmya%2Fsecondary%3Fuser%3Dsowmya%26domain%3DBLR";
        final String result = StringUtils.cleanString(input);
        if (result.equalsIgnoreCase(expected)) {
            resultMap.put("request", "true");
        } else {
            resultMap.put("request", "false");
        }
        // Encrypt (보안기능에 적합한 알고리즘으로 암호화된 암호를 복호화하는 프로세스가 정상적으로 동작하는지 확인)
        final String pwd = "managementkey";
        AeadBase64Encryptor encryptor = new AeadBase64Encryptor(pwd.getBytes(StandardCharsets.UTF_8));
        try {
            final String decrypt = encryptor.decrypt("DlTJUG8rWFjOd3aoHtbBGEcQ/piovBzRJ/bnQ1FACLg=");
            if (decrypt.equalsIgnoreCase("mold")) {
                resultMap.put("encrypt", "true");
            } else {
                resultMap.put("encrypt", "false");
            }
        } catch (EncryptionException e){
            resultMap.put("encrypt", "false");
        }
        // Sshkey
        String rsaKey =
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC2D2Cs0XAEqm+ajJpumIPrMpKp0CWtIW+8ZY2/MJCW"
                + "hge1eY18u9I3PPnkMVJsTOaN0wQojjw4AkKgKjNZXA9wyUq56UyN/stmipu8zifWPgxQGDRkuzzZ6buk"
                + "ef8q2Awjpo8hv5/0SRPJxQLEafESnUP+Uu/LUwk5VVC7PHzywJRUGFuzDl/uT72+6hqpL2YpC6aTl4/P"
                + "2eDvUQhCdL9dBmUSFX8ftT53W1jhsaQl7mPElVgSCtWz3IyRkogobMPrpJW/IPKEiojKIuvNoNv4CDR6"
                + "ybeVjHOJMb9wi62rXo+CzUsW0Y4jPOX/OykAm5vrNOhQhw0aaBcv5XVv8BRX test@testkey";
        String storedRsaKey =
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC2D2Cs0XAEqm+ajJpumIPrMpKp0CWtIW+8ZY2/MJCW"
                + "hge1eY18u9I3PPnkMVJsTOaN0wQojjw4AkKgKjNZXA9wyUq56UyN/stmipu8zifWPgxQGDRkuzzZ6buk"
                + "ef8q2Awjpo8hv5/0SRPJxQLEafESnUP+Uu/LUwk5VVC7PHzywJRUGFuzDl/uT72+6hqpL2YpC6aTl4/P"
                + "2eDvUQhCdL9dBmUSFX8ftT53W1jhsaQl7mPElVgSCtWz3IyRkogobMPrpJW/IPKEiojKIuvNoNv4CDR6" + "ybeVjHOJMb9wi62rXo+CzUsW0Y4jPOX/OykAm5vrNOhQhw0aaBcv5XVv8BRX";
        try {
            String parsedKey = SSHKeysHelper.getPublicKeyFromKeyMaterial(rsaKey);
            String fingerprint = SSHKeysHelper.getPublicKeyFingerprint(parsedKey);
            if (storedRsaKey.equals(parsedKey) && "f6:96:3f:f4:78:f7:80:11:6c:f8:e3:2b:40:20:f1:14".equals(fingerprint)) {
                resultMap.put("sshkey", "true");
            } else {
                resultMap.put("sshkey", "false");
            }
        } catch (Exception e){
            resultMap.put("sshkey", "false");
        }
        System.out.printf("%s%n", resultMap);
    }
}
