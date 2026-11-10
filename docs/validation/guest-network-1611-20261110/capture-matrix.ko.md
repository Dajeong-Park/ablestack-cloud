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

# 실제 UI 원본 JPEG 79장

브라우저 live viewport와 JPEG 디코딩 치수를 대조하고 SHA256을 기록했다. 같은 이름의 중간 프레임은 합산하지 않았다. `before`는 수정 전/중간 배치, `reference`는 VM 표준 비교이며 최종18배치와 구분한다.

| 캡처 | 폭×높이 | 테마 | 화면 |
| --- | --- | --- | --- |
| [32-before-internal-default](screenshots/32-before-internal-default.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-before-internal-candidate](screenshots/32-before-internal-candidate.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-after-public-only-options](screenshots/32-after-public-only-options.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-nic-selected](screenshots/32-public-nic-selected.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-tier-change-clears-nic](screenshots/32-tier-change-clears-nic.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-invalid-cidr-draft-preserved](screenshots/32-invalid-cidr-draft-preserved.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-lb-created](screenshots/32-public-lb-created.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [31-existing-vpc-public-tier-verified](screenshots/31-existing-vpc-public-tier-verified.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-offering-503-blocked](screenshots/31-offering-503-blocked.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-offering-503-recovered](screenshots/31-offering-503-recovered.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-empty-blocked](screenshots/31-empty-blocked.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-empty-recovered](screenshots/31-empty-recovered.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [32-network-503-blocked](screenshots/32-network-503-blocked.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-network-503-recovered](screenshots/32-network-503-recovered.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-offering-503-blocked](screenshots/32-offering-503-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-offering-503-recovered](screenshots/32-offering-503-recovered.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-empty-blocked](screenshots/32-empty-blocked.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-empty-recovered](screenshots/32-empty-recovered.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-preflight-internal-blocked](screenshots/32-preflight-internal-blocked.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-preflight-internal-recovered](screenshots/32-preflight-internal-recovered.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [31-isolated-created](screenshots/31-isolated-created.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-autoscale-public-only](screenshots/32-autoscale-public-only.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-autoscale-search-excludes-internal](screenshots/32-autoscale-search-excludes-internal.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-autoscale-tier-selected](screenshots/32-autoscale-tier-selected.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-autoscale-lb-created](screenshots/32-autoscale-lb-created.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/bb36cd52-5f78-4906-835d-3028eadbae71?tab=loadbalancing |
| [32-project-pending-metadata](screenshots/32-project-pending-metadata.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [32-project-return-fresh-candidates](screenshots/32-project-return-fresh-candidates.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-390-light](screenshots/32-manual-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-768-light](screenshots/32-manual-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-1280-light](screenshots/32-manual-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-390-dark](screenshots/32-manual-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-768-dark](screenshots/32-manual-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-manual-1280-dark](screenshots/32-manual-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-390-light](screenshots/32-autoscale-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-768-light](screenshots/32-autoscale-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-1280-light](screenshots/32-autoscale-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-390-dark](screenshots/32-autoscale-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-768-dark](screenshots/32-autoscale-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-1280-dark](screenshots/32-autoscale-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [31-manual-390-light](screenshots/31-manual-390-light.jpg) | 390×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-manual-768-light](screenshots/31-manual-768-light.jpg) | 768×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-manual-1280-light](screenshots/31-manual-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-manual-390-dark](screenshots/31-manual-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-manual-768-dark](screenshots/31-manual-768-dark.jpg) | 768×900 | dark | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [31-manual-1280-dark](screenshots/31-manual-1280-dark.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/d54fabbc-1852-4853-9121-baee9f7a5c69?tab=loadbalancing |
| [32-peer-create-allowed](screenshots/32-peer-create-allowed.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-peer-created](screenshots/32-peer-created.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-domainAdmin-create-allowed](screenshots/32-domainAdmin-create-allowed.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-domainAdmin-created](screenshots/32-domainAdmin-created.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-readonly-create-disabled](screenshots/32-readonly-create-disabled.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-readonly-390-dark](screenshots/32-readonly-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-nonmember-resource-denied](screenshots/32-nonmember-resource-denied.jpg) | 1920×871 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [31-peer-create-allowed](screenshots/31-peer-create-allowed.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-domainAdmin-create-allowed](screenshots/31-domainAdmin-create-allowed.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-readonly-create-disabled](screenshots/31-readonly-create-disabled.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-readonly-390-dark](screenshots/31-readonly-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-nonmember-resource-denied](screenshots/31-nonmember-resource-denied.jpg) | 1920×871 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [32-autoscale-mobile-before-layout-fix](screenshots/32-autoscale-mobile-before-layout-fix.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-vm-standard-list](screenshots/32-vm-standard-list.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/vm |
| [32-vm-standard-detail](screenshots/32-vm-standard-detail.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df |
| [32-vm-standard-nic-dialog-1280-dark](screenshots/32-vm-standard-nic-dialog-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [32-vm-standard-nic-dialog-390-dark](screenshots/32-vm-standard-nic-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [31-vm-standard-list](screenshots/31-vm-standard-list.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/vm |
| [31-vm-standard-detail](screenshots/31-vm-standard-detail.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf |
| [31-vm-standard-nic-dialog-1280-dark](screenshots/31-vm-standard-nic-dialog-1280-dark.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-standard-nic-dialog-390-dark](screenshots/31-vm-standard-nic-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-final-public-options](screenshots/32-final-public-options.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-final-mobile-tier-controls](screenshots/32-final-mobile-tier-controls.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-mobile-scrolled-right](screenshots/32-autoscale-mobile-scrolled-right.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-autoscale-mobile-selected](screenshots/32-autoscale-mobile-selected.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [32-final-member-public-options](screenshots/32-final-member-public-options.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [31-final-review](screenshots/31-final-review.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-final-review](screenshots/32-final-review.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/dc553e6a-5e9f-4d9f-a6fa-e2c1d2aed593?tab=loadbalancing |
| [31-final-breadcrumb-list](screenshots/31-final-breadcrumb-list.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/publicip |
| [32-final-breadcrumb-list](screenshots/32-final-breadcrumb-list.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip |
