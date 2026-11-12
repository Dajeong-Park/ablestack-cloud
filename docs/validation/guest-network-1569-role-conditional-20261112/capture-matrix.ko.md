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

# UI 검증과 원본 캡처

이번 UI 소스 변경0. VM 목록·상세·NIC 탭·NIC 연결창 기준을 직접 확인했다. 네트워크/공인 IP 댓글·이벤트·태그, 역할별 작업 노출, breadcrumb·프로젝트 이동을 대조했다. 새로 스타일을 적용했다고 보고하지 않는다.

원본 JPEG191개: 실제 screenshot 크기와 브라우저 viewport 일치, URL origin·명명한 테마를 감사했다. 레이아웃76건(폭390/768/1280 일부 조합), 즉시 테마9변경은 timeOrigin 동일, 프로젝트2왕복이다. 허용 역할40화면과 비구성원 직접URL10거부를 포함한다. 모든 조합의 완전 교차 행렬은 아니다.

32 모바일 화면 상단 자원 경고는 환경/용량 알림이다. 제품 기능 결함으로 등록하지 않았다.

| 캡처 | 크기 | 대상 |
| --- | --- | --- |
| [31-admin-Isolated-comments-dark-1280.jpg](screenshots/31-admin-Isolated-comments-dark-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-admin-Isolated-comments-dark-390.jpg](screenshots/31-admin-Isolated-comments-dark-390.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-admin-Isolated-comments-dark-768.jpg](screenshots/31-admin-Isolated-comments-dark-768.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-admin-Isolated-comments-light-1280.jpg](screenshots/31-admin-Isolated-comments-light-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-admin-Isolated-comments-light-390.jpg](screenshots/31-admin-Isolated-comments-light-390.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-admin-Isolated-comments-light-768.jpg](screenshots/31-admin-Isolated-comments-light-768.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-admin-Isolated-events-dark-1280.jpg](screenshots/31-admin-Isolated-events-dark-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-admin-Isolated-events-dark-390.jpg](screenshots/31-admin-Isolated-events-dark-390.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-admin-Isolated-events-dark-768.jpg](screenshots/31-admin-Isolated-events-dark-768.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-admin-Isolated-events-light-1280.jpg](screenshots/31-admin-Isolated-events-light-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-admin-Isolated-events-light-390.jpg](screenshots/31-admin-Isolated-events-light-390.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-admin-Isolated-events-light-768.jpg](screenshots/31-admin-Isolated-events-light-768.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-admin-L2-comments-dark-1280.jpg](screenshots/31-admin-L2-comments-dark-1280.jpg) | 1280×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-admin-L2-comments-dark-390.jpg](screenshots/31-admin-L2-comments-dark-390.jpg) | 390×844 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-admin-L2-comments-light-1280.jpg](screenshots/31-admin-L2-comments-light-1280.jpg) | 1280×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-admin-L2-comments-light-390.jpg](screenshots/31-admin-L2-comments-light-390.jpg) | 390×844 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-admin-L2-events-dark-1280.jpg](screenshots/31-admin-L2-events-dark-1280.jpg) | 1280×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=events |
| [31-admin-L2-events-dark-390.jpg](screenshots/31-admin-L2-events-dark-390.jpg) | 390×844 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=events |
| [31-admin-L2-events-light-1280.jpg](screenshots/31-admin-L2-events-light-1280.jpg) | 1280×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=events |
| [31-admin-L2-events-light-390.jpg](screenshots/31-admin-L2-events-light-390.jpg) | 390×844 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=events |
| [31-admin-PublicIP-Isolated-comments-dark-390.jpg](screenshots/31-admin-PublicIP-Isolated-comments-dark-390.jpg) | 390×844 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-admin-PublicIP-Isolated-comments-light-1280.jpg](screenshots/31-admin-PublicIP-Isolated-comments-light-1280.jpg) | 1280×900 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-admin-PublicIP-Isolated-events-dark-390.jpg](screenshots/31-admin-PublicIP-Isolated-events-dark-390.jpg) | 390×844 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=events |
| [31-admin-PublicIP-Isolated-events-light-1280.jpg](screenshots/31-admin-PublicIP-Isolated-events-light-1280.jpg) | 1280×900 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=events |
| [31-admin-PublicIP-VPC-comments-dark-390.jpg](screenshots/31-admin-PublicIP-VPC-comments-dark-390.jpg) | 390×844 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178?tab=comments |
| [31-admin-PublicIP-VPC-comments-light-1280.jpg](screenshots/31-admin-PublicIP-VPC-comments-light-1280.jpg) | 1280×900 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178?tab=comments |
| [31-admin-PublicIP-VPC-events-dark-390.jpg](screenshots/31-admin-PublicIP-VPC-events-dark-390.jpg) | 390×844 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178?tab=events |
| [31-admin-PublicIP-VPC-events-light-1280.jpg](screenshots/31-admin-PublicIP-VPC-events-light-1280.jpg) | 1280×900 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178?tab=events |
| [31-admin-Shared-comments-dark-1280.jpg](screenshots/31-admin-Shared-comments-dark-1280.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-comments-dark-390.jpg](screenshots/31-admin-Shared-comments-dark-390.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-comments-dark-768.jpg](screenshots/31-admin-Shared-comments-dark-768.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-comments-light-1280.jpg](screenshots/31-admin-Shared-comments-light-1280.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-comments-light-390.jpg](screenshots/31-admin-Shared-comments-light-390.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-comments-light-768.jpg](screenshots/31-admin-Shared-comments-light-768.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-admin-Shared-events-dark-1280.jpg](screenshots/31-admin-Shared-events-dark-1280.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-admin-Shared-events-dark-390.jpg](screenshots/31-admin-Shared-events-dark-390.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788 |
| [31-admin-Shared-events-dark-768.jpg](screenshots/31-admin-Shared-events-dark-768.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-admin-Shared-events-light-1280.jpg](screenshots/31-admin-Shared-events-light-1280.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-admin-Shared-events-light-390.jpg](screenshots/31-admin-Shared-events-light-390.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788 |
| [31-admin-Shared-events-light-768.jpg](screenshots/31-admin-Shared-events-light-768.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-child-denied-Isolated.jpg](screenshots/31-child-denied-Isolated.jpg) | 1920×871 | dashboard |
| [31-child-denied-L2.jpg](screenshots/31-child-denied-L2.jpg) | 1920×871 | dashboard |
| [31-child-denied-PublicIP-Isolated.jpg](screenshots/31-child-denied-PublicIP-Isolated.jpg) | 1920×871 | dashboard |
| [31-child-denied-PublicIP-VPC.jpg](screenshots/31-child-denied-PublicIP-VPC.jpg) | 1920×871 | dashboard |
| [31-child-denied-Shared.jpg](screenshots/31-child-denied-Shared.jpg) | 1920×871 | dashboard |
| [31-comment-long-431-input-preserved.jpg](screenshots/31-comment-long-431-input-preserved.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comment-write-503-input-preserved.jpg](screenshots/31-comment-write-503-input-preserved.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comment-write-retry-success.jpg](screenshots/31-comment-write-retry-success.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comments-controlled-read-503.jpg](screenshots/31-comments-controlled-read-503.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comments-page2-dark-desktop.jpg](screenshots/31-comments-page2-dark-desktop.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comments-read-retry-recovered.jpg](screenshots/31-comments-read-retry-recovered.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-comments-ui-created-light-1280.jpg](screenshots/31-comments-ui-created-light-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-domainAdmin-Isolated-comments.jpg](screenshots/31-domainAdmin-Isolated-comments.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-domainAdmin-Isolated-events.jpg](screenshots/31-domainAdmin-Isolated-events.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-domainAdmin-L2-comments.jpg](screenshots/31-domainAdmin-L2-comments.jpg) | 1280×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-domainAdmin-PublicIP-Isolated-comments.jpg](screenshots/31-domainAdmin-PublicIP-Isolated-comments.jpg) | 1280×900 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-domainAdmin-PublicIP-VPC-comments.jpg](screenshots/31-domainAdmin-PublicIP-VPC-comments.jpg) | 1280×900 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178 |
| [31-domainAdmin-Shared-comments.jpg](screenshots/31-domainAdmin-Shared-comments.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-domainAdmin-Shared-events.jpg](screenshots/31-domainAdmin-Shared-events.jpg) | 1280×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-events-controlled-read-503.jpg](screenshots/31-events-controlled-read-503.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-events-light-1280.jpg](screenshots/31-events-light-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-events-page2-dark-desktop.jpg](screenshots/31-events-page2-dark-desktop.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-events-read-retry-recovered.jpg](screenshots/31-events-read-retry-recovered.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-events-search-dark-desktop.jpg](screenshots/31-events-search-dark-desktop.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-final-review-network.jpg](screenshots/31-final-review-network.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-offering-api-completed-ui.jpg](screenshots/31-offering-api-completed-ui.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-offering-clone-before-submit.jpg](screenshots/31-offering-clone-before-submit.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-offering-confirm.jpg](screenshots/31-offering-confirm.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-offering-pending.jpg](screenshots/31-offering-pending.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-offering-restored.jpg](screenshots/31-offering-restored.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-owner-Isolated-comments.jpg](screenshots/31-owner-Isolated-comments.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-owner-Isolated-events.jpg](screenshots/31-owner-Isolated-events.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-owner-L2-comments.jpg](screenshots/31-owner-L2-comments.jpg) | 1920×871 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-owner-project-default-return.jpg](screenshots/31-owner-project-default-return.jpg) | 1920×871 | dashboard |
| [31-owner-project-roundtrip-restored.jpg](screenshots/31-owner-project-roundtrip-restored.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb |
| [31-owner-PublicIP-Isolated-comments.jpg](screenshots/31-owner-PublicIP-Isolated-comments.jpg) | 1920×871 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-owner-PublicIP-VPC-comments.jpg](screenshots/31-owner-PublicIP-VPC-comments.jpg) | 1920×871 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178 |
| [31-owner-Shared-comments.jpg](screenshots/31-owner-Shared-comments.jpg) | 1920×871 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-owner-Shared-events.jpg](screenshots/31-owner-Shared-events.jpg) | 1920×871 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-peer-Isolated-comments.jpg](screenshots/31-peer-Isolated-comments.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-peer-Isolated-events.jpg](screenshots/31-peer-Isolated-events.jpg) | 768×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-peer-L2-comments.jpg](screenshots/31-peer-L2-comments.jpg) | 768×900 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-peer-PublicIP-Isolated-comments.jpg](screenshots/31-peer-PublicIP-Isolated-comments.jpg) | 768×900 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-peer-PublicIP-VPC-comments.jpg](screenshots/31-peer-PublicIP-VPC-comments.jpg) | 768×900 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178 |
| [31-peer-Shared-comments.jpg](screenshots/31-peer-Shared-comments.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-peer-Shared-events.jpg](screenshots/31-peer-Shared-events.jpg) | 768×900 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-readOnly-Isolated-comments.jpg](screenshots/31-readOnly-Isolated-comments.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-readOnly-Isolated-events.jpg](screenshots/31-readOnly-Isolated-events.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-readOnly-L2-comments.jpg](screenshots/31-readOnly-L2-comments.jpg) | 390×844 | guestnetwork/a803353e-3992-47fd-b9d5-df789b264f73?tab=comments |
| [31-readOnly-network-action-guard-mobile.jpg](screenshots/31-readOnly-network-action-guard-mobile.jpg) | 390×844 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-readOnly-PublicIP-Isolated-comments.jpg](screenshots/31-readOnly-PublicIP-Isolated-comments.jpg) | 390×844 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=comments |
| [31-readOnly-PublicIP-VPC-comments.jpg](screenshots/31-readOnly-PublicIP-VPC-comments.jpg) | 390×844 | publicip/5b51a4bb-4f09-4dfa-8db1-6bd6278b5178 |
| [31-readOnly-Shared-comments.jpg](screenshots/31-readOnly-Shared-comments.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=comments |
| [31-readOnly-Shared-events.jpg](screenshots/31-readOnly-Shared-events.jpg) | 390×844 | guestnetwork/87601b32-f211-4609-819f-6d0f4810b788?tab=events |
| [31-tag-relogin-recovered-job-success.jpg](screenshots/31-tag-relogin-recovered-job-success.jpg) | 1920×871 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-tag-unknown-after-refresh.jpg](screenshots/31-tag-unknown-after-refresh.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-tag-unknown-review-desktop.jpg](screenshots/31-tag-unknown-review-desktop.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-tag-write-503-input-preserved.jpg](screenshots/31-tag-write-503-input-preserved.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-tags-controlled-read-503.jpg](screenshots/31-tags-controlled-read-503.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-tags-read-retry-recovered.jpg](screenshots/31-tags-read-retry-recovered.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=events |
| [31-tags-ui-created-light-1280.jpg](screenshots/31-tags-ui-created-light-1280.jpg) | 1280×900 | guestnetwork/43c8f6f5-8893-4a1c-bfaa-a569acaf44bb?tab=comments |
| [31-vm-standard-detail-light-1280.jpg](screenshots/31-vm-standard-detail-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf |
| [31-vm-standard-list-light-1280.jpg](screenshots/31-vm-standard-list-light-1280.jpg) | 1280×900 | vm |
| [31-vm-standard-nic-dialog-light-1280.jpg](screenshots/31-vm-standard-nic-dialog-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-standard-nic-light-1280.jpg](screenshots/31-vm-standard-nic-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-admin-Isolated-comments-dark-1280.jpg](screenshots/32-admin-Isolated-comments-dark-1280.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-admin-Isolated-comments-dark-390.jpg](screenshots/32-admin-Isolated-comments-dark-390.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-admin-Isolated-comments-light-1280.jpg](screenshots/32-admin-Isolated-comments-light-1280.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-admin-Isolated-comments-light-390.jpg](screenshots/32-admin-Isolated-comments-light-390.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-admin-Isolated-comments-light-768.jpg](screenshots/32-admin-Isolated-comments-light-768.jpg) | 768×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-admin-Isolated-events-dark-1280.jpg](screenshots/32-admin-Isolated-events-dark-1280.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-admin-Isolated-events-dark-390.jpg](screenshots/32-admin-Isolated-events-dark-390.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711 |
| [32-admin-Isolated-events-light-1280.jpg](screenshots/32-admin-Isolated-events-light-1280.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-admin-Isolated-events-light-390.jpg](screenshots/32-admin-Isolated-events-light-390.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711 |
| [32-admin-Isolated-events-light-768.jpg](screenshots/32-admin-Isolated-events-light-768.jpg) | 768×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-admin-L2-comments-dark-1280.jpg](screenshots/32-admin-L2-comments-dark-1280.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-admin-L2-comments-dark-390.jpg](screenshots/32-admin-L2-comments-dark-390.jpg) | 390×844 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-admin-L2-comments-light-1280.jpg](screenshots/32-admin-L2-comments-light-1280.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-admin-L2-comments-light-390.jpg](screenshots/32-admin-L2-comments-light-390.jpg) | 390×844 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-admin-L2-events-dark-1280.jpg](screenshots/32-admin-L2-events-dark-1280.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=events |
| [32-admin-L2-events-dark-390.jpg](screenshots/32-admin-L2-events-dark-390.jpg) | 390×844 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=events |
| [32-admin-L2-events-light-1280.jpg](screenshots/32-admin-L2-events-light-1280.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=events |
| [32-admin-L2-events-light-390.jpg](screenshots/32-admin-L2-events-light-390.jpg) | 390×844 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=events |
| [32-admin-PublicIP-Isolated-comments-dark-390.jpg](screenshots/32-admin-PublicIP-Isolated-comments-dark-390.jpg) | 390×844 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-admin-PublicIP-Isolated-comments-light-1280.jpg](screenshots/32-admin-PublicIP-Isolated-comments-light-1280.jpg) | 1280×900 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-admin-PublicIP-Isolated-events-dark-390.jpg](screenshots/32-admin-PublicIP-Isolated-events-dark-390.jpg) | 390×844 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=events |
| [32-admin-PublicIP-Isolated-events-light-1280.jpg](screenshots/32-admin-PublicIP-Isolated-events-light-1280.jpg) | 1280×900 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=events |
| [32-admin-PublicIP-VPC-comments-dark-390.jpg](screenshots/32-admin-PublicIP-VPC-comments-dark-390.jpg) | 390×844 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012?tab=comments |
| [32-admin-PublicIP-VPC-comments-light-1280.jpg](screenshots/32-admin-PublicIP-VPC-comments-light-1280.jpg) | 1280×900 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012?tab=comments |
| [32-admin-PublicIP-VPC-events-dark-390.jpg](screenshots/32-admin-PublicIP-VPC-events-dark-390.jpg) | 390×844 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012?tab=events |
| [32-admin-PublicIP-VPC-events-light-1280.jpg](screenshots/32-admin-PublicIP-VPC-events-light-1280.jpg) | 1280×900 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012?tab=events |
| [32-admin-Shared-comments-dark-1280.jpg](screenshots/32-admin-Shared-comments-dark-1280.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-admin-Shared-comments-dark-390.jpg](screenshots/32-admin-Shared-comments-dark-390.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-admin-Shared-comments-light-1280.jpg](screenshots/32-admin-Shared-comments-light-1280.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-admin-Shared-comments-light-390.jpg](screenshots/32-admin-Shared-comments-light-390.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-admin-Shared-comments-light-768.jpg](screenshots/32-admin-Shared-comments-light-768.jpg) | 768×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-admin-Shared-events-dark-1280.jpg](screenshots/32-admin-Shared-events-dark-1280.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-admin-Shared-events-dark-390.jpg](screenshots/32-admin-Shared-events-dark-390.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd |
| [32-admin-Shared-events-light-1280.jpg](screenshots/32-admin-Shared-events-light-1280.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-admin-Shared-events-light-390.jpg](screenshots/32-admin-Shared-events-light-390.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd |
| [32-admin-Shared-events-light-768.jpg](screenshots/32-admin-Shared-events-light-768.jpg) | 768×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-child-denied-Isolated.jpg](screenshots/32-child-denied-Isolated.jpg) | 1920×871 | dashboard |
| [32-child-denied-L2.jpg](screenshots/32-child-denied-L2.jpg) | 1920×871 | dashboard |
| [32-child-denied-PublicIP-Isolated.jpg](screenshots/32-child-denied-PublicIP-Isolated.jpg) | 1920×871 | dashboard |
| [32-child-denied-PublicIP-VPC.jpg](screenshots/32-child-denied-PublicIP-VPC.jpg) | 1920×871 | dashboard |
| [32-child-denied-Shared.jpg](screenshots/32-child-denied-Shared.jpg) | 1920×871 | dashboard |
| [32-comment-write-503-input-preserved.jpg](screenshots/32-comment-write-503-input-preserved.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-comment-write-retry-success.jpg](screenshots/32-comment-write-retry-success.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-comments-controlled-read-503.jpg](screenshots/32-comments-controlled-read-503.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-comments-read-retry-recovered.jpg](screenshots/32-comments-read-retry-recovered.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-domainAdmin-Isolated-comments.jpg](screenshots/32-domainAdmin-Isolated-comments.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-domainAdmin-Isolated-events.jpg](screenshots/32-domainAdmin-Isolated-events.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-domainAdmin-L2-comments.jpg](screenshots/32-domainAdmin-L2-comments.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-domainAdmin-PublicIP-Isolated-comments.jpg](screenshots/32-domainAdmin-PublicIP-Isolated-comments.jpg) | 1280×900 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-domainAdmin-PublicIP-VPC-comments.jpg](screenshots/32-domainAdmin-PublicIP-VPC-comments.jpg) | 1280×900 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012 |
| [32-domainAdmin-Shared-comments.jpg](screenshots/32-domainAdmin-Shared-comments.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-domainAdmin-Shared-events.jpg](screenshots/32-domainAdmin-Shared-events.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-events-controlled-read-503.jpg](screenshots/32-events-controlled-read-503.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-events-read-retry-recovered.jpg](screenshots/32-events-read-retry-recovered.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-final-review-network.jpg](screenshots/32-final-review-network.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-offering-clone-before-submit.jpg](screenshots/32-offering-clone-before-submit.jpg) | 1920×871 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711 |
| [32-offering-clone-completed.jpg](screenshots/32-offering-clone-completed.jpg) | 1920×871 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711 |
| [32-owner-Isolated-comments.jpg](screenshots/32-owner-Isolated-comments.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-owner-Isolated-events.jpg](screenshots/32-owner-Isolated-events.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-owner-L2-comments.jpg](screenshots/32-owner-L2-comments.jpg) | 1280×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-owner-project-default-return.jpg](screenshots/32-owner-project-default-return.jpg) | 1280×900 | dashboard |
| [32-owner-project-roundtrip-restored.jpg](screenshots/32-owner-project-roundtrip-restored.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-owner-PublicIP-Isolated-comments.jpg](screenshots/32-owner-PublicIP-Isolated-comments.jpg) | 1280×900 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-owner-PublicIP-VPC-comments.jpg](screenshots/32-owner-PublicIP-VPC-comments.jpg) | 1280×900 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012 |
| [32-owner-Shared-comments.jpg](screenshots/32-owner-Shared-comments.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-owner-Shared-events.jpg](screenshots/32-owner-Shared-events.jpg) | 1280×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-peer-Isolated-comments.jpg](screenshots/32-peer-Isolated-comments.jpg) | 768×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-peer-Isolated-events.jpg](screenshots/32-peer-Isolated-events.jpg) | 768×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-peer-L2-comments.jpg](screenshots/32-peer-L2-comments.jpg) | 768×900 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-peer-PublicIP-Isolated-comments.jpg](screenshots/32-peer-PublicIP-Isolated-comments.jpg) | 768×900 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-peer-PublicIP-VPC-comments.jpg](screenshots/32-peer-PublicIP-VPC-comments.jpg) | 768×900 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012 |
| [32-peer-Shared-comments.jpg](screenshots/32-peer-Shared-comments.jpg) | 768×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-peer-Shared-events.jpg](screenshots/32-peer-Shared-events.jpg) | 768×900 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-readOnly-Isolated-comments.jpg](screenshots/32-readOnly-Isolated-comments.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-readOnly-Isolated-events.jpg](screenshots/32-readOnly-Isolated-events.jpg) | 390×844 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-readOnly-L2-comments.jpg](screenshots/32-readOnly-L2-comments.jpg) | 390×844 | guestnetwork/29acfe58-8d90-46f2-906e-ba69311d9e7c?tab=comments |
| [32-readOnly-PublicIP-Isolated-comments.jpg](screenshots/32-readOnly-PublicIP-Isolated-comments.jpg) | 390×844 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=comments |
| [32-readOnly-PublicIP-VPC-comments.jpg](screenshots/32-readOnly-PublicIP-VPC-comments.jpg) | 390×844 | publicip/eb9043d0-adaa-4711-ac89-463c5e8fd012 |
| [32-readOnly-Shared-comments.jpg](screenshots/32-readOnly-Shared-comments.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=comments |
| [32-readOnly-Shared-events.jpg](screenshots/32-readOnly-Shared-events.jpg) | 390×844 | guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd?tab=events |
| [32-tag-relogin-recovered-job-success.jpg](screenshots/32-tag-relogin-recovered-job-success.jpg) | 1920×871 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-tag-unknown-after-refresh.jpg](screenshots/32-tag-unknown-after-refresh.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-tag-unknown-review-desktop.jpg](screenshots/32-tag-unknown-review-desktop.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-tag-write-503-input-preserved.jpg](screenshots/32-tag-write-503-input-preserved.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=comments |
| [32-tags-controlled-read-503.jpg](screenshots/32-tags-controlled-read-503.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
| [32-tags-read-retry-recovered.jpg](screenshots/32-tags-read-retry-recovered.jpg) | 1280×900 | guestnetwork/b7cd0439-ed95-4e7d-8b31-eb0ebacbd711?tab=events |
