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

# DNS 영역 Epic #1828 작업 및 검증 계획

Mold 네트워크 > DNS 영역의 생성·가져오기·조회·검색·삭제와 DNS 레코드 작업을 개선한다. TXT 값 유실과 권한 표시부터 다룬다. 가상머신의 목록, 상세, 탭 및 대화상자 배치를 화면 기준으로 사용한다. [Epic #1828과 최초 검증 기록](https://github.com/ablecloud-team/ablestack-cloud/issues/1828)

기준은 upstream `ablestack-europa`의 `0f8fe2f808cd797e9404b383b4b46f6701dfdb66`이다. 작업 브랜치는 `dhslove:dhslove/epic-1828-dns-zone`이다.

## 구현 순서 및 검증 기준

TXT 값 전송과 레코드 권한을 먼저 고친다. 다음으로 레코드 집합 삭제의 안전 동작, 영역 데이터와 비동기 상태, 목록과 레코드 조회 계약을 확정한다. 공통 화면 배치는 이 작업들의 동작을 유지하면서 적용한다.

1. **최우선** [#1829 DNS 레코드의 쉼표 포함 TXT 값 유실 방지](https://github.com/ablecloud-team/ablestack-cloud/issues/1829)
2. **최우선** [#1830 DNS 레코드 탭과 생성·삭제 동작의 API 권한 반영](https://github.com/ablecloud-team/ablestack-cloud/issues/1830)
3. [#1831 DNS 레코드 집합 삭제 범위 안내와 영역 최상위 NS 보호](https://github.com/ablecloud-team/ablestack-cloud/issues/1831)
4. [#1832 DNS 영역 생성·가져오기의 유형 선택과 목록·상세 응답 연결](https://github.com/ablecloud-team/ablestack-cloud/issues/1832)
5. [#1833 DNS 서버 선택과 영역·레코드 비동기 작업 실패 복구](https://github.com/ablecloud-team/ablestack-cloud/issues/1833)
6. [#1834 DNS 영역 서버 필터·목록 복귀 및 연결 정보 개선](https://github.com/ablecloud-team/ablestack-cloud/issues/1834)
7. [#1835 DNS 레코드 조회·검색·페이지와 실패 상태 정합성 개선](https://github.com/ablecloud-team/ablestack-cloud/issues/1835)
8. [#1836 DNS 영역 목록·상세·레코드 탭·대화상자에 가상머신 UI 표준 적용](https://github.com/ablecloud-team/ablestack-cloud/issues/1836)

| 순서 | 하위 이슈 | 통과 기준 | 31번(GFS2)·32번(RBD) 확인 방법 |
| --- | --- | --- | --- |
| 1 · 최우선 | [#1829](https://github.com/ablecloud-team/ablestack-cloud/issues/1829) | 쉼표·인용부호가 있는 TXT 한 값과 복수 RDATA 값이 각각 원문으로 전달되고 기존 호출도 동작한다. | 각 Mold 폼으로 입력·요청·응답을 대조한다. 전용 제공자가 준비되면 저장 후 TXT 응답까지 확인한다. |
| 2 · 최우선 | [#1830](https://github.com/ablecloud-team/ablestack-cloud/issues/1830) | 세 API의 허용 여부와 탭·버튼·요청이 일치하고 직접 탭 접근 및 403에서 적절한 상태가 표시된다. | 기능별 권한 조합을 모의한다. 권한이 없는 요청은 네트워크 로그에서 발생하지 않는지 확인한다. |
| 3 | [#1831](https://github.com/ablecloud-team/ablestack-cloud/issues/1831) | 삭제 대상과 범위를 확인할 수 있고 영역 최상위 NS에는 정의한 보호 정책이 적용된다. | 실제 영역 변경 없이 단일·다중 값, 최상위 NS, 위임용 NS의 표시와 요청을 대조한다. |
| 4 | [#1832](https://github.com/ablecloud-team/ablestack-cloud/issues/1832) | `Public`·`Private`의 전송, 저장된 유형의 API 반환, 목록·상세 표시가 일치한다. | 두 유형을 각각 선택하여 실제 UI 요청과 모의 응답을 대조한다. 전용 제공자에서 생성·가져오기 결과를 확인한다. |
| 5 | [#1833](https://github.com/ablecloud-team/ablestack-cloud/issues/1833) | 서버 없음·불가 상태에서 제출이 멈추고 재시도, 입력·대상 보존, 작업 최종 상태가 일관되게 표시된다. | 두 클러스터의 실제 0건 상태와 모의 서버 실패·복구·작업 결과를 확인한다. |
| 6 | [#1834](https://github.com/ablecloud-team/ablestack-cloud/issues/1834) | DNS 서버 필터가 적용·해제되고 목록 상태가 복원된다. 권한에 맞는 서버 링크와 연결 정보를 제공한다. | 모의 영역에서 필터, 페이지, 상세 이동, 서버 링크와 연결 정보를 확인한다. 실제 API의 필터 등록도 대조한다. |
| 7 | [#1835](https://github.com/ablecloud-team/ablestack-cloud/issues/1835) | 레코드 검색·페이지·전체 건수가 일치하고 초기 실패와 갱신 실패가 구분된다. | 복수 페이지와 빈 결과, 503, 늦은 응답과 재시도를 브라우저에서 시험한다. |
| 8 | [#1836](https://github.com/ablecloud-team/ablestack-cloud/issues/1836) | 가상머신과 같은 목록·상세·탭 구조, 반응형 툴바, 공통 대화상자 하단 동작과 키보드 규칙을 제공한다. | 두 클러스터에서 390·768·1280px와 밝은·어두운 모드, 키보드 이동을 비교한다. |

두 클러스터에서 같은 합격 기준을 실행하고 결과는 각각 기록한다. 우선 실제 Mold 메뉴·조회 API와 DNS 서버·영역 인벤토리를 확인한다. 최초 검토 당시 두 곳 모두 등록 DNS 서버와 영역이 0건이었다. 이 상태에서는 브라우저의 모의 영역과 응답으로 입력, API 권한, 네트워크 요청 및 실패 복구를 확인한다.

실제 TXT 질의, 영역 생성·가져오기·삭제와 레코드 집합 변경은 전용 DNS 제공자와 시험 영역에서 검증한다. 실제 제공자가 필요한 항목은 별도 상태로 기록하고, 모의 요청으로 확인한 항목은 모의 결과라고 명시한다. 시험 후 생성한 DNS 서버·영역·레코드와 연결 정보를 확인하고 시험용 자원을 정리한다. 기존 게스트 네트워크 DNS 주소·DHCP·연결 대화상자 검증은 반복 범위에서 제외한다. [기존 게스트 네트워크 검증](https://github.com/ablecloud-team/ablestack-cloud/issues/1828#범위와-검증-환경)
