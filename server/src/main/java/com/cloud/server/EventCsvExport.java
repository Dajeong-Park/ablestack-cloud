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
package com.cloud.server;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import org.apache.cloudstack.api.BaseCmd;

import com.cloud.api.query.vo.EventJoinVO;

final class EventCsvExport {
    private static final String HEADER = "id,username,type,level,description,account,domainid,resourcetype,created,state,key";

    private EventCsvExport() {
    }

    static String write(List<EventJoinVO> events) {
        StringBuilder csv = new StringBuilder("\uFEFF").append(HEADER).append("\r\n");
        for (EventJoinVO event : events) {
            // Keep the empty key column for compatibility with the original UI export.
            String row = Arrays.stream(new Object[] {
                    event.getUuid(), event.getUserName(), event.getType(), event.getLevel(), event.getDescription(),
                    event.getProjectUuid() == null ? event.getAccountName() : null, event.getDomainUuid(), event.getResourceType(),
                    BaseCmd.getDateString(event.getCreateDate()), event.getState(), null
            }).map(EventCsvExport::quote).collect(Collectors.joining(","));
            csv.append(row).append("\r\n");
        }
        return csv.toString();
    }

    private static String quote(Object value) {
        String text = Objects.toString(value, "");
        if (value instanceof String && needsSpreadsheetTextPrefix(text)) {
            text = "'" + text;
        }
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    private static boolean needsSpreadsheetTextPrefix(String text) {
        if (text.isEmpty()) {
            return false;
        }
        final char first = text.charAt(0);
        final String trimmed = text.stripLeading();
        return first == '\t' || first == '\r' || first == '\n'
                || (!trimmed.isEmpty() && "=+-@＝＋－＠".indexOf(trimmed.charAt(0)) >= 0);
    }
}
