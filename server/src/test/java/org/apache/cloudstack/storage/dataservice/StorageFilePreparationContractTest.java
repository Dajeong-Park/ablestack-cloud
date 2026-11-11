// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
// http://www.apache.org/licenses/LICENSE-2.0
package org.apache.cloudstack.storage.dataservice;
import java.util.*;
import com.cloud.storage.VolumeVO;
import com.cloud.utils.exception.CloudRuntimeException;
import com.google.gson.*;
import org.apache.cloudstack.storage.dataservice.dao.StorageFileShareDao;
import org.apache.cloudstack.storage.sharedfs.dao.SharedFSDao;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class StorageFilePreparationContractTest {
    @Test public void nfsRequiresTheMatchingDeferredReceiptAndRejectsOldRuntimeBeforePrepare() {
        for(boolean aligned:new boolean[]{false,true}) {
            StorageServiceManagerImpl manager=spy(new StorageServiceManagerImpl());
            StorageServiceGuestCommandDispatcher guest=mock(StorageServiceGuestCommandDispatcher.class);
            ReflectionTestUtils.setField(manager,"guestCommandDispatcher",guest);
            ReflectionTestUtils.setField(manager,"sharedFSDao",mock(SharedFSDao.class));
            StorageServiceInstanceVO instance=mock(StorageServiceInstanceVO.class);
            when(instance.getVmId()).thenReturn(1L);
            VolumeVO volume=mock(VolumeVO.class);
            String volumeUuid="11111111-2222-4333-8444-555555555555";
            when(volume.getUuid()).thenReturn(volumeUuid);
            StorageFileShareVO share=new StorageFileShareVO(1L,StorageServiceInstance.Protocol.NFS,"share","/export/share",3L,"xfs",null,StorageServiceInstance.ResourceState.Allocated,"{}");
            StorageServiceConfigurationPlan plan=mock(StorageServiceConfigurationPlan.class);
            plan.operationUuid="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
            StorageFileShareDao dao=mock(StorageFileShareDao.class);
            when(plan.dao(StorageFileShareDao.class)).thenReturn(dao);
            @SuppressWarnings("unchecked") ThreadLocal<StorageServiceConfigurationPlan> local=
                (ThreadLocal<StorageServiceConfigurationPlan>)ReflectionTestUtils.getField(manager,"configurationPlan");
            local.set(plan);
            JsonObject payload=new JsonObject();payload.addProperty("protocol","NFS");payload.add("config",new JsonObject());
            doReturn(payload).when(manager).createFileShareVolumePayload(instance,share,volume);
            doReturn("{}").when(manager).buildFileShareAttachConfigJson(anyString(),anyString(),eq(volume),any());
            when(guest.dispatch(any())).thenAnswer(call -> {
                StorageServiceGuestCommand cmd=call.getArgument(0);
                if(cmd.getOperation().equals("configuration capability show"))
                    return new StorageServiceGuestCommandResult(true,"",aligned?"{\"nfsDeferredDirectoryVersion\":1}":"{}");
                assertTrue(aligned);
                assertEquals("volume attach inspect",cmd.getOperation());
                JsonObject request=JsonParser.parseString(cmd.getPayload()).getAsJsonObject();
                assertTrue(request.get("deferDirectory").getAsBoolean());
                assertEquals(plan.operationUuid,request.get("configurationOperationId").getAsString());
                JsonObject reply=new JsonObject();
                reply.addProperty("directoryManagedByApply",true);reply.addProperty("directoryCreated",false);
                reply.addProperty("configurationOperationId",plan.operationUuid);
                reply.addProperty("volumeUuid",volumeUuid);reply.addProperty("filesystemUuid","filesystem");
                return new StorageServiceGuestCommandResult(true,"",reply.toString());
            });
            try {
                manager.inspectAttachedFileShareVolume(instance,share,volume,"MOUNT_EXISTING");
                assertTrue(aligned);
                verify(dao).update(share.getId(),share);
            } catch(CloudRuntimeException failure) {
                assertFalse(aligned);
                assertEquals("NFS_DIRECTORY_PREPARATION_CAPABILITY_REQUIRED",failure.getMessage());
                verifyNoInteractions(dao);
            } finally {local.remove();}
            verify(guest,times(aligned?2:1)).dispatch(any());
        }
    }
}
