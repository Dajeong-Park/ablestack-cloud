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

# 원본 캡처와 화면 조건

원본 JPEG 79장. 실제 viewport/디코딩 치수/해시를 [manifest](evidence/verified-images.json)로 대조했다. before 캡처는 수정 전 재현이다.

| 캡처 | viewport | 테마 | 분류 |
| --- | --- | --- | --- |
| [31-before-mixed-acl-links](screenshots/31-before-mixed-acl-links.jpg) | 1920×871 | light | 수정 전 |
| [32-before-empty-acl-links](screenshots/32-before-empty-acl-links.jpg) | 1920×871 | light | 수정 전 |
| [31-after-mixed-acl-links](screenshots/31-after-mixed-acl-links.jpg) | 1920×871 | light | 실제 UI |
| [32-after-missing-acl-dashes](screenshots/32-after-missing-acl-dashes.jpg) | 1920×871 | light | 실제 UI |
| [31-primary-1280-light](screenshots/31-primary-1280-light.jpg) | 1280×900 | light | 실제 UI |
| [31-primary-768-light](screenshots/31-primary-768-light.jpg) | 768×900 | light | 실제 UI |
| [31-primary-390-light](screenshots/31-primary-390-light.jpg) | 390×900 | light | 실제 UI |
| [31-primary-1280-dark](screenshots/31-primary-1280-dark.jpg) | 1280×900 | dark | 실제 UI |
| [31-primary-768-dark](screenshots/31-primary-768-dark.jpg) | 768×900 | dark | 실제 UI |
| [31-primary-390-dark](screenshots/31-primary-390-dark.jpg) | 390×900 | dark | 실제 UI |
| [32-primary-1280-light](screenshots/32-primary-1280-light.jpg) | 1280×900 | light | 실제 UI |
| [32-primary-768-light](screenshots/32-primary-768-light.jpg) | 768×900 | light | 실제 UI |
| [32-primary-390-light](screenshots/32-primary-390-light.jpg) | 390×900 | light | 실제 UI |
| [32-primary-1280-dark](screenshots/32-primary-1280-dark.jpg) | 1280×900 | dark | 실제 UI |
| [32-primary-768-dark](screenshots/32-primary-768-dark.jpg) | 768×900 | dark | 실제 UI |
| [32-primary-390-dark](screenshots/32-primary-390-dark.jpg) | 390×900 | dark | 실제 UI |
| [31-metadata-503-no-stale-links](screenshots/31-metadata-503-no-stale-links.jpg) | 1280×900 | light | 통제 읽기 |
| [31-metadata-503-recovered](screenshots/31-metadata-503-recovered.jpg) | 1280×900 | light | 실제 UI |
| [31-child-503-no-stale-links](screenshots/31-child-503-no-stale-links.jpg) | 1280×900 | light | 통제 읽기 |
| [31-child-503-recovered](screenshots/31-child-503-recovered.jpg) | 1280×900 | light | 실제 UI |
| [32-metadata-503-no-stale-links](screenshots/32-metadata-503-no-stale-links.jpg) | 1280×900 | light | 통제 읽기 |
| [32-metadata-503-recovered](screenshots/32-metadata-503-recovered.jpg) | 1280×900 | light | 실제 UI |
| [32-child-503-no-stale-links](screenshots/32-child-503-no-stale-links.jpg) | 1280×900 | light | 통제 읽기 |
| [32-child-503-recovered](screenshots/32-child-503-recovered.jpg) | 1280×900 | light | 실제 UI |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | light | 실제 UI |
| [31-project-late-read-discarded](screenshots/31-project-late-read-discarded.jpg) | 1280×900 | light | 통제 읽기 |
| [31-default-valid-links](screenshots/31-default-valid-links.jpg) | 1280×900 | light | 실제 UI |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | light | 실제 UI |
| [31-project-return-links-current](screenshots/31-project-return-links-current.jpg) | 1280×900 | light | 실제 UI |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | light | 실제 UI |
| [32-project-late-read-discarded](screenshots/32-project-late-read-discarded.jpg) | 1280×900 | light | 통제 읽기 |
| [32-default-valid-links](screenshots/32-default-valid-links.jpg) | 1280×900 | light | 실제 UI |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | light | 실제 UI |
| [32-project-return-links-current](screenshots/32-project-return-links-current.jpg) | 1280×900 | light | 실제 UI |
| [31-valid-1280-light](screenshots/31-valid-1280-light.jpg) | 1280×900 | light | 실제 UI |
| [31-valid-768-light](screenshots/31-valid-768-light.jpg) | 768×900 | light | 실제 UI |
| [31-valid-390-light](screenshots/31-valid-390-light.jpg) | 390×900 | light | 실제 UI |
| [31-valid-1280-dark](screenshots/31-valid-1280-dark.jpg) | 1280×900 | dark | 실제 UI |
| [31-valid-768-dark](screenshots/31-valid-768-dark.jpg) | 768×900 | dark | 실제 UI |
| [31-valid-390-dark](screenshots/31-valid-390-dark.jpg) | 390×900 | dark | 실제 UI |
| [31-valid-id-without-name-uuid-link](screenshots/31-valid-id-without-name-uuid-link.jpg) | 1280×900 | light | 통제 읽기 |
| [31-acl-valid-link-opened](screenshots/31-acl-valid-link-opened.jpg) | 1280×900 | light | 실제 UI |
| [31-acl-link-return-names-restored](screenshots/31-acl-link-return-names-restored.jpg) | 1280×900 | light | 실제 UI |
| [32-valid-1280-light](screenshots/32-valid-1280-light.jpg) | 1280×900 | light | 실제 UI |
| [32-valid-768-light](screenshots/32-valid-768-light.jpg) | 768×900 | light | 실제 UI |
| [32-valid-390-light](screenshots/32-valid-390-light.jpg) | 390×900 | light | 실제 UI |
| [32-valid-1280-dark](screenshots/32-valid-1280-dark.jpg) | 1280×900 | dark | 실제 UI |
| [32-valid-768-dark](screenshots/32-valid-768-dark.jpg) | 768×900 | dark | 실제 UI |
| [32-valid-390-dark](screenshots/32-valid-390-dark.jpg) | 390×900 | dark | 실제 UI |
| [32-valid-id-without-name-uuid-link](screenshots/32-valid-id-without-name-uuid-link.jpg) | 1280×900 | light | 통제 읽기 |
| [32-acl-valid-link-opened](screenshots/32-acl-valid-link-opened.jpg) | 1280×900 | light | 실제 UI |
| [32-acl-link-return-names-restored](screenshots/32-acl-link-return-names-restored.jpg) | 1280×900 | light | 실제 UI |
| [31-peer-valid-acl](screenshots/31-peer-valid-acl.jpg) | 1280×900 | light | 실제 UI |
| [31-peer-acl-opened](screenshots/31-peer-acl-opened.jpg) | 1280×900 | light | 실제 UI |
| [31-vpnLbReadOnly-valid-acl](screenshots/31-vpnLbReadOnly-valid-acl.jpg) | 1280×900 | light | 실제 UI |
| [31-vpnLbReadOnly-acl-opened](screenshots/31-vpnLbReadOnly-acl-opened.jpg) | 1280×900 | light | 실제 UI |
| [31-readOnly-missing-acl-dash](screenshots/31-readOnly-missing-acl-dash.jpg) | 1280×900 | light | 실제 UI |
| [31-readOnly-390-light](screenshots/31-readOnly-390-light.jpg) | 390×900 | light | 실제 UI |
| [32-peer-valid-acl](screenshots/32-peer-valid-acl.jpg) | 1280×900 | light | 실제 UI |
| [32-peer-acl-opened](screenshots/32-peer-acl-opened.jpg) | 1280×900 | light | 실제 UI |
| [32-vpnLbReadOnly-valid-acl](screenshots/32-vpnLbReadOnly-valid-acl.jpg) | 1280×900 | light | 실제 UI |
| [32-vpnLbReadOnly-acl-opened](screenshots/32-vpnLbReadOnly-acl-opened.jpg) | 1280×900 | light | 실제 UI |
| [32-readOnly-390-light](screenshots/32-readOnly-390-light.jpg) | 390×900 | light | 실제 UI |
| [31-nonmember-no-acl-links](screenshots/31-nonmember-no-acl-links.jpg) | 1920×871 | light | 실제 UI |
| [32-nonmember-no-acl-links](screenshots/32-nonmember-no-acl-links.jpg) | 1920×871 | light | 실제 UI |
| [31-vm-standard-list](screenshots/31-vm-standard-list.jpg) | 1280×900 | light | VM 표준 |
| [31-vm-standard-detail](screenshots/31-vm-standard-detail.jpg) | 1280×900 | light | VM 표준 |
| [31-vm-standard-nic-tab](screenshots/31-vm-standard-nic-tab.jpg) | 1280×900 | light | VM 표준 |
| [31-vm-standard-connect-dialog](screenshots/31-vm-standard-connect-dialog.jpg) | 1280×900 | light | VM 표준 |
| [31-vm-standard-390-dark](screenshots/31-vm-standard-390-dark.jpg) | 390×900 | dark | VM 표준 |
| [31-vm-breadcrumb-list-return](screenshots/31-vm-breadcrumb-list-return.jpg) | 1280×900 | light | VM 표준 |
| [32-vm-standard-list](screenshots/32-vm-standard-list.jpg) | 1280×900 | light | VM 표준 |
| [32-vm-standard-detail](screenshots/32-vm-standard-detail.jpg) | 1280×900 | light | VM 표준 |
| [32-vm-standard-nic-tab](screenshots/32-vm-standard-nic-tab.jpg) | 1280×900 | light | VM 표준 |
| [32-vm-standard-connect-dialog](screenshots/32-vm-standard-connect-dialog.jpg) | 1280×900 | light | VM 표준 |
| [32-vm-standard-390-dark](screenshots/32-vm-standard-390-dark.jpg) | 390×900 | dark | VM 표준 |
| [32-vm-breadcrumb-list-return](screenshots/32-vm-breadcrumb-list-return.jpg) | 1280×900 | light | VM 표준 |
| [31-final-review-tier](screenshots/31-final-review-tier.jpg) | 1920×871 | light | 실제 UI |
| [32-final-review-tier](screenshots/32-final-review-tier.jpg) | 1920×871 | light | 실제 UI |
