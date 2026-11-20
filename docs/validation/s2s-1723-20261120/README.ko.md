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

# #1723 Root 관리자 VPN 표시 설정 구현·검증

- 구현 소스: `025ae706601a63db85ede458ce03af32147c6771` (WSL ext4 `cloud-s2s-1723`, `dhslove/s2s-1723-display`).
- 직전 UI 기반: #1722 증거 HEAD `e5e696490ae34f46f9f2953b34519cb6fa3c0948`.
- 변경 모듈: **UI만**. Maven/전체 Cloud 빌드, 수동 Actions, 관리 서버 재시작은 실행하지 않았다.
- 대상: 31 GFS2·32 RBD. #1719/#1720/#1721/#1722의 선행 배포를 유지한 환경에서 검증했다.

## 구현 결과

Root 관리자에게 표시 대상(true)/숨김(false)의 명시적 필터, 생성 시 기본 true 옵션, 상세 작업의 표시 설정 수정창을 제공한다. '모두' 필터와 UUID(customid) 편집은 제공하지 않는다. customid는 API 전용이다. 표시 설정은 조회 노출 정책이며 연결 활성화·차단이나 터널 상태를 변경하지 않는다.

현재 표시값과 draft를 분리하고 같은 값 저장은 요청을 보내지 않는다. 제출 전 ID/VPC/IP/소유 범위/확정 표시값을 다시 확인한다. 단일 customjobid 접수 → 동일 job 추적 → jobresult.vpngateway → 명시적 표시값 재조회가 일치해야 성공으로 처리한다. 성공 후 같은 소유 범위와 해당 표시 필터 목록에서 대상 행을 보여준다. Root 생성은 true/false 모두 이 정책을 적용한다.

작업 실패는 draft·오류를 보존한다. 미확정 작업은 같은 job 재조회만 가능하다. jobstatus=1 이후 조회 실패는 '변경 완료·조회 확인 필요'로 구분한다. 사용자·역할·API·프로젝트·경로 변경은 기존 draft/콜백을 폐기한다. 숨김 공유 URL의 권한·프로젝트 불일치는 명시적 오류로 차단한다.

## 빌드·배포

집중 Jest **8개 suite / 212건 PASS**, 변경 JS/Vue ESLint PASS, UI production build PASS. 빌드의 source map 생성만 검증용 설정으로 껐고 제품 vue.config.js는 변경하지 않았다. `ui-tests.log`, `lint.log`, `ui-build.log`, `build.config.js`, `ui-manifest.json` 참조.

최종 정적 자산을 양쪽 활성 `/usr/share/cloudstack-management/webapp`에 배포했다. config.json·WEB-INF·META-INF를 보존하고 서버 디렉터리 전체 삭제/치환 또는 rsync --delete를 사용하지 않았다. 전후 `/client/` HTTP 200, WEB-INF 존재, 설정 SHA 보존, FTCTL 기존 번들 마커와 새 표시 UI 마커를 확인했다.

| 구분 | 31 | 32 |
| --- | --- | --- |
| 최종 정적 자산 백업 | `/root/s2s1723-ui-20261120-040713` | `/root/s2s1723-ui-20261120-040738` |
| 관리 프로세스 PID(전후 동일) | 2900836 | 3221445 |
| 기존 JAR SHA256(전후 동일) | `9d3958219d781111ece30e7e9aeb83ec29f6b98b9c42ffe4a9fded4950a3c841` | `4c2835aa06e63503ec4cbff65c09b01b911024b474fe5d974823c864f48811f1` |

양쪽 index.html SHA256: `a7f463bbc29063d4b40bc5b4793936e0ab029b3bc229c2f052fc5e8be460ec3e`. UI payload SHA256: `d1abe90f3721102dcd31b7226b8b86d44ff3a6583102eb1895b7abe611ce11f8`. 클러스터별 기존 JAR가 서로 동일하다는 주장이 아니라 각 클러스터의 선행 배포를 유지했다는 증거다. #1720의 UpdateVpnGatewayCmd 결과 반환 패치도 유지했다.

## 실제 UI ↔ API 검증

| 항목 | 양쪽 결과·근거 |
| --- | --- |
| Root 숨김 생성 | 실제 Source NAT IP/명시 IP ID·fordisplay=false, POST 1회, 최종 객체/재조회/숨김 행 일치. `*-final-hidden-create-network.json` |
| 표시 전환 | false→true→false 및 반복 전환에서 각 POST 1회·jobstatus=1·객체/재조회/URL/대상 행 일치. 최종 빌드 재확인 `*-deployed-display-*-network.json` |
| 목록·상세·복귀 | true/false 별 count와 행, 숨김 상세의 false 명시, breadcrumb 복귀의 필터/문맥 유지. VM 비교 12조건에서도 확인 |
| 같은 값 | Ctrl+Enter와 비활성 저장에서 update POST 0. `*-final-{query,readback,job2}-network.json` |
| 프로젝트 | 숨김 목록에서 기본 true 생성 후 프로젝트 표시 목록으로 이동. true↔false 전환 후 같은 프로젝트·대상 행 유지. `*-project-*-network.json` |
| 잘못된 프로젝트 URL | 다른 프로젝트를 선택한 상태의 공유 URL은 범위 오류, 게이트웨이 조회 0. `*-wrong-project-url.json` |
| 일반 사용자·DomainAdmin | 필터/수정 작업/생성 옵션 미노출, 숨김 URL은 권한 오류·GW 조회 0, 생성 POST 각각 1회·관리자 인자 생략·서버 기본 true 유지. `*-permission-network.json`, `*-create-network*.json`, `*-role-api-verification.json` |
| 경로 변경 | 수정 draft 변경 후 VM으로 이동, 재진입 시 확정값으로 초기화·update POST 0. `*-draft-context-network.json` |

**실제 제한 역할 API 정책의 정정:** @Parameter authorized=Admin 인자는 listApis에서 제한 역할에 노출되지 않는다. 해당 역할이 직접 update에 fordisplay=false를 넣으면 서버는 그 인자를 **무시**하고 기존 값으로 jobstatus=1을 반환했다. Root 재조회 true 유지로 확인했다. HTTP 오류/최종 job2 거부라고 주장하지 않는다. 이번 UI는 이 기존 관리자 전용 정책을 확대하지 않으며 제한 인자를 전송하지 않는다. `role-api.py`는 저장된 접수 receipt를 재사용하므로 재검증으로 동일 mutation을 다시 접수하지 않는다.

31 일반 사용자 생성에서 검증 스크립트가 관리자 전용 응답 필드의 존재를 잘못 기대했다. 이미 생성된 개체를 재생성하지 않고, 최초 POST 직전부터 남아 있던 완전한 Network 이벤트로 receipt·job·재조회를 복구했다(`31-user-create-network-recovered.json`). 제한 역할 응답의 fordisplay 생략은 정상 계약이고 Root API로 값을 대조했다.

## 통제 실패와 실제 서버 거부의 구분

- 실제 update를 접수한 뒤 queryAsyncJobResult에만 HTTP 503을 주입: unknown 안내 1회, 같은 job 재조회, update POST 총 1회, 통제 해제 후 성공.
- 실제 jobstatus=1 뒤 listVpnGateways만 HTTP 503 주입: '변경 완료·조회 확인 필요', 같은 job 재조회, update POST 총 1회, 복구 후 결과 일치.
- 통제된 접수/최종 job2: update는 서버에 전달하지 않고 통제 receipt/실패를 제공했다. draft·오류 유지와 임의 이동 없음 확인. 실제 서버 실패를 재현했다고 확대하지 않는다.
- 실제 서버 거부: 삭제된 전용 pilot 게이트웨이에 대한 직접 API update의 최종 job2 확인(`31-deleted-target-api-rejection.json`). 최초 응답의 접수 job을 읽기 전용 DB 조회로 복구한 뒤 같은 job을 조회했다. mutation 재접수 없음.
- 위 pilot의 UI preflight 응답 보류 시도는 클라이언트 timeout이 먼저 발생해 POST 0이었다. 이를 실제 서버 update 거부 UI 검증으로 계산하지 않는다(`31-preflight-timeout-network.json`).

기능·오류 검증 대부분은 `86acfe2a247`에서 수행했고 최종 `025ae706601`은 검색 공통 색상만 수정했다. 최종 소스에서 212건 회귀, 실제 표시 왕복·제한 역할 생성/차단·문맥 초기화 및 아래 전체 화면 행렬을 다시 확인했다.

## 가상머신 메뉴 표준 인수

**31/32 × 390/768/1280px × 라이트/다크 = 12조건**, 조건별 VM 5장(목록·검색·상세·편집·편집 스크롤), S2S 9장(목록·검색·상세·연결 탭·수정·수정 키보드·삭제 미리보기·생성·생성 focus)으로 최종 원본 **168장**을 수집했다. VM은 기존 기준 VM을 조회하고 편집창을 취소했으며 설정을 제출하지 않았다.

- 실제 DOM 폭·높이와 PNG 치수 모두 요청값과 일치. SHA256·x=901 반복 화상 검사 포함.
- breadcrumb·목록 표·검색 label/input/select·상세 본문 padding/font/color/background·탭 방향·탭 폭·동일 sidebar 조건·대화상자 폭/padding/footer/버튼 경계·동일 값 저장 비활성/키보드 focus를 **1,536항목** 검사해 통과했다. `vm-ui-standard-audit.json`, `audit-matrix.py`, `ui-captures.json` 참조.
- 공통 md=720px, 모바일 390px에서는 VM과 동일한 366px. 검색 panel/label/input/select의 색·글꼴·여백도 VM과 일치한다. UUID 선택 설명을 위한 검색 폼 폭/스크롤과 필터 칩은 데이터에 맞춰 반응형으로 배치했다.
- 데스크톱 탭 rail VM=100.25px/S2S=100px(1px 미만), 모바일은 둘 다 296px로 동일 방향/배치다. 내용 길이와 탭 개수에 따른 높이를 강제로 같게 만들지 않았다.
- 검색 열기 focus는 VM과 동일하게 trigger에 있고, 입력에서 Escape로 닫아 trigger로 복귀한다. 수정 switch Space → Tab으로 주 버튼 focus를 확인했다. 미리보기의 수정/삭제/생성은 모두 취소했다.
- VM 편집창의 실제 본문 스크롤을 행렬에서 확인했다. 생성 `*-create-scroll` 파일은 마지막 focus 이동 후 상태이며 실제 scrollTop=0인 조건을 스크롤 성공으로 세지 않는다. 추가로 양쪽 390px light/dark에서 기존 프로젝트 GW의 **수정창 본문을 실제 0→16px 스크롤**하고 고정 footer를 확인했다(`*-existing-edit-scroll-{before,after}`). 이 추가 확인도 제출 없이 취소했다.
- 최초 행렬은 일부 명명된 390/768px가 실제 1280px여서 판정에서 제외하고 전체를 대체했다(`matrix-initial-exclusions.json`). 최종 168장은 요청 폭·DOM·PNG 일치 검사를 모두 적용했다. pilot 중 중복 unknown 안내 캡처도 수정 전 이력이며 최종 기준이 아니다.

## 정리·보존·제한

새 전용 domain 2개·계정 4개·프로젝트 2개·VPC 8개를 사용했다. UI 생성 GW는 pilot 1개와 최종/역할/프로젝트 8개이며 모두 정리했다. 삭제는 저장된 UUID와 qa-s2s1723 prefix를 대조한 개체만 대상으로 했다. `31/32-cleanup.json` 참조.

전후 API 인벤토리 **167개 항목의 UUID·선택 주요 설정**과 기준 VM이 일치했다(`preservation-check.json`). 기존 호스트 3대씩 Up/Enabled, 기존 프로젝트 GW/연결 상태를 보존했다. 모든 DB 이력·비밀값·호스트 파일의 전수 동일성을 증명한 것은 아니다. 최종 Root·기본 보기·표시 대상 빈 목록, 다크 테마, viewport/device override 해제를 확인했다.

새 터널/고객 GW/게스트 VM은 만들지 않았다. ISP·non-SourceNat·외부 제공자·실제 피어·패킷·암호화 통신은 시험하지 않았다. 기존 완료 기능의 전체 행렬은 반복하지 않고 이번 표시 분기의 UI–API와 필요한 후보/소유 문맥만 확인했다.

#1719/#1720/#1721/#1722는 Closed를 원격 확인했다. #1723 구현·배포·검증은 완료했지만 관련 PR은 별도 검토/병합 대상이다. 이 브랜치는 #1740 기반으로 #1719/#1721/#1722를 포함하며 **별도 API PR #1725의 선행 통합이 필요**하다. 검증 환경에는 해당 API 패치가 이미 배포되어 있다. 병합 후 통합 소스에서 변경 모듈 재빌드·배포·최종 검증은 아직 하지 않았다. 전체 CI 통과를 주장하지 않으며 수동 전체 빌드는 시작하지 않았다.


## 2026-11-20 후속 교정

사용자 재검토에서 breadcrumb 내부 도구 배치 및 다크 설명문 색상 검증의 누락을 확인했다. 위 1,536항목만으로 해당 범위까지 완전히 인수했다는 판정을 정정한다. VM 공통 도구 배치·별도 필터 행과 설명문 색상을 교정하고 12조건/1,516항목을 다시 검증했다. [후속 교정·배포·재검증 보고서](../s2s-1723-breadcrumb-20261120/README.ko.md)를 참조한다.
