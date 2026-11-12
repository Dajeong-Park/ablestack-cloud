<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# 실제 UI 원본 캡처

89장 native JPEG. [치수/해시](evidence/image-validation.json) · [DOM](evidence/ui-state.json) · [60개 배치](evidence/ui-matrix.json). before는 개선 전 실제 실패, failure120는 개선 후 실제431, pending/unknown은 통제된 응답 유실 시험이다.

| 캡처 | 실제 viewport | 테마 |
| --- | --- | --- |
| [31-before-submit120](screenshots/31-before-submit120.jpg) | 1680×841 | light |
| [32-before-submit120](screenshots/32-before-submit120.jpg) | 1680×841 | dark |
| [31-before-failure-dialog-closed](screenshots/31-before-failure-dialog-closed.jpg) | 1680×841 | light |
| [32-before-failure-dialog-closed](screenshots/32-before-failure-dialog-closed.jpg) | 1680×841 | dark |
| [31-before-reopened60](screenshots/31-before-reopened60.jpg) | 1680×841 | light |
| [32-before-reopened60](screenshots/32-before-reopened60.jpg) | 1680×841 | dark |
| [31-failure120-preserved](screenshots/31-failure120-preserved.jpg) | 1680×841 | light |
| [32-failure120-preserved](screenshots/32-failure120-preserved.jpg) | 1680×841 | dark |
| [31-corrected60-success](screenshots/31-corrected60-success.jpg) | 1680×841 | light |
| [32-corrected60-success](screenshots/32-corrected60-success.jpg) | 1680×841 | dark |
| [31-setup-query-timeout-preserved](screenshots/31-setup-query-timeout-preserved.jpg) | 1680×841 | light |
| [31-pending-receipt](screenshots/31-pending-receipt.jpg) | 1280×900 | light |
| [31-unknown-receipt](screenshots/31-unknown-receipt.jpg) | 1280×900 | light |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | light |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | light |
| [31-receipt-recovered-project-roundtrip](screenshots/31-receipt-recovered-project-roundtrip.jpg) | 1280×900 | light |
| [31-same-job-recheck-success](screenshots/31-same-job-recheck-success.jpg) | 1280×900 | light |
| [32-pending-receipt](screenshots/32-pending-receipt.jpg) | 1680×841 | dark |
| [32-unknown-receipt](screenshots/32-unknown-receipt.jpg) | 1680×841 | dark |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | dark |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | dark |
| [32-receipt-recovered-project-roundtrip](screenshots/32-receipt-recovered-project-roundtrip.jpg) | 1280×900 | dark |
| [31-light-390-group-list](screenshots/31-light-390-group-list.jpg) | 390×900 | light |
| [31-light-390-group-operations](screenshots/31-light-390-group-operations.jpg) | 390×900 | light |
| [31-light-390-update-dialog](screenshots/31-light-390-update-dialog.jpg) | 390×900 | light |
| [31-light-390-vm-nic-standard](screenshots/31-light-390-vm-nic-standard.jpg) | 390×900 | light |
| [31-light-390-vm-dialog-standard](screenshots/31-light-390-vm-dialog-standard.jpg) | 390×900 | light |
| [31-light-768-group-list](screenshots/31-light-768-group-list.jpg) | 768×900 | light |
| [31-light-768-group-operations](screenshots/31-light-768-group-operations.jpg) | 768×900 | light |
| [31-light-768-update-dialog](screenshots/31-light-768-update-dialog.jpg) | 768×900 | light |
| [31-light-768-vm-nic-standard](screenshots/31-light-768-vm-nic-standard.jpg) | 768×900 | light |
| [31-light-768-vm-dialog-standard](screenshots/31-light-768-vm-dialog-standard.jpg) | 768×900 | light |
| [31-light-1280-group-list](screenshots/31-light-1280-group-list.jpg) | 1280×900 | light |
| [31-light-1280-group-operations](screenshots/31-light-1280-group-operations.jpg) | 1280×900 | light |
| [31-light-1280-update-dialog](screenshots/31-light-1280-update-dialog.jpg) | 1280×900 | light |
| [31-light-1280-vm-nic-standard](screenshots/31-light-1280-vm-nic-standard.jpg) | 1280×900 | light |
| [31-light-1280-vm-dialog-standard](screenshots/31-light-1280-vm-dialog-standard.jpg) | 1280×900 | light |
| [31-immediate-dark-no-reload](screenshots/31-immediate-dark-no-reload.jpg) | 1280×900 | dark |
| [31-dark-390-group-list](screenshots/31-dark-390-group-list.jpg) | 390×900 | dark |
| [31-dark-390-group-operations](screenshots/31-dark-390-group-operations.jpg) | 390×900 | dark |
| [31-dark-390-update-dialog](screenshots/31-dark-390-update-dialog.jpg) | 390×900 | dark |
| [31-dark-390-vm-nic-standard](screenshots/31-dark-390-vm-nic-standard.jpg) | 390×900 | dark |
| [31-dark-390-vm-dialog-standard](screenshots/31-dark-390-vm-dialog-standard.jpg) | 390×900 | dark |
| [31-dark-768-group-list](screenshots/31-dark-768-group-list.jpg) | 768×900 | dark |
| [31-dark-768-group-operations](screenshots/31-dark-768-group-operations.jpg) | 768×900 | dark |
| [31-dark-768-update-dialog](screenshots/31-dark-768-update-dialog.jpg) | 768×900 | dark |
| [31-dark-768-vm-nic-standard](screenshots/31-dark-768-vm-nic-standard.jpg) | 768×900 | dark |
| [31-dark-768-vm-dialog-standard](screenshots/31-dark-768-vm-dialog-standard.jpg) | 768×900 | dark |
| [31-dark-1280-group-list](screenshots/31-dark-1280-group-list.jpg) | 1280×900 | dark |
| [31-dark-1280-group-operations](screenshots/31-dark-1280-group-operations.jpg) | 1280×900 | dark |
| [31-dark-1280-update-dialog](screenshots/31-dark-1280-update-dialog.jpg) | 1280×900 | dark |
| [31-dark-1280-vm-nic-standard](screenshots/31-dark-1280-vm-nic-standard.jpg) | 1280×900 | dark |
| [31-dark-1280-vm-dialog-standard](screenshots/31-dark-1280-vm-dialog-standard.jpg) | 1280×900 | dark |
| [32-immediate-light-no-reload](screenshots/32-immediate-light-no-reload.jpg) | 1280×900 | light |
| [32-light-390-group-list](screenshots/32-light-390-group-list.jpg) | 390×900 | light |
| [32-light-390-group-operations](screenshots/32-light-390-group-operations.jpg) | 390×900 | light |
| [32-light-390-update-dialog](screenshots/32-light-390-update-dialog.jpg) | 390×900 | light |
| [32-light-390-vm-nic-standard](screenshots/32-light-390-vm-nic-standard.jpg) | 390×900 | light |
| [32-light-390-vm-dialog-standard](screenshots/32-light-390-vm-dialog-standard.jpg) | 390×900 | light |
| [32-light-768-group-list](screenshots/32-light-768-group-list.jpg) | 768×900 | light |
| [32-light-768-group-operations](screenshots/32-light-768-group-operations.jpg) | 768×900 | light |
| [32-light-768-update-dialog](screenshots/32-light-768-update-dialog.jpg) | 768×900 | light |
| [32-light-768-vm-nic-standard](screenshots/32-light-768-vm-nic-standard.jpg) | 768×900 | light |
| [32-light-768-vm-dialog-standard](screenshots/32-light-768-vm-dialog-standard.jpg) | 768×900 | light |
| [32-light-1280-group-list](screenshots/32-light-1280-group-list.jpg) | 1280×900 | light |
| [32-light-1280-group-operations](screenshots/32-light-1280-group-operations.jpg) | 1280×900 | light |
| [32-light-1280-update-dialog](screenshots/32-light-1280-update-dialog.jpg) | 1280×900 | light |
| [32-light-1280-vm-nic-standard](screenshots/32-light-1280-vm-nic-standard.jpg) | 1280×900 | light |
| [32-light-1280-vm-dialog-standard](screenshots/32-light-1280-vm-dialog-standard.jpg) | 1280×900 | light |
| [32-immediate-dark-no-reload](screenshots/32-immediate-dark-no-reload.jpg) | 1280×900 | dark |
| [32-dark-390-group-list](screenshots/32-dark-390-group-list.jpg) | 390×900 | dark |
| [32-dark-390-group-operations](screenshots/32-dark-390-group-operations.jpg) | 390×900 | dark |
| [32-dark-390-update-dialog](screenshots/32-dark-390-update-dialog.jpg) | 390×900 | dark |
| [32-dark-390-vm-nic-standard](screenshots/32-dark-390-vm-nic-standard.jpg) | 390×900 | dark |
| [32-dark-390-vm-dialog-standard](screenshots/32-dark-390-vm-dialog-standard.jpg) | 390×900 | dark |
| [32-dark-768-group-list](screenshots/32-dark-768-group-list.jpg) | 768×900 | dark |
| [32-dark-768-group-operations](screenshots/32-dark-768-group-operations.jpg) | 768×900 | dark |
| [32-dark-768-update-dialog](screenshots/32-dark-768-update-dialog.jpg) | 768×900 | dark |
| [32-dark-768-vm-nic-standard](screenshots/32-dark-768-vm-nic-standard.jpg) | 768×900 | dark |
| [32-dark-768-vm-dialog-standard](screenshots/32-dark-768-vm-dialog-standard.jpg) | 768×900 | dark |
| [32-dark-1280-group-list](screenshots/32-dark-1280-group-list.jpg) | 1280×900 | dark |
| [32-dark-1280-group-operations](screenshots/32-dark-1280-group-operations.jpg) | 1280×900 | dark |
| [32-dark-1280-update-dialog](screenshots/32-dark-1280-update-dialog.jpg) | 1280×900 | dark |
| [32-dark-1280-vm-nic-standard](screenshots/32-dark-1280-vm-nic-standard.jpg) | 1280×900 | dark |
| [32-dark-1280-vm-dialog-standard](screenshots/32-dark-1280-vm-dialog-standard.jpg) | 1280×900 | dark |
| [31-immediate-light-no-reload](screenshots/31-immediate-light-no-reload.jpg) | 1280×900 | light |
| [31-review-update-dialog](screenshots/31-review-update-dialog.jpg) | 1280×900 | light |
| [31-final-review-native](screenshots/31-final-review-native.jpg) | 1680×841 | light |
| [32-final-review-native](screenshots/32-final-review-native.jpg) | 1680×841 | dark |
