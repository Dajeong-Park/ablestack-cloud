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

# 캡처와 화면 상태

JPEG 76장 모두 live viewport와 디코딩 치수를 대조했다. 최종12배치는 헤더 보정 후 재빌드/재배포한1f08ae1f에서도 다시 확인했다. [메타데이터/분류](evidence/capture-audit.json), [UI DOM](evidence/ui-state.json), [레이아웃](evidence/layout.json). 중간 진단·실패 화면은 성공 결과와 구분한다.

| 화면 | 클러스터 | 폭 | 테마 | 구분 |
| --- | --- | --- | --- | --- |
| [31-project-return](screenshots/31-project-return.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-before-dialog](screenshots/31-before-dialog.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [32-project-return](screenshots/32-project-return.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [32-before-dialog](screenshots/32-before-dialog.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [31-delete-pending](screenshots/31-delete-pending.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-delete-actual-success](screenshots/31-delete-actual-success.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-create-query-loss](screenshots/31-create-query-loss.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-known-job-reopened](screenshots/31-known-job-reopened.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-query-recovery-success](screenshots/31-query-recovery-success.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-remove-source-success](screenshots/31-remove-source-success.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-real-job-failure-preserved](screenshots/31-real-job-failure-preserved.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [32-431-draft-preserved](screenshots/32-431-draft-preserved.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [32-503-draft-preserved](screenshots/32-503-draft-preserved.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [32-missing-receipt-blocked](screenshots/32-missing-receipt-blocked.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [32-missing-receipt-reopened](screenshots/32-missing-receipt-reopened.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [31-final-real-job2-preserved](screenshots/31-final-real-job2-preserved.jpg) | 31 | 1280 | dark | final UI |
| [31-final-real-job2-mobile](screenshots/31-final-real-job2-mobile.jpg) | 31 | 390 | dark | final UI |
| [31-diagnostic-revoked-history-blocked](screenshots/31-diagnostic-revoked-history-blocked.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-revoked-history-current-policy](screenshots/31-revoked-history-current-policy.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-final-context-retry-visible](screenshots/31-final-context-retry-visible.jpg) | 31 | 1280 | dark | final UI |
| [31-final-431-preserved](screenshots/31-final-431-preserved.jpg) | 31 | 1280 | dark | final UI |
| [31-final-503-preserved](screenshots/31-final-503-preserved.jpg) | 31 | 1280 | dark | final UI |
| [31-final-corrected-lb-cookie-success](screenshots/31-final-corrected-lb-cookie-success.jpg) | 31 | 1280 | dark | final UI |
| [31-final-query-loss](screenshots/31-final-query-loss.jpg) | 31 | 1280 | dark | final UI |
| [31-late-query-details-stable](screenshots/31-late-query-details-stable.jpg) | 31 | 1280 | dark | final UI |
| [31-final-delete-pending](screenshots/31-final-delete-pending.jpg) | 31 | 1280 | dark | final UI |
| [31-final-delete-success](screenshots/31-final-delete-success.jpg) | 31 | 1280 | dark | final UI |
| [31-final-missing-receipt](screenshots/31-final-missing-receipt.jpg) | 31 | 1280 | dark | final UI |
| [31-project-default](screenshots/31-project-default.jpg) | 31 | 1280 | dark | intermediate or diagnostic |
| [31-final-transport-loss](screenshots/31-final-transport-loss.jpg) | 31 | 1280 | dark | final UI |
| [31-final-appcookie-review-success](screenshots/31-final-appcookie-review-success.jpg) | 31 | 1280 | dark | final UI |
| [32-final-real-job2-preserved](screenshots/32-final-real-job2-preserved.jpg) | 32 | 1280 | dark | final UI |
| [32-final-context-retry](screenshots/32-final-context-retry.jpg) | 32 | 1280 | dark | final UI |
| [32-final-431-preserved](screenshots/32-final-431-preserved.jpg) | 32 | 1280 | dark | final UI |
| [32-final-503-preserved](screenshots/32-final-503-preserved.jpg) | 32 | 1280 | dark | final UI |
| [32-final-corrected-lb-cookie-success](screenshots/32-final-corrected-lb-cookie-success.jpg) | 32 | 1280 | dark | final UI |
| [32-final-query-loss](screenshots/32-final-query-loss.jpg) | 32 | 1280 | dark | final UI |
| [32-project-default](screenshots/32-project-default.jpg) | 32 | 1280 | dark | intermediate or diagnostic |
| [32-late-query-default-stable](screenshots/32-late-query-default-stable.jpg) | 32 | 1280 | dark | final UI |
| [32-final-delete-pending](screenshots/32-final-delete-pending.jpg) | 32 | 1280 | dark | final UI |
| [32-final-delete-success](screenshots/32-final-delete-success.jpg) | 32 | 1280 | dark | final UI |
| [32-final-missing-receipt](screenshots/32-final-missing-receipt.jpg) | 32 | 1280 | dark | final UI |
| [32-final-missing-reopen](screenshots/32-final-missing-reopen.jpg) | 32 | 1280 | dark | final UI |
| [32-final-transport-loss](screenshots/32-final-transport-loss.jpg) | 32 | 1280 | dark | final UI |
| [32-final-app-unknown](screenshots/32-final-app-unknown.jpg) | 32 | 1280 | dark | final UI |
| [32-final-app-same-job-success](screenshots/32-final-app-same-job-success.jpg) | 32 | 1280 | dark | final UI |
| [31-final-light-1280](screenshots/31-final-light-1280.jpg) | 31 | 1280 | light | final UI |
| [31-final-light-768](screenshots/31-final-light-768.jpg) | 31 | 768 | light | final UI |
| [31-final-light-390](screenshots/31-final-light-390.jpg) | 31 | 390 | light | final UI |
| [31-final-dark-1280](screenshots/31-final-dark-1280.jpg) | 31 | 1280 | dark | final UI |
| [31-final-dark-768](screenshots/31-final-dark-768.jpg) | 31 | 768 | dark | final UI |
| [31-final-dark-390](screenshots/31-final-dark-390.jpg) | 31 | 390 | dark | final UI |
| [32-final-light-1280](screenshots/32-final-light-1280.jpg) | 32 | 1280 | light | final UI |
| [32-final-light-768](screenshots/32-final-light-768.jpg) | 32 | 768 | light | final UI |
| [32-final-light-390](screenshots/32-final-light-390.jpg) | 32 | 390 | light | final UI |
| [32-final-dark-1280](screenshots/32-final-dark-1280.jpg) | 32 | 1280 | dark | final UI |
| [32-final-dark-768](screenshots/32-final-dark-768.jpg) | 32 | 768 | dark | final UI |
| [32-final-dark-390](screenshots/32-final-dark-390.jpg) | 32 | 390 | dark | final UI |
| [31-final-project-return-modal](screenshots/31-final-project-return-modal.jpg) | 31 | 1280 | dark | final UI |
| [31-resized-dropdown-closed](screenshots/31-resized-dropdown-closed.jpg) | 31 | 390 | dark | final UI |
| [32-final-project-return-modal](screenshots/32-final-project-return-modal.jpg) | 32 | 1280 | dark | final UI |
| [32-resized-dropdown-closed](screenshots/32-resized-dropdown-closed.jpg) | 32 | 390 | dark | final UI |
| [31-vm-standard-nic-tab](screenshots/31-vm-standard-nic-tab.jpg) | 31 | 1280 | dark | final UI |
| [31-vm-standard-dialog](screenshots/31-vm-standard-dialog.jpg) | 31 | 1280 | dark | final UI |
| [31-vm-standard-mobile-dialog](screenshots/31-vm-standard-mobile-dialog.jpg) | 31 | 390 | dark | final UI |
| [31-vm-standard-list](screenshots/31-vm-standard-list.jpg) | 31 | 1280 | dark | final UI |
| [32-vm-standard-nic-tab](screenshots/32-vm-standard-nic-tab.jpg) | 32 | 1280 | dark | final UI |
| [32-vm-standard-dialog](screenshots/32-vm-standard-dialog.jpg) | 32 | 1280 | dark | final UI |
| [32-vm-standard-mobile-dialog](screenshots/32-vm-standard-mobile-dialog.jpg) | 32 | 390 | dark | final UI |
| [32-vm-standard-list](screenshots/32-vm-standard-list.jpg) | 32 | 1280 | dark | final UI |
| [31-readonly-desktop](screenshots/31-readonly-desktop.jpg) | 31 | 1280 | dark | final UI |
| [31-readonly-mobile](screenshots/31-readonly-mobile.jpg) | 31 | 390 | dark | final UI |
| [32-readonly-desktop](screenshots/32-readonly-desktop.jpg) | 32 | 1280 | dark | final UI |
| [32-readonly-mobile](screenshots/32-readonly-mobile.jpg) | 32 | 390 | dark | final UI |
| [31-final-review-admin](screenshots/31-final-review-admin.jpg) | 31 | 1280 | light | final UI |
| [32-final-review-admin](screenshots/32-final-review-admin.jpg) | 32 | 1280 | light | final UI |
