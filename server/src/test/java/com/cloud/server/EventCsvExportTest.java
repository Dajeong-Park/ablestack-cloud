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

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.Test;

import com.cloud.api.query.vo.EventJoinVO;
import com.cloud.event.Event;

public class EventCsvExportTest {
    private static final String HEADER = "\uFEFFid,username,type,level,description,account,domainid,resourcetype,created,state,key\r\n";

    @Test
    public void writesHeaderForEmptyResult() {
        assertEquals(HEADER, EventCsvExport.write(List.of()));
    }

    @Test
    public void quotesMultilineUnicodeAndPreservesEmptyCells() {
        EventJoinVO active = mock(EventJoinVO.class);
        when(active.getUuid()).thenReturn("event-1");
        when(active.getType()).thenReturn("USER.LOGIN");
        when(active.getState()).thenReturn(Event.State.Completed);
        when(active.getDescription()).thenReturn("한글, \"quoted\"\r\nnext line");

        EventJoinVO archived = mock(EventJoinVO.class);
        when(archived.getUuid()).thenReturn("event-2");
        when(archived.getAccountName()).thenReturn("owner");
        assertEquals(HEADER
                + "\"event-1\",\"\",\"USER.LOGIN\",\"\",\"한글, \"\"quoted\"\"\r\nnext line\",\"\",\"\",\"\",\"\",\"Completed\",\"\"\r\n"
                + "\"event-2\",\"\",\"\",\"\",\"\",\"owner\",\"\",\"\",\"\",\"\",\"\"\r\n",
                EventCsvExport.write(List.of(active, archived)));
    }

    @Test
    public void exportsSpreadsheetFormulaPrefixesAsText() {
        EventJoinVO event = mock(EventJoinVO.class);
        when(event.getUserName()).thenReturn("@operator");
        when(event.getDescription()).thenReturn("  =1+1");
        when(event.getAccountName()).thenReturn("\t-account");
        when(event.getResourceType()).thenReturn("＋text");
        assertEquals(HEADER
                + "\"\",\"'@operator\",\"\",\"\",\"'  =1+1\",\"'\t-account\",\"\",\"'＋text\",\"\",\"\",\"\"\r\n",
                EventCsvExport.write(List.of(event)));
    }
}
