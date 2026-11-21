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

# Epic #1784 VPN 고객 게이트웨이 구현 준비

2026-11-21 KST 기준 upstream `ablestack-europa`의 `3d14ed40689bef2ec958d29663f93903cde422b1`에서 통합 브랜치를 분기했다. 개선 범위는 Mold **네트워크 → VPN 고객 게이트웨이**다. 31·32의 최초 재현 결과는 Epic에 기록했다. [Epic #1784](https://github.com/ablecloud-team/ablestack-cloud/issues/1784) · [작업 브랜치](https://github.com/dhslove/ablestack-cloud/tree/dhslove/epic-1784-vpn-customer-gateways)

## 구현 순서와 완료 기준

| 순서 | 하위 이슈 | 31번(GFS2)·32번(RBD) 각각의 완료 기준 |
| --- | --- | --- |
| **1 · P1** | [#1785](https://github.com/ablecloud-team/ablestack-cloud/issues/1785) 일괄 삭제 창의 PSK 노출 차단 | 서로 다른 시험 키를 가진 두 행의 확인창에서 화면·DOM·툴팁·접근성 이름에 PSK가 없다. 취소 요청 0건과 정확한 삭제 대상, 390/1280px 두 테마를 확인한다. |
| 2 · P2 | [#1786](https://github.com/ablecloud-team/ablestack-cloud/issues/1786) 삭제 후 검색과 필터 | 이름·부분 이름·UUID 키워드 및 정확 ID, 도메인·계정·프로젝트 조합, 페이지 1/2와 총건수를 검증한다. 삭제한 행은 기본 목록·이름 검색·정확 조회 모두에서 0건이다. |
| 3 · P2 | [#1787](https://github.com/ablecloud-team/ablestack-cloud/issues/1787) 작업 완료와 실패 복구 | 생성·편집·개별/일괄 삭제의 실제 성공과 갱신을 확인한다. 실제 검증 실패, 통제 job 실패, 같은 job 재조회, 중복 제출 차단, 암호 정책 조회 503 및 복구를 확인한다. |
| 4 · P2 | [#1788](https://github.com/ablecloud-team/ablestack-cloud/issues/1788) 등록 대상과 프로젝트 범위 | 기본/전체/특정 프로젝트에서 표시한 소유자·요청·저장 결과가 일치한다. 관리자 계정·도메인 선택, 제한 역할, 프로젝트 왕복과 정책 응답이 늦게 도착하는 경우를 확인한다. |
| 5 · P3 | [#1789](https://github.com/ablecloud-team/ablestack-cloud/issues/1789) 폼 입력과 API 계약 | 이름 생략·자동 이름, IPv4/FQDN, 복수 CIDR 및 오류, 수명 단위·기본값·경계, IKE 버전별 분할 옵션과 ESP PFS 재편집을 확인한다. |
| 6 · P3 | [#1790](https://github.com/ablecloud-team/ablestack-cloud/issues/1790) VM 표준 화면과 통합 검증 | 390/768/1280px 라이트·다크에서 breadcrumb, 목록·필터, 상세·이벤트·코멘트, 생성·편집·삭제 창을 VM 메뉴와 비교한다. 고정 푸터, 키보드 포커스 및 삭제 대상·영향 안내를 확인한다. |

#1785가 선택 대상 요약을 정하면 #1787의 개별·일괄 작업과 #1790의 확인창에서 사용한다. #1786의 검색·범위 계약은 #1788의 프로젝트 전환과 화면 복귀에 적용한다. #1787의 정책 조회·작업 처리 위에 #1788의 등록 대상과 #1789의 입력 규칙을 반영하고, #1790에서 통합 검증한다. VM 화면 기준은 각 UI 변경에 함께 적용한다.

## 공통 검증

- 각 클러스터에서 격리 시험 프로젝트·게이트웨이를 사용하고 기존 게이트웨이와 연결의 식별자·상태를 시험 전후 비교한다. 성공과 실패는 요청, 최종 job, 화면 및 재조회 결과로 확인한다. 실제 응답과 브라우저 통제 응답은 각각의 검증 결과에 표시한다.
- 증적에는 공유 키와 로그인 정보를 포함하지 않는다. 범위 변경, 새로고침 및 다시 열기에서 기존 PSK 표시 규칙을 확인하되, 이미 검증한 실제 터널 통신과 VPC 내부 VPN 생성은 [#1569](https://github.com/ablecloud-team/ablestack-cloud/issues/1569), [#1609](https://github.com/ablecloud-team/ablestack-cloud/issues/1609), [#1610](https://github.com/ablecloud-team/ablestack-cloud/issues/1610), [#1745](https://github.com/ablecloud-team/ablestack-cloud/issues/1745)의 결과를 사용한다.
- 구현 뒤 UI는 변경 파일 lint, 관련 단위 테스트와 UI 빌드로 확인한다. Cloud Java 변경은 WSL ext4에서 변경 Maven 모듈만 빌드한다. 배포 시 활성 관리 웹앱의 정적 자산을 갱신하고, 배포 전후 `WEB-INF`와 기존 `META-INF`를 보존하며 `/client/`가 HTTP 200인지 확인한다.

전체 Cloud 빌드는 명시적으로 요청받은 경우 GitHub Actions에서 실행한다. 현재 커밋은 구현 순서와 인수 조건을 준비한다.
