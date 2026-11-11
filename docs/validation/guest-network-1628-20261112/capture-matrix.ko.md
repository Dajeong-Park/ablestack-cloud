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

# UI 표준·캡처 근거

원본 JPEG 104장, 실제 viewport와 decoded image의 크기 일치. 초기 목록 갱신 중3프레임은 경과 기록으로 보존하고 배치 근거에서 제외했다. [전체 해시·분류](evidence/capture-audit.json).

## UI 변경 범위와 표준

UI 소스·스타일 변경은0이다. 기존 VM 목록·상세·NIC 탭·연결창·breadcrumb·모바일/다크 테마를 그대로 유지했다. 사용자가 보는 개선은 Shared 두 번째 서브넷 생성530과 재시작 실패가 해소되어 기존 UI에서 끝까지 완료되는 것이다. 범위 탭의 아이콘+텍스트 업데이트·의미별 IPv4 입력 그룹·실패 후 오류/입력 보존을 확인했다.

| 확인 | 캡처 |
| --- | --- |
| 31 최종 추가 서브넷 | [31-final-admin-ranges.jpg](screenshots/31-final-admin-ranges.jpg) |
| 31 실제 NIC 연결 | [31-second-subnet-nic-connected.jpg](screenshots/31-second-subnet-nic-connected.jpg) |
| 31 VM 목록·breadcrumb | [31-vm-list-standard.jpg](screenshots/31-vm-list-standard.jpg) |
| 31 읽기 전용 쓰기 버튼0 | [31-readonly-nics.jpg](screenshots/31-readonly-nics.jpg) |
| 31 IP 탭 두 번째 서브넷 VM 링크 | [31-ip-tab-second-subnet.jpg](screenshots/31-ip-tab-second-subnet.jpg) |
| 31 중복 입력 보존 | [31-duplicate-range-input-preserved.jpg](screenshots/31-duplicate-range-input-preserved.jpg) |
| 31 역순 입력 보존 | [31-invalid-order-preserved.jpg](screenshots/31-invalid-order-preserved.jpg) |
| 31 미사용 두 번째 서브넷 삭제 | [31-second-subnet-deleted-stable.jpg](screenshots/31-second-subnet-deleted-stable.jpg) |
| 32 최종 추가 서브넷 | [32-final-admin-ranges.jpg](screenshots/32-final-admin-ranges.jpg) |
| 32 실제 NIC 연결 | [32-second-subnet-nic-connected.jpg](screenshots/32-second-subnet-nic-connected.jpg) |
| 32 VM 목록·breadcrumb | [32-vm-list-standard.jpg](screenshots/32-vm-list-standard.jpg) |
| 32 읽기 전용 쓰기 버튼0 | [32-readonly-nics.jpg](screenshots/32-readonly-nics.jpg) |
| 32 IP 탭 두 번째 서브넷 VM 링크 | [32-ip-tab-second-subnet.jpg](screenshots/32-ip-tab-second-subnet.jpg) |
| 32 중복 입력 보존 | [32-duplicate-range-input-preserved.jpg](screenshots/32-duplicate-range-input-preserved.jpg) |
| 32 역순 입력 보존 | [32-invalid-order-preserved.jpg](screenshots/32-invalid-order-preserved.jpg) |
| 32 미사용 두 번째 서브넷 삭제 | [32-second-subnet-deleted-stable.jpg](screenshots/32-second-subnet-deleted-stable.jpg) |

[수정 전32 SQL530·입력 보존](screenshots/32-before-schema530-input-preserved.jpg) · [24조합 측정](evidence/ui-layout-cases.json) · [범위 측정](evidence/range-layout-cases.json) · [프로젝트/화면 이동](evidence/navigation-cases.json) · [즉시 테마](evidence/theme-switches.json) · [관리자 최종 문맥](evidence/final-ui-context.json).

## 반응형·테마 조합

| 사이트 | 테마 | 폭 | VM NIC 할당 상태 | NIC 연결창 | Shared 범위 | 범위 입력창 |
| --- | --- | --- | --- | --- | --- | --- |
| 31 | light | 1280 | [상태](screenshots/31-nic-light-1280-allocation.jpg) | [연결창](screenshots/31-attach-light-1280.jpg) | [범위](screenshots/31-ranges-light-1280.jpg) | [입력창](screenshots/31-range-dialog-light-1280.jpg) |
| 31 | light | 768 | [상태](screenshots/31-nic-light-768-allocation.jpg) | [연결창](screenshots/31-attach-light-768.jpg) | [범위](screenshots/31-ranges-light-768.jpg) | [입력창](screenshots/31-range-dialog-light-768.jpg) |
| 31 | light | 390 | [상태](screenshots/31-nic-light-390-allocation.jpg) | [연결창](screenshots/31-attach-light-390.jpg) | [범위](screenshots/31-ranges-light-390.jpg) | [입력창](screenshots/31-range-dialog-light-390.jpg) |
| 31 | dark | 1280 | [상태](screenshots/31-nic-dark-1280-allocation.jpg) | [연결창](screenshots/31-attach-dark-1280.jpg) | [범위](screenshots/31-ranges-dark-1280.jpg) | [입력창](screenshots/31-range-dialog-dark-1280.jpg) |
| 31 | dark | 768 | [상태](screenshots/31-nic-dark-768-allocation.jpg) | [연결창](screenshots/31-attach-dark-768.jpg) | [범위](screenshots/31-ranges-dark-768.jpg) | [입력창](screenshots/31-range-dialog-dark-768.jpg) |
| 31 | dark | 390 | [상태](screenshots/31-nic-dark-390-allocation.jpg) | [연결창](screenshots/31-attach-dark-390.jpg) | [범위](screenshots/31-ranges-dark-390.jpg) | [입력창](screenshots/31-range-dialog-dark-390.jpg) |
| 32 | light | 1280 | [상태](screenshots/32-nic-light-1280-allocation.jpg) | [연결창](screenshots/32-attach-light-1280.jpg) | [범위](screenshots/32-ranges-light-1280.jpg) | [입력창](screenshots/32-range-dialog-light-1280.jpg) |
| 32 | light | 768 | [상태](screenshots/32-nic-light-768-allocation.jpg) | [연결창](screenshots/32-attach-light-768.jpg) | [범위](screenshots/32-ranges-light-768.jpg) | [입력창](screenshots/32-range-dialog-light-768.jpg) |
| 32 | light | 390 | [상태](screenshots/32-nic-light-390-allocation.jpg) | [연결창](screenshots/32-attach-light-390.jpg) | [범위](screenshots/32-ranges-light-390.jpg) | [입력창](screenshots/32-range-dialog-light-390.jpg) |
| 32 | dark | 1280 | [상태](screenshots/32-nic-dark-1280-allocation.jpg) | [연결창](screenshots/32-attach-dark-1280.jpg) | [범위](screenshots/32-ranges-dark-1280.jpg) | [입력창](screenshots/32-range-dialog-dark-1280.jpg) |
| 32 | dark | 768 | [상태](screenshots/32-nic-dark-768-allocation.jpg) | [연결창](screenshots/32-attach-dark-768.jpg) | [범위](screenshots/32-ranges-dark-768.jpg) | [입력창](screenshots/32-range-dialog-dark-768.jpg) |
| 32 | dark | 390 | [상태](screenshots/32-nic-dark-390-allocation.jpg) | [연결창](screenshots/32-attach-dark-390.jpg) | [범위](screenshots/32-ranges-dark-390.jpg) | [입력창](screenshots/32-range-dialog-dark-390.jpg) |

VM NIC는 실제 수평 스크롤 좌/중/우에서 상태·작업 도달을 확인했다. 범위/입력창은3행·4입력과 viewport 경계를 대조했다. 즉시 테마 전환은 같은 document timeOrigin을 유지했다. 최종 창은 임시 viewport override를 해제해 관리자 검토 화면으로 복원했다.
