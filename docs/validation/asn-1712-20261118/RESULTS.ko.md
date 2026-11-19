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

# 실행 결과

## 자동 검증

| 검사 | 결과와 의미 |
| --- | --- |
| API 모듈 | ListASNumbersCmdTest 6 PASS: 32비트 조회, 오류 분류/권한 오류 401 |
| engine/schema | ASNumberDaoQueryTest 6 PASS: 실제 GenericDao/JDBC/H2에서 AND·소유자·도메인·기본 역할·Free 제외 |
| server | BGPASNumberQueryTest 9 + BGPASNumberRangeDeletionTest 7 = 16 PASS |
| 배포 overlay | 실제 배포 class로 schema 6/server 16 PASS, module target 복원 |
| UI | 6 suites / 71 PASS: ASN 신규 3 suites와 기존 Public IP/게스트 네트워크/VNF 검색의 제한 회귀 |
| 정적 검사 | 변경 UI 파일 lint, 변경 Java 5개 Checkstyle PASS |
| UI production | source map 없는 production build; 기존 buildVersion 유지 |

서버 fixture는 domain 단독 전달/접근 거부/계정의 선택 domain, 존재하지 않는 domain, range/network/VPC 교차 Zone, VPC tier 변환·명시 VPC 불일치를 확인한다. 기존 삭제 7개는 이 서비스 수정의 제한 회귀다. UI fixture는 잘못된 응답·빈 응답·후보 페이지·동일 이름/다른 UUID·선택 UUID 재조회·늦은 응답·권한/프로젝트 전환·URL allowlist·변경 후 page=1·조회 실패 후 선택 해제·UUID chip 표시를 검증한다.

## 31·32 API — 각각 22 PASS

각 Zone에 폐기 가능한 64512~64534(23개), 4200000000~4200000002(3개)를 생성했다.

| 경우 | 양쪽 결과 |
| --- | --- |
| exact / leading-zero / keyword | 각각 1건; Long·UUID 손실 없음 |
| range / exact+range+keyword / 모순 keyword·range | 3 / 1 / 0 / 0건 |
| Free / Allocated | 26 / 0건 |
| 서버 페이지/total | page1 20개, page2 6개, 중복 없음, total 26 |
| -1 / 1e3 / 4294967296 | 각각 API 431 |
| ROOT domain 단독 / admin+ROOT | 소유자 없는 Free 제외로 0건 |
| 기존 VPC / tier+같은 VPC / 독립 네트워크 | 읽기 전용 0건 |
| 독립 네트워크+VPC | 431, 대상/설정 변경 없음 |
| 임시 User 역할 기본 / 명시 자기 domain | 기존 Free 가시성 26 / 명시 소유 범위 0건 |
| 임시 User 역할의 다른 domain | 401; scope 정보 없는 안정된 오류 |

## 실제 UI

양쪽에서 고급 검색으로 Zone/범위를 선택하고 004200000000을 4200000000으로 정규화해 같은 번호를 조회했다. keyword 64512와 조합하면 0건, 일치 keyword면 1건이다. 실제 요청에 zoneid/asnrangeid/asnumber/keyword/page/pagesize가 포함되고 filter/q/임의 인자는 전달하지 않았다.

31에서 chip 제거 후 범위 3건, 뒤로가기 후 exact 1건을 확인했다. 양쪽 page2 6/total26을 확인했고, 31은 page size 10 변경 후 page1/10건으로 복귀했다. 상태 필터는 검색 조건을 유지하며 Allocated 0건/Free 1건을 반환했고 재설정은 상태와 검색 조건을 함께 지웠다. 직접 URL은 q 및 앞자리 0을 정규화하고 임의 키를 제거했다. ROOT domain 조건의 Free 제외, 기존 VPC/tier 0건, 모순 조합 차단도 확인했다. 31 네트워크 후보의 더 불러오기(20/31)로 다음 페이지를 읽었다.

두 클러스터에서 1280/768/390px×라이트/다크 12조합의 세로 label, 정수 오류, 화면 넘침, sticky footer, Ctrl+Enter와 Escape 후 검색 버튼 포커스를 검사했다. 화면 크기/테마 전환 애니메이션 중 캡처와 입력은 완료 상태를 다시 관찰해 재검사했으며, 전환 중 위치를 최종 화면 결과로 집계하지 않았다. 추가 1102px 관찰은 12조합 수에 포함하지 않는다.

대상 삭제 후 갱신은 원래 조건을 보존하고 lookup 단계에서 차단해 listASNumbers 확대 조회가 없었다. 마지막 정상 행에는 stale 안내를 표시한다. 이때 이전 chip 표시명이 남던 문제를 수정하고 단위 회귀 및 최종 배포 검증에 포함했다. 삭제된 범위 UUID/확인 필요 상태와 오류를 표시하며 재설정 후 정상 0건으로 돌아온다. 저장 화면 대조에서 확인한 다크 도움말 대비 문제는 공통 테마 토큰으로 보완하고 양쪽 세 크기에서 다시 검사했다.

## 정리·보존

31·32 모두 범위/번호 0건, 임시 계정/도메인/역할 부재를 API로 확인했다. 기존 network(31/17개), VPC(2/1개), peer(0/0개), network offering(33/24개), VPC offering(7/7개), Zone(1/1개)의 ID와 건수가 전후 동일하다. 임시 viewport·테마를 복원했다.

## 미검증·CI 해석

ISP 연결·할당·통신/경로 광고, 전체 Cloud 빌드, 전체 UI 회귀, 전체 모듈 Checkstyle은 제외했다. 기존 32 클러스터의 인프라 경보는 ASN 검사와 구분했다. 배포 서버 JAR은 저장소 전체와 같지 않으므로 소유 메서드 overlay와 보존 검사를 사용했다.

자동 CI 상태는 PR에 별도로 기록한다. 이전 HEAD의 License Check와 Lint 실패를 이번 변경 통과로 바꾸어 보고하지 않는다. 깨끗한 base/새 HEAD RAT의 추가 미승인 파일 유무를 비교하며, 이것은 전체 CI 성공 선언이 아니다. 변경 소스를 반영한 격리된 WSL RAT 검사에서 base와 미승인 4,077개가 동일했고 추가/삭제 0개였다. 검증 Python helper도 저장소 flake8 설정을 통과했다.
