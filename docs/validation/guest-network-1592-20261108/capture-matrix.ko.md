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

# #1592 실제 UI 원본 캡처

JPEG 원본 82장이다. 편집·합성·리사이즈하지 않았으며 서명·디코딩 치수·뷰포트/문서 크기·SHA256을 대조했다. [원자료](evidence/ui-captures.json).

`before-revoked-mismatch`는 배포 전 요약 1/NIC 0 재현이다. `revoked-*`는 회수 후 일반 텍스트, `final-shared-*`는 재부여 후 링크다. 모바일은 고정 헤더 아래 콘텐츠를 스크롤해 요약과 NIC 행을 별도로 촬영했다. `lookup-failure/recovered`는 조회 오류·복구, `*-direct-denied`는 직접 URL 거부, `network-open`은 실제 링크 이동이다. 링크 수는 VM 화면의 대상 망에 한정하며 다른 화면의 0은 권한 판정 결과가 아니다.

| 화면 | 원본 크기 | 요약/NIC 링크 | 원본 |
| --- | --- | --- | --- |
| 31-after-grant | 1670×841 | 1/1 | [보기](screenshots/31-after-grant.jpg) |
| 31-after-revoke-member | 1670×841 | 0/0 | [보기](screenshots/31-after-revoke-member.jpg) |
| 31-after-unshared | 1670×841 | 0/0 | [보기](screenshots/31-after-unshared.jpg) |
| 31-before-granted | 1670×841 | 1/1 | [보기](screenshots/31-before-granted.jpg) |
| 31-before-revoked-mismatch | 1670×841 | 1/0 | [보기](screenshots/31-before-revoked-mismatch.jpg) |
| 31-breadcrumb-return-mobile | 380×844 | 0/0 | [보기](screenshots/31-breadcrumb-return-mobile.jpg) |
| 31-final-admin-review | 1670×841 | 1/1 | [보기](screenshots/31-final-admin-review.jpg) |
| 31-final-grant | 1270×900 | 1/1 | [보기](screenshots/31-final-grant.jpg) |
| 31-final-lookup-failure-light | 380×844 | 0/0 | [보기](screenshots/31-final-lookup-failure-light.jpg) |
| 31-final-lookup-recovered-light | 380×844 | 1/1 | [보기](screenshots/31-final-lookup-recovered-light.jpg) |
| 31-final-restored | 380×844 | 1/1 | [보기](screenshots/31-final-restored.jpg) |
| 31-final-revoke | 1270×900 | 0/0 | [보기](screenshots/31-final-revoke.jpg) |
| 31-final-shared-mobile-nic-light | 380×844 | 1/1 | [보기](screenshots/31-final-shared-mobile-nic-light.jpg) |
| 31-final-shared-mobile-summary-light | 380×844 | 1/1 | [보기](screenshots/31-final-shared-mobile-summary-light.jpg) |
| 31-final-ui-source-confirmed | 380×844 | 1/1 | [보기](screenshots/31-final-ui-source-confirmed.jpg) |
| 31-lookup-failure-dark | 1270×900 | 0/0 | [보기](screenshots/31-lookup-failure-dark.jpg) |
| 31-lookup-recovered-dark | 1270×900 | 1/1 | [보기](screenshots/31-lookup-recovered-dark.jpg) |
| 31-member-revoked-network-direct-denied | 1670×841 | 0/0 | [보기](screenshots/31-member-revoked-network-direct-denied.jpg) |
| 31-nonmember-vm-direct-denied | 1670×841 | 0/0 | [보기](screenshots/31-nonmember-vm-direct-denied.jpg) |
| 31-project-default-final-mobile | 380×844 | 0/0 | [보기](screenshots/31-project-default-final-mobile.jpg) |
| 31-project-default-mobile | 380×844 | 0/0 | [보기](screenshots/31-project-default-mobile.jpg) |
| 31-project-return-final-mobile | 380×844 | 1/1 | [보기](screenshots/31-project-return-final-mobile.jpg) |
| 31-project-return-revoked-mobile | 380×844 | 0/0 | [보기](screenshots/31-project-return-revoked-mobile.jpg) |
| 31-regrant-readonly-network-open | 1670×841 | 0/0 | [보기](screenshots/31-regrant-readonly-network-open.jpg) |
| 31-regrant-readonly-return | 1670×841 | 1/1 | [보기](screenshots/31-regrant-readonly-return.jpg) |
| 31-regrant-readonly | 1670×841 | 1/1 | [보기](screenshots/31-regrant-readonly.jpg) |
| 31-revoked-admin-final | 1670×841 | 0/0 | [보기](screenshots/31-revoked-admin-final.jpg) |
| 31-revoked-dark-1280 | 1270×900 | 0/0 | [보기](screenshots/31-revoked-dark-1280.jpg) |
| 31-revoked-dark-390 | 380×844 | 0/0 | [보기](screenshots/31-revoked-dark-390.jpg) |
| 31-revoked-dark-768 | 758×1024 | 0/0 | [보기](screenshots/31-revoked-dark-768.jpg) |
| 31-revoked-domainadmin | 1670×841 | 0/0 | [보기](screenshots/31-revoked-domainadmin.jpg) |
| 31-revoked-light-1280 | 1270×900 | 0/0 | [보기](screenshots/31-revoked-light-1280.jpg) |
| 31-revoked-light-390 | 380×844 | 0/0 | [보기](screenshots/31-revoked-light-390.jpg) |
| 31-revoked-light-768 | 758×1024 | 0/0 | [보기](screenshots/31-revoked-light-768.jpg) |
| 31-revoked-mobile-nic-dark | 380×844 | 0/0 | [보기](screenshots/31-revoked-mobile-nic-dark.jpg) |
| 31-revoked-mobile-nic-light | 380×844 | 0/0 | [보기](screenshots/31-revoked-mobile-nic-light.jpg) |
| 31-revoked-mobile-summary-light | 380×844 | 0/0 | [보기](screenshots/31-revoked-mobile-summary-light.jpg) |
| 31-revoked-owner | 1670×841 | 0/0 | [보기](screenshots/31-revoked-owner.jpg) |
| 31-revoked-readonly | 1670×841 | 0/0 | [보기](screenshots/31-revoked-readonly.jpg) |
| 31-vm-list-mobile | 380×844 | 0/0 | [보기](screenshots/31-vm-list-mobile.jpg) |
| 31-vm-standard-nic-details-mobile | 380×844 | 1/1 | [보기](screenshots/31-vm-standard-nic-details-mobile.jpg) |
| 32-after-grant | 1670×841 | 1/1 | [보기](screenshots/32-after-grant.jpg) |
| 32-after-revoke-member | 1670×841 | 0/0 | [보기](screenshots/32-after-revoke-member.jpg) |
| 32-after-unshared | 1670×841 | 0/0 | [보기](screenshots/32-after-unshared.jpg) |
| 32-before-granted | 1670×841 | 1/1 | [보기](screenshots/32-before-granted.jpg) |
| 32-before-revoked-mismatch | 1670×841 | 1/0 | [보기](screenshots/32-before-revoked-mismatch.jpg) |
| 32-breadcrumb-return-mobile | 380×844 | 0/0 | [보기](screenshots/32-breadcrumb-return-mobile.jpg) |
| 32-final-admin-review | 1670×841 | 1/1 | [보기](screenshots/32-final-admin-review.jpg) |
| 32-final-grant | 1270×900 | 1/1 | [보기](screenshots/32-final-grant.jpg) |
| 32-final-lookup-failure-dark | 380×844 | 0/0 | [보기](screenshots/32-final-lookup-failure-dark.jpg) |
| 32-final-lookup-recovered-dark | 380×844 | 1/1 | [보기](screenshots/32-final-lookup-recovered-dark.jpg) |
| 32-final-restored | 380×844 | 1/1 | [보기](screenshots/32-final-restored.jpg) |
| 32-final-revoke | 1270×900 | 0/0 | [보기](screenshots/32-final-revoke.jpg) |
| 32-final-shared-mobile-nic-dark | 380×844 | 1/1 | [보기](screenshots/32-final-shared-mobile-nic-dark.jpg) |
| 32-final-shared-mobile-summary-dark | 380×844 | 1/1 | [보기](screenshots/32-final-shared-mobile-summary-dark.jpg) |
| 32-final-ui-source-confirmed | 1670×841 | 1/1 | [보기](screenshots/32-final-ui-source-confirmed.jpg) |
| 32-lookup-failure-light | 1270×900 | 0/0 | [보기](screenshots/32-lookup-failure-light.jpg) |
| 32-lookup-recovered-light | 1270×900 | 1/1 | [보기](screenshots/32-lookup-recovered-light.jpg) |
| 32-member-revoked-network-direct-denied | 1670×841 | 0/0 | [보기](screenshots/32-member-revoked-network-direct-denied.jpg) |
| 32-nonmember-vm-direct-denied | 1670×841 | 0/0 | [보기](screenshots/32-nonmember-vm-direct-denied.jpg) |
| 32-project-default-final-mobile | 380×844 | 0/0 | [보기](screenshots/32-project-default-final-mobile.jpg) |
| 32-project-default-mobile | 380×844 | 0/0 | [보기](screenshots/32-project-default-mobile.jpg) |
| 32-project-return-final-mobile | 380×844 | 1/1 | [보기](screenshots/32-project-return-final-mobile.jpg) |
| 32-project-return-revoked-mobile | 380×844 | 0/0 | [보기](screenshots/32-project-return-revoked-mobile.jpg) |
| 32-regrant-readonly-network-open | 1670×841 | 0/0 | [보기](screenshots/32-regrant-readonly-network-open.jpg) |
| 32-regrant-readonly-return | 1670×841 | 1/1 | [보기](screenshots/32-regrant-readonly-return.jpg) |
| 32-regrant-readonly | 1670×841 | 1/1 | [보기](screenshots/32-regrant-readonly.jpg) |
| 32-revoked-admin-final | 1670×841 | 0/0 | [보기](screenshots/32-revoked-admin-final.jpg) |
| 32-revoked-dark-1280 | 1270×900 | 0/0 | [보기](screenshots/32-revoked-dark-1280.jpg) |
| 32-revoked-dark-390 | 380×844 | 0/0 | [보기](screenshots/32-revoked-dark-390.jpg) |
| 32-revoked-dark-768 | 758×1024 | 0/0 | [보기](screenshots/32-revoked-dark-768.jpg) |
| 32-revoked-domainadmin | 1670×841 | 0/0 | [보기](screenshots/32-revoked-domainadmin.jpg) |
| 32-revoked-light-1280 | 1270×900 | 0/0 | [보기](screenshots/32-revoked-light-1280.jpg) |
| 32-revoked-light-390 | 380×844 | 0/0 | [보기](screenshots/32-revoked-light-390.jpg) |
| 32-revoked-light-768 | 758×1024 | 0/0 | [보기](screenshots/32-revoked-light-768.jpg) |
| 32-revoked-mobile-nic-dark | 380×844 | 0/0 | [보기](screenshots/32-revoked-mobile-nic-dark.jpg) |
| 32-revoked-mobile-nic-light | 380×844 | 0/0 | [보기](screenshots/32-revoked-mobile-nic-light.jpg) |
| 32-revoked-mobile-summary-dark | 380×844 | 0/0 | [보기](screenshots/32-revoked-mobile-summary-dark.jpg) |
| 32-revoked-owner | 1670×841 | 0/0 | [보기](screenshots/32-revoked-owner.jpg) |
| 32-revoked-readonly | 1670×841 | 0/0 | [보기](screenshots/32-revoked-readonly.jpg) |
| 32-vm-list-mobile | 380×844 | 0/0 | [보기](screenshots/32-vm-list-mobile.jpg) |
| 32-vm-standard-nic-details-mobile | 380×844 | 1/1 | [보기](screenshots/32-vm-standard-nic-details-mobile.jpg) |
