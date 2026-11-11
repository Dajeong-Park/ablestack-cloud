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
// specific language govening permissions and limitations
// under the License.

package org.apache.cloudstack.storage.sharedfs;

import com.cloud.capacity.Capacity;
import com.cloud.capacity.CapacityManager;
import com.cloud.capacity.CapacityVO;
import com.cloud.capacity.dao.CapacityDao;
import com.cloud.host.Host;
import com.cloud.utils.db.GlobalLock;
import com.cloud.utils.exception.CloudRuntimeException;

/** Moves only the delta from reserved to used after the guest verification receipt. */
public final class SharedFSComputeCapacity {
    private final CapacityDao capacityDao;
    private final CapacityManager capacityManager;

    public SharedFSComputeCapacity(CapacityDao capacityDao, CapacityManager capacityManager) {
        this.capacityDao = capacityDao;
        this.capacityManager = capacityManager;
    }

    public static GlobalLock lockForHost(long hostId) {
        return GlobalLock.getInternLock("sharedfs-compute-capacity-" + hostId);
    }

    public void reserve(Host host, SharedFSComputeOperationVO operation) {
        if (capacityManager.checkIfClusterCrossesThreshold(host.getClusterId(),
                Math.toIntExact(operation.getCpuDelta()), operation.getMemoryDelta())) {
            throw new CloudRuntimeException("COMPUTE_CLUSTER_CAPACITY_EXCEEDED");
        }
        move(host, operation, true, false);
    }

    public void settle(Host host, SharedFSComputeOperationVO operation, boolean committed) {
        move(host, operation, false, committed);
    }

    private void move(Host host, SharedFSComputeOperationVO operation, boolean reserve, boolean commit) {
        update(host, Capacity.CAPACITY_TYPE_CPU, operation.getCpuDelta(), reserve, commit);
        update(host, Capacity.CAPACITY_TYPE_MEMORY, operation.getMemoryDelta(), reserve, commit);
        update(host, Capacity.CAPACITY_TYPE_CPU_CORE, operation.getCoreDelta(), reserve, commit);
    }

    private void update(Host host, short type, long amount, boolean reserve, boolean commit) {
        if (amount == 0) {
            return;
        }
        CapacityVO existing = capacityDao.findByHostIdType(host.getId(), type);
        CapacityVO row = existing == null ? null : capacityDao.lockRow(existing.getId(), true);
        if (row == null) {
            throw new CloudRuntimeException("COMPUTE_HOST_CAPACITY_UNAVAILABLE");
        }
        long reserved = row.getReservedCapacity();
        long used = row.getUsedCapacity();
        if (reserve) {
            float ratio = type == Capacity.CAPACITY_TYPE_CPU_CORE ? 1
                    : capacityManager.getClusterOverProvisioningFactor(host.getClusterId(), type);
            if ((long)(row.getTotalCapacity() * ratio) - used - reserved < amount) {
                throw new CloudRuntimeException("COMPUTE_HOST_CAPACITY_EXCEEDED");
            }
            row.setReservedCapacity(reserved + amount);
        } else {
            if (reserved < amount) {
                throw new CloudRuntimeException("COMPUTE_HOST_RESERVATION_MISSING");
            }
            row.setReservedCapacity(reserved - amount);
            if (commit) {
                row.setUsedCapacity(used + amount);
            }
        }
        if (!capacityDao.update(row.getId(), row)) {
            throw new CloudRuntimeException("COMPUTE_HOST_CAPACITY_WRITE_FAILED");
        }
    }
}
