#!/usr/bin/env python3

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
from uuid import UUID


PROFILE = "kvm-x86-64-acpi-v1"
MIB = 1024 * 1024
MEMORY_BLOCK_BYTES = 128 * MIB
MEMORY_STEP_BYTES = 4096 * MIB
FIRMWARE_CPU_PATH = re.compile(r"\\_SB_\.CPUS\.C([0-9A-F]{3})")


class ComputeError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise ComputeError(code)


def read(path):
    return path.read_text().strip()


def canonical_uuid(value):
    try:
        return str(UUID(value))
    except (ValueError, AttributeError, TypeError) as error:
        raise ComputeError("COMPUTE_IDENTITY_INVALID") from error


def cpu_set(value):
    result = set()
    for item in value.split(","):
        bounds = [int(v) for v in item.split("-")]
        result.update(range(bounds[0], bounds[-1] + 1))
    return result


class GuestCompute:
    def __init__(self, sys_root=Path("/sys"), proc_root=Path("/proc"),
                 journals=Path("/var/lib/ablestack-storage/compute-operations")):
        self.sys = sys_root
        self.proc = proc_root
        self.journals = journals

    @property
    def cpus(self):
        return self.sys / "devices/system/cpu"

    @property
    def memory(self):
        return self.sys / "devices/system/memory"

    def cpu_state(self):
        online = cpu_set(read(self.cpus / "online"))
        rows = {}
        for index in sorted(cpu_set(read(self.cpus / "present"))):
            node = self.cpus / f"cpu{index}"
            firmware = read(node / "firmware_node/path")
            match = FIRMWARE_CPU_PATH.fullmatch(firmware)
            require(match, "COMPUTE_CPU_FIRMWARE_UNVERIFIED")
            row = {"core": int(match[1], 16), "online": index in online}
            if row["online"]:
                row["package"] = int(read(node / "topology/physical_package_id"))
                row["topologyCore"] = int(read(node / "topology/core_id"))
                row["siblings"] = sorted(cpu_set(read(node / "topology/thread_siblings_list")))
            rows[str(index)] = row
        require(len({row["core"] for row in rows.values()}) == len(rows), "COMPUTE_CPU_FIRMWARE_DUPLICATE")
        return rows

    def memory_state(self):
        states = {}
        for node in self.memory.glob("memory[0-9]*"):
            index = str(int(read(node / "phys_index"), 16))
            require(index not in states, "COMPUTE_MEMORY_BLOCK_DUPLICATE")
            states[index] = (node / "state", read(node / "state"))
        return states

    def observe(self):
        block_size = int(read(self.memory / "block_size_bytes"), 16)
        require(block_size == MEMORY_BLOCK_BYTES, "COMPUTE_MEMORY_PROFILE_UNSUPPORTED")
        mem_total = re.search(r"^MemTotal:\s+(\d+) kB$", read(self.proc / "meminfo"), re.MULTILINE)
        require(mem_total, "COMPUTE_MEMORY_TOTAL_UNAVAILABLE")
        return {
            "profile": PROFILE,
            "vmUuid": canonical_uuid(read(self.sys / "class/dmi/id/product_uuid").lower()),
            "bootId": canonical_uuid(read(self.proc / "sys/kernel/random/boot_id")),
            "blockBytes": block_size,
            "memoryKiB": int(mem_total[1]),
            "cpus": self.cpu_state(),
            "blocks": {i: state for i, (_, state) in self.memory_state().items()},
        }

    def validate_cpu(self, current, previous, cores):
        require(current.keys() >= previous.keys(), "COMPUTE_CPU_ORIGINAL_MISSING")
        require(all(current[i] == state for i, state in previous.items()), "COMPUTE_CPU_ORIGINAL_CHANGED")
        added = current.keys() - previous.keys()
        require({current[i]["core"] for i in added} == set(cores), "COMPUTE_CPU_TARGET_MISMATCH")
        for i in added:
            row = current[i]
            if row["online"]:
                require(row["package"] == 0 and row["topologyCore"] == row["core"]
                        and row["siblings"] == [int(i)], "COMPUTE_CPU_TOPOLOGY_UNVERIFIED")
        return added

    def validate_memory(self, current, previous, request):
        require(current.keys() >= previous.keys(), "COMPUTE_MEMORY_ORIGINAL_MISSING")
        require(all(current[i] == state for i, state in previous.items()), "COMPUTE_MEMORY_ORIGINAL_CHANGED")
        added = current.keys() - previous.keys()
        if request is None:
            require(not added, "COMPUTE_MEMORY_UNEXPECTED")
            return added
        start, size = request["address"], request["bytes"]
        require(type(start) is int and start >= 0 and start % MEMORY_BLOCK_BYTES == 0
                and type(size) is int and size == MEMORY_STEP_BYTES, "COMPUTE_MEMORY_RANGE_UNSUPPORTED")
        expected = {str(i) for i in range(start // MEMORY_BLOCK_BYTES, (start + size) // MEMORY_BLOCK_BYTES)}
        require(added == expected and all(current[i] in {"online", "offline"} for i in added),
                "COMPUTE_MEMORY_TARGET_MISMATCH")
        return added

    def reconcile(self, plan):
        operation = canonical_uuid(plan["operationUuid"])
        before = plan["before"]
        cores = plan.get("cores", [])
        memory = plan.get("memory")
        require(isinstance(cores, list) and all(type(core) is int and 0 <= core < 256 for core in cores)
                and len(cores) == len(set(cores)) and bool(cores) != (memory is not None),
                "COMPUTE_AXIS_INVALID")
        fingerprint = hashlib.sha256(json.dumps(plan, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        self.journals.mkdir(mode=0o700, parents=True, exist_ok=True)
        info = self.journals.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700,
                "COMPUTE_JOURNAL_UNPROTECTED")
        path = self.journals / operation
        lock = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(lock, "r+", encoding="ascii") as journal:
            info = os.fstat(journal.fileno())
            require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600,
                    "COMPUTE_JOURNAL_UNPROTECTED")
            fcntl.flock(journal, fcntl.LOCK_EX | fcntl.LOCK_NB)
            saved = journal.read(65).strip()
            require(not saved or saved == fingerprint, "COMPUTE_OPERATION_MISMATCH")
            current = self.observe()
            require(all(before[key] == current[key] for key in ("profile", "vmUuid", "bootId", "blockBytes")),
                    "COMPUTE_BOOT_OR_VM_CHANGED")
            cpu_ids = self.validate_cpu(current["cpus"], before["cpus"], cores)
            block_ids = self.validate_memory(current["blocks"], before["blocks"], memory)
            if not saved:
                journal.write(fingerprint + "\n")
                journal.flush()
                os.fsync(journal.fileno())
                directory = os.open(self.journals, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
            writes = 0
            for index in sorted(cpu_ids, key=int):
                if not current["cpus"][index]["online"]:
                    (self.cpus / f"cpu{index}" / "online").write_text("1\n")
                    writes += 1
            observed_blocks = self.memory_state()
            for index in sorted(block_ids, key=int):
                path, state = observed_blocks[index]
                require(state in {"online", "offline"}, "COMPUTE_MEMORY_TARGET_MISMATCH")
                if state == "offline":
                    path.write_text("online\n")
                    writes += 1
            after = self.observe()
            self.validate_cpu(after["cpus"], before["cpus"], cores)
            self.validate_memory(after["blocks"], before["blocks"], memory)
            require(all(after["cpus"][i]["online"] for i in cpu_ids)
                    and all(after["blocks"][i] == "online" for i in block_ids), "COMPUTE_GUEST_PARTIAL")
            if memory:
                expected = memory["bytes"] // 1024
                delta = after["memoryKiB"] - before["memoryKiB"]
                require(expected - MEMORY_BLOCK_BYTES // 1024 <= delta <= expected, "COMPUTE_MEMORY_TOTAL_MISMATCH")
            return {"operationUuid": operation, "planSha256": fingerprint, "observation": after, "writes": writes}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("inspect", "reconcile"))
    parser.add_argument("payload", nargs="?")
    args = parser.parse_args()
    compute = GuestCompute()
    try:
        if args.action == "inspect":
            result = {"observation": compute.observe()}
        else:
            with open(args.payload, encoding="utf-8") as source:
                result = compute.reconcile(json.load(source))
        print(json.dumps({"success": True, **result}))
        return 0
    except BlockingIOError:
        error = "COMPUTE_OPERATION_IN_PROGRESS"
    except ComputeError as failure:
        error = str(failure)
    except (KeyError, OSError, TypeError, ValueError):
        error = "COMPUTE_GUEST_OBSERVATION_FAILED"
    print(json.dumps({"success": False, "errorCode": error}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
