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

# 실제 UI 원본 JPEG 95장

Live viewport/JSON/디코딩 치수와 SHA256을 대조했다. before는 수정 전, reference는 실제 VM 메뉴 표준이며 final/역할/통제 실패 캡처와 구분한다. 같은 label의 중간 프레임은 합산하지 않았다.

| 캡처 | 폭×높이 | 테마 | 화면 |
| --- | --- | --- | --- |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [31-before-readonly-public](screenshots/31-before-readonly-public.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [32-before-readonly-internal](screenshots/32-before-readonly-internal.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c?tab=loadbalancerinstance |
| [31-before-mobile-backend](screenshots/31-before-mobile-backend.jpg) | 390×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-readonly-public-disabled](screenshots/31-readonly-public-disabled.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-readonly-internal-disabled](screenshots/32-readonly-internal-disabled.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-readonly-public-disabled](screenshots/32-readonly-public-disabled.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [31-admin-public-first-removed](screenshots/31-admin-public-first-removed.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-admin-public-reassign-selected](screenshots/31-admin-public-reassign-selected.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-admin-public-reassigned](screenshots/31-admin-public-reassigned.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-admin-public-removed](screenshots/32-admin-public-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-admin-public-assign-selected](screenshots/32-admin-public-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-admin-public-reassigned](screenshots/32-admin-public-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-admin-internal-removed](screenshots/32-admin-internal-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-admin-internal-assign-selected](screenshots/32-admin-internal-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-admin-internal-reassigned](screenshots/32-admin-internal-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-member-public-removed](screenshots/31-member-public-removed.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-member-public-removed](screenshots/32-member-public-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [31-member-public-assign-selected](screenshots/31-member-public-assign-selected.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-member-public-reassigned](screenshots/31-member-public-reassigned.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-member-public-assign-selected](screenshots/32-member-public-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-member-public-reassigned](screenshots/32-member-public-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-member-internal-removed](screenshots/32-member-internal-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-member-internal-assign-selected](screenshots/32-member-internal-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-member-internal-reassigned](screenshots/32-member-internal-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-domainadmin-public-removed](screenshots/31-domainadmin-public-removed.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-domainadmin-public-assign-selected](screenshots/31-domainadmin-public-assign-selected.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-domainadmin-public-reassigned](screenshots/31-domainadmin-public-reassigned.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-domainadmin-public-removed](screenshots/32-domainadmin-public-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-domainadmin-public-assign-selected](screenshots/32-domainadmin-public-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-domainadmin-public-reassigned](screenshots/32-domainadmin-public-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-domainadmin-internal-removed](screenshots/32-domainadmin-internal-removed.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-domainadmin-internal-assign-selected](screenshots/32-domainadmin-internal-assign-selected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-domainadmin-internal-reassigned](screenshots/32-domainadmin-internal-reassigned.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-public-401-blocked](screenshots/31-public-401-blocked.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-job2-blocked](screenshots/31-public-job2-blocked.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-public-401-blocked](screenshots/32-public-401-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-job2-blocked](screenshots/32-public-job2-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-internal-401-blocked](screenshots/32-internal-401-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-job2-blocked](screenshots/32-internal-job2-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-query-retry-blocked](screenshots/32-internal-query-retry-blocked.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-query-retry-recovered](screenshots/32-internal-query-retry-recovered.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-public-list503-stale](screenshots/31-public-list503-stale.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-list503-recovered](screenshots/31-public-list503-recovered.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-public-list503-stale](screenshots/32-public-list503-stale.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-list503-recovered](screenshots/32-public-list503-recovered.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-internal-list503-stale](screenshots/32-internal-list503-stale.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-list503-recovered](screenshots/32-internal-list503-recovered.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/dashboard |
| [31-public-late-receipt-discarded](screenshots/31-public-late-receipt-discarded.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/dashboard |
| [31-public-project-return](screenshots/31-public-project-return.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/dashboard |
| [32-internal-late-receipt-discarded](screenshots/32-internal-late-receipt-discarded.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/dashboard |
| [32-internal-project-return](screenshots/32-internal-project-return.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [31-public-390-light](screenshots/31-public-390-light.jpg) | 390×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-768-light](screenshots/31-public-768-light.jpg) | 768×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-1280-light](screenshots/31-public-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-390-dark](screenshots/31-public-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-768-dark](screenshots/31-public-768-dark.jpg) | 768×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-public-1280-dark](screenshots/31-public-1280-dark.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-internal-390-light](screenshots/32-internal-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-768-light](screenshots/32-internal-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-1280-light](screenshots/32-internal-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-390-dark](screenshots/32-internal-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-768-dark](screenshots/32-internal-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-internal-1280-dark](screenshots/32-internal-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-public-390-light](screenshots/32-public-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-768-light](screenshots/32-public-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-1280-light](screenshots/32-public-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-390-dark](screenshots/32-public-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-768-dark](screenshots/32-public-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-public-1280-dark](screenshots/32-public-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [31-final-readonly-public](screenshots/31-final-readonly-public.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-readonly-public-390-dark](screenshots/31-readonly-public-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-final-readonly-internal](screenshots/32-final-readonly-internal.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-readonly-internal-390-dark](screenshots/32-readonly-internal-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
| [32-final-readonly-public](screenshots/32-final-readonly-public.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [32-readonly-public-390-dark](screenshots/32-readonly-public-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/0c2a14fe-22df-4f6f-8057-c39628138538?tab=loadbalancing |
| [31-nonmember-resource-denied](screenshots/31-nonmember-resource-denied.jpg) | 1920×871 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [32-nonmember-resource-denied](screenshots/32-nonmember-resource-denied.jpg) | 1920×871 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [31-autoscale-protected](screenshots/31-autoscale-protected.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-autoscale-protected](screenshots/32-autoscale-protected.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [31-vm-standard-list](screenshots/31-vm-standard-list.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vm |
| [31-vm-standard-detail](screenshots/31-vm-standard-detail.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf |
| [31-vm-standard-dialog-1280-light](screenshots/31-vm-standard-dialog-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-standard-dialog-390-dark](screenshots/31-vm-standard-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-vm-standard-list](screenshots/32-vm-standard-list.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vm |
| [32-vm-standard-detail](screenshots/32-vm-standard-detail.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df |
| [32-vm-standard-dialog-1280-light](screenshots/32-vm-standard-dialog-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [32-vm-standard-dialog-390-dark](screenshots/32-vm-standard-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [31-breadcrumb-list](screenshots/31-breadcrumb-list.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip |
| [31-final-review](screenshots/31-final-review.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-breadcrumb-list](screenshots/32-breadcrumb-list.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb |
| [32-final-review](screenshots/32-final-review.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/ilb/b984694c-2c8d-4398-879a-c01f11531ee1?tab=loadbalancerinstance |
