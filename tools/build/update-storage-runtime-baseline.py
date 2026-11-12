#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
"""Regenerate the exact signed payload profile from the managed-file contract."""
import argparse
import ast
import hashlib
import json
from pathlib import Path

def update(repo, version):
    local = repo / "systemvm/debian/usr/local"
    tree = ast.parse((local / "lib/ablestack-storage/runtime_updater.py").read_text())
    managed = next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "MANAGED_FILES" for target in node.targets))
    profile = local / "lib/ablestack-storage/runtime-baseline-profile.json"
    value = json.loads(profile.read_text())
    if version < value["baselineVersion"]:
        raise ValueError("baseline version cannot decrease")
    entries = []
    for name, mode in sorted(managed.items()):
        path = local / (name if "/" in name else "bin/" + name)
        if path.is_symlink() or not path.is_file():
            raise ValueError("missing regular managed source: " + name)
        entries.append({"path": name, "mode": mode, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    value["baselineVersion"] = version
    value["files"] = entries
    value["sourcePayloadSha256"] = hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    profile.write_text(json.dumps(value, indent=2) + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", type=int, required=True)
    args = parser.parse_args()
    update(Path(__file__).resolve().parents[2], args.version)
