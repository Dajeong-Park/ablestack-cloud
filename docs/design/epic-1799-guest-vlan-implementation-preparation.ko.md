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

# Epic #1799 게스트 VLAN 구현 준비

2026-11-22 KST 기준 upstream Europa \`c8b146634122d297dc32a004c3f905d9f2cb1f58\`에서 작업 브랜치 \`dhslove/epic-1799-guest-vlan\`를 분기했다. 이 문서는 게스트 VLAN 화면의 구현 순서와 31·32 검증 기준을 기록한다. [Epic #1799](https://github.com/ablecloud-team/ablestack-cloud/issues/1799)

## 하위 이슈 구현 순서

프로젝트 네트워크 링크와 VPC 정보 표시 [#1800](https://github.com/ablecloud-team/ablestack-cloud/issues/1800), [#1801](https://github.com/ablecloud-team/ablestack-cloud/issues/1801)를 먼저 수정하고 양쪽에서 화면 진입을 확인한다. #1800에서 정리한 연결 링크의 문맥 규칙을 #1801에서 참고한다. #1802의 필터 계약을 확정한 뒤 #1803의 목록 복귀에 적용한다. 이어서 탭 오류 처리, VM 화면 표준, 전용 범위 진입과 관련 창을 검증한다.

| 단계 | 하위 이슈 | 31·32 완료 기준 |
| --- | --- | --- |
| 1 | [#1800](https://github.com/ablecloud-team/ablestack-cloud/issues/1800) 게스트 VLAN 목록에서 프로젝트 네트워크 상세 링크 복구 | 프로젝트 소속 및 일반 계정 소속 연결망을 각각 목록과 탭에서 열고, 대상 네트워크 UUID와 프로젝트 식별자가 일치하는지 확인한다. |
| 2 | [#1801](https://github.com/ablecloud-team/ablestack-cloud/issues/1801) 게스트 VLAN 연결 탭에 VPC 이름과 상세 링크 표시 | 31번 VLAN 169와 32번 VLAN 113의 VPC 계층에서 이름과 상세 경로를 검증한다. 독립 네트워크도 함께 확인한다. |
| 3 | [#1802](https://github.com/ablecloud-team/ablestack-cloud/issues/1802) 게스트 VLAN 고급 검색에 물리망·정확 VLAN/VNI 필터 추가 | Zone·물리망·정확 VLAN과 기존 부분 검색 및 할당을 조합하고, API 요청과 총건수·페이지·초기화를 대조한다. |
| 4 | [#1803](https://github.com/ablecloud-team/ablestack-cloud/issues/1803) 게스트 VLAN 상세에서 목록으로 돌아올 때 조회 상태 복원 | 키워드와 필터·페이지 크기를 설정한 목록에서 VLAN 상세로 이동해 복귀한 뒤 URL·표·요청이 동일한지 확인한다. |
| 5 | [#1804](https://github.com/ablecloud-team/ablestack-cloud/issues/1804) 게스트 VLAN 연결 탭의 빈 응답과 갱신 실패·재시도 처리 | 정상, 0건, 초기 실패, 갱신 실패, 재시도와 상세 전환을 두 클러스터에서 검증한다. |
| 6 | [#1805](https://github.com/ablecloud-team/ablestack-cloud/issues/1805) 게스트 VLAN 목록·상세·연결 탭에 가상머신 UI 표준 적용 | 31·32에서 라이트·다크 × 390·768·1280px로 VM과 비교하고 키보드 탐색·스크롤을 확인한다. |
| 7 | [#1806](https://github.com/ablecloud-team/ablestack-cloud/issues/1806) 게스트 VLAN에서 전용 범위 관리 연결과 대화상자 표준화 | 양쪽에서 물리망별 진입과 할당 대화상자 열기·취소를 검증한다. 쓰기 검증이 필요하면 가용한 별도 시험 범위만 사용한다. |

### 31·32 공통 검증 기준

- 31번(GFS2)과 32번(RBD) Mold 관리자 UI에서 각각 확인한다. UI 동작을 먼저 실행하고 브라우저 요청, API 응답, 실제 진입한 상세를 대조한다.
- 프로젝트 링크 기준은 31번 VLAN 152와 32번 VLAN 104다. VPC 열 기준은 31번 VLAN 169와 32번 VLAN 113이다. 시험 자원이 바뀌면 같은 유형의 자원으로 교체하고 근거를 기록한다.
- 최초 전체·할당 건수는 31번 84·23건, 32번 131·14건이다. 재검증 시점의 API 결과를 기준으로 화면의 총건수와 페이지, 빈 결과를 확인한다.
- 0건·503은 해당 탭의 브라우저 응답만 통제한다. 성공 응답으로 재시도, 탭 전환과 마지막 성공 데이터 표시도 확인한다. 실환경 결과와 통제 응답 결과를 구분한다.
- VM 표준은 컴퓨트 → 가상머신의 breadcrumb, 필터와 버튼 배치, 요약·상세, 탭 본문, 공통 대화상자다. 각 클러스터에서 라이트·다크 × 390·768·1280px 및 키보드 동작을 확인한다.
- 전용 범위의 기존 데이터와 권한을 기준으로 검증한다. 32번은 최초 전용 범위가 0건이다. 작업 검증에 필요한 경우에만 가용 시험 범위를 선택하고 종료 시 정리와 기존 범위 보존을 확인한다.
- 변경 파일 lint·집중 테스트·UI 빌드와 실환경 결과를 따로 기록한다. 서버를 변경하는 경우 WSL ext4에서 변경 Maven 모듈만 빌드한다. 통합 검증에서 게스트 네트워크 통신·PVLAN 격리·trunk는 기존 검증 결과를 참조한다.
