<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# 검증 결과와 범위

| 항목 | 31 | 32 | 근거 |
| --- | --- | --- | --- |
| VPN 철회 전 실제 통신 | PPP·ICMP5/5·TCP3/3 | PPP·ICMP5/5·TCP3/3 | `*-ra-before-revoke*.json` |
| UI 사용자 삭제 후 통신 | 최종 job1/사용자 부재 → ppp69 고정 ping 실패·TCP0 | ppp69 부재·고정 ping 실패·TCP0 | `31-vpn-strict-revoke-terminal.json`, `*-ra-revoked-bound.json` |
| 철회 사용자 재인증 | PPP 생성 안 됨·CHAP 인증 실패 | PPP 생성 안 됨·CHAP 인증 실패 | `*-ra-revoked-new-auth*.json` |
| 사용자 UI 복구 | PPP·ICMP5/5·TCP3/3 복구 | PPP·ICMP5/5·TCP3/3 복구 | `31-ra-restored-bound-strict.json`, `32-ra-restored-bound.json` |
| 역할/API | 40기록·5주체 | 40기록·5주체 | `*-role-api-read-deny/write/revoke-restore.json` |
| 역할/UI | 구성원/도메인 관리자 추가창 허용, 읽기 전용 VPN추가 숨김/LB추가 비활성, 비회원 프로젝트/직접 자원 접근 거부 | 동일 | `*-ui-permissions.json`, `*-nonmember-ui.json`, `ui-state.json` |
| Isolated LB 생성/복구 | 중복18871→537/입력 보존,18969 보정 생성 | 동일 | `*-isolated-duplicate/recovered-response.json` |
| 새 LB NIC 연결 | 새 규칙에 기존 전용 VM NIC 1개 UI 연결·Active | VPC Public/Internal 각각 새 VM NIC 연결·Active | `31-new-lb-backend-api.json`, `32-lb-vpn-current-api.json` |
| 단일 SSH 연결 | 별도 TCP18969 방화벽 전제 충족 후 성공 | Public18971·Internal18973 성공 | `31-isolated-single-tcp.json`, `32-public/internal-single-tcp.json` |
| 추가 VPC/Internal 시험 | 공인 IP 풀 부족으로 신규 VPC rollback | 실제 생성·실패 보정·할당·동일 호스트 통신 | `31-vpc-create-detailed-cause.json`, `32-lb-fixture.json` |
| 유효/빈 ACL 링크 | 기존 사용자 지정 ACL 정상 이동·복귀 | 두 Tier API aclid/name 없음 → 빈 undefined 링크(결함) | `*-tier-acl-payload.json`, `32-acl-empty-links.json` |
| 런타임/보존 | 정적664 해시·HTTP200·WEB-INF·JAR/PID/설정 유지 | 동일 | `*-active-webapp-verified.json`, `*-final-preservation.json` |

## 권한 판정

일반 구성원은 기존 `scope-peer` 계정이다. 기존 `scope-readonly` 역할은 네트워크 9개 명령만 제한하므로 전역 읽기 전용으로 취급하지 않았다. 기존 권한은 바꾸지 않고 새 `vpn-lb-readonly` 계정/프로젝트 역할을 만들어 VPN·LB·망/NIC 변경 32개 명령을 제한했다. 전체 제품의 모든 변경 명령이 제한된 역할이라는 뜻은 아니다. 역할/규칙 목록은 `*-fixture.json`에 있다.

5주체 × 4조회 × 양쪽 = 읽기40(허용32/비회원 거부8), 추가 변경 검사40(허용16/거부24), 합계80이다. 관리자 생성/철회는 별도 실제 UI 경로로 검증했다. 프로젝트 owner 전용 계정의 이번 VPN/LB 변경, VPN 서비스 자체 삭제/재활성화의 모든 역할 조합, 모든 SSL/AutoScale 명령 권한까지 완료한 것은 아니다.

## 통신·실패·전제 조건

32 철회 후 일반 ping은 eth0 기본 경로로 응답했다. 이를 VPN 생존으로 해석하지 않고, 최종 ping `-I ppp69`와 TCP `SO_BINDTODEVICE`를 사용했다. 31은 최종 삭제 job 완료/사용자 부재 뒤 음성 검증했다. 삭제 확인창 제출 전의 두 자동화 관측은 `31-harness-pre-confirmation-*`로 분리해 판정에서 제외했다. [판정 메모](evidence/qualification-notes.json).

32 Internal LB VM이 처음 다른 호스트에 배치되어, **새로 만든 그 LB VM만** 새 시험 VM·VR와 같은 32.1로 이동했다. 새 게스트의 두 번째 NIC가 실제 OS에서 비활성인 것을 확인한 뒤 DHCP·never-default 설정을 적용했다. 이후 동일 호스트의 VR에서 Internal VIP를 통해 SSH 응답을 확인했다. QGA exec 보안 정책은 변경하지 않았다. 31 LB 생성은 `openfirewall=false`이므로 새 포트18969에만 별도 Source CIDR10.10.0.0/16 방화벽 규칙을 만들었다. 전제 충족 전 무응답을 LB 분산 실패로 집계하지 않았다.

31 공인 IP 범위31.100~150 고갈로 새 VPC Source NAT 할당이 실패했다. 임의 주소 확장/기존 확인 자원 삭제/운영 VPC 변경을 하지 않았다. 32 신규 VPC에서 준비된 실제 경로를 검증했고, 31 VPC/Internal 추가 검증은 공인 IP가 준비된 뒤 실행한다. Health Monitor는 별도 Netscaler/Tungsten 제공자 없음이라는 사용자 확인대로 환경 차단을 유지한다.

## UI 대조와 한계

VPN 목록12조합 + LB 생성창12조합 = 양쪽 3폭×2테마의24조합이다. VM NIC 탭/기존 네트워크 연결창·LB 실제 탭까지 스크롤한 모바일 다크 화면도 별도 캡처했다. 페이지 가로 넘침/모달 범위와 breadcrumb를 측정했고, 테이블 내부 가로 스크롤은 페이지 넘침과 구별했다. 프로젝트 기본보기↔QA 왕복의 최종 dashboard 이동/데이터 복귀를 확인했고, 관리자 테마는 timeOrigin 동일로 즉시 전환했다. 비관리자에게 없는 설정 메뉴를 임의 DOM 변경으로 대체하지 않았다.

이번 제품 UI 변경은 없다. 기존 LB 생성창은 VM 표준 MoldDialog·고정 footer/세로 폼을 따르지만 Internal LB 생성창은 legacy a-modal/본문 작업 버튼으로 남아 #1612에서 개선한다. 실제 동기431 입력 유실을 재현했으며 비동기job2/접수 유실은 소스 분석에 따른 후속 검증 범위다. 잘못된 Public Tier 후보와 ACL 빈 링크 때문에 모든 UI를 통과 처리하지 않는다.

## 소스·CI

제품/UI/API 변경 및 로컬 제품 빌드·전체 Cloud 빌드·수동 Actions 실행 없음. 실제 배포 해시는 #1610 manifest와 664개 전부 일치한다. 관련 없는 FT 작업트리 raw diff SHA256도 보존했다. 문서·캡처 무결성/비밀값/기능 결과 일관성 검사를 별도로 수행했다.

실행 시작 시 PR head976f846의 자동 License Check는 기존 미승인3573으로 실패했고 Lint도 저장소 전체 기존 Markdown 오류 등으로 실패했다. 이를 실환경 검증 성공으로 대체하지 않는다. 새 head의 등록된 검사 상태는 게시 후 별도로 보고한다.

## 백엔드 해제 UI 권한 추가 교차검증

31 Public LB/32 Internal LB의 읽기 전용 역할에서 backend 해제 버튼이 활성이라 클릭할 수 있었다. 공통 postAPI 권한 검사가 로컬에서 거부했고 변경 POST는 각각0건이다. 직접 API deny401은 80기록 안에서 확인했으며 재조회에서 기존 backend/NIC는 유지됐다. 보안 우회로 집계하지 않고 UI 비활성/핸들러 가드·오류 정리를 [#1614](https://github.com/ablecloud-team/ablestack-cloud/issues/1614)로 분리했다. Internal의 catch/finally 보완은 소스 분석에 따른 개선 설계다.

문서10개를 WSL ext4에서 저장소 설정의 markdownlint로 검사하고, 96개 원본 JPEG·JSON/UTF-8·로컬 링크·비밀값·제품 소스/보호 FT 작업트리를 확인했다. 결과 파일은 `evidence/docs-lint-result.json`, `evidence/artifact-audit.json`이다.
