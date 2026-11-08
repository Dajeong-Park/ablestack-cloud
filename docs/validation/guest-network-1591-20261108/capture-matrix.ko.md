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

# #1591 실제 UI 캡처 48장

브라우저가 생성한 JPEG 원본이다. 편집·합성·리사이즈하지 않았다. [치수·뷰포트·URL·SHA256](evidence/ui-captures.json)을 대조했으며 각 이미지의 가로 크기는 뷰포트 또는 스크롤바를 제외한 문서 너비다. 모바일 콘텐츠는 내부 스크롤로 해당 탭을 드러내 촬영했다.

`zone-provider-empty`는 실제 Zone 필터를 전달한 정상 빈 목록이다. `provider-invalid-zone-error`는 잘못된 Zone의 실제 431 알림이다. `tungsten-*-empty` 물리 제공자 탭은 플러그인 비활성으로 목록 API를 생략하므로 백엔드 성공 증거로 사용하지 않는다. `vm-*`은 대조한 기존 VM 표준이며 이번 UI 변경 화면이 아니다. 캡처의 기존 Wall/리소스 경보는 검증용으로 제거하거나 설정을 바꾸지 않았다.

| 클러스터·화면 | 원본 크기 | 뷰포트 | 원본 |
| --- | --- | --- | --- |
| 31 · isolated-detail-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-isolated-detail-light-desktop.jpg) |
| 31 · l2-detail-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-l2-detail-light-desktop.jpg) |
| 31 · nic-to-network-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-nic-to-network-desktop.jpg) |
| 31 · provider-invalid-zone-error-desktop | 1280×900 | 1280×900 | [보기](screenshots/31-provider-invalid-zone-error-desktop.jpg) |
| 31 · provider-list-empty-light-desktop | 1280×900 | 1280×900 | [보기](screenshots/31-provider-list-empty-light-desktop.jpg) |
| 31 · qa-network-list-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-qa-network-list-light-desktop.jpg) |
| 31 · shared-detail-dark-mobile | 390×844 | 390×844 | [보기](screenshots/31-shared-detail-dark-mobile.jpg) |
| 31 · shared-detail-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-shared-detail-light-desktop.jpg) |
| 31 · shared-vnf-tab-dark-mobile | 390×844 | 390×844 | [보기](screenshots/31-shared-vnf-tab-dark-mobile.jpg) |
| 31 · shared-vnf-tab-light-mobile | 390×844 | 390×844 | [보기](screenshots/31-shared-vnf-tab-light-mobile.jpg) |
| 31 · shared-vnf-tab-light-tablet | 768×1024 | 768×1024 | [보기](screenshots/31-shared-vnf-tab-light-tablet.jpg) |
| 31 · tungsten-zone-empty-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-tungsten-zone-empty-light-desktop.jpg) |
| 31 · vm-detail-nic-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-vm-detail-nic-light-desktop.jpg) |
| 31 · vm-final-light-desktop | 1680×841 | 1680×841 | [보기](screenshots/31-vm-final-light-desktop.jpg) |
| 31 · vm-list-light-desktop | 1280×900 | 1280×900 | [보기](screenshots/31-vm-list-light-desktop.jpg) |
| 31 · vm-network-dialog-light-mobile | 390×844 | 390×844 | [보기](screenshots/31-vm-network-dialog-light-mobile.jpg) |
| 31 · vm-nic-tab-dark-mobile | 390×844 | 390×844 | [보기](screenshots/31-vm-nic-tab-dark-mobile.jpg) |
| 31 · vm-nic-tab-light-mobile | 390×844 | 390×844 | [보기](screenshots/31-vm-nic-tab-light-mobile.jpg) |
| 31 · vm-nic-tab-light-tablet | 768×1024 | 768×1024 | [보기](screenshots/31-vm-nic-tab-light-tablet.jpg) |
| 31 · vm-summary-dark-mobile | 390×844 | 390×844 | [보기](screenshots/31-vm-summary-dark-mobile.jpg) |
| 31 · zone-provider-empty-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/31-zone-provider-empty-dark-desktop.jpg) |
| 31 · zone-provider-empty-dark-mobile | 390×844 | 390×844 | [보기](screenshots/31-zone-provider-empty-dark-mobile.jpg) |
| 31 · zone-provider-empty-dark-tablet | 768×1024 | 768×1024 | [보기](screenshots/31-zone-provider-empty-dark-tablet.jpg) |
| 31 · zone-provider-empty-light-desktop | 1280×900 | 1280×900 | [보기](screenshots/31-zone-provider-empty-light-desktop.jpg) |
| 31 · zone-provider-empty-light-mobile | 390×844 | 390×844 | [보기](screenshots/31-zone-provider-empty-light-mobile.jpg) |
| 31 · zone-provider-empty-light-tablet | 768×1024 | 768×1024 | [보기](screenshots/31-zone-provider-empty-light-tablet.jpg) |
| 32 · isolated-detail-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-isolated-detail-dark-desktop.jpg) |
| 32 · l2-detail-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-l2-detail-dark-desktop.jpg) |
| 32 · nic-to-network-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-nic-to-network-desktop.jpg) |
| 32 · provider-invalid-zone-error-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-provider-invalid-zone-error-desktop.jpg) |
| 32 · qa-network-list-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-qa-network-list-dark-desktop.jpg) |
| 32 · shared-detail-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-shared-detail-dark-desktop.jpg) |
| 32 · shared-vnf-tab-dark-mobile | 390×844 | 390×844 | [보기](screenshots/32-shared-vnf-tab-dark-mobile.jpg) |
| 32 · shared-vnf-tab-light-mobile | 390×844 | 390×844 | [보기](screenshots/32-shared-vnf-tab-light-mobile.jpg) |
| 32 · tungsten-disabled-empty-dark-desktop | 1680×841 | 1680×841 | [보기](screenshots/32-tungsten-disabled-empty-dark-desktop.jpg) |
| 32 · vm-detail-nic-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-vm-detail-nic-dark-desktop.jpg) |
| 32 · vm-final-dark-desktop | 1680×841 | 1680×841 | [보기](screenshots/32-vm-final-dark-desktop.jpg) |
| 32 · vm-list-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-vm-list-dark-desktop.jpg) |
| 32 · vm-network-dialog-dark-mobile | 390×844 | 390×844 | [보기](screenshots/32-vm-network-dialog-dark-mobile.jpg) |
| 32 · vm-nic-tab-dark-mobile | 390×844 | 390×844 | [보기](screenshots/32-vm-nic-tab-dark-mobile.jpg) |
| 32 · vm-nic-tab-dark-tablet | 768×1024 | 768×1024 | [보기](screenshots/32-vm-nic-tab-dark-tablet.jpg) |
| 32 · vm-summary-dark-mobile | 390×844 | 390×844 | [보기](screenshots/32-vm-summary-dark-mobile.jpg) |
| 32 · zone-provider-empty-dark-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-zone-provider-empty-dark-desktop.jpg) |
| 32 · zone-provider-empty-dark-mobile | 390×844 | 390×844 | [보기](screenshots/32-zone-provider-empty-dark-mobile.jpg) |
| 32 · zone-provider-empty-dark-tablet | 768×1024 | 768×1024 | [보기](screenshots/32-zone-provider-empty-dark-tablet.jpg) |
| 32 · zone-provider-empty-light-desktop | 1280×900 | 1280×900 | [보기](screenshots/32-zone-provider-empty-light-desktop.jpg) |
| 32 · zone-provider-empty-light-mobile | 390×844 | 390×844 | [보기](screenshots/32-zone-provider-empty-light-mobile.jpg) |
| 32 · zone-provider-empty-light-tablet | 768×1024 | 768×1024 | [보기](screenshots/32-zone-provider-empty-light-tablet.jpg) |
