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
package org.apache.cloudstack.storage.object;

import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.inject.Inject;
import javax.naming.ConfigurationException;

import org.apache.cloudstack.api.command.user.bucket.CreateBucketCmd;
import org.apache.cloudstack.api.command.user.bucket.SyncBucketUsageCmd;
import org.apache.cloudstack.api.command.user.bucket.UpdateBucketCmd;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.framework.config.ConfigKey;
import org.apache.cloudstack.framework.config.Configurable;
import org.apache.cloudstack.managed.context.ManagedContextRunnable;
import org.apache.cloudstack.reservation.dao.ReservationDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;

import com.amazonaws.services.s3.internal.BucketNameUtils;
import com.amazonaws.services.s3.model.IllegalBucketNameException;
import com.cloud.agent.api.to.BucketTO;
import com.cloud.event.ActionEvent;
import com.cloud.event.EventTypes;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.ResourceAllocationException;
import com.cloud.resourcelimit.ResourceLimitManagerImpl;
import com.cloud.storage.BucketVO;
import com.cloud.storage.DataStoreRole;
import com.cloud.storage.dao.BucketDao;
import com.cloud.usage.dao.BucketStatisticsDao;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.utils.component.ManagerBase;
import com.cloud.utils.concurrency.NamedThreadFactory;
import com.cloud.utils.db.GlobalLock;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationDao;
import org.apache.cloudstack.context.CallContext;
import java.util.Objects;

public class BucketApiServiceImpl extends ManagerBase implements BucketApiService, Configurable {

    @Inject
    private ObjectStoreDao _objectStoreDao;
    @Inject
    DataStoreManager _dataStoreMgr;
    @Inject
    private BucketDao _bucketDao;
    @Inject
    private AccountManager _accountMgr;
    @Inject
    private ResourceLimitManagerImpl resourceLimitManager;

    @Inject
    private BucketStatisticsDao _bucketStatisticsDao;
    @Inject
    ReservationDao reservationDao;

    @Inject
    private BucketQuotaOperationDao quotaOperations;

    @Inject private org.apache.cloudstack.storage.datastore.db.ObjectStoreAccountCredentialDao objectCredentials;

    private BucketProtectionCoordinator protectionCoordinator() {
        return new BucketProtectionCoordinator(_bucketDao, _objectStoreDao, quotaOperations, _dataStoreMgr, objectCredentials);
    }
    @Override public org.apache.cloudstack.api.response.BucketProtectionResponse getProtection(String id, Account caller) {
        return protectionCoordinator().get(objectBucket(id, caller, false));
    }
    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_UPDATE, eventDescription = "explicit protection verification reconciliation")
    public org.apache.cloudstack.api.response.BucketProtectionResponse reconcileProtection(String id, Account caller, String operation, boolean acceptActual) {
        return protectionCoordinator().reconcile(objectBucket(id, caller, false), operation, acceptActual);
    }
    private BucketQuotaCoordinator quotaCoordinator() {
        return new BucketQuotaCoordinator(_objectStoreDao, _bucketDao, quotaOperations, _dataStoreMgr,
                _accountMgr, resourceLimitManager, reservationDao, objectCredentials);
    }

    private ScheduledExecutorService _executor = null;
    private BucketUsageCoordinator usageCoordinator;
    protected synchronized BucketUsageCoordinator usageCoordinator() {
        if (usageCoordinator == null) usageCoordinator = new BucketUsageCoordinator(_bucketDao, _bucketStatisticsDao, _objectStoreDao, _dataStoreMgr);
        return usageCoordinator;
    }

    private static final int ACQUIRE_GLOBAL_LOCK_TIMEOUT_FOR_COOPERATION = 3;

    protected BucketApiServiceImpl() {

    }

    @Override
    public boolean configure(String name, Map<String, Object> params) throws ConfigurationException {
        _executor = Executors.newScheduledThreadPool(2, new NamedThreadFactory("Bucket-Usage"));
        return true;
    }

    @Override
    public boolean start() {
        _executor.scheduleWithFixedDelay(new BucketUsageTask(), 60L, 3600L, TimeUnit.SECONDS);
        _executor.scheduleWithFixedDelay(new ManagedContextRunnable() {
            @Override protected void runInContext() {
                CallContext.registerSystemCallContextOnceOnly();
                try {
                    quotaCoordinator().recover();
                    protectionCoordinator().recoverInterrupted();
                    for (ObjectStoreVO store : _objectStoreDao.listObjectStores()) {
                        if ("Glue".equals(store.getProviderName())) {
                            BucketQuotaCoordinator.withStoreLock(store.getId(), () -> {
                                ((org.apache.cloudstack.engine.subsystem.api.storage.ObjectStoreCredentialProvider)
                                    _dataStoreMgr.getDataStore(store.getId(), DataStoreRole.Object).getDriver()).recoverCredentialRotations(store.getId());
                                return true;
                            });
                        }
                    }
                }
                catch (RuntimeException failure) { logger.warn("Bucket quota recovery will retry"); }
                finally { CallContext.unregister(); }
            }
        }, 30L, 30L, TimeUnit.SECONDS);
        return true;
    }

    @Override
    public boolean stop() {
        _executor.shutdown();
        if (usageCoordinator != null) usageCoordinator.close();
        return true;
    }

    @Override
    public String getConfigComponentName() {
        return BucketApiService.class.getSimpleName();
    }

    @Override
    public ConfigKey<?>[] getConfigKeys() {
        return new ConfigKey<?>[] {
                DefaultMaxAccountBuckets,
                DefaultMaxAccountObjectStorage,
                DefaultMaxProjectBuckets,
                DefaultMaxProjectObjectStorage,
                DefaultMaxDomainBuckets,
                DefaultMaxDomainObjectStorage
        };
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_CREATE, eventDescription = "creating bucket", create = true)
    public Bucket allocBucket(CreateBucketCmd cmd) throws ResourceAllocationException {
        try {
            BucketNameUtils.validateBucketName(cmd.getBucketName());
        } catch (IllegalBucketNameException e) {
            logger.error("Invalid Bucket Name: " +cmd.getBucketName(), e);
            throw new InvalidParameterValueException("Invalid Bucket Name: "+e.getMessage());
        }
        return quotaCoordinator().allocate(cmd);
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_CREATE, eventDescription = "creating bucket", async = true)
    public Bucket createBucket(CreateBucketCmd cmd) {
        return quotaCoordinator().create(cmd.getEntityId());
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_DELETE, eventDescription = "deleting bucket")
    public boolean deleteBucket(long bucketId, Account caller) throws ResourceAllocationException {
        Bucket bucket = _bucketDao.findById(bucketId);
        if (bucket == null) {
            throw new InvalidParameterValueException("Unable to find bucket with ID: " + bucketId);
        }
        _accountMgr.checkAccess(caller, null, true, bucket);
        return quotaCoordinator().delete((BucketVO)bucket);
    }

    private BucketVO objectBucket(String id, Account caller, boolean includeRemoved) {
        BucketVO bucket = includeRemoved ? _bucketDao.findByUuidIncludingRemoved(id) : _bucketDao.findByUuid(id);
        if (bucket == null) throw new InvalidParameterValueException("Bucket is unavailable");
        _accountMgr.checkAccess(caller, null, true, bucket);
        return bucket;
    }
    @Override public org.apache.cloudstack.api.response.BucketObjectResponse getDeletionImpact(String id, Account caller) {
        return quotaCoordinator().impact(objectBucket(id, caller, false));
    }
    @Override
    public org.apache.cloudstack.api.response.BucketObjectMetadataResponse getObjectMetadata(String id, Account caller, String key, String version) {
        BucketVO bucket = objectBucket(id, caller, false); // ACL before provider access, including project ownership.
        if (bucket.getState() != Bucket.State.Created || bucket.getRemoved() != null) throw new InvalidParameterValueException("A created bucket is required");
        if (key == null || key.isEmpty() || !validObjectMetadataText(key, 1024) ||
                version != null && (version.isEmpty() || !validObjectMetadataText(version, 1024))) {
            throw new InvalidParameterValueException("A valid exact UTF-8 object key and optional version ID are required");
        }
        try {
            var store = _dataStoreMgr.getDataStore(bucket.getObjectStoreId(), DataStoreRole.Object);
            var driver = store.getDriver();
            if (driver instanceof org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider) {
                var response = ((org.apache.cloudstack.engine.subsystem.api.storage.BucketObjectStoreProvider) driver).objectMetadata(bucket, key, version);
                if (response != null && response.getStatus() != null && key.equals(response.getKey()) &&
                        (version == null || version.equals(response.getVersionId()))) return response;
            } else {
                return new org.apache.cloudstack.api.response.BucketObjectMetadataResponse(key, version,
                        org.apache.cloudstack.api.response.BucketObjectMetadataResponse.Status.Unsupported);
            }
        } catch (RuntimeException unavailable) {
            // Never return or log provider diagnostics, credentials, request headers, or object metadata.
        }
        return new org.apache.cloudstack.api.response.BucketObjectMetadataResponse(key, version,
                org.apache.cloudstack.api.response.BucketObjectMetadataResponse.Status.Unavailable);
    }
    private static boolean validObjectMetadataText(String value, int maximumBytes) {
        try {
            java.nio.ByteBuffer encoded = java.nio.charset.StandardCharsets.UTF_8.newEncoder().encode(java.nio.CharBuffer.wrap(value));
            return encoded.remaining() <= maximumBytes && value.indexOf('\0') < 0;
        } catch (java.nio.charset.CharacterCodingException invalid) { return false; }
    }

    @Override public org.apache.cloudstack.api.response.BucketObjectResponse listObjectVersions(String id, Account caller, String key, String version, int limit) {
        return quotaCoordinator().versions(objectBucket(id, caller, false), key, version, limit);
    }
    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_UPDATE, eventDescription = "explicit object version mutation")
    public org.apache.cloudstack.api.response.BucketObjectResponse manageObjectVersion(String id, Account caller, String key, String version, String action) {
        return quotaCoordinator().mutateVersion(objectBucket(id, caller, false), key, version, action);
    }
    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_DELETE, eventDescription = "explicit durable bucket purge")
    public org.apache.cloudstack.api.response.BucketObjectResponse purgeBucket(String id, Account caller, String operation, String name, boolean versions, String external, boolean retry) {
        var result = quotaCoordinator().startPurge(objectBucket(id, caller, true), operation, name, versions, external, retry);
        _executor.execute(new ManagedContextRunnable() {
            @Override protected void runInContext() {
                CallContext.registerSystemCallContextOnceOnly();
                try { quotaCoordinator().recoverPurge(operation); }
                finally { CallContext.unregister(); }
            }
        });
        return result;
    }
    @Override public org.apache.cloudstack.api.response.BucketObjectResponse getPurgeStatus(String id, Account caller, String operation) {
        return quotaCoordinator().purgeStatus(objectBucket(id, caller, true), operation);
    }

    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_UPDATE, eventDescription = "updating bucket")
    public boolean updateBucket(UpdateBucketCmd cmd, Account caller) throws ResourceAllocationException {
        BucketVO bucket = _bucketDao.findById(cmd.getId());
        if (bucket == null) { throw new InvalidParameterValueException("Unable to find bucket"); }
        _accountMgr.checkAccess(caller, null, true, bucket);
        if (cmd.getObjectLocking() != null && cmd.getObjectLocking() != bucket.isObjectLock()) throw new InvalidParameterValueException("OBJECT_LOCK_CREATE_ONLY");
        if (cmd.isReconcile()) {
            if (cmd.getQuota() != null || cmd.getEncryption() != null || cmd.getVersioning() != null || cmd.getPolicy() != null) {
                throw new InvalidParameterValueException("Reconciliation cannot be combined with property changes");
            }
            return quotaCoordinator().reconcile(bucket, cmd.getExpectedQuotaOperationId());
        }
        boolean protectionProvided = cmd.getEncryption() != null || cmd.getVersioning() != null;
        boolean protection = cmd.getEncryption() != null && cmd.getEncryption() != bucket.isEncryption()
                || cmd.getVersioning() != null && cmd.getVersioning() != bucket.isVersioning();
        boolean policy = cmd.getPolicy() != null && !Objects.equals(cmd.getPolicy(), bucket.getPolicy());
        boolean quota = cmd.getQuota() != null && !Objects.equals(cmd.getQuota(), bucket.getQuota());
        if (cmd.getQuota() != null) BucketQuotaCoordinator.quotaBytes(cmd.getQuota());
        if ((quota ? 1 : 0) + (protection ? 1 : 0) + (policy ? 1 : 0) > 1) throw new InvalidParameterValueException("Apply quota, protection and policy changes separately");
        if (quota) return quotaCoordinator().update(bucket, cmd.getQuota());
        if (protectionProvided && !policy) return protectionCoordinator().update(bucket, cmd.getEncryption(), cmd.getVersioning());
        return BucketQuotaCoordinator.withStoreLock(bucket.getObjectStoreId(), () -> {
            var active = quotaOperations.findActiveByBucket(bucket.getId());
            if (active != null) throw new BucketQuotaException(active.getUuid(), true);
            if (policy) {
                ObjectStoreEntity store = (ObjectStoreEntity)_dataStoreMgr.getDataStore(bucket.getObjectStoreId(), DataStoreRole.Object);
                store.setBucketPolicy(new BucketTO(bucket), cmd.getPolicy());
                BucketVO update = _bucketDao.createForUpdate(bucket.getId()); update.setPolicy(cmd.getPolicy());
                if (!_bucketDao.update(bucket.getId(), update)) throw new CloudRuntimeException("Unable to update bucket policy");
            }
            return true;
        });
    }

    public void getBucketUsage() {
        for (ObjectStoreVO store : _objectStoreDao.listObjectStores()) {
            for (BucketVO bucket : _bucketDao.listByObjectStoreId(store.getId())) {
                if (bucket.getState() != Bucket.State.Created) continue;
                try { usageCoordinator().collect(bucket); }
                catch (RuntimeException unavailable) {
                    // Provider/credential diagnostics never belong in usage logs.
                    logger.warn("Bucket usage collection failed for bucket {}", bucket.getUuid());
                }
            }
        }
    }

    private BucketVO credentialBucket(long id, Account caller) {
        BucketVO bucket = _bucketDao.findById(id);
        if (bucket == null || bucket.getState() != Bucket.State.Created) throw new InvalidParameterValueException("A created bucket is required");
        _accountMgr.checkAccess(caller, null, true, bucket);
        return bucket;
    }
    private org.apache.cloudstack.engine.subsystem.api.storage.ObjectStoreCredentialProvider credentialProvider(Bucket bucket) {
        return (org.apache.cloudstack.engine.subsystem.api.storage.ObjectStoreCredentialProvider)
                _dataStoreMgr.getDataStore(bucket.getObjectStoreId(), DataStoreRole.Object).getDriver();
    }
    private org.apache.cloudstack.api.response.BucketCredentialResponse credentialResponse(BucketVO bucket, BucketCredentials credential, boolean reveal) {
        if (credential.getAccessKey() == null || credential.getSecretKey() == null) {
            throw new InvalidParameterValueException("Unable to verify bucket credentials; check the storage connection and retry");
        }
        ObjectStoreVO store = _objectStoreDao.findById(bucket.getObjectStoreId());
        String url = "Glue".equals(store.getProviderName()) ? store.getUrl().replaceAll("/+$", "") + "/" + bucket.getName() : bucket.getBucketURL();
        return new org.apache.cloudstack.api.response.BucketCredentialResponse(bucket, url, credential, reveal,
                _bucketDao.listByObjectStoreIdAndAccountId(bucket.getObjectStoreId(), bucket.getAccountId()));
    }
    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_CREDENTIAL_READ, eventDescription = "read bucket credential metadata or explicitly revealed credentials")
    public org.apache.cloudstack.api.response.BucketCredentialResponse getCredentials(long id, Account caller, boolean reveal) {
        BucketVO bucket = credentialBucket(id, caller);
        CallContext.current().setEventDetails("Bucket Id: " + bucket.getUuid() + ", reveal: " + reveal);
        return credentialResponse(bucket, credentialProvider(bucket).getBucketCredentials(bucket), reveal);
    }
    @Override
    @ActionEvent(eventType = EventTypes.EVENT_BUCKET_CREDENTIAL_ROTATE, eventDescription = "rotate account and store bucket credentials")
    public org.apache.cloudstack.api.response.BucketCredentialResponse rotateCredentials(long id, Account caller, long revision,
            String operationId, String action, int graceSeconds) {
        BucketVO bucket = credentialBucket(id, caller);
        CallContext.current().setEventDetails("Bucket Id: " + bucket.getUuid() + ", revision: " + revision + ", operation: " + operationId);
        return BucketQuotaCoordinator.withStoreLock(bucket.getObjectStoreId(), () -> {
            if (quotaOperations.hasActiveForStore(bucket.getObjectStoreId())) throw new InvalidParameterValueException("Reconcile pending quota operations before rotating keys");
            return credentialResponse(bucket, credentialProvider(bucket).rotateBucketCredentials(bucket, revision, operationId, action, graceSeconds), false);
        });
    }

    @Override
    public Bucket syncBucketUsage(SyncBucketUsageCmd cmd, Account caller) {
        BucketVO bucket = _bucketDao.findById(cmd.getId());
        if (bucket == null) {
            throw new InvalidParameterValueException("Unable to find bucket with ID: " + cmd.getId());
        }
        _accountMgr.checkAccess(caller, null, true, bucket);
        ObjectStoreVO objectStoreVO = _objectStoreDao.findById(bucket.getObjectStoreId());
        if (objectStoreVO == null) {
            throw new InvalidParameterValueException("Unable to find object store with ID: " + bucket.getObjectStoreId());
        }
        return usageCoordinator().collect(bucket);
    }

    private class BucketUsageTask extends ManagedContextRunnable {
        public BucketUsageTask() {
        }

        @Override
        protected void runInContext() {
            GlobalLock scanLock = GlobalLock.getInternLock("BucketUsage");
            try {
                if (scanLock.lock(ACQUIRE_GLOBAL_LOCK_TIMEOUT_FOR_COOPERATION)) {
                    try {
                        CallContext.registerSystemCallContextOnceOnly();
                        getBucketUsage();
                    } catch (RuntimeException unavailable) {
                        logger.warn("Periodic bucket usage collection will retry");
                    } finally {
                        CallContext.unregister();
                        scanLock.unlock();
                    }
                }
            } finally {
                scanLock.releaseRef();
            }
        }
    }
}
