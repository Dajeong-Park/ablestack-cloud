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

# #1698 검색·count·목록 복귀 설계

서버는 키워드/Zone/arch의DB 조건을 먼저 적용하고, 해당 카탈로그 전체에 숫자 최소 버전·전체 정렬을 적용한 뒤 count와 page를 계산합니다. UI에서 받은 현재 페이지만 필터해 count를 추정하지 않습니다. 키워드의 이름/UUID OR는 다른 조건과 AND로 묶습니다.

최소 버전은 숫자 부분3개 이상·32비트 부분 범위로 비교합니다. 검색 기준은 등록 최소1.11.0보다 낮아도 정상적인 조회 기준이며, 등록 검증과 혼동하지 않습니다. minimumsemanticversion과 minimumkubernetesversionid는 상호 배타입니다. 잘못된 기준 ID를 광범위 성공 조회로 바꾸지 않습니다.

새 서버 sortkey/sortorder는 name/semanticversion/state/mincpunumber/minmemory, asc/desc만 지원합니다. 숫자 버전은 전체 대상으로 정렬하고 ID를 안정적인 보조 키로 사용합니다. ISO 상태/Zone 이름/arch 등 지원하지 않는 열은 UI 정렬을 끕니다. API 설명에서 지원을 확인할 수 없을 때도 전체 정렬로 가장하지 않습니다.

현재 카탈로그 크기에서 정확한 숫자 비교를 보장하기 위해 서버 메모리에서 전체 적격 후보를 필터/정렬합니다. 비용은 후보 수N에 대해 O(N) 메모리와 O(N log N) 정렬입니다. 일반 VM/ISO 목록에는 적용하지 않습니다. 큰 규모에서 SQL 숫자 버전 인덱스가 필요하면 별도 최적화할 수 있으나 임의 상한으로 결과를 자르지 않습니다. 스키마 변경은 없습니다.

목록 URL은 keyword/Zone/arch/최소 기준/page/pagesize/서버 정렬만 정규화합니다. 상세 링크는 이 목록 상태와 계정·역할·API·프로젝트·세션의 단방향 해시를 함께 담습니다. 토큰 원문은 URL이나 보고서에 쓰지 않습니다. breadcrumb/탭/브라우저 뒤로에서 같은 소유 범위만 복원하고 다른 계정/권한/세션의 과거 상태는 폐기합니다.

페이지 크기·검색·정렬 변경은1페이지부터 시작합니다. 필터된 count의 마지막 페이지가 줄면 새 마지막 페이지로 복구합니다. 첫 페이지의 불완전한 빈 응답과 정상 범위 밖의 빈 페이지를 구분합니다. 오래된 응답은 요청 세대/소유 범위 비교로 버립니다.

고급 검색은 기존 도구 모음의 팝오버에 둡니다. 텍스트 최소 버전과 등록 버전 선택은 하나만 활성화합니다. 선택기는 카탈로그 API로 페이지 조회하며 listIsos/VM Metrics 같은 별도 권한을 요구하지 않습니다. 실패/권한 제한을 빈 성공 선택지로 바꾸지 않고 재시도를 제공합니다. Zone 이름 조회가 제한돼도 기본 카탈로그 읽기는 막지 않습니다.

RootAdmin 쓰기와 isourl 보호는 기존 계약을 유지합니다. 실제Root·읽기 전용 계정 UI, 조합 검색·0개·마지막 페이지·복귀·경합·권한 전환을 검증하고 전용 자원을 정리합니다. #1701 공통 아이콘/스타일 및 #926·#1044 CI 부채는 분리합니다.
