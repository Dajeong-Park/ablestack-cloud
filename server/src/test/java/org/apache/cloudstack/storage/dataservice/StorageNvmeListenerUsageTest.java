// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
package org.apache.cloudstack.storage.dataservice;

import com.cloud.api.response.ApiResponseSerializer;
import com.cloud.utils.exception.CloudRuntimeException;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import org.apache.cloudstack.api.response.*;
import org.apache.cloudstack.storage.dataservice.dao.*;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class StorageNvmeListenerUsageTest {
    static class Harness extends StorageServiceManagerImpl {
        final List<StorageBlockTargetVO> targets=new ArrayList<>();
        final List<StorageServiceProtocolVO> listeners=new ArrayList<>();
        final StorageServiceInstanceVO instance=mock(StorageServiceInstanceVO.class);
        final StorageBlockTargetDao targetDao=mock(StorageBlockTargetDao.class);
        int applies;
        Harness() {
            when(instance.getId()).thenReturn(8L);
            when(instance.getUuid()).thenReturn("instance");
            var instances=mock(StorageServiceInstanceDao.class);
            when(instances.findById(8L)).thenReturn(instance);
            ReflectionTestUtils.setField(this,"storageServiceInstanceDao",instances);
            when(targetDao.listByInstanceIdAndProtocol(eq(8L),any())).thenAnswer(i->
                i.getArgument(1)==StorageServiceInstance.Protocol.NVME_OF?targets:List.of());
            ReflectionTestUtils.setField(this,"storageBlockTargetDao",targetDao);
            var files=mock(StorageFileShareDao.class);
            when(files.listByInstanceIdAndProtocol(eq(8L),any())).thenReturn(List.of());
            ReflectionTestUtils.setField(this,"storageFileShareDao",files);
            var protocols=mock(StorageServiceProtocolDao.class);
            when(protocols.listByInstanceIdAndProtocol(8L,StorageServiceInstance.Protocol.NVME_OF)).thenAnswer(i->listeners);
            when(protocols.remove(anyLong())).thenAnswer(i->listeners.removeIf(x->x.getId()==(Long)i.getArgument(0)));
            ReflectionTestUtils.setField(this,"storageServiceProtocolDao",protocols);
        }
        void target(String config,StorageServiceInstance.ResourceState state) {
            var t=mock(StorageBlockTargetVO.class);
            when(t.getConfigJson()).thenReturn(config);when(t.getState()).thenReturn(state);targets.add(t);
        }
        StorageServiceProtocolVO listener(Integer port) {
            var p=new StorageServiceProtocolVO(8L,StorageServiceInstance.Protocol.NVME_OF,true,"0.0.0.0",port);
            ReflectionTestUtils.setField(p,"id",(long)listeners.size()+1);
            p.setState(StorageServiceInstance.ResourceState.Ready);listeners.add(p);return p;
        }
        JsonObject wire() {
            var context=new ProtocolResponseContext();
            populateLinkedResourceCounts(context,8L);
            var list=new ListResponse<StorageServiceProtocolResponse>();
            list.setResponses(listeners.stream().map(p->createProtocolResponse(p,context)).collect(java.util.stream.Collectors.toList()));
            list.setResponseName("liststorageserviceprotocolsresponse");
            return JsonParser.parseString(ApiResponseSerializer.toSerializedString(list,"json")).getAsJsonObject();
        }
        int count(int port) {
            for(var item:wire().getAsJsonObject("liststorageserviceprotocolsresponse").getAsJsonArray("storageserviceprotocol")) {
                var row=item.getAsJsonObject();
                if((row.has("port")?row.get("port").getAsInt():4420)==port)return row.get("linkedresourcecount").getAsInt();
            }
            throw new AssertionError("missing listener");
        }
        void guard(StorageServiceProtocolVO listener,int port) {validateNvmeOfListenerCanBeDeleted(instance,listener,port);}
        boolean remove(int port) {return deleteNvmeOfStorageServiceEndpoint(instance,"0.0.0.0",port);}
        @Override protected void applyNvmeOfDesiredState(StorageServiceInstanceVO instance) {applies++;}
    }
    @Test public void subsystemContainerCannotClaimTheUnusedDefaultPortAndActualApiWireAllowsItsRemoval() throws Exception {
        Harness h=new Harness();var old=h.listener(null);var active=h.listener(4421);
        h.target("{\"type\":\"subsystem\",\"allowAnyHost\":false,\"engine\":\"KERNEL_NVMET\",\"transport\":\"tcp\"}",StorageServiceInstance.ResourceState.Ready);
        h.target("{\"type\":\"namespace\",\"listenerGroupPorts\":[4421],\"endpointMode\":\"LISTENER_GROUP\"}",StorageServiceInstance.ResourceState.Ready);
        assertEquals(0,h.count(4420));assertEquals(1,h.count(4421));
        h.guard(old,4420);
        String output=System.getProperty("nvme.usage.fixture");
        if(output!=null)Files.writeString(Path.of(output),new GsonBuilder().setPrettyPrinting().create().toJson(h.wire())+"\n");
        assertTrue(h.remove(4420));assertEquals(List.of(active),h.listeners);assertEquals(1,h.applies);
        verify(h.targetDao,never()).remove(anyLong());verify(h.targetDao,never()).update(anyLong(),any());
    }
    @Test public void actualLastNamespaceListenerRemainsProtectedForImplicitExplicitAndDuplicatePortForms() {
        for(String config:List.of("{\"type\":\"namespace\"}","{\"type\":\"namespace\",\"listenerGroupPorts\":[]}","{\"type\":\"namespace\",\"listenerGroupPorts\":[4420,4420]}")) {
            Harness h=new Harness();var active=h.listener(null);h.target(config,StorageServiceInstance.ResourceState.Ready);
            assertEquals(1,h.count(4420));
            try {h.remove(4420);fail("active namespace must protect the last listener");}
            catch(CloudRuntimeException e){assertTrue(e.getMessage().contains("used by namespaces"));}
            assertEquals(0,h.applies);assertTrue(active.isEnabled());assertEquals(1,h.listeners.size());
        }
    }
    @Test public void onlyTheSameActiveResourceStatesAsDeletionProtectionContributeUsage() {
        Harness h=new Harness();var active=h.listener(4421);
        for(var state:StorageServiceInstance.ResourceState.values()) {
            h.targets.clear();h.target("{\"type\":\"namespace\",\"listenerGroupPorts\":[4421]}",state);
            boolean protectedState=h.isActiveStorageServiceResource(state);
            assertEquals(state.name(),protectedState?1:0,h.count(4421));
            try {h.guard(active,4421);assertFalse(state.name(),protectedState);}
            catch(CloudRuntimeException e){assertTrue(state.name(),protectedState);}
        }
    }
}
