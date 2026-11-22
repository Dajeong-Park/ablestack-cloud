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

# DNS 서버 Epic #1846 작업 및 검증 계획

Mold 네트워크 > DNS 서버의 삭제 정합성, 상태 관리, 목록과 대화상자를 개선한다.

## 구현 순서와 31·32 클러스터 검증 기준

삭제 결과와 데이터 정합성 #1847, 비활성 서버 복구 #1848를 최우선으로 구현한다. #1849에서 확정된 삭제 결과를 대화상자에 연결한다. 다음으로 목록 복원, 입력 검증, 공급자 조회 복구를 구현하고 공통 UI 배치를 적용한다.

| 순서 | 하위 이슈 | 합격 기준 | 31번(GFS2)·32번(RBD) 검증 |
| --- | --- | --- | --- |
| 1 · 최우선 | [#1847 삭제 정합성](https://github.com/ablecloud-team/ablestack-cloud/issues/1847) | 연결 영역이 있는 정리 끔 요청을 차단한다. 제공자 정리 실패 시 서버와 남은 연결을 보존하고 완료 여부를 작업 결과와 맞춘다. | 실제 시험 서버에서 정리 끔·정상 정리·관리 해제·제공자 장애와 일부 처리 실패 및 재시도를 확인한다. Mold의 등록·영역 상태와 PowerDNS의 영역·레코드를 대조한다. |
| 2 · 최우선 | [#1848 비활성 서버 복구](https://github.com/ablecloud-team/ablestack-cloud/issues/1848) | 관리 목록·ID 상세에서 비활성 서버와 상태를 표시하고 UI에서 활성 상태로 복구할 수 있다. | 실제 서버를 UI에서 비활성화한 뒤 목록·직접 주소·새로고침·UI 재활성화를 검증한다. 기존 활성 공급자 선택과 권한 제한을 확인한다. |
| 3 | [#1849 삭제 영향과 작업 결과](https://github.com/ablecloud-team/ablestack-cloud/issues/1849) | 영향을 확인한 뒤 삭제할 수 있으며 최종 결과가 나올 때까지 입력과 선택을 유지한다. | 실제 연결 건수·옵션을 대조한다. 지연·503·5건 초과 영향, 작업 대기·실패·결과 미확인과 기존 작업 ID 재조회는 모의 응답으로 확인한다. |
| 4 | [#1850 공급자 필터와 목록 복귀](https://github.com/ablecloud-team/ablestack-cloud/issues/1850) | 공급자·검색어·페이지가 API와 URL에 일치하며 상세 경유 뒤에 복구된다. | 실제 PowerDNS 필터 및 관련 DNS 영역 이동의 서버 ID를 대조한다. 복수 페이지, 초기화, 상세 뒤로 가기와 새로고침을 확인한다. |
| 5 | [#1851 네임서버 입력](https://github.com/ablecloud-team/ablestack-cloud/issues/1851) | 유효한 절대 이름과 일반 FQDN이 저장되며 잘못된 값과 같은 이름의 중복을 차단한다. | 실제 추가·수정에서 끝에 점이 있는 이름과 복수 이름을 전송하고 저장 결과를 확인한다. 중복과 오류 입력을 점검한다. |
| 6 | [#1852 공급자 조회 복구](https://github.com/ablecloud-team/ablestack-cloud/issues/1852) | 유효한 공급자를 선택하기 전에는 제출을 막고, 조회 실패 시 입력을 유지한 채 재시도할 수 있다. | 실제 정상 목록과 등록 요청을 확인한다. 지연·빈 목록·403·503·복구는 제어 응답으로, 차단 조건의 등록 요청 건수는 브라우저에서 확인한다. |
| 7 | [#1853 가상머신 UI 공통 배치](https://github.com/ablecloud-team/ablestack-cloud/issues/1853) | 공통 breadcrumb·툴바·상세 정보와 대화상자 하단 작업 영역을 적용한다. | 390·768·1280px, 밝은·어두운 모드 각 6조합에서 가상머신과 비교한다. 추가·수정·삭제의 탭 이동, Escape, 초점 복귀와 관련 링크를 확인한다. |

31·32에서 같은 기준으로 각각 검증한다. 실제 동작은 전용 시험 PowerDNS와 구분 가능한 서버·영역으로 확인한다. 장애·권한·지연 응답은 시험 조건을 기록한다. 실패와 재시도에서 서버 등록·연결·영역이 일치하는지 확인하고 시험 서버·영역과 임시 제공자를 정리한다. 기존 DNS 영역의 등록·레코드 동작은 선택 정책과 삭제 영향에 필요한 경로만 확인한다.

작업 기준은 upstream `ablestack-europa`의 `cbf25b124d7ef97ed99a50c0a7ac8fb8e3330a79`다. 작업 브랜치는 `dhslove:dhslove/epic-1846-dns-server`다. 최초 재현 결과는 [Epic #1846](https://github.com/ablecloud-team/ablestack-cloud/issues/1846)에 기록돼 있다.
