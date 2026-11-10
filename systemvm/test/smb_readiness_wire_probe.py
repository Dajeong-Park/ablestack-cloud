# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
"""Consume the actual coordinator Gson wire and run the guest protocol gate."""
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "debian/usr/local/lib/ablestack-storage"))
import configuration_transaction as transaction
import shared_directory_policy as policy

value = json.load(sys.stdin)
observed = value["observed"]
candidate = value["payload"]["candidate"]["directory policy apply"]
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    engine = policy.DirectoryPolicies(registry=root / "registry.json", managed=root / "managed",
                                      configs=root / "configs", desired=root / "desired")
    engine.desired.mkdir()
    desired = {"instanceUuid": observed["instanceUuid"], "enabled": True,
               "listeners": [{"id": row["id"], "listenIp": row["listenIp"], "port": row["port"]}
                             for row in observed["listeners"]]}
    transaction.atomic_json(engine.desired / "smb-share-apply.json", desired)
    controller = transaction.SmbListenerProfiles(root / "profiles", root / "smb.conf")
    target = engine.managed / "volume" / "child"
    query = {**candidate, "units": [], "policy": {"volumeuuid": "volume", "canonicalpath": "child"},
             "smbShares": [{"state": "Ready", "config": {"backingPath": str(target)}}]}
    with patch.object(transaction, "SmbListenerProfiles", return_value=controller), \
         patch.object(controller, "show", return_value={"listeners": observed["listeners"]}), \
         patch.object(controller, "implicit_legacy", side_effect=AssertionError("managed fallback")):
        try:
            engine.verify_protocols(query)
            print(json.dumps({"code": "ACCEPTED", "readiness": engine.smb_readiness_report}))
        except policy.PolicyError as error:
            print(json.dumps({"code": error.code}))
