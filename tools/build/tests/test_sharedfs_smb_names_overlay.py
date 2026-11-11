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

import importlib.util
from pathlib import Path
import tempfile
import os
import subprocess
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("smb_overlay", ROOT / "tools/build/overlay-sharedfs-smb-names.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SmbNamesOverlayTest(unittest.TestCase):
    def test_preserves_deployed_xml_exactly(self):
        original = b'<!-- keep -->\n<beans xmlns="http://www.springframework.org/schema/beans">\n  <bean id="old" class="Old" />\n</beans>\n'
        merged = MODULE.add_smb_names_bean(original)
        self.assertEqual(original, merged.replace(MODULE.BEAN, b"", 1))
        self.assertEqual(merged, MODULE.add_smb_names_bean(merged))

    def test_refuses_conflicting_or_duplicate_bean(self):
        for beans in [
            f'<bean id="{MODULE.BEAN_ID}" class="Foreign" />',
            MODULE.BEAN.decode() * 2,
        ]:
            with self.subTest(beans=beans), self.assertRaises(ValueError):
                MODULE.add_smb_names_bean(("<beans>" + beans + "</beans>").encode())

    def test_newer_patch_xml_cannot_import_unrelated_beans(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base, patch, output = [root / name for name in ["base.jar", "patch.jar", "output.jar"]]
            original = b"<beans><!-- deployed DAO layout --></beans>"
            with zipfile.ZipFile(base, "w") as jar:
                jar.writestr(MODULE.RESOURCE, original)
            with zipfile.ZipFile(patch, "w") as jar:
                jar.writestr(MODULE.RESOURCE, b'<beans><bean id="newUpstream" class="MissingClass"/></beans>')
                jar.writestr("feature.class", b"same compiled feature")
            MODULE.overlay(base, patch, output)
            with zipfile.ZipFile(output) as jar:
                self.assertEqual(MODULE.add_smb_names_bean(original), jar.read(MODULE.RESOURCE))
                self.assertNotIn(b"MissingClass", jar.read(MODULE.RESOURCE))
                self.assertEqual(b"same compiled feature", jar.read("feature.class"))
            with self.assertRaises(ValueError):
                MODULE.overlay(base, patch, patch)


@unittest.skipUnless(os.environ.get("SHAREDFS_1466_BAD_JAR") and os.environ.get("SHAREDFS_1466_FINAL_JAR"), "Final deployment artifacts required")
class SmbNamesFinalJarSpringTest(unittest.TestCase):
    def run_probe(self, jar, mode):
        return subprocess.run(["java", "--add-opens=java.base/java.lang=ALL-UNNAMED", "-cp", jar,
            str(ROOT / "tools/build/SharedFSSmbNamesSpringSmoke.java"), jar, mode],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=60)

    def test_original_failure_is_reproduced_by_real_spring(self):
        for mode in ["--references", "--spring"]:
            with self.subTest(mode=mode):
                result = self.run_probe(os.environ["SHAREDFS_1466_BAD_JAR"], mode)
                self.assertNotEqual(0, result.returncode, result.stdout)
                self.assertIn("ObjectStoreAccountCredentialDaoImpl", result.stdout)
                if mode == "--spring":
                    self.assertIn("CannotLoadBeanClassException", result.stdout)

    def test_corrected_final_jar_references_and_spring_start(self):
        for mode, marker in [("--references", "REFERENCE_CLASSES_OK"), ("--spring", "SPRING_CONTEXT_OK")]:
            with self.subTest(mode=mode):
                result = self.run_probe(os.environ["SHAREDFS_1466_FINAL_JAR"], mode)
                self.assertEqual(0, result.returncode, result.stdout)
                self.assertIn(marker, result.stdout)


if __name__ == "__main__":
    unittest.main()
