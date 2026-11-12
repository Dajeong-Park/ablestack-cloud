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

# 원본 캡처·검증 무결성

JPEG 원본 210장. 연결 증거 174장, 배치 통과 제외 36장. 모두 서명/디코딩을 확인했고 연결된 live viewport의 치수 불일치0이다. 요약 영역만 보인 구형 Shared 탭 사진과 일부 helper reset 뒤 live 기록이 맞지 않는 사진36장은 그대로 보관하며 검증 통과에 사용하지 않는다.

Shared36개 새 verified-* 프레임은 실제 탭 본문을 viewport 안에 두고 촬영했다. VM NIC/연결창24조합, 장문/원복, 실패530·531·NIC false 활성과 프로젝트/스크롤/새 라우터의 사진을 구분한다. API/DB/실제 패킷 결과는 사진만으로 대체하지 않는다.

[전체 해시/live viewport/제외 이유 JSON](evidence/capture-audit.json).

| 사진 | 디코딩 치수 | 테마 | 프레임 | 판정 |
| --- | --- | --- | --- | --- |
| [31-breadcrumb-initial-scrolled.jpg](screenshots/31-breadcrumb-initial-scrolled.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-breadcrumb-reload-scrolled.jpg](screenshots/31-breadcrumb-reload-scrolled.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-comment-crud-no-residual.jpg](screenshots/31-comment-crud-no-residual.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-comment-literal-ui-created.jpg](screenshots/31-comment-literal-ui-created.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-comments503-draft-and-list-retained.jpg](screenshots/31-comments503-draft-and-list-retained.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-event-read503-list-retained.jpg](screenshots/31-event-read503-list-retained.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-events-search-recovered.jpg](screenshots/31-events-search-recovered.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-failed-addnic-stale-row-filtered.jpg](screenshots/31-failed-addnic-stale-row-filtered.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-failed-addnic-stale-row.jpg](screenshots/31-failed-addnic-stale-row.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-failed-addnic-state-column.jpg](screenshots/31-failed-addnic-state-column.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-final-native-review.jpg](screenshots/31-final-native-review.jpg) | 1680×841 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-final-review-router.jpg](screenshots/31-final-review-router.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-0.jpg](screenshots/31-Isolated-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-1.jpg](screenshots/31-Isolated-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-2.jpg](screenshots/31-Isolated-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-3.jpg](screenshots/31-Isolated-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-4.jpg](screenshots/31-Isolated-tab-4.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-5.jpg](screenshots/31-Isolated-tab-5.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Isolated-tab-6.jpg](screenshots/31-Isolated-tab-6.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-L2-tab-0.jpg](screenshots/31-L2-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-L2-tab-1.jpg](screenshots/31-L2-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-L2-tab-2.jpg](screenshots/31-L2-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-L2-tab-3.jpg](screenshots/31-L2-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-livepatch-completed.jpg](screenshots/31-livepatch-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-livepatch-confirm.jpg](screenshots/31-livepatch-confirm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-long-name-1280.jpg](screenshots/31-long-name-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-long-name-390.jpg](screenshots/31-long-name-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-long-name-768.jpg](screenshots/31-long-name-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-long-name-job-status-unconfirmed.jpg](screenshots/31-long-name-job-status-unconfirmed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-long-name-update-draft.jpg](screenshots/31-long-name-update-draft.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-member-shared-ip-failure.jpg](screenshots/31-member-shared-ip-failure.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-normal-restart-completed.jpg](screenshots/31-normal-restart-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-owner-shared-ip.jpg](screenshots/31-owner-shared-ip.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-owner-shared-supported-tabs.jpg](screenshots/31-owner-shared-supported-tabs.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-project-default.jpg](screenshots/31-project-default.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-project-return.jpg](screenshots/31-project-return.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-range-create-input.jpg](screenshots/31-range-create-input.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-range-crud-complete-retained-review.jpg](screenshots/31-range-crud-complete-retained-review.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-range-duplicate-failure-input-preserved.jpg](screenshots/31-range-duplicate-failure-input-preserved.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-range-duplicate-recovered.jpg](screenshots/31-range-duplicate-recovered.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-range-updated.jpg](screenshots/31-range-updated.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-readonly-shared-detail.jpg](screenshots/31-readonly-shared-detail.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-readonly-shared-ip.jpg](screenshots/31-readonly-shared-ip.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-recreate-completed.jpg](screenshots/31-recreate-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-recreate-confirm.jpg](screenshots/31-recreate-confirm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-recreated-router-tab.jpg](screenshots/31-recreated-router-tab.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-review-new-router-final.jpg](screenshots/31-review-new-router-final.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-shared-before-systemvm.jpg](screenshots/31-shared-before-systemvm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-shared-IP 주소-dark-1280.jpg](screenshots/31-shared-IP%20주소-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-IP 주소-dark-390.jpg](screenshots/31-shared-IP%20주소-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-IP 주소-dark-768.jpg](screenshots/31-shared-IP%20주소-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-IP 주소-light-1280.jpg](screenshots/31-shared-IP%20주소-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-IP 주소-light-390.jpg](screenshots/31-shared-IP%20주소-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-IP 주소-light-768.jpg](screenshots/31-shared-IP%20주소-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-Shared-tab-0.jpg](screenshots/31-Shared-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-1.jpg](screenshots/31-Shared-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-2.jpg](screenshots/31-Shared-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-3.jpg](screenshots/31-Shared-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-4.jpg](screenshots/31-Shared-tab-4.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-5.jpg](screenshots/31-Shared-tab-5.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-6.jpg](screenshots/31-Shared-tab-6.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-Shared-tab-7.jpg](screenshots/31-Shared-tab-7.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-shared-가상 라우터-dark-1280.jpg](screenshots/31-shared-가상%20라우터-dark-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-가상 라우터-dark-390.jpg](screenshots/31-shared-가상%20라우터-dark-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-가상 라우터-dark-768.jpg](screenshots/31-shared-가상%20라우터-dark-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-가상 라우터-light-1280.jpg](screenshots/31-shared-가상%20라우터-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-가상 라우터-light-390.jpg](screenshots/31-shared-가상%20라우터-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-가상 라우터-light-768.jpg](screenshots/31-shared-가상%20라우터-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-dark-1280.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-dark-390.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-dark-768.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-light-1280.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-light-390.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-shared-게스트 IP 주소 범위-light-768.jpg](screenshots/31-shared-게스트%20IP%20주소%20범위-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [31-ui-tag-created-literal.jpg](screenshots/31-ui-tag-created-literal.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-verified-IP 주소-dark-1280.jpg](screenshots/31-verified-IP%20주소-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-IP 주소-dark-390.jpg](screenshots/31-verified-IP%20주소-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-IP 주소-dark-768.jpg](screenshots/31-verified-IP%20주소-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-IP 주소-light-1280.jpg](screenshots/31-verified-IP%20주소-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-IP 주소-light-390.jpg](screenshots/31-verified-IP%20주소-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-IP 주소-light-768.jpg](screenshots/31-verified-IP%20주소-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-dark-1280.jpg](screenshots/31-verified-가상%20라우터-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-dark-390.jpg](screenshots/31-verified-가상%20라우터-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-dark-768.jpg](screenshots/31-verified-가상%20라우터-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-light-1280.jpg](screenshots/31-verified-가상%20라우터-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-light-390.jpg](screenshots/31-verified-가상%20라우터-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-가상 라우터-light-768.jpg](screenshots/31-verified-가상%20라우터-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-dark-1280.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-dark-390.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-dark-768.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-light-1280.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-light-390.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [31-verified-게스트 IP 주소 범위-light-768.jpg](screenshots/31-verified-게스트%20IP%20주소%20범위-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [31-vm-connect-dark-1280.jpg](screenshots/31-vm-connect-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-connect-dark-390.jpg](screenshots/31-vm-connect-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-connect-dark-768.jpg](screenshots/31-vm-connect-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-connect-light-1280.jpg](screenshots/31-vm-connect-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 사용 |
| [31-vm-connect-light-390.jpg](screenshots/31-vm-connect-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 사용 |
| [31-vm-connect-light-768.jpg](screenshots/31-vm-connect-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-dark-1280.jpg](screenshots/31-vm-nic-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-dark-390.jpg](screenshots/31-vm-nic-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-dark-768.jpg](screenshots/31-vm-nic-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-light-1280.jpg](screenshots/31-vm-nic-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-light-390.jpg](screenshots/31-vm-nic-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 사용 |
| [31-vm-nic-light-768.jpg](screenshots/31-vm-nic-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-breadcrumb-initial-scrolled.jpg](screenshots/32-breadcrumb-initial-scrolled.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-breadcrumb-reload-scrolled.jpg](screenshots/32-breadcrumb-reload-scrolled.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-comment-adminonly-ui.jpg](screenshots/32-comment-adminonly-ui.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-comment-crud-no-residual.jpg](screenshots/32-comment-crud-no-residual.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-comment-literal-ui-created.jpg](screenshots/32-comment-literal-ui-created.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-comments503-draft-and-list-retained.jpg](screenshots/32-comments503-draft-and-list-retained.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-control-name-restored.jpg](screenshots/32-control-name-restored.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-event-read503-list-retained.jpg](screenshots/32-event-read503-list-retained.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-final-native-review.jpg](screenshots/32-final-native-review.jpg) | 1680×841 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-final-review-router.jpg](screenshots/32-final-review-router.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-0.jpg](screenshots/32-Isolated-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-1.jpg](screenshots/32-Isolated-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-2.jpg](screenshots/32-Isolated-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-3.jpg](screenshots/32-Isolated-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-4.jpg](screenshots/32-Isolated-tab-4.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-5.jpg](screenshots/32-Isolated-tab-5.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Isolated-tab-6.jpg](screenshots/32-Isolated-tab-6.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-L2-tab-0.jpg](screenshots/32-L2-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-L2-tab-1.jpg](screenshots/32-L2-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-L2-tab-2.jpg](screenshots/32-L2-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-L2-tab-3.jpg](screenshots/32-L2-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-livepatch-completed.jpg](screenshots/32-livepatch-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-livepatch-confirm.jpg](screenshots/32-livepatch-confirm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-long-name-1280.jpg](screenshots/32-long-name-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-long-name-390.jpg](screenshots/32-long-name-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-long-name-768.jpg](screenshots/32-long-name-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-long-name-update-draft.jpg](screenshots/32-long-name-update-draft.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-mac-cidr-test-network.jpg](screenshots/32-mac-cidr-test-network.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-member-shared-ip-failure.jpg](screenshots/32-member-shared-ip-failure.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-normal-restart-completed.jpg](screenshots/32-normal-restart-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-owner-shared-ip.jpg](screenshots/32-owner-shared-ip.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-project-default.jpg](screenshots/32-project-default.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-project-return.jpg](screenshots/32-project-return.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-range-create-input.jpg](screenshots/32-range-create-input.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-range-crud-complete-retained-review.jpg](screenshots/32-range-crud-complete-retained-review.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-range-duplicate-failure-input-preserved.jpg](screenshots/32-range-duplicate-failure-input-preserved.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-range-duplicate-recovered.jpg](screenshots/32-range-duplicate-recovered.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-range-updated.jpg](screenshots/32-range-updated.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-readonly-shared-detail.jpg](screenshots/32-readonly-shared-detail.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-readonly-shared-ip-failed-confirmed.jpg](screenshots/32-readonly-shared-ip-failed-confirmed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-readonly-shared-ip.jpg](screenshots/32-readonly-shared-ip.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-recreate-completed.jpg](screenshots/32-recreate-completed.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-recreate-confirm.jpg](screenshots/32-recreate-confirm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-recreated-router-tab.jpg](screenshots/32-recreated-router-tab.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-review-new-router-final.jpg](screenshots/32-review-new-router-final.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-second-subnet-schema530-input-preserved.jpg](screenshots/32-second-subnet-schema530-input-preserved.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-shared-before-systemvm.jpg](screenshots/32-shared-before-systemvm.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-shared-IP 주소-dark-1280.jpg](screenshots/32-shared-IP%20주소-dark-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-IP 주소-dark-390.jpg](screenshots/32-shared-IP%20주소-dark-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-IP 주소-dark-768.jpg](screenshots/32-shared-IP%20주소-dark-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-IP 주소-light-1280.jpg](screenshots/32-shared-IP%20주소-light-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-IP 주소-light-390.jpg](screenshots/32-shared-IP%20주소-light-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-IP 주소-light-768.jpg](screenshots/32-shared-IP%20주소-light-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-Shared-tab-0.jpg](screenshots/32-Shared-tab-0.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-1.jpg](screenshots/32-Shared-tab-1.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-2.jpg](screenshots/32-Shared-tab-2.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-3.jpg](screenshots/32-Shared-tab-3.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-4.jpg](screenshots/32-Shared-tab-4.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-5.jpg](screenshots/32-Shared-tab-5.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-6.jpg](screenshots/32-Shared-tab-6.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-Shared-tab-7.jpg](screenshots/32-Shared-tab-7.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-shared-가상 라우터-dark-1280.jpg](screenshots/32-shared-가상%20라우터-dark-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-가상 라우터-dark-390.jpg](screenshots/32-shared-가상%20라우터-dark-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-가상 라우터-dark-768.jpg](screenshots/32-shared-가상%20라우터-dark-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-가상 라우터-light-1280.jpg](screenshots/32-shared-가상%20라우터-light-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-가상 라우터-light-390.jpg](screenshots/32-shared-가상%20라우터-light-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-가상 라우터-light-768.jpg](screenshots/32-shared-가상%20라우터-light-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-dark-1280.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-dark-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-dark-390.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-dark-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-dark-768.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-dark-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-light-1280.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-light-1280.jpg) | 1280×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-light-390.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-light-390.jpg) | 390×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-shared-게스트 IP 주소 범위-light-768.jpg](screenshots/32-shared-게스트%20IP%20주소%20범위-light-768.jpg) | 768×900 | 기록 없음 | 기능/상태/진단 프레임 | 제외: Superseded summary-only tab framing; use verified-* tab-body captures. Some helper-session metadata was overwritten. |
| [32-ui-tag-created-literal.jpg](screenshots/32-ui-tag-created-literal.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-verified-IP 주소-dark-1280.jpg](screenshots/32-verified-IP%20주소-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-IP 주소-dark-390.jpg](screenshots/32-verified-IP%20주소-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-IP 주소-dark-768.jpg](screenshots/32-verified-IP%20주소-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-IP 주소-light-1280.jpg](screenshots/32-verified-IP%20주소-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-IP 주소-light-390.jpg](screenshots/32-verified-IP%20주소-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-IP 주소-light-768.jpg](screenshots/32-verified-IP%20주소-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-router-dark-390.jpg](screenshots/32-verified-router-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-verified-가상 라우터-dark-1280.jpg](screenshots/32-verified-가상%20라우터-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-가상 라우터-dark-390.jpg](screenshots/32-verified-가상%20라우터-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-가상 라우터-dark-768.jpg](screenshots/32-verified-가상%20라우터-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-가상 라우터-light-1280.jpg](screenshots/32-verified-가상%20라우터-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-가상 라우터-light-390.jpg](screenshots/32-verified-가상%20라우터-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-가상 라우터-light-768.jpg](screenshots/32-verified-가상%20라우터-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-dark-1280.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-dark-1280.jpg) | 1280×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-dark-390.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-dark-390.jpg) | 390×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-dark-768.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-dark-768.jpg) | 768×900 | dark | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-light-1280.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-light-1280.jpg) | 1280×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-light-390.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-light-390.jpg) | 390×900 | light | 본문 viewport 확인 | 사용 |
| [32-verified-게스트 IP 주소 범위-light-768.jpg](screenshots/32-verified-게스트%20IP%20주소%20범위-light-768.jpg) | 768×900 | light | 본문 viewport 확인 | 사용 |
| [32-vm-connect-dark-1280.jpg](screenshots/32-vm-connect-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-connect-dark-390.jpg](screenshots/32-vm-connect-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-connect-dark-768.jpg](screenshots/32-vm-connect-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-connect-light-1280.jpg](screenshots/32-vm-connect-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-vm-connect-light-390.jpg](screenshots/32-vm-connect-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-vm-connect-light-768.jpg](screenshots/32-vm-connect-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-dark-1280.jpg](screenshots/32-vm-nic-dark-1280.jpg) | 1280×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-dark-390.jpg](screenshots/32-vm-nic-dark-390.jpg) | 390×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-dark-768.jpg](screenshots/32-vm-nic-dark-768.jpg) | 768×900 | dark | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-light-1280.jpg](screenshots/32-vm-nic-light-1280.jpg) | 1280×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-light-390.jpg](screenshots/32-vm-nic-light-390.jpg) | 390×900 | light | 기능/상태/진단 프레임 | 사용 |
| [32-vm-nic-light-768.jpg](screenshots/32-vm-nic-light-768.jpg) | 768×900 | light | 기능/상태/진단 프레임 | 사용 |
