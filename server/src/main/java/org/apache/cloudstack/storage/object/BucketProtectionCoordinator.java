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

import java.util.Date;
import java.util.Objects;
import java.util.function.Supplier;
import com.google.gson.Gson;
import com.cloud.agent.api.to.BucketTO;
import com.cloud.storage.BucketVO;
import com.cloud.storage.DataStoreRole;
import com.cloud.storage.dao.BucketDao;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.exception.CloudRuntimeException;
import com.cloud.exception.InvalidParameterValueException;
import org.apache.cloudstack.api.response.BucketProtectionResponse;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationDao;
import org.apache.cloudstack.storage.datastore.db.BucketQuotaOperationVO;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreAccountCredentialDao;

/** Durable protection saga. No SQL transaction spans S3 I/O; no recovery silently lowers protection. */
public class BucketProtectionCoordinator {
    private final BucketDao buckets;
    private final ObjectStoreDao stores;
    private final BucketQuotaOperationDao operations;
    private final DataStoreManager dataStores;
    private final ObjectStoreAccountCredentialDao credentials;
    private final Gson gson = new Gson();
    private static class Change {
        BucketProtectionResponse before;
        boolean encryption;
        boolean versioning;
    }
    public BucketProtectionCoordinator(BucketDao buckets, ObjectStoreDao stores, BucketQuotaOperationDao operations,
            DataStoreManager dataStores, ObjectStoreAccountCredentialDao credentials) {
        this.buckets = buckets; this.stores = stores; this.operations = operations; this.dataStores = dataStores; this.credentials = credentials;
    }
    protected <T> T transaction(Supplier<T> action) {
        return Transaction.execute((com.cloud.utils.db.TransactionCallback<T>) status -> action.get());
    }
    private ObjectStoreEntity entity(Bucket bucket) {
        return (ObjectStoreEntity)dataStores.getDataStore(bucket.getObjectStoreId(), DataStoreRole.Object);
    }
    public static void validateCreate(ObjectStoreEntity store, boolean encryption, boolean versioning, boolean locking) {
        if (locking && !versioning) throw new InvalidParameterValueException("OBJECT_LOCK_REQUIRES_VERSIONING");
        var caps = store.protectionCapabilities();
        if (encryption && !"Supported".equals(caps.get("encryption"))) throw new InvalidParameterValueException(caps.getOrDefault("encryptionreason", "ENCRYPTION_NOT_SUPPORTED"));
        if (versioning && !"Supported".equals(caps.get("versioning"))) throw new InvalidParameterValueException("VERSIONING_NOT_SUPPORTED");
        if (locking && !"Supported".equals(caps.get("objectlocking"))) throw new InvalidParameterValueException("OBJECT_LOCK_NOT_SUPPORTED");
    }
    private static BucketProtectionResponse known(ObjectStoreEntity store, Bucket bucket) {
        BucketProtectionResponse result = store.readBucketProtection(bucket);
        if (result == null || result.getEncryption() == null || result.getVersioning() == null || result.getObjectLock() == null) throw new CloudRuntimeException("PROTECTION_STATE_UNKNOWN");
        return result;
    }
    public static BucketProtectionResponse initialize(ObjectStoreEntity store, BucketVO bucket) {
        validateCreate(store, bucket.isEncryption(), bucket.isVersioning(), bucket.isObjectLock());
        BucketProtectionResponse before = known(store, bucket);
        if (!Objects.equals(before.getObjectLock(), bucket.isObjectLock())) throw new CloudRuntimeException("OBJECT_LOCK_CREATE_NOT_VERIFIED");
        BucketTO to = new BucketTO(bucket);
        if (bucket.isEncryption() && !before.getEncryption() && !store.setBucketEncryption(to)) throw new CloudRuntimeException("ENCRYPTION_APPLY_FAILED");
        if (bucket.isVersioning() && !before.getVersioning() && !store.setBucketVersioning(to)) throw new CloudRuntimeException("VERSIONING_APPLY_FAILED");
        BucketProtectionResponse verified = known(store, bucket);
        verified.compare(bucket.isEncryption(), bucket.isVersioning(), bucket.isObjectLock());
        if (!"Verified".equals(verified.getVerificationState())) throw new CloudRuntimeException("PROTECTION_CREATE_NOT_VERIFIED");
        return verified;
    }
    private void snapshot(BucketVO bucket, BucketProtectionResponse value) {
        value.compare(bucket.isEncryption(), bucket.isVersioning(), bucket.isObjectLock());
        value.setCapabilities(entity(bucket).protectionCapabilities());
        BucketVO update = buckets.createForUpdate(bucket.getId()); update.setProtectionSnapshot(gson.toJson(value));
        if (!buckets.update(bucket.getId(), update)) throw new CloudRuntimeException("PROTECTION_SNAPSHOT_SAVE_FAILED");
    }
    private BucketProtectionResponse read(BucketVO bucket) {
        BucketProtectionResponse result;
        try { result = known(entity(bucket), bucket); }
        catch (RuntimeException failure) {
            result = new BucketProtectionResponse(); result.setCheckedAt(new Date()); result.setReason("PROTECTION_READ_FAILED");
            try {
                BucketProtectionResponse previous = gson.fromJson(bucket.getProtectionSnapshot(), BucketProtectionResponse.class);
                if (previous != null) result.setVerifiedAt(previous.getVerifiedAt());
            } catch (RuntimeException invalid) { /* no stale effective values */ }
        }
        snapshot(bucket, result); decorate(bucket, result); return result;
    }
    private void decorate(BucketVO bucket, BucketProtectionResponse value) {
        value.compare(bucket.isEncryption(), bucket.isVersioning(), bucket.isObjectLock());
        value.setCapabilities(entity(bucket).protectionCapabilities());
        BucketQuotaOperationVO op = operations.findLatestByBucket(bucket.getId());
        if (op != null && "PROTECTION".equals(op.getOperationType())) {
            value.setOperationId(op.getUuid()); value.setOperationState(op.getState());
            if (op.isActive()) value.setReason("PROTECTION_RECONCILIATION_REQUIRED");
        }
    }
    public BucketProtectionResponse get(BucketVO initial) {
        return BucketQuotaCoordinator.withStoreLock(initial.getObjectStoreId(), () -> read(buckets.findById(initial.getId())));
    }
    private void noRotation(BucketVO bucket) {
        if (credentials == null) return;
        var credential = credentials.findByAccountAndStore(bucket.getAccountId(), bucket.getObjectStoreId());
        if (credential != null && credential.getRotationPhase() != null && !"Completed".equals(credential.getRotationPhase())) throw new InvalidParameterValueException("CREDENTIAL_ROTATION_IN_PROGRESS");
    }
    private void identity(BucketVO bucket, BucketQuotaOperationVO op) {
        if (!Objects.equals(stores.findById(bucket.getObjectStoreId()).getUrl(), op.getStoreUrl())) throw new CloudRuntimeException("PROTECTION_STORE_CHANGED");
        Object driver = entity(bucket).getDriver();
        if (!(driver instanceof ObjectStoreQuotaProvider)) throw new CloudRuntimeException("PROTECTION_IDENTITY_UNKNOWN");
        BucketQuotaState live = ((ObjectStoreQuotaProvider)driver).readBucketQuota(bucket);
        if (!live.exists() || !Objects.equals(live.getExternalId(), op.getExternalId())) throw new CloudRuntimeException("PROTECTION_BUCKET_IDENTITY_CHANGED");
    }
    private void save(BucketQuotaOperationVO op, String state) {
        op.setState(state); op.setUpdated(new Date());
        if (!operations.update(op.getId(), op)) throw new CloudRuntimeException("PROTECTION_OPERATION_SAVE_FAILED");
    }
    private void finish(BucketQuotaOperationVO op, String state) {
        op.setActiveBucketId(null); op.setErrorCode(null); save(op, state);
    }
    private void apply(ObjectStoreEntity store, BucketVO bucket, BucketProtectionResponse current, boolean enc, boolean ver) {
        BucketTO to = new BucketTO(bucket);
        if (current.getEncryption() != enc) {
            if (!"Supported".equals(store.protectionCapabilities().get("encryption"))) throw new InvalidParameterValueException("ENCRYPTION_NOT_SUPPORTED");
            boolean ok = enc ? store.setBucketEncryption(to) : store.deleteBucketEncryption(to);
            if (!ok) throw new CloudRuntimeException("ENCRYPTION_APPLY_FAILED");
        }
        if (current.getVersioning() != ver) {
            if (current.getObjectLock() && !ver) throw new InvalidParameterValueException("OBJECT_LOCK_REQUIRES_VERSIONING");
            boolean ok = ver ? store.setBucketVersioning(to) : store.deleteBucketVersioning(to);
            if (!ok) throw new CloudRuntimeException("VERSIONING_APPLY_FAILED");
        }
    }
    private boolean same(BucketProtectionResponse a, BucketProtectionResponse b) {
        return a.matches(b.getEncryption(), b.getVersioning(), b.getObjectLock()) && Objects.equals(a.getAlgorithm(), b.getAlgorithm()) && Objects.equals(a.getVersioningStatus(), b.getVersioningStatus());
    }
    private BucketProtectionResponse restore(BucketVO bucket, BucketQuotaOperationVO op) {
        identity(bucket, op); Change change = gson.fromJson(op.getPreviousSnapshot(), Change.class);
        ObjectStoreEntity store = entity(bucket); BucketProtectionResponse current = known(store, bucket);
        if (!Objects.equals(current.getObjectLock(), change.before.getObjectLock()) ||
                !Objects.equals(current.getEncryption(), change.before.getEncryption()) && current.getEncryption() != change.encryption ||
                !Objects.equals(current.getVersioning(), change.before.getVersioning()) && current.getVersioning() != change.versioning ||
                current.getEncryption() && !"AES256".equals(current.getAlgorithm()) && !Objects.equals(current.getAlgorithm(), change.before.getAlgorithm())) throw new CloudRuntimeException("PROTECTION_CHANGED_OUTSIDE_OPERATION");
        apply(store, bucket, current, change.before.getEncryption(), change.before.getVersioning());
        BucketProtectionResponse restored = known(store, bucket); snapshot(bucket, restored);
        if (!same(restored, change.before)) throw new CloudRuntimeException("PROTECTION_EXACT_RESTORE_UNAVAILABLE");
        transaction(() -> { finish(op, "Failed"); return null; }); return restored;
    }
    public boolean update(BucketVO initial, Boolean encryption, Boolean versioning) {
        return BucketQuotaCoordinator.withStoreLock(initial.getObjectStoreId(), () -> {
            BucketVO bucket = buckets.findById(initial.getId()); noRotation(bucket);
            BucketQuotaOperationVO active = operations.findActiveByBucket(bucket.getId());
            if (active != null) throw new BucketQuotaException(active.getUuid(), true);
            ObjectStoreEntity store = entity(bucket);
            if (Boolean.TRUE.equals(encryption)) validateCreate(store, true, versioning == null ? bucket.isVersioning() : versioning, bucket.isObjectLock());
            BucketProtectionResponse before = read(bucket);
            if (!"Verified".equals(before.getVerificationState())) throw new InvalidParameterValueException("PROTECTION_VERIFY_OR_ADOPT_REQUIRED");
            boolean enc = encryption == null ? bucket.isEncryption() : encryption;
            boolean ver = versioning == null ? bucket.isVersioning() : versioning;
            if (before.getObjectLock() && !ver) throw new InvalidParameterValueException("OBJECT_LOCK_REQUIRES_VERSIONING");
            if (enc != before.getEncryption() && !"Supported".equals(store.protectionCapabilities().get("encryption"))) throw new InvalidParameterValueException("ENCRYPTION_NOT_SUPPORTED");
            if (before.matches(enc, ver, bucket.isObjectLock())) return true;
            Change change = new Change(); change.before = before; change.encryption = enc; change.versioning = ver;
            String data = gson.toJson(change); if (data.length() > 1000) throw new InvalidParameterValueException("PROTECTION_SNAPSHOT_TOO_LARGE");
            var live = ((ObjectStoreQuotaProvider)store.getDriver()).readBucketQuota(bucket);
            if (!live.exists() || live.getExternalId() == null) throw new InvalidParameterValueException("PROTECTION_IDENTITY_UNKNOWN");
            BucketQuotaOperationVO prepared = new BucketQuotaOperationVO();
            prepared.setOperationType("PROTECTION"); prepared.setBucketId(bucket.getId()); prepared.setActiveBucketId(bucket.getId());
            prepared.setAccountId(bucket.getAccountId()); prepared.setDomainId(bucket.getDomainId()); prepared.setObjectStoreId(bucket.getObjectStoreId());
            prepared.setStoreUrl(stores.findById(bucket.getObjectStoreId()).getUrl()); prepared.setExternalId(live.getExternalId());
            prepared.setPreviousSnapshot(data); prepared.setPreviousQuota(bucket.getQuota()); prepared.setRequestedQuota(bucket.getQuota());
            operations.persist(prepared);
            // GenericDao updates require a DAO-enhanced object, not the plain constructor argument.
            final BucketQuotaOperationVO op = operations.findById(prepared.getId());
            try {
                save(op, "Applying"); identity(bucket, op); apply(store, bucket, before, enc, ver);
                BucketProtectionResponse verified = known(store, bucket);
                if (!verified.matches(enc, ver, before.getObjectLock())) throw new CloudRuntimeException("PROTECTION_WRITE_NOT_VERIFIED");
                identity(bucket, op); save(op, "Committing");
                transaction(() -> {
                    BucketVO update = buckets.createForUpdate(bucket.getId());
                    verified.compare(enc, ver, before.getObjectLock()); update.setEncryption(enc); update.setVersioning(ver); update.setProtectionSnapshot(gson.toJson(verified));
                    if (!buckets.update(bucket.getId(), update)) throw new CloudRuntimeException("PROTECTION_METADATA_SAVE_FAILED");
                    finish(op, "Succeeded"); return null;
                });
                return true;
            } catch (RuntimeException failure) {
                BucketQuotaOperationVO durable = operations.findById(op.getId());
                if (!durable.isActive() && "Succeeded".equals(durable.getState())) return true;
                try { save(durable, "Compensating"); restore(buckets.findById(bucket.getId()), durable); }
                catch (RuntimeException restoreFailure) { durable = operations.findById(op.getId()); durable.setErrorCode("PROTECTION_RECONCILIATION_REQUIRED"); save(durable, "NeedsReconcile"); }
                throw new BucketProtectionException(durable.getUuid(), durable.getState());
            }
        });
    }
    public BucketProtectionResponse reconcile(BucketVO initial, String operationId, boolean acceptActual) {
        return BucketQuotaCoordinator.withStoreLock(initial.getObjectStoreId(), () -> {
            BucketVO bucket = buckets.findById(initial.getId()); noRotation(bucket);
            BucketQuotaOperationVO op = operations.findActiveByBucket(bucket.getId());
            if (op != null) {
                if (!"PROTECTION".equals(op.getOperationType()) || !Objects.equals(operationId, op.getUuid())) throw new InvalidParameterValueException("EXPECTED_PROTECTION_OPERATION_REQUIRED");
                identity(bucket, op);
                if (!acceptActual) {
                    try { save(op, "Compensating"); restore(bucket, op); }
                    catch (RuntimeException failed) { op = operations.findById(op.getId()); op.setErrorCode("PROTECTION_RECONCILIATION_REQUIRED"); save(op, "NeedsReconcile"); throw new CloudRuntimeException("PROTECTION_RESTORE_FAILED operation=" + op.getUuid()); }
                    return read(buckets.findById(bucket.getId()));
                }
            } else if (operationId != null && !operationId.isEmpty()) {
                BucketQuotaOperationVO prior = operations.findByUuid(operationId);
                if (prior == null || !Objects.equals(prior.getBucketId(), bucket.getId()) || !"PROTECTION".equals(prior.getOperationType())) throw new InvalidParameterValueException("EXPECTED_PROTECTION_OPERATION_REQUIRED");
                return read(bucket);
            } else if (!acceptActual) throw new InvalidParameterValueException("EXPECTED_PROTECTION_OPERATION_REQUIRED");
            BucketProtectionResponse actual = known(entity(bucket), bucket);
            if (actual.getObjectLock() && !actual.getVersioning()) throw new InvalidParameterValueException("OBJECT_LOCK_REQUIRES_VERSIONING");
            final BucketQuotaOperationVO resolved = op;
            transaction(() -> {
                BucketVO update = buckets.createForUpdate(bucket.getId());
                update.setEncryption(actual.getEncryption()); update.setVersioning(actual.getVersioning()); update.setObjectLock(actual.getObjectLock());
                actual.compare(actual.getEncryption(), actual.getVersioning(), actual.getObjectLock()); update.setProtectionSnapshot(gson.toJson(actual));
                if (!buckets.update(bucket.getId(), update)) throw new CloudRuntimeException("PROTECTION_METADATA_SAVE_FAILED");
                if (resolved != null) finish(resolved, "Failed"); return null;
            });
            return read(buckets.findById(bucket.getId()));
        });
    }
    public void recoverInterrupted() {
        for (BucketQuotaOperationVO item : operations.listActive()) {
            if (!"PROTECTION".equals(item.getOperationType()) || "NeedsReconcile".equals(item.getState())) continue;
            BucketQuotaCoordinator.withStoreLock(item.getObjectStoreId(), () -> {
                BucketQuotaOperationVO op = operations.findById(item.getId());
                if (op != null && op.isActive()) { op.setErrorCode("PROTECTION_OPERATION_INTERRUPTED"); save(op, "NeedsReconcile"); }
                return null;
            });
        }
    }
}
