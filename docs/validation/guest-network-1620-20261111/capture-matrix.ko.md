<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# UI 캡처와 실제 치수

고유 JPEG 38장. 모든 파일의 JPEG 서명·실제 브라우저 viewport·디코딩 이미지 치수·SHA256을 대조했다. [검사 JSON](evidence/capture-audit.json). 캡처의 기존 SSL 창 오류는 #1619 미해결로 판정한다. 32 owner swap-pending은 비동기 진행 중이다.

| 화면 | 실제 폭×높이 | 테마 |
| --- | --- | --- |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | dark |
| [31-vm-standard-detail](screenshots/31-vm-standard-detail.jpg) | 1280×900 | light |
| [31-vm-standard-nic-tab](screenshots/31-vm-standard-nic-tab.jpg) | 1280×900 | light |
| [31-vm-standard-connect-dialog](screenshots/31-vm-standard-connect-dialog.jpg) | 1280×900 | light |
| [31-vm-standard-390-dark](screenshots/31-vm-standard-390-dark.jpg) | 390×900 | dark |
| [31-vm-breadcrumb-return](screenshots/31-vm-breadcrumb-return.jpg) | 1280×900 | light |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | dark |
| [32-vm-standard-detail](screenshots/32-vm-standard-detail.jpg) | 1280×900 | light |
| [32-vm-standard-nic-tab](screenshots/32-vm-standard-nic-tab.jpg) | 1280×900 | light |
| [32-vm-standard-connect-dialog](screenshots/32-vm-standard-connect-dialog.jpg) | 1280×900 | light |
| [32-vm-standard-390-dark](screenshots/32-vm-standard-390-dark.jpg) | 390×900 | dark |
| [32-vm-breadcrumb-return](screenshots/32-vm-breadcrumb-return.jpg) | 1280×900 | light |
| [31-ssl-deny-before-submit](screenshots/31-ssl-deny-before-submit.jpg) | 1280×900 | light |
| [31-ssl-deny-after-401](screenshots/31-ssl-deny-after-401.jpg) | 1280×900 | light |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | dark |
| [32-ssl-deny-before-submit](screenshots/32-ssl-deny-before-submit.jpg) | 1280×900 | light |
| [32-ssl-deny-after-401](screenshots/32-ssl-deny-after-401.jpg) | 1280×900 | light |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | dark |
| [31-owner-certificate-swapped](screenshots/31-owner-certificate-swapped.jpg) | 1280×900 | light |
| [31-owner-certificate-removed](screenshots/31-owner-certificate-removed.jpg) | 1280×900 | light |
| [31-owner-original-certificate-restored](screenshots/31-owner-original-certificate-restored.jpg) | 1280×900 | light |
| [32-owner-certificate-swap-pending](screenshots/32-owner-certificate-swap-pending.jpg) | 1280×900 | light |
| [32-owner-certificate-removed](screenshots/32-owner-certificate-removed.jpg) | 1280×900 | light |
| [32-owner-original-certificate-restored](screenshots/32-owner-original-certificate-restored.jpg) | 1280×900 | light |
| [31-ssl-deny-light-1280](screenshots/31-ssl-deny-light-1280.jpg) | 1280×900 | light |
| [31-ssl-deny-light-768](screenshots/31-ssl-deny-light-768.jpg) | 768×900 | light |
| [31-ssl-deny-light-390](screenshots/31-ssl-deny-light-390.jpg) | 390×900 | light |
| [31-ssl-deny-dark-1280](screenshots/31-ssl-deny-dark-1280.jpg) | 1280×900 | dark |
| [31-ssl-deny-dark-768](screenshots/31-ssl-deny-dark-768.jpg) | 768×900 | dark |
| [31-ssl-deny-dark-390](screenshots/31-ssl-deny-dark-390.jpg) | 390×900 | dark |
| [32-ssl-deny-light-1280](screenshots/32-ssl-deny-light-1280.jpg) | 1280×900 | light |
| [32-ssl-deny-light-768](screenshots/32-ssl-deny-light-768.jpg) | 768×900 | light |
| [32-ssl-deny-light-390](screenshots/32-ssl-deny-light-390.jpg) | 390×900 | light |
| [32-ssl-deny-dark-1280](screenshots/32-ssl-deny-dark-1280.jpg) | 1280×900 | dark |
| [32-ssl-deny-dark-768](screenshots/32-ssl-deny-dark-768.jpg) | 768×900 | dark |
| [32-ssl-deny-dark-390](screenshots/32-ssl-deny-dark-390.jpg) | 390×900 | dark |
| [31-final-admin-ssl-review](screenshots/31-final-admin-ssl-review.jpg) | 1280×900 | dark |
| [32-final-admin-ssl-review](screenshots/32-final-admin-ssl-review.jpg) | 1280×900 | dark |

![32 거부401와 기존 인증서](screenshots/32-ssl-deny-after-401.jpg)

![32 원래 인증서 복구](screenshots/32-owner-original-certificate-restored.jpg)

![31 VM 모바일 표준](screenshots/31-vm-standard-390-dark.jpg)

![32 SSL 모바일 미해결 #1619](screenshots/32-ssl-deny-dark-390.jpg)
