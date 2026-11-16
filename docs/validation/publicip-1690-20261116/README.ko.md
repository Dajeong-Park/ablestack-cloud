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

# #1690 Public IP 표현 통합과 변경 범위 최종 검증

2026-11-16 KST. 구현·31번(GFS2)·32번(RBD) 배포·실제 UI 검증·시험 자원 정리를 완료했다. Epic #1684의 PIP-01~06 채택 변경을 집중 회귀했다. 기존 가상머신용 네트워크/VPC/VNF의 NAT·PF·LB·VPN·NIC 전체 체인은 반복하지 않았다. #1693 Free 주소 직접 updateIpAddress API 오류는 독립 후속 이슈로 유지한다.

## 구현

최종 제품 소스 `5a46ec6f7b994fe8d1b3a45c6d75e9141a349560` (소스15개 파일은 `source-manifest.json`).

| API 원문 | Public IP 표시 |
|---|---|
| Free / Reserved / Allocated | 가용 / 예약 / 할당됨 |
| Allocating / Releasing | 할당 중 / 해제 중 |
| 알 수 없는 상태 | 확인 불가 + 이스케이프한 원문, 중립 배지 |
| 상태 미응답 | 이 응답에서 미제공 |
| 엄격한 Boolean true / false | 예 / 아니오, 사용자 표시는 표시 / 숨김 |
| Boolean 미응답 / 잘못된 문자열 | 미제공 / 알 수 없음과 원문을 구분 |
| allocated | 할당 일시, VM 공통 날짜 포맷에 원래 offset을 한 번만 전달 |

PublicIpStatus/표시 도우미를 해당 메뉴에 한정했다. 공통 Status의 동명 상태 번역을 전역 교체하지 않았다. 목록·요약·상세·선택 미리보기·예약 결과 확인·작업 확인·검색 chip/열 제목을 맞췄고 언어 변경도 즉시 반영한다. 실제 UI에서 발견한 `label.filtercolumn` 노출은 제목이 빈 열 선택 유틸리티 열을 번역에서 제외해 수정했다. 선택 불리언 열도 같은 표현을 사용한다.

예약/표시 편집의 기존 직렬화·권한·결과 추적을 보존했다. 편집 요약에는 정확한 계정 또는 프로젝트와 도메인을 추가했다. 예약 해제 확인창은 Public IP에 한해 공통 MoldDialog/MoldDialogActions를 사용하고 IP·UUID·예약 상태·소유 범위와 취소/해제 버튼을 제공한다.

## VM 메뉴와 실제 화면 대조

| VM 기준 | Public IP 적용과 실화면 근거 |
|---|---|
| AutogenView/ListView, breadcrumb·업데이트·작업·상세 탭 | 같은 구조/컴포넌트. 최신 양쪽 목록/상세와 32번 HA-VM-13 상세를 읽기 검증 |
| EditVM 세로 폼과 연결 label | 예약/표시 설정의 연결 label과 읽기 순서, 입력 보존 확인 |
| 공통 md 대화상자와 고정 footer | 예약·저장·해제 모두 한 footer/버튼2개. 양쪽 1280/768/390 × 라이트/다크 실측 |
| 취소/확인, focus와 busy | Public IP는 취소/예약·저장·해제. 포커스 순환/Escape, 전송 중 예약 Escape 차단 확인 |
| 공통 테마·날짜 | 동일 토큰/포맷 사용. 즉시 테마/언어 전환, 한글·영문 날짜 확인 |

VM 편집은 열기/취소만 실행했다 (`32-final-vm-standard-edit.*`, `vm-standard-final.json`). 최초 `vm-standard.json`의 dialog 크기는 바깥 overlay 측정이라 명칭을 정정했다. 최종 VM bounds도 열림 애니메이션 중 표본이므로 정밀 폭 일치 판정에 사용하지 않는다. md의 명목720px은 공통 소스, Public IP의 안정된 실제 콘텐츠/버튼 경계는 `responsive.json`을 기준으로 한다.

## 실제 UI와 요청·응답

- 31번은 전용 User 계정/도메인, 32번은 기존 프로젝트를 선택해 실제 UI 예약2회를 수행했다. account/domainid와 projectid가 각각 정확히 전달됐고 동기 Reserved 응답·소유자 재조회가 일치했다. 예약 실패 입력 보존과 응답 미확정→읽기 재확인→명시적 추적 종료도 확인했다. 제어용 Free probe는 실제 예약 요청을 전달하지 않았다.
- User·DomainAdmin·실제 기본 Read-Only Admin 역할을 양쪽에서 로그인해 총6개 UI/API 범위를 확인했다. 비관리자 Boolean false는 아니오, 생략된 fordisplay/VLAN은 미제공으로 구분했다. 읽기 전용 역할은 IP 변경 API와 UI 변경 작업이 없었다. 기존 역할은 변경하지 않았다. User의 Free URL 우회도 차단됐다.
- 최신 소스에서 양쪽 표시 true→false→true의 실제 UI 저장4회/job4개가 모두 최종 status1과 실제 재조회를 통과했다. 각 저장 POST는1회였다. 31번 첫 job 조회만 HTTP503/빈 응답으로 주입해 결과 미확정·저장 잠금·동일 job 재확인을 거쳤다. 실제 update POST는 서버에서 실행됐으며 주입은 읽기만 차단했다. 변경 후 현재 필터에서 주소가 제외되고 숨김 검색에서 복원됐다.
- 최신 양쪽 실제 UI 예약 해제2회도 각각 POST1회로 성공했다. 31번 선행 HTTP431 주입은 서버로 전달하지 않은 실패 시험으로 창과 IP/소유자 요약을 유지했다. 실제 실패 발생이나 서버 장애로 계산하지 않는다.
- 한글/영문 목록·상세·제목·예약 chip·날짜를 확인했다. 31번 시간대 옵션 on, 32번 off에서 기존 공통 포맷을 보존했다. 예를 들어 31 예약 원문 `2026-11-16T19:27:55+0900`은 `오후 7:27:55`, 32 원문 `2026-11-16T19:34:05+0900`은 `오전 10:34:05`였다. offset/저장 시각은 수정하지 않았다.
- VLAN 값/범위 UUID, 공용망과 연결 게스트망, 무연결의 — 표시를 최신 상세와 목록에서 확인했다. UUID 복사 소스는 변경하지 않았다. 세션 클립보드 읽기는 #1686에서 이미 확인한 레거시 실제 복사와 도구 관찰 경로 차이를 다시 보여 성공 근거로 사용하지 않았다. 복사 명령/선택 UUID/콜백 경계의 기존 #1686 확정 증적을 재사용한다.

`ui-wire.json`, `ui-results.json`, `role-api-proof.json`에 원문 자격 증명 없이 요청·투영 응답을 보관했다. 실제 예약은 3f5 단계, 권한 UI는5c 단계에서 확인했고, 이후 변경은 유틸리티 열/선택 표시·편집 소유자 요약이다. 최종5a 소스에서 전체 반응형·표시 job·해제·표시/상태 경계를 다시 확인했다. 중간 단계의 시험을 최종 바이너리에서 새로 수행했다고 계산하지 않는다.

## 반응형·합성 경계와 범위

- 최종 소스의 **5화면(목록/상세/예약/표시/해제) × 3폭 × 2테마 × 2클러스터 =60개**. 페이지 가로 넘침 없음, 표 내부 스크롤, dialog/버튼 viewport 내 표시와 hit-test, footer1개/버튼2개, label 연결 PASS. 테마 즉시 전환과 각 테마의 해제 Tab 포커스/Escape 닫기를 확인했다. 초기3개 표본은 최종60개와 분리했다.
- 서버의 실제 Allocating/Releasing은 모두0건이다. **읽기 전용 상세 합성14개**로5상태+알 수 없음+미응답, true/false/생략/잘못된 Boolean과 잘못된 날짜 표시를 확인했다. 전환/알 수 없는 상태6개에서 IP 변경 작업이 노출되지 않았다. 영어5상태와 누락/offset/중립 배지는 집중 컴포넌트 검사와 실제 영문 화면을 함께 근거로 한다. 실제 할당/해제 전환 job 성공으로 확대하지 않는다.
- 한 응답에 서로 다른 상태7개를 넣은 초기 목록 합성은 기존 상태 범위 계약이 거절해 실제 이전 행을 유지했다. 이 시도는 상태 렌더 PASS 건수에서 제외했다. 상세의 유효한 단일ID 응답으로 표시 경계를 분리해 검증했다.
- 공통 Status 소비자와 비PublicIP 열/날짜 분기를 집중 검사했고 최신 VM 화면/편집 열기·취소로 경계를 확인했다. 기존 서비스 전체 체인, 대량 부분 실패, 실제 스크린리더 음성 출력은 새 PASS 범위가 아니다.

## 빌드·배포와 보존

- **11 suites /250 tests**, 변경 파일 lint, WSL ext4 로컬 production UI build PASS (`focused-tests.log`, `lint.log`, `build.log`). 이번 이슈는 UI만 변경했다. Maven/전체 Cloud 빌드/Actions dispatch/호스트 패키지 작업은 실행하지 않았다.
- 동일 artifact SHA256 `1994fb4caca31c8dd4f81516f670cc4770bdeb7719656d8e5f85afd5190eadfc`, 양쪽 index SHA256 `bfd8eb78a71e2906a05d199dbb04c1ae0d0f35ff842da0f39e22b51a5788beb1`.
- 활성 `/usr/share/cloudstack-management/webapp`에 정적 allowlist만 배포했다. 최종 백업31 `/root/publicip1690-ui-20261116-105434`,32 `/root/publicip1690-ui-20261116-105527`.
- 최종 정적 파일 전수 SHA, 서버 디렉터리·설정·백엔드 JAR SHA, 신규 상태 marker, WEB-INF/HTTP200/서비스 active를 확인했다. PID31 `2375963`,32 `2698517` 보존, 이전 #1689 API class SHA `7d8d1cf034c34c6aa480fdfcec65a5da05a24976a44c584d3236fe9edcfa4f6c` 동일. 서비스 재시작 없음 (`runtime-final-31/32.log`).

## 정리와 종료 판단

시험 IP3개는 표시=true/Free로 복원했다. primary2개는 실제 UI 해제, 역할용32번1개만 API 해제했다. 계정6개·도메인2개 정리, 역할 목록 보존, 제어용31번 probe 원래 Free를 확인했다. VM·네트워크·VPC·프로젝트·스토리지는 생성하지 않았다.

| 최종 전체 범위 | 31 GFS2 | 32 RBD |
|---|---:|---:|
| Free / Reserved / Allocated | 18 /0 /35 | 83 /0 /19 |
| IP /네트워크 /VPC /VM | 53 /44 /5 /149 | 102 /29 /4 /73 |

두 클러스터 주요8종씩 **16개 인벤토리 UUID/주요 필드 동일**, 원래 dirty FTCTL 작업 **14,541파일 지문/HEAD 동일** (`preservation-check.json`, `protected-worktree.json`). 이벤트·할당 이력이나 모든 DB/호스트의 불변을 주장하는 비교는 아니다. 한국어·라이트·기본 보기·Allocated/20으로 복원하고 viewport/주입/cache override를 해제한 뒤 전용 탭2개를 닫았다.

#1685~#1690 구현 범위와 실환경 검증/정리가 완료돼 #1690과 Epic #1684를 종료할 근거가 충족됐다. 누적 PR #1691은 기존 base 충돌 상태로 미병합이며, 로컬/실환경 PASS는 전체 원격 CI/병합 성공을 뜻하지 않는다. 다음 필수 하위 이슈는 없고 독립 후속 #1693은 열린 상태로 유지한다.
