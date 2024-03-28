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
package com.cloud.dr.cluster;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.URL;
import java.net.URLEncoder;
import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;
import java.security.SecureRandom;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;

import org.apache.cloudstack.utils.security.SSLUtils;
import org.apache.commons.codec.binary.Base64;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;
import org.json.XML;
import org.json.JSONObject;

import com.cloud.utils.nio.TrustAllManager;
import com.google.gson.JsonParser;
import com.google.gson.JsonObject;

public class DisasterRecoveryClusterUtil {

    protected static Logger LOGGER = LogManager.getLogger(DisasterRecoveryClusterUtil.class);

    /**
     * Glue 상태 조회
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /glue
     * @param method
     *  GET
     * @return
     *  String
     *  ex) {"checks": "string", "mutes": "string", "status": "HEALTH_WARN"}
     */
    protected static String glueStatusAPI(String region, String subUrl, String method) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            if (connection.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                sb = new StringBuffer();
                while ((readLine = br.readLine()) != null) {
                    sb.append(readLine);
                }
                JsonParser jParser = new JsonParser();
                JsonObject jObject = (JsonObject)jParser.parse(sb.toString());
                String health = jObject.get("health").toString();
                return health;
            } else {
                String msg = "Failed to request glue status API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return null;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return null;
        }
    }

    /**
     * Glue 미러링 상태 조회
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror
     * @param method
     *  GET
     * @return
     *  String
     *  ex) {"daemon_health": "string", "health": "string", "image_health": "string", "states": "string"}
     */
    protected static String glueMirrorStatusAPI(String region, String subUrl, String method) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            if (connection.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                sb = new StringBuffer();
                while ((readLine = br.readLine()) != null) {
                    sb.append(readLine);
                }
                JsonParser jParser = new JsonParser();
                JsonObject jObject = (JsonObject)jParser.parse(sb.toString());
                String daemonHealth = jObject.get("daemon_health").toString();
                return daemonHealth;
            } else {
                String msg = "Failed to request glue mirror status API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return null;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return null;
        }
    }

    /**
     * Glue 미러링 클러스터 설정
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror
     * @param method
     *  POST
     * @param parameter
     *  localClusterName("local"), remoteClusterName("remote"), host(<scvmIP>), privateKeyFile(<scvmKey>), mirrorPool("rbd")
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static boolean glueMirrorSetupAPI(String region, String subUrl, String method, Map<String, String> params, File privateKey) {
        try {
            String readLine = null;
            OutputStream outputStream;
	        PrintWriter writer;
            String boundary = Long.toHexString(System.currentTimeMillis());
		    String CRLF = "\r\n";
            StringBuffer sb = null;
            
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Connection","Keep-Alive"); 
            connection.setRequestProperty("Content-type", "multipart/form-data;boundary=" + boundary);
            // parameter 추가 시 사용 예정
            outputStream = connection.getOutputStream();
            writer = new PrintWriter(new OutputStreamWriter(outputStream, "UTF-8"), true);
            for(Map.Entry<String, String> param : params.entrySet()){
                String key = param.getKey();
                String value = param.getValue();
                if (key.equalsIgnoreCase("localClusterName")) {
                    wr.writeBytes("--" + boundary + CRLF);
                    wr.writeBytes("Content-Disposition: form-data; name=\"localClusterName\"" + CRLF + CRLF + value);
                } else if (key.equalsIgnoreCase("remoteClusterName")) {
                    wr.writeBytes(CRLF + "--" + boundary + CRLF);
                    wr.writeBytes("Content-Disposition: form-data; name=\"remoteClusterName\"" + CRLF + CRLF + value);
                } else if (key.equalsIgnoreCase("host")) {
                    wr.writeBytes(CRLF + "--" + boundary + CRLF);
                    wr.writeBytes("Content-Disposition: form-data; name=\"host\"" + CRLF + CRLF + value);
                } else if (key.equalsIgnoreCase("mirrorPool")) {
                    wr.writeBytes(CRLF + "--" + boundary + CRLF);
                    wr.writeBytes("Content-Disposition: form-data; name=\"host\"" + CRLF + CRLF + value);
                }
            }
            wr.writeBytes(CRLF + "--" + boundary + CRLF);
            wr.writeBytes("Content-Disposition: form-data; name=\"privateKeyFile\"; filename="+ privateKey.getOriginalFilename() + "\r\n");
            wr.writeBytes("Content-Type: application/octet-stream\r\n\r\n");
            FileInputStream fileInputStream = new FileInputStream(privateKey.getPath());
            int bytesAvailable = fileInputStream.available();
            int maxBufferSize = 4096;
            int bufferSize = Math.min(bytesAvailable, maxBufferSize);
            byte[] buffer = new byte[bufferSize];

            int bytesRead = fileInputStream.read(buffer, 0, bufferSize);
            while (bytesRead > 0) {
                DataOutputStream dataWrite = new DataOutputStream(con.getOutputStream());
                dataWrite.write(buffer, 0, bufferSize);
                bytesAvailable = fileInputStream.available(); 
                bufferSize = Math.min(bytesAvailable, maxBufferSize); 
                bytesRead = fileInputStream.read(buffer, 0, bufferSize); 
            } 
            fileInputStream.close();
            wr.writeBytes(CRLF + "--" + boundary + "--" + CRLF);
            wr.flush();
            if (connection.getResponseCode() == 200) {
                return true;
            } else {
                String msg = "Failed to request glue mirror setup API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return false;
        }
    }

    /**
     * Glue 미러링 클러스터 제거
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror
     * @param method
     *  DELETE
     * @param parameter
     *  host(string), privateKeyFile(file), mirrorPool(string)
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static boolean glueMirrorRemoveAPI(String region, String subUrl, String method, Map<String, String> params) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            // parameter 추가 시 사용 예정
            // String apiParams = buildParamsGlues(params);
            // OutputStream os = connection.getOutputStream();
            // os.write(apiParams.getBytes("UTF-8"));
            // os.flush();
            // os.close();
            if (connection.getResponseCode() == 200) {
                return true;
            } else {
                String msg = "Failed to request glue mirror remove API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return false;
        }
    }

    /**
     * Glue 미러링된 이미지 목록 조회
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror/image
     * @param method
     *  GET
     * @return
     *  String
     *  {"Local": [{"image": "string","items": [{"interval": "string","start_time": "string"}],"namespace": "string","pool": "string"}],
        "Remote": [{"image": "string","items": [{"interval": "string","start_time": "string"}],"namespace": "string","pool": "string"}]}
     */
    protected static String glueImageMirrorAPI(String region, String subUrl, String method) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            if (connection.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                sb = new StringBuffer();
                while ((readLine = br.readLine()) != null) {
                    sb.append(readLine);
                }
                JsonParser jParser = new JsonParser();
                JsonObject jObject = (JsonObject)jParser.parse(sb.toString());
                return jObject.toString();
            } else {
                String msg = "Failed to request glue image mirror status API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return null;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return null;
        }
    }

    /**
     * Glue 이미지 미러링 설정
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror/image/mirrorPool(string)/imageName(string)
     * @param method
     *  POST
     * @param parameter
     *  interval(string), startTime(string)
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static boolean glueImageMirrorSetupAPI(String region, String subUrl, String method, Map<String, String> params) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            // parameter 추가 시 사용 예정
            // String apiParams = buildParamsGlues(params);
            // OutputStream os = connection.getOutputStream();
            // os.write(apiParams.getBytes("UTF-8"));
            // os.flush();
            // os.close();
            if (connection.getResponseCode() == 200) {
                return true;
            } else {
                String msg = "Failed to request glue image mirror setup API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return false;
        }
    }

    /**
     * Glue 미러링 이미지 프로모트
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror/promote/<mirrorPool>/<imageName>
     * @param method
     *  POST
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static boolean glueImageMirrorPromoteAPI(String region, String subUrl, String method) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            if (connection.getResponseCode() == 200) {
                return true;
            } else {
                String msg = "Failed to request glue image mirror promote API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return false;
        }
    }

    /**
     * Glue 미러링 이미지 디모트
     * @param region
     *  https://<IP>:8080/api/v1
     * @param subUrl
     *  /mirror/demote/<mirrorPool>/<imageName>
     * @param method
     *  DELETE
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static boolean glueImageMirrorDemoteAPI(String region, String subUrl, String method) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            // SSL 인증서 에러 우회 처리
            final SSLContext sslContext = SSLUtils.getSSLContext();
            sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
            URL url = new URL(region + subUrl);
            HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
            connection.setSSLSocketFactory(sslContext.getSocketFactory());
            connection.setDoOutput(true);
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(600000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
            if (connection.getResponseCode() == 200) {
                return true;
            } else {
                String msg = "Failed to request glue image mirror demote API. response code : " + connection.getResponseCode();
                LOGGER.error(msg);
                return false;
            }
        } catch (Exception e) {
            LOGGER.error(String.format("Glue API endpoint not available"), e);
            return false;
        }
    }

    /**
     * @param params
     *  Map<String, String>
     *  ex) map.put("vol_name", "test");
     *  ex) map.put("size", "10");
     *  ...
     * @return String
     *  ex) vol_name=test&size=10
     */
    protected static String buildParamsGlue(Map<String, String> params) {
        StringBuffer paramString = new StringBuffer("");
        if (params != null) {
            try {
                for(Map.Entry<String, String> param : params.entrySet() ){
                    String key = param.getKey();
                    String value = param.getValue();
                    paramString.append("&" + param.getKey() + "=" + URLEncoder.encode(param.getValue(), "UTF-8"));
                }
            } catch (UnsupportedEncodingException e) {
                LOGGER.error(e.getMessage());
                return null;
            }
        }
        return paramString.toString();
    }

    /**
     * Mold listScvmIpAddress API 요청
     * @param region
     *  <protocol>://<ip>:<port>/client/api/
     * @param command
     *  listScvmIpAddress
     * @param method
     *  GET
     * @param apiKey
     *  mold API Key
     * @param secretKey
     *  mold Secret Key
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static String moldListScvmIpAddressAPI(String region, String command, String method, String apiKey, String secretKey) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            String apiParams = buildParamsMold(command, null);
            String urlFinal = buildUrl(apiParams, region, apiKey, secretKey);
            URL url = new URL(urlFinal);
            if (region.contains("https")) {
                // SSL 인증서 에러 우회 처리
                final SSLContext sslContext = SSLUtils.getSSLContext();
                sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
                HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
                connection.setSSLSocketFactory(sslContext.getSocketFactory());
                connection.setDoOutput(true);
                connection.setRequestMethod(method);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(600000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
                if (connection.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                    sb = new StringBuffer();
                    while ((readLine = br.readLine()) != null) {
                        sb.append(readLine);
                    }
                } else {
                    String msg = "Failed to request mold API. response code : " + connection.getResponseCode();
                    LOGGER.error(msg);
                    return null;
                }
            } else {
                HttpURLConnection connection = (HttpURLConnection)url.openConnection();
                connection.setDoOutput(true);
                connection.setRequestMethod(method);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(600000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
                if (connection.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                    sb = new StringBuffer();
                    while ((readLine = br.readLine()) != null) {
                        sb.append(readLine);
                    }
                } else {
                    String msg = "Failed to request mold API. response code : " + connection.getResponseCode();
                    LOGGER.error(msg);
                    return null;
                }
            }
            JSONObject jObject = XML.toJSONObject(sb.toString());
            JSONObject response = (JSONObject) jObject.get("listscvmipaddressresponse");
            JSONObject ipaddress = (JSONObject) response.get("scvmipaddress");
            return ipaddress.get("ipaddress").toString();
        } catch (Exception e) {
            LOGGER.error(String.format("Mold API endpoint not available"), e);
            return null;
        }
    }

    /**
     * Mold createDisasterRecoveryCluster API 요청
     * @param region
     *  <protocol>://<ip>:<port>/client/api/
     * @param command
     *  createDisasterRecoveryCluster
     * @param method
     *  POST
     * @param name
     *  primary cluster name
     * @param drClusterType
     *  primary
     * @param drClusterIp
     *  primary cluster ip
     * @param drClusterPort
     *  primary cluster port
     * @param drClusterProtocol
     *  primary cluster protocol
     * @param drClusterApikey
     *  primary cluster api key
     * @param drClusterSecretKey
     *  primary cluster secret key
     * @return true = 200, 이외 코드는 false 처리
     */
    protected static String moldCreateDisasterRecoveryClusterAPI(String region, String command, String method, String apiKey, String secretKey, Map<String, String> params) {
        try {
            String readLine = null;
            StringBuffer sb = null;
            String apiParams = buildParamsMold(command, params);
            String urlFinal = buildUrl(apiParams, region, apiKey, secretKey);
            URL url = new URL(urlFinal);
            if (region.contains("https")) {
                // SSL 인증서 에러 우회 처리
                final SSLContext sslContext = SSLUtils.getSSLContext();
                sslContext.init(null, new TrustManager[]{new TrustAllManager()}, new SecureRandom());
                HttpsURLConnection connection = (HttpsURLConnection)url.openConnection();
                connection.setSSLSocketFactory(sslContext.getSocketFactory());
                connection.setDoOutput(true);
                connection.setRequestMethod(method);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(600000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
                if (connection.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                    sb = new StringBuffer();
                    while ((readLine = br.readLine()) != null) {
                        sb.append(readLine);
                    }
                } else {
                    String msg = "Failed to request mold API. response code : " + connection.getResponseCode();
                    LOGGER.error(msg);
                    return null;
                }
            } else {
                HttpURLConnection connection = (HttpURLConnection)url.openConnection();
                connection.setDoOutput(true);
                connection.setRequestMethod(method);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(600000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-type", "application/x-www-form-urlencoded");
                if (connection.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
                    sb = new StringBuffer();
                    while ((readLine = br.readLine()) != null) {
                        sb.append(readLine);
                    }
                } else {
                    String msg = "Failed to request mold API. response code : " + connection.getResponseCode();
                    LOGGER.error(msg);
                    return null;
                }
            }
            JSONObject jObject = XML.toJSONObject(sb.toString());
            // JSONObject response = (JSONObject) jObject.get("listscvmipaddressresponse");
            // JSONObject ipaddress = (JSONObject) response.get("scvmipaddress");
            // return ipaddress.get("ipaddress").toString();
        } catch (Exception e) {
            LOGGER.error(String.format("Mold API endpoint not available"), e);
            return null;
        }
    }


    /**
     * @param command
     *  command Mold API 명
     * @param params
     *  Map<String, String>
     *  ex) map.put("accountId", "3");
     *  ex) map.put("storageId", "1");
     *  ...
     * @return String
     *  ex) command=listStoragePools&domain=ROOT&user=admin
     */
    protected static String buildParamsMold(String command, Map<String, String> params) {
        StringBuffer paramString = new StringBuffer("command=" + command);
        if (params != null) {
            try {
                for(Map.Entry<String, String> param : params.entrySet() ){
                    String key = param.getKey();
                    String value = param.getValue();
                    paramString.append("&" + param.getKey() + "=" + URLEncoder.encode(param.getValue(), "UTF-8"));
                }
            } catch (UnsupportedEncodingException e) {
                LOGGER.error(e.getMessage());
                return null;
            }
        }
        return paramString.toString();
    }

    // Mold API 요청 최종 URL 생성
    private static String buildUrl(String apiParams, String region, String apiKey, String secretKey) {

        String encodedApiKey;
        try {
            encodedApiKey = URLEncoder.encode(apiKey, "UTF-8");
            List<String> sortedParams = new ArrayList<String>();
            sortedParams.add("apikey=" + encodedApiKey.toLowerCase());
            StringTokenizer st = new StringTokenizer(apiParams, "&");
            String url = null;
            boolean first = true;
            while (st.hasMoreTokens()) {
                String paramValue = st.nextToken();
                String param = paramValue.substring(0, paramValue.indexOf("="));
                String value = paramValue.substring(paramValue.indexOf("=") + 1, paramValue.length());
                if (first) {
                    url = param + "=" + value;
                    first = false;
                } else {
                    url = url + "&" + param + "=" + value;
                }
                sortedParams.add(param.toLowerCase() + "=" + value.toLowerCase());
            }
            Collections.sort(sortedParams);
            String sortedUrl = null;
            first = true;
            for (String param : sortedParams) {
                if (first) {
                    sortedUrl = param;
                    first = false;
                } else {
                    sortedUrl = sortedUrl + "&" + param;
                }
            }
            String encodedSignature = signRequest(sortedUrl, secretKey);
            String finalUrl = region + "?" + apiParams + "&apiKey=" + apiKey + "&signature=" + encodedSignature;
            return finalUrl;
        } catch (UnsupportedEncodingException e) {
            LOGGER.error(e.getMessage());
            return null;
        }
    }

    // Mold Signature 생성
    private static String signRequest(String request, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(key.getBytes(), "HmacSHA256");
            mac.init(keySpec);
            mac.update(request.getBytes());
            byte[] encryptedBytes = mac.doFinal();
            return URLEncoder.encode(Base64.encodeBase64String(encryptedBytes), "UTF-8");
        } catch (Exception ex) {
            LOGGER.error(ex.getMessage());
            return null;
        }
    }

}
