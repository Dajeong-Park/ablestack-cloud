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
package com.cloud.api.response;

import org.apache.cloudstack.api.ResponseObject;
import org.apache.cloudstack.api.response.ListResponse;
import org.junit.Assert;
import org.junit.Test;

import java.util.Collections;

public class ASNListCountSerializationTest {
    @Test
    public void emptyAsnQueriesHaveExplicitZeroInResponseAndLog() {
        for (String name : new String[] {"listasnumbersresponse", "listasnrangesresponse"}) {
            ListResponse<ResponseObject> response = new ListResponse<>();
            response.setResponses(Collections.emptyList(), 0); response.setResponseName(name);
            StringBuilder log = new StringBuilder();
            Assert.assertEquals("{\"" + name + "\":{\"count\":0}}", ApiResponseSerializer.toJSONSerializedString(response, log));
            Assert.assertEquals("{\"" + name + "\":{\"count\":0}}", log.toString());
        }
    }

    @Test
    public void otherListSerializationRemainsUnchanged() {
        ListResponse<ResponseObject> response = new ListResponse<>();
        response.setResponses(Collections.emptyList(), 0); response.setResponseName("listnetworksresponse");
        Assert.assertEquals("{\"listnetworksresponse\":{}}", ApiResponseSerializer.toJSONSerializedString(response, new StringBuilder()));
    }

    @Test
    public void positiveCountAndUnknownCountAreNotConvertedToZero() {
        ListResponse<ResponseObject> response = new ListResponse<>(); response.setResponseName("listasnumbersresponse");
        response.setResponses(Collections.emptyList(), 3);
        Assert.assertTrue(ApiResponseSerializer.toJSONSerializedString(response, new StringBuilder()).contains("\"count\":3"));
        response.setResponses(null, null);
        Assert.assertEquals("{\"listasnumbersresponse\":{}}", ApiResponseSerializer.toJSONSerializedString(response, new StringBuilder()));
    }
}
