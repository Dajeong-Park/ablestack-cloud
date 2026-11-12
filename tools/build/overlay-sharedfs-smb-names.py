#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""Add only the #1466 DAO bean to a deployed XML, preserving all other bytes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

RESOURCE = "META-INF/cloudstack/core/spring-engine-schema-core-daos-context.xml"
BEAN_ID = "StorageSmbServiceNameDaoImpl"
BEAN_CLASS = "org.apache.cloudstack.storage.dataservice.dao.StorageSmbServiceNameDaoImpl"
BEAN = f'  <bean id="{BEAN_ID}" class="{BEAN_CLASS}" />\n'.encode()


def add_smb_names_bean(original):
    root = ET.fromstring(original)
    matches = [node for node in root if node.get("id") == BEAN_ID]
    if matches:
        if len(matches) != 1 or matches[0].attrib != {"id": BEAN_ID, "class": BEAN_CLASS}:
            raise ValueError("Conflicting SMB service name bean")
        return original
    if original.count(b"</beans>") != 1:
        raise ValueError("Expected exactly one beans document")
    candidate = original.replace(b"</beans>", BEAN + b"</beans>")
    ET.fromstring(candidate)
    if candidate.replace(BEAN, b"", 1) != original:
        raise ValueError("Unrelated XML modified")
    return candidate


def overlay(base, patch, output):
    if output.resolve() in (base.resolve(), patch.resolve()):
        raise ValueError("Output must be separate from both input artifacts")
    with zipfile.ZipFile(base) as deployed, zipfile.ZipFile(patch) as feature:
        xml = add_smb_names_bean(deployed.read(RESOURCE))
        metadata_name = "META-INF/ablestack-sharedfs-1466-build.json"
        metadata = None
        if metadata_name in feature.namelist():
            metadata = json.loads(feature.read(metadata_name))
            metadata["entries"][RESOURCE] = hashlib.sha256(xml).hexdigest()
            metadata["xmlOverlay"] = {"baseSha256": hashlib.sha256(deployed.read(RESOURCE)).hexdigest(), "addedBean": BEAN_ID}
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
            for entry in feature.infolist():
                data = xml if entry.filename == RESOURCE else feature.read(entry)
                if entry.filename == metadata_name and metadata is not None:
                    data = json.dumps(metadata, indent=2).encode()
                target.writestr(copy.copy(entry), data)
        with zipfile.ZipFile(output) as target:
            assert target.read(RESOURCE) == xml
            for name in feature.namelist():
                if name not in (RESOURCE, metadata_name):
                    assert feature.read(name) == target.read(name), name


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--patch", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    overlay(args.base, args.patch, args.output)
