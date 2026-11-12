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

# 실제 UI 원본 캡처

브라우저 live viewport와 JPEG 디코딩 치수를 대조했다. 아래는 마지막 캡처 기준이며 같은 이름의 중간 프레임은 합산하지 않았다. 모든 역할 로그인 입력 화면은 제외했다.

| 캡처 | 폭×높이 | 테마 | 화면 |
| --- | --- | --- | --- |
| [31-vpn-user-validation-failure](screenshots/31-vpn-user-validation-failure.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-user-created](screenshots/31-vpn-user-created.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [32-vpn-user-created](screenshots/32-vpn-user-created.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [31-lb-duplicate-failure](screenshots/31-lb-duplicate-failure.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-create-recovered](screenshots/31-lb-create-recovered.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-vpn-revoke-confirm](screenshots/31-vpn-revoke-confirm.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser/a6c31f7a-f6b9-43f9-b50e-82f6f4694661 |
| [31-vpn-user-revoked](screenshots/31-vpn-user-revoked.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [32-vpc-public-lb-internal-tier-candidate](screenshots/32-vpc-public-lb-internal-tier-candidate.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c63eaff-c372-4084-8586-a9a590faf9bb?tab=loadbalancing |
| [31-vpn-user-restored](screenshots/31-vpn-user-restored.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [32-vpc-public-lb-invalid-tier-rejected](screenshots/32-vpc-public-lb-invalid-tier-rejected.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c63eaff-c372-4084-8586-a9a590faf9bb?tab=loadbalancing |
| [32-vpc-public-lb-supported-tier](screenshots/32-vpc-public-lb-supported-tier.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c63eaff-c372-4084-8586-a9a590faf9bb?tab=loadbalancing |
| [32-vpn-revoke-confirm](screenshots/32-vpn-revoke-confirm.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpnuser/ce087de5-90ba-4d39-839e-0a5553989bc9 |
| [32-vpn-user-revoked](screenshots/32-vpn-user-revoked.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpc-public-lb-created](screenshots/32-vpc-public-lb-created.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/0c63eaff-c372-4084-8586-a9a590faf9bb?tab=loadbalancing |
| [32-internal-lb-invalid-before](screenshots/32-internal-lb-invalid-before.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [32-internal-lb-invalid-closed](screenshots/32-internal-lb-invalid-closed.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [32-internal-lb-reopened-empty](screenshots/32-internal-lb-reopened-empty.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [31-vpn-strict-user-restored](screenshots/31-vpn-strict-user-restored.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [32-lb-duplicate-failure](screenshots/32-lb-duplicate-failure.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-create-recovered](screenshots/32-lb-create-recovered.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-internal-lb-assign-selected](screenshots/32-internal-lb-assign-selected.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c?tab=loadbalancerinstance |
| [32-internal-lb-assigned](screenshots/32-internal-lb-assigned.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c?tab=loadbalancerinstance |
| [31-project-return](screenshots/31-project-return.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/dashboard |
| [31-vpnLbReadOnly-vpn](screenshots/31-vpnLbReadOnly-vpn.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/vpnuser |
| [31-readonly-lb-action-visible](screenshots/31-readonly-lb-action-visible.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-vpnLbReadOnly-lb](screenshots/31-vpnLbReadOnly-lb.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-vpnLbReadOnly-390-inherited](screenshots/31-vpnLbReadOnly-390-inherited.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-vpnLbReadOnly-768-inherited](screenshots/31-vpnLbReadOnly-768-inherited.jpg) | 768×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-project-default](screenshots/31-project-default.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/dashboard |
| [31-peer-vpn](screenshots/31-peer-vpn.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-peer-lb](screenshots/31-peer-lb.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-domainAdmin-vpn](screenshots/31-domainAdmin-vpn.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-domainAdmin-lb](screenshots/31-domainAdmin-lb.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-nonmember-project-unavailable](screenshots/31-nonmember-project-unavailable.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/dashboard |
| [31-nonmember-direct-lb-denied](screenshots/31-nonmember-direct-lb-denied.jpg) | 1920×871 | light | http://10.10.31.10:8080/client/#/dashboard |
| [32-project-return](screenshots/32-project-return.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/dashboard |
| [32-vpnLbReadOnly-vpn](screenshots/32-vpnLbReadOnly-vpn.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpnLbReadOnly-lb](screenshots/32-vpnLbReadOnly-lb.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-vpnLbReadOnly-390-inherited](screenshots/32-vpnLbReadOnly-390-inherited.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-vpnLbReadOnly-768-inherited](screenshots/32-vpnLbReadOnly-768-inherited.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-project-default](screenshots/32-project-default.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/dashboard |
| [32-peer-vpn](screenshots/32-peer-vpn.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-peer-lb](screenshots/32-peer-lb.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-domainAdmin-vpn](screenshots/32-domainAdmin-vpn.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-domainAdmin-lb](screenshots/32-domainAdmin-lb.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-nonmember-project-unavailable](screenshots/32-nonmember-project-unavailable.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/dashboard |
| [32-nonmember-direct-lb-denied](screenshots/32-nonmember-direct-lb-denied.jpg) | 1920×871 | light | http://10.10.32.10:8080/client/#/dashboard |
| [31-vpn-390-light](screenshots/31-vpn-390-light.jpg) | 390×900 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-768-light](screenshots/31-vpn-768-light.jpg) | 768×900 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-1280-light](screenshots/31-vpn-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-390-dark](screenshots/31-vpn-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-768-dark](screenshots/31-vpn-768-dark.jpg) | 768×900 | dark | http://10.10.31.10:8080/client/#/vpnuser |
| [31-vpn-1280-dark](screenshots/31-vpn-1280-dark.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/vpnuser |
| [32-vpn-390-light](screenshots/32-vpn-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpn-768-light](screenshots/32-vpn-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpn-1280-light](screenshots/32-vpn-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpn-390-dark](screenshots/32-vpn-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpn-768-dark](screenshots/32-vpn-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/vpnuser |
| [32-vpn-1280-dark](screenshots/32-vpn-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/vpnuser |
| [31-lb-dialog-390-light](screenshots/31-lb-dialog-390-light.jpg) | 390×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-dialog-768-light](screenshots/31-lb-dialog-768-light.jpg) | 768×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-dialog-1280-light](screenshots/31-lb-dialog-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-dialog-390-dark](screenshots/31-lb-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-dialog-768-dark](screenshots/31-lb-dialog-768-dark.jpg) | 768×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-lb-dialog-1280-dark](screenshots/31-lb-dialog-1280-dark.jpg) | 1280×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-project-default-resource-visible](screenshots/31-project-default-resource-visible.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-lb-dialog-390-light](screenshots/32-lb-dialog-390-light.jpg) | 390×900 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-dialog-768-light](screenshots/32-lb-dialog-768-light.jpg) | 768×900 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-dialog-1280-light](screenshots/32-lb-dialog-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-dialog-390-dark](screenshots/32-lb-dialog-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-dialog-768-dark](screenshots/32-lb-dialog-768-dark.jpg) | 768×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-lb-dialog-1280-dark](screenshots/32-lb-dialog-1280-dark.jpg) | 1280×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [31-vm-nic-standard-1280-light](screenshots/31-vm-nic-standard-1280-light.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-nic-standard-390-dark](screenshots/31-vm-nic-standard-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-vm-nic-standard-1280-light](screenshots/32-vm-nic-standard-1280-light.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [32-vm-nic-standard-390-dark](screenshots/32-vm-nic-standard-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [31-vm-attach-standard-390-dark](screenshots/31-vm-attach-standard-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-vm-attach-standard-390-dark](screenshots/32-vm-attach-standard-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [32-vpc-tier-empty-acl-links](screenshots/32-vpc-tier-empty-acl-links.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [32-internal-legacy-modal-390-dark](screenshots/32-internal-legacy-modal-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [31-vm-nic-visible-390-dark](screenshots/31-vm-nic-visible-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-lb-tab-visible-390-dark](screenshots/31-lb-tab-visible-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-vm-nic-visible-390-dark](screenshots/32-vm-nic-visible-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/vm/f2f65780-56e0-405e-b471-7a077e3045df?tab=nics |
| [32-lb-tab-visible-390-dark](screenshots/32-lb-tab-visible-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [31-readonly-lb-visible-390-dark](screenshots/31-readonly-lb-visible-390-dark.jpg) | 390×900 | dark | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-readonly-lb-visible-390-dark](screenshots/32-readonly-lb-visible-390-dark.jpg) | 390×900 | dark | http://10.10.32.10:8080/client/#/publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [31-vpc-tier-valid-acl-link](screenshots/31-vpc-tier-valid-acl-link.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7?tab=tier |
| [31-vpc-acl-link-navigation](screenshots/31-vpc-acl-link-navigation.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/vpc/86950275-e6b6-4790-8bc9-bee82ab173c7?tab=tier |
| [31-vpc-tier-return](screenshots/31-vpc-tier-return.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/dashboard |
| [31-lb-assign-selected](screenshots/31-lb-assign-selected.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-review-admin-lb](screenshots/31-review-admin-lb.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-review-admin-vpc](screenshots/32-review-admin-vpc.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/vpc/91c180fc-6f94-4a64-a875-49697b0f3266?tab=tier |
| [31-readonly-backend-remove-enabled](screenshots/31-readonly-backend-remove-enabled.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-readonly-backend-remove-rejected](screenshots/31-readonly-backend-remove-rejected.jpg) | 1280×900 | light | http://10.10.31.10:8080/client/#/publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [32-readonly-internal-remove-enabled](screenshots/32-readonly-internal-remove-enabled.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c?tab=loadbalancerinstance |
| [32-readonly-internal-remove-rejected](screenshots/32-readonly-internal-remove-rejected.jpg) | 1280×900 | light | http://10.10.32.10:8080/client/#/ilb/025c3afd-55ec-4e70-bf2c-339bc7e1ac5c?tab=loadbalancerinstance |
