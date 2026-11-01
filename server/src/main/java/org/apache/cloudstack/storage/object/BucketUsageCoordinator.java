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
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import com.cloud.storage.BucketVO;
import com.cloud.storage.DataStoreRole;
import com.cloud.storage.dao.BucketDao;
import com.cloud.usage.BucketStatisticsVO;
import com.cloud.usage.dao.BucketStatisticsDao;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.engine.subsystem.api.storage.DataStoreManager;
import org.apache.cloudstack.engine.subsystem.api.storage.BucketUsageProvider;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreDao;
import org.apache.cloudstack.storage.datastore.db.ObjectStoreVO;

/** One collection path for explicit and periodic requests. No transaction spans provider I/O. */
public class BucketUsageCoordinator implements AutoCloseable {
    private final BucketDao buckets;
    private final BucketStatisticsDao statistics;
    private final ObjectStoreDao stores;
    private final DataStoreManager dataStores;
    private final Map<Long, CompletableFuture<BucketVO>> inFlight = new ConcurrentHashMap<>();
    // A provider ignoring interruption can occupy at most four daemon workers, never an unbounded queue.
    private final ThreadPoolExecutor reads = new ThreadPoolExecutor(0, 4, 30, TimeUnit.SECONDS,
            new SynchronousQueue<>(), action -> {
                Thread thread = new Thread(action, "Bucket-Usage-Read"); thread.setDaemon(true); return thread;
            });

    public BucketUsageCoordinator(BucketDao buckets, BucketStatisticsDao statistics, ObjectStoreDao stores, DataStoreManager dataStores) {
        this.buckets = buckets; this.statistics = statistics; this.stores = stores; this.dataStores = dataStores;
    }
    protected <T> T inTransaction(Supplier<T> action) {
        return Transaction.execute((com.cloud.utils.db.TransactionCallback<T>) status -> action.get());
    }
    protected <T> T withStoreLock(long id, Supplier<T> action) { return BucketQuotaCoordinator.withStoreLock(id, action); }
    protected long read(BucketUsageProvider driver, BucketVO bucket) {
        var future = reads.submit(() -> driver.getBucketUsage(bucket));
        try { return future.get(25, TimeUnit.SECONDS); }
        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw failure(); }
        catch (Exception unavailable) { throw failure(); }
        finally { future.cancel(true); }
    }
    private static CloudRuntimeException failure() { return new CloudRuntimeException("Bucket usage is unavailable; the last successful value is preserved"); }
    private static boolean active(BucketVO bucket) { return bucket != null && bucket.getRemoved() == null && bucket.getState() == Bucket.State.Created; }

    public BucketVO collect(BucketVO initial) {
        CompletableFuture<BucketVO> mine = new CompletableFuture<>();
        CompletableFuture<BucketVO> existing = inFlight.putIfAbsent(initial.getId(), mine);
        if (existing != null) {
            try { return existing.get(65, TimeUnit.SECONDS); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw failure(); }
            catch (Exception unavailable) { throw failure(); }
        }
        Date requested = new Date();
        try {
            BucketVO result = withStoreLock(initial.getObjectStoreId(), () -> collectLocked(initial, requested));
            mine.complete(result); return result;
        } catch (RuntimeException unavailable) {
            mine.completeExceptionally(failure()); throw failure();
        } finally { inFlight.remove(initial.getId(), mine); }
    }
    private BucketVO collectLocked(BucketVO initial, Date requested) {
        BucketVO bucket = buckets.findById(initial.getId());
        if (!active(bucket) || bucket.getObjectStoreId() != initial.getObjectStoreId()) throw failure();
        // The same store lock also coalesces overlapping requests on different management nodes.
        if (bucket.getUsageLastAttempt() != null && !bucket.getUsageLastAttempt().before(requested)) {
            if ("Error".equals(bucket.getUsageStatus())) throw failure();
            if (bucket.getUsageLastUpdated() != null) return bucket;
        }
        try {
            var store = dataStores.getDataStore(bucket.getObjectStoreId(), DataStoreRole.Object);
            BucketUsageProvider driver = (BucketUsageProvider) store.getDriver();
            long size = read(driver, bucket);
            if (size < 0) throw failure();
            String source = "Bucket".equals(driver.getBucketUsageSource()) ? "Bucket" : "StoreFallback";
            return commit(bucket, size, source);
        } catch (RuntimeException unavailable) {
            markError(bucket.getId()); throw failure();
        }
    }
    protected BucketVO commit(BucketVO observed, long size, String source) {
        return inTransaction(() -> {
            BucketVO bucket = buckets.findById(observed.getId());
            if (!active(bucket)) throw failure();
            Date now = new Date();
            BucketVO patch = buckets.createForUpdate(bucket.getId());
            patch.setSize(size); patch.setUsageLastUpdated(now); patch.setUsageLastAttempt(now);
            patch.setUsageStatus("Fresh"); patch.setUsageSource(source);
            if (!buckets.update(bucket.getId(), patch)) throw failure();
            BucketStatisticsVO row = statistics.findBy(bucket.getAccountId(), bucket.getId());
            if (row == null) {
                row = new BucketStatisticsVO(bucket.getAccountId(), bucket.getId()); row.setSize(size);
                if (statistics.persist(row) == null) throw failure();
            } else {
                row.setSize(size); if (!statistics.update(row.getId(), row)) throw failure();
            }
            // Recompute the sum of committed last-known KiB; never increment or zero a partial collection.
            long total = 0;
            for (BucketVO member : buckets.listByObjectStoreId(bucket.getObjectStoreId())) {
                if (!active(member)) continue;
                Long value = member.getId() == bucket.getId() ? size : member.getSize();
                if (value == null || value < 0) throw failure();
                total = Math.addExact(total, value);
            }
            ObjectStoreVO storePatch = stores.createForUpdate(bucket.getObjectStoreId());
            storePatch.setUsedSize(total);
            if (!stores.update(bucket.getObjectStoreId(), storePatch)) throw failure();
            return buckets.findById(bucket.getId());
        });
    }
    private void markError(long id) {
        inTransaction(() -> {
            if (!active(buckets.findById(id))) return false;
            BucketVO patch = buckets.createForUpdate(id);
            patch.setUsageLastAttempt(new Date()); patch.setUsageStatus("Error");
            if (!buckets.update(id, patch)) throw failure();
            return true;
        });
    }
    @Override public void close() { reads.shutdownNow(); }
}
