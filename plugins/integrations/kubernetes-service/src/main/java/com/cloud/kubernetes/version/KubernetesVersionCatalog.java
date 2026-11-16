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

package com.cloud.kubernetes.version;

import com.cloud.utils.Pair;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class KubernetesVersionCatalog {
    private KubernetesVersionCatalog() {
    }

    public static Pair<List<KubernetesSupportedVersionVO>, Integer> page(List<KubernetesSupportedVersionVO> candidates,
            String minimum, Number offset, Number limit, String sortKey, String sortOrder) {
        if (minimum != null && !minimum.isEmpty()) {
            KubernetesVersionManagerImpl.compareSemanticVersions(minimum, minimum);
        }
        List<KubernetesSupportedVersionVO> eligible = new ArrayList<>();
        for (KubernetesSupportedVersionVO row : candidates) {
            try {
                if (minimum == null || minimum.isEmpty()
                        || KubernetesVersionManagerImpl.compareSemanticVersions(row.getSemanticVersion(), minimum) >= 0) {
                    eligible.add(row);
                }
            } catch (IllegalArgumentException ignored) {
                // A malformed historical row does not satisfy a numeric minimum.
            }
        }
        final String key = sortKey == null || sortKey.isEmpty() ? "id" : sortKey;
        final boolean descending = "desc".equals(sortOrder);
        eligible.sort(new Comparator<KubernetesSupportedVersionVO>() {
            @Override
            public int compare(KubernetesSupportedVersionVO a, KubernetesSupportedVersionVO b) {
                int compared;
                switch (key) {
                    case "name":
                        compared = value(a.getName()).compareToIgnoreCase(value(b.getName()));
                        break;
                    case "semanticversion":
                        compared = compareVersion(a.getSemanticVersion(), b.getSemanticVersion());
                        break;
                    case "state":
                        compared = value(a.getState()).compareTo(value(b.getState()));
                        break;
                    case "mincpunumber":
                        compared = Long.compare(number(a.getMinimumCpu()), number(b.getMinimumCpu()));
                        break;
                    case "minmemory":
                        compared = Long.compare(number(a.getMinimumRamSize()), number(b.getMinimumRamSize()));
                        break;
                    default:
                        compared = Long.compare(a.getId(), b.getId());
                }
                if (compared != 0) {
                    return descending ? -Integer.signum(compared) : compared;
                }
                return Long.compare(a.getId(), b.getId());
            }
        });
        int count = eligible.size();
        long start = offset == null ? 0 : Math.max(0, offset.longValue());
        long size = limit == null ? count : Math.max(0, limit.longValue());
        int from = (int) Math.min(start, count);
        int to = (int) Math.min(count, from + Math.min(size, count));
        return new Pair<>(new ArrayList<>(eligible.subList(from, to)), count);
    }

    private static long number(Number value) {
        return value == null ? Long.MIN_VALUE : value.longValue();
    }

    private static String value(Object value) {
        return value == null ? "" : value.toString();
    }

    private static int compareVersion(String a, String b) {
        boolean aValid = true;
        boolean bValid = true;
        try {
            KubernetesVersionManagerImpl.compareSemanticVersions(a, a);
        } catch (IllegalArgumentException ignored) {
            aValid = false;
        }
        try {
            KubernetesVersionManagerImpl.compareSemanticVersions(b, b);
        } catch (IllegalArgumentException ignored) {
            bValid = false;
        }
        if (aValid && bValid) {
            return KubernetesVersionManagerImpl.compareSemanticVersions(a, b);
        }
        if (aValid != bValid) {
            return aValid ? -1 : 1;
        }
        return value(a).compareTo(value(b));
    }
}
