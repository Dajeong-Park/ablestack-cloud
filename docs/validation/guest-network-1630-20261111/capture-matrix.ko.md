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

# UI 변경·표준·캡처

원본 JPEG 72장. 실제 viewport/decoded image 크기가 일치하는 63장은 배치 근거로 사용한다. 나머지는 경과 기록이며 배치 합격 증거로 사용하지 않는다. `31-after-legacy-allocated.jpg`는 초기 로딩 프레임으로 제외한다. 전체 해시·제외 목록은 [capture-audit](evidence/capture-audit.json)에 있다.

## 실제 변경 UI

VM 상세 > NIC 탭만 변경했다. 할당 상태 태그와 NIC 사용 설정을 분리하고, 실패 할당/불명확 연결 경고와 변경 가드를 추가했다. 기존 VM 목록·요약/상세·탭 툴바·연결/해제 대화상자·breadcrumb·모바일 테마 표준을 유지하며 회귀 확인했다. 생성 및 연결·기존 네트워크 연결을 앞에, 아이콘+텍스트 업데이트를 뒤에 두는 기존 순서를 유지한다. 공통 레이아웃을 새로 설계하지 않았다.

| 목적 | 캡처 |
| --- | --- |
| 수정 전 ghost 활성 오표시 | [31-before-ghost-active.jpg](screenshots/31-before-ghost-active.jpg) |
| 수정 후 기존 실패 할당·경고 | [31-after-legacy-allocated-ready.jpg](screenshots/31-after-legacy-allocated-ready.jpg) |
| 31 실패 후 잔류 없음 | [31-capacity-failure-no-residue.jpg](screenshots/31-capacity-failure-no-residue.jpg) |
| 32 준비 실패 후 잔류 없음 | [32-preparation-failure-no-residue.jpg](screenshots/32-preparation-failure-no-residue.jpg) |
| 31 정상 복구 관리자 | [31-final-admin-nics.jpg](screenshots/31-final-admin-nics.jpg) |
| 32 정상 복구 관리자 | [32-final-admin-nics.jpg](screenshots/32-final-admin-nics.jpg) |
| 31 읽기 전용 | [31-readonly-nics.jpg](screenshots/31-readonly-nics.jpg) |
| 32 읽기 전용 | [32-readonly-nics.jpg](screenshots/32-readonly-nics.jpg) |

## 실제 반응형·즉시 테마 조합

[12조합 DOM/스크롤·대화상자 측정](evidence/ui-layout-cases.json) · [즉시 테마 timeOrigin](evidence/theme-switches.json) · [프로젝트/화면 이동](evidence/project-navigation.json) · [읽기 전용 버튼](evidence/role-ui-checks.json)

| 클러스터 | 테마 | 폭 | 할당 상태 중간 보기 | 대화상자 |
| --- | --- | --- | --- | --- |
| 31 | light | 1280 | [상태](screenshots/31-nic-light-1280-allocation.jpg) | [연결창](screenshots/31-attach-light-1280.jpg) |
| 31 | light | 768 | [상태](screenshots/31-nic-light-768-allocation.jpg) | [연결창](screenshots/31-attach-light-768.jpg) |
| 31 | light | 390 | [상태](screenshots/31-nic-light-390-allocation.jpg) | [연결창](screenshots/31-attach-light-390.jpg) |
| 31 | dark | 1280 | [상태](screenshots/31-nic-dark-1280-allocation.jpg) | [연결창](screenshots/31-attach-dark-1280.jpg) |
| 31 | dark | 768 | [상태](screenshots/31-nic-dark-768-allocation.jpg) | [연결창](screenshots/31-attach-dark-768.jpg) |
| 31 | dark | 390 | [상태](screenshots/31-nic-dark-390-allocation.jpg) | [연결창](screenshots/31-attach-dark-390.jpg) |
| 32 | light | 1280 | [상태](screenshots/32-nic-light-1280-allocation.jpg) | [연결창](screenshots/32-attach-light-1280.jpg) |
| 32 | light | 768 | [상태](screenshots/32-nic-light-768-allocation.jpg) | [연결창](screenshots/32-attach-light-768.jpg) |
| 32 | light | 390 | [상태](screenshots/32-nic-light-390-allocation.jpg) | [연결창](screenshots/32-attach-light-390.jpg) |
| 32 | dark | 1280 | [상태](screenshots/32-nic-dark-1280-allocation.jpg) | [연결창](screenshots/32-attach-dark-1280.jpg) |
| 32 | dark | 768 | [상태](screenshots/32-nic-dark-768-allocation.jpg) | [연결창](screenshots/32-attach-dark-768.jpg) |
| 32 | dark | 390 | [상태](screenshots/32-nic-dark-390-allocation.jpg) | [연결창](screenshots/32-attach-dark-390.jpg) |

모바일은 table 내부 수평 스크롤로 열을 확인하고 고정 작업 열을 유지한다. 좌·우·중간 할당 상태 화면을 각각 저장했다. 단순 DOM에 값이 존재하는 것만으로 가독성 통과를 판정하지 않았다. 마지막 관리자 화면은1680×841로 원복했다.
