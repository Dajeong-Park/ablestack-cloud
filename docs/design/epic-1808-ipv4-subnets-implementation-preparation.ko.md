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

# IPv4 서브넷 Epic #1808 작업 및 검증 계획

Mold 네트워크 > IPv4 서브넷의 조회, 생성, 삭제 및 화면 탐색을 개선한다. Zone 변경과 미할당 서브넷 삭제 조건부터 다루고, 가상머신 UI의 목록·상세·대화상자 배치를 적용한다. [Epic #1808과 최초 검증 기록](https://github.com/ablecloud-team/ablestack-cloud/issues/1808)

기준은 upstream `ablestack-europa`의 `ed02beb036227531525da0092bf608f5c766e87d`이다. 작업 브랜치는 `dhslove:dhslove/epic-1808-ipv4-subnets`이다.

## 구현 순서

1. **최우선** [#1810 IPv4 서브넷 생성에서 Zone 변경 시 상위 서브넷 선택 초기화](https://github.com/ablecloud-team/ablestack-cloud/issues/1810)
2. **최우선** [#1811 IPv4 서브넷 단건·일괄 삭제를 미할당 항목으로 제한](https://github.com/ablecloud-team/ablestack-cloud/issues/1811)
3. [#1812 IPv4 서브넷 생성 입력 검증과 비동기 실패 복구](https://github.com/ablecloud-team/ablestack-cloud/issues/1812)
4. [#1813 IPv4 서브넷 조회 API의 정렬·페이지·전체 건수 정합성 수정](https://github.com/ablecloud-team/ablestack-cloud/issues/1813)
5. [#1814 IPv4 서브넷 고급 검색에 상위 서브넷·정확 CIDR·네트워크·VPC 추가](https://github.com/ablecloud-team/ablestack-cloud/issues/1814)
6. [#1815 IPv4 서브넷 상세에서 목록으로 돌아올 때 검색 상태 복원](https://github.com/ablecloud-team/ablestack-cloud/issues/1815)
7. [#1816 IPv4 서브넷에서 프로젝트 네트워크·VPC 링크의 소유 범위 반영](https://github.com/ablecloud-team/ablestack-cloud/issues/1816)
8. [#1817 IPv4 서브넷 목록·상세·대화상자에 가상머신 UI 표준 적용](https://github.com/ablecloud-team/ablestack-cloud/issues/1817)

## 완료 기준

| 순서 | 하위 이슈 | 통과 기준 | 31번(GFS2)·32번(RBD) 확인 방식 |
| --- | --- | --- | --- |
| 1 · 최우선 | [#1810](https://github.com/ablecloud-team/ablestack-cloud/issues/1810) | Zone을 바꾸면 기존 상위 서브넷 선택이 비워지고 현재 Zone의 응답만 반영된다. 목록 0건·조회 중·실패 시 제출이 차단되며 실패 후 재시도가 가능하다. | 실제 상위 0건과 시험 전용 상위 선택을 확인한다. 둘째 Zone, 늦은 응답, 503과 재시도는 브라우저 모의 응답으로 시험한다. |
| 2 · 최우선 | [#1811](https://github.com/ablecloud-team/ablestack-cloud/issues/1811) | 미할당 항목만 단건·일괄 삭제할 수 있다. 혼합 선택에는 제외 정보가 표시되고 네트워크·VPC 할당 ID는 전송되지 않는다. 처리 중 상태 변경으로 실패하면 결과가 표시된다. | 전용 미할당 서브넷에서 단건·일괄 삭제를 실행한다. 할당 및 혼합 선택과 실패 처리는 실제 할당 자원을 변경하지 않고 브라우저에서 확인한다. |
| 3 | [#1812](https://github.com/ablecloud-team/ablestack-cloud/issues/1812) | CIDR 또는 크기 한 가지가 유효해야 요청한다. 성공 후 목록이 갱신된다. 요청 또는 작업 실패 시 입력값이 유지된다. | 두 정상 생성 경로는 실서버에 실행한다. 양쪽 누락·동시 입력, 중복 제출, 재시도 가능 여부와 실패 후 입력 유지도 확인한다. |
| 4 | [#1813](https://github.com/ablecloud-team/ablestack-cloud/issues/1813) | 동일한 필터로 페이지 1·2가 각기 다른 1건을 반환하고 전체 일치 건수가 2로 유지된다. | 실제 서브넷 2건에서 API와 UI 페이지 이동·크기 변경·마지막 페이지·빈 페이지를 대조한다. 필터 적용 후 전체 건수도 확인한다. |
| 5 | [#1814](https://github.com/ablecloud-team/ablestack-cloud/issues/1814) | 기존 Zone·부분 CIDR 검색에 상위 서브넷, 정확 CIDR, 네트워크, VPC를 추가한다. 필터 적용·해제·초기화가 URL 및 API 요청과 일치한다. | 상위·정확·부분 CIDR을 실제 조회하고 Zone 상세 링크를 통해 들어온 필터의 적용과 해제를 검증한다. 실제 할당 사례가 없으면 네트워크·VPC 선택과 UI 결과를 모의 응답으로 확인한다. |
| 6 | [#1815](https://github.com/ablecloud-team/ablestack-cloud/issues/1815) | 목록→상세→목록에서 활성 필터, 검색어, 페이지 및 페이지 크기가 복원된다. | breadcrumb, 브라우저 뒤로 가기, 새로고침, Zone 상세 경유와 직접 상세 URL 각각의 복귀 동작을 확인한다. |
| 7 | [#1816](https://github.com/ablecloud-team/ablestack-cloud/issues/1816) | 권한이 있는 계정·프로젝트의 네트워크 및 VPC 링크가 올바른 상세를 열고, 미권한 항목은 이름이 표시된다. | 브라우저 모의 서브넷 행을 실제 조회 가능한 시험 네트워크·VPC에 연결한다. 상세 조회의 프로젝트 범위와 응답을 비교한다. |
| 8 | [#1817](https://github.com/ablecloud-team/ablestack-cloud/issues/1817) | 가상머신과 같은 breadcrumb·필터·버튼 배치, CIDR 제목과 UUID 복사, 단일 상세의 공통 정보 배치, 공통 대화상자 하단 작업 영역을 적용한다. | 390·768·1280px, 밝은·어두운 모드에서 목록·상세·생성·삭제와 키보드 이동을 실제 가상머신 UI에 비교한다. |

두 클러스터에서 같은 합격 기준을 적용하고 클러스터별 결과를 각각 기록한다. 실제 변경에는 시험 계정 전용 상위 풀과 미할당 하위 서브넷을 사용한다. 검증이 끝나면 시험용 계정·상위 풀·하위 서브넷의 정리를 확인한다. 브라우저 모의 시나리오는 실제 할당과 분리해 기록한다.

Shared 네트워크의 추가 IP 서브넷 CRUD와 이미 확인한 게스트 네트워크 흐름은 반복 검증 범위에서 제외한다. 실제 Routed 네트워크 할당 및 BGP 연계는 별도 물리 요건의 영향을 받는다. [기존 #1628](https://github.com/ablecloud-team/ablestack-cloud/issues/1628) · [ASN/BGP #1636](https://github.com/ablecloud-team/ablestack-cloud/issues/1636)
