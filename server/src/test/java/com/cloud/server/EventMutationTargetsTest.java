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
import static org.junit.Assert.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;

import org.apache.cloudstack.api.command.user.event.DeleteEventsCmd;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import org.apache.cloudstack.framework.config.dao.ConfigurationDao;
import com.cloud.event.EventVO;
import com.cloud.event.dao.EventDao;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;

public class EventMutationTargetsTest {
    private final ManagementServerImpl server = spy(new ManagementServerImpl());
    private final AccountManager accounts = mock(AccountManager.class);
    private final ConfigurationDao configurations = mock(ConfigurationDao.class);
    private final EventDao events = mock(EventDao.class);

    @Before
    public void setUp() {
        Account caller = mock(Account.class);
        doReturn(caller).when(server).getCaller();
        when(caller.getId()).thenReturn(42L);
        when(accounts.isNormalUser(42L)).thenReturn(true);
        ReflectionTestUtils.setField(server, "_accountMgr", accounts);
        ReflectionTestUtils.setField(server, "_configDao", configurations);
        server._eventDao = events;
    }

    @Test
    public void deactivatedDeletionDoesNotReadOrModifyEventRows() {
        when(configurations.getValue("event.delete.enabled")).thenReturn("false");
        PermissionDeniedException error = assertThrows(PermissionDeniedException.class,
                () -> server.deleteEvents(mock(DeleteEventsCmd.class)));
        assertEquals("Event deletion is disabled.", error.getMessage());
        verifyNoInteractions(events);
    }

    @Test
    public void rejectsArchivedTargetsForBothActions() {
        EventVO active = new EventVO();
        EventVO archived = new EventVO();
        archived.setArchived(true);
        List<Long> ids = List.of(11L, 12L);
        when(events.lockEventsForArchiveOrDelete(ids, null, null, null, List.of(42L))).thenReturn(List.of(active, archived));
        assertEquals("Archived events cannot be deleted.", assertThrows(InvalidParameterValueException.class,
                () -> server.lockActiveEventTargets(ids, null, null, null, true)).getMessage());
        assertEquals("Archived events cannot be archived again.", assertThrows(InvalidParameterValueException.class,
                () -> server.lockActiveEventTargets(ids, null, null, null, false)).getMessage());
    }

    @Test
    public void checksWholeSelectionAndKeepsOnlyDistinctIds() {
        EventVO active = new EventVO();
        List<Long> ids = List.of(11L, 12L);
        when(events.lockEventsForArchiveOrDelete(ids, null, null, null, List.of(42L))).thenReturn(List.of(active));
        assertEquals("One or more selected events are unavailable.", assertThrows(InvalidParameterValueException.class,
                () -> server.lockActiveEventTargets(ids, null, null, null, false)).getMessage());

        when(events.lockEventsForArchiveOrDelete(List.of(11L), null, null, null, List.of(42L))).thenReturn(List.of(active));
        assertEquals(List.of(active), server.lockActiveEventTargets(List.of(11L, 11L), null, null, null, true));
        verify(events).lockEventsForArchiveOrDelete(List.of(11L), null, null, null, List.of(42L));
    }
}
