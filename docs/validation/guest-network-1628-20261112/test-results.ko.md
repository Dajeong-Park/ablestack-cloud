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

# 검증 결과·배포·한계

## 로컬 빌드와 집중 회귀

WSL ext4 clone에서 engine/schema와 필요한 api/server 모듈만 로컬 빌드했다. 전체 Cloud 빌드·수동 Actions 실행·UI 재빌드는 없다. Java96건 실패/오류/skip0이며 모듈 Checkstyle도 통과했다. Maven은 rat.skip=true이므로 전체 저장소 RAT 성공을 뜻하지 않는다.

| 테스트 | 건수 |
| --- | --- |
| SharedNetworkSubnetSchemaUpgradeTest | 9 |
| DatabaseUpgradeCheckerTest | 17 |
| DatabaseUpgradeCheckerDoUpgradesTest | 4 |
| Upgrade42040to42100Test | 1 |
| Upgrade42100to42200Test | 7 |
| Upgrade42210to42300Test | 4 |
| SharedSubnetRouterBootTest | 5 |
| VirtualNetworkApplianceManagerImplTest | 9 |
| CommandSetupHelperTest | 13 |
| ApiResponseHelperTest | 23 |
| NicStateResponseTest | 4 |

[실행 명령·schema](evidence/module-result.json) · [server/api](evidence/router-module-result.json) · [JUnit 집계·활성 UI 검증](evidence/final-static-and-tests.json)

실제 MySQL에서 각 사이트 legacy narrow·already wide·mixed custom wide·interrupted resume·NO_BACKSLASH_ESCAPES의5조건을 격리 DB로 검증했다. 데이터·폭 외 컬럼 속성 보존, 재실행 DDL0을 확인했다. 신규/지원 버전별 전체 Cloud 업그레이드를 실제로 반복한 시험은 아니며, 경로 계산6조건과 실제 DDL fixture/현재 설치의 자동 보정 근거를 구분한다. [실제 MySQL10조건](evidence/live-schema-regression.json).

## UI·API 범위 CRUD

32의 수정 전 UI·직접 API530과 네 입력값 보존을 먼저 재현했다. 배포·재로그인 후 같은 값으로 정상 생성했다. 양쪽 UI에서10.249.x.100–102 생성→103 확장→120/110 역순 입력 거부/보존→100–104 정정 성공→미사용 범위 삭제→확인용100–105 재생성을 실행했다. 중복은 UI 메시지·입력을 보존했고 직접 API에서도 별도로 거부했다.

API 전용10.246.x.100–102의 세 번째 서브넷 생성·104 확장·역순 거부 후 원래값 보존·삭제도 양쪽에서 성공했다. 원래 두 범위의 ID와 응답을 보존했고 최종 추가 범위는 사이트당1개다. [31 API](evidence/31-api-range-regression.json) · [32 API](evidence/32-api-range-regression.json) · [UI 실패 입력](evidence/ui-input-preservation.json) · [31 삭제 직후](evidence/31-checkpoint-ui-delete.json) · [32 삭제 직후](evidence/32-checkpoint-ui-delete.json).

## 실제 NIC·job·재시작

| 사이트 | UI NIC 추가 job /결과 | 수정 후 reboot job /결과 |
| --- | --- | --- |
| 31 | 84242aa5-04a5-4008-b887-a7609b04a1b3 /1 | 262c53fe-78fc-4a74-b0be-a1b6525800b2 /1 |
| 32 | 82046056-97f1-4139-b66e-8224e45d3879 /1 | f6453bb2-cefd-47ec-82ae-4b1321df1d8a /1 |

초기31 reboot job1c7c8f62-c7f7-4d0a-b586-3e87741e1c4b는530·Stopped였다. 스키마 보정만으로 종료하지 않고 부팅·DHCP 재적용을 수정했다. 복구 start job503395b7-e5a7-400f-8cf7-54c1c26f4abc는1이다. 이후 위 표의 재시작은 새 boot ID·같은 router ID/host·dnsmasq active를 확인했다. [초기 실패](evidence/31-router-reboot-csv530.json) · [31 정상 재시작](evidence/31-router-reboot-complete.json) · [32 정상 재시작](evidence/32-router-reboot-complete.json).

신규 VM26의 UI 요청 IP10.249.x.102·MAC02:16:28:xx:49:26이 listNics Reserved, 실제 libvirt 인터페이스, 게스트 DHCP 주소, 라우터 dnsmasq 임대와 일치한다. 각 VM은 API/runtime2/2 NIC이며 기존 라우터와 같은31-3/32-2 호스트다. [31 NIC 대조](evidence/31-nic-api-runtime.json) · [32 NIC 대조](evidence/32-nic-api-runtime.json).

재시작 전·후 각각 실제 DISCOVER/OFFER/REQUEST/ACK와 ciaddr를 가진 unicast REQUEST/ACK를 수행했다. IP·MAC·mask·server identifier를 대조했다. 실제 alias10.249.x.103에 새 NIC source-bound DNS UDP/TCP 각각12/12·ICMP10/10이다. 기본 NIC가 아니므로 gateway/DNS DHCP 옵션의 의도적 생략과 기본 경로 보존을 함께 기록했다. [31 전](evidence/31-actual-dhcp-before-reboot.json) · [31 후](evidence/31-actual-dhcp-after-reboot.json) · [32 전](evidence/32-actual-dhcp-before-reboot.json) · [32 후](evidence/32-actual-dhcp-after-reboot.json).

## 기존 NIC 연속성과 실패·정상 구간

Shared peer 감시는 VM25의10.247.x.110에 ICMP·SSH 소켓을 바인딩해 VM21의10.247.x.58과 통신했다. DNS UDP/TCP도 기존 Shared NIC에 바인딩했다. 별도 control peer 감시와 구분하며 설치된 실제 probe의 바인딩/해시와 raw 표본을 근거로 한다.

| 사이트·Shared peer | 전체 표본 | DNS UDP/TCP 성공 | ICMP/SSH 성공 | 수정 후 정상 구간 |
| --- | --- | --- | --- | --- |
| 31 | 2093 | 1657 /1659 | 2093 /2093 | 1203표본, 네 항목 실패0 |
| 32 | 2323 | 2305 /2306 | 2323 /2323 | 1160표본, 네 항목 실패0 |

첫31 재시작 실패/복구 구간과 수정 후 정상 재시작 구간을 합쳐 무중단으로 표시하지 않는다. 아래는 실패 표본의 첫 시각~마지막 시각이며 실제 서비스 중단의 정확한 경계는 아니다.

| 사이트 | 실패 표본 시작 | 마지막 실패 | 표본 수 | 표본 span(초) |
| --- | --- | --- | --- | --- |
| 31 | 11-12 00:59:19 KST | 11-12 01:10:05 KST | 414 | 646.0 |
| 31 | 11-12 01:10:14 KST | 11-12 01:10:20 KST | 7 | 6.0 |
| 31 | 11-12 01:13:13 KST | 11-12 01:13:26 KST | 8 | 13.0 |
| 31 | 11-12 01:13:37 KST | 11-12 01:13:43 KST | 7 | 6.0 |
| 32 | 11-12 01:13:50 KST | 11-12 01:14:07 KST | 10 | 17.0 |
| 32 | 11-12 01:14:20 KST | 11-12 01:14:27 KST | 8 | 7.0 |

31의 긴 실패 구간은 수정 전 재시작530으로 시험 라우터가 정지한 기간이다. 수정 후 재시작의 짧은 DNS 중단도 별도 raw 기록에 남긴다. 전체 Shared peer ICMP·SSH는 실패0이고 최종 정상 구간은31 1203·32 1160표본 모두 DNS UDP/TCP·ICMP·SSH 성공이다. [31 전체 요약](evidence/31-communication-summary.json) · [32 전체 요약](evidence/32-communication-summary.json) · [31 raw Shared](evidence/31-shared-peer-samples.json) · [32 raw Shared](evidence/32-shared-peer-samples.json).

## 배포·보존·UI·권한

활성 management JAR의 변경 클래스만 WSL 로컬 산출물로 반영했다. 나머지 archive entry 해시와 webapp을 보존했고 각 원본 전체 JAR는 비공개 WSL 백업으로 유지했다. 검증 후 임시 rollback hardlink를 해제했다. HTTP200·WEB-INF/META-INF/config 보존과 활성 static675개 해시 불일치0을 양쪽에서 확인했다. UI 소스와 배포 자산은 바뀌지 않았다. [31 schema 배포](evidence/31-backend-deployment.json) · [32 schema 배포](evidence/32-backend-deployment.json) · [31 router 배포](evidence/31-router-backend-deployment.json) · [32 router 배포](evidence/32-router-backend-deployment.json).

원래 VM19개/NIC59개의 ID·네트워크/IP/MAC/device/default 및 VM state/host와 원래 범위2개씩을 보존했다. [31 보존](evidence/31-final-preservation.json) · [32 보존](evidence/32-final-preservation.json). Root/owner/peer/readOnly NIC 조회8경로, readOnly createVlanIpRange 실제432·job없음, 양쪽 읽기 전용 UI 쓰기 버튼0이다. [31 역할](evidence/31-role-api-regression.json) · [32 역할](evidence/32-role-api-regression.json) · [UI 가드](evidence/readonly-ui-checks.json).

VM NIC12·Shared 범위/대화상자12의390/768/1280×밝음/다크 조합, 즉시 테마의 동일 timeOrigin, 기본/QA 프로젝트 왕복 때 이전 NIC 제거, 실제 IP→VM 링크와 목록/breadcrumb 이동을 확인했다. [UI24조합·캡처](capture-matrix.ko.md).

## 제한과 남은 환경 조건

IPv6 컬럼 용량 보정은 확인했지만 IPv6 실제 DHCP/RA·외부 스위치 trunk·외부 gateway 경유 통신·LB 부하분산은 이번 판정에 포함하지 않았다. API health check의 dhcp.service/dhcp_check.py/dns_check.py는 양쪽 성공·VM6개 항목 정합이다. gateways_check.py의10.247.x.1 도달 불가는 별도 환경 조건으로 남겼다. healthchecksfailed 요약 flag만으로 모든 점검 성공을 주장하지 않는다. [31 점검](evidence/31-router-health-existing-condition.json) · [32 점검](evidence/32-router-health-existing-condition.json).

현재 구현 head의 등록 체크는 PR Merge Conflict Check 성공뿐이며 전체 Cloud CI 결과는 없다.96건은 로컬 모듈 테스트이고24조합은 실제 배포 UI 결과다. [등록 CI](evidence/source-ci-snapshot.json).

문서 7개의 실제 ASF 라이선스 hook·markdownlint, 공개 JSON의 UTF-8/구문, 원본 JPEG 104장과 인증 값·개인 키 제외 검사를 통과했다. [문서 검사](evidence/scoped-document-checks.json) · [공개 산출물 검사](evidence/public-artifact-audit.json) · [다른 작업 보호](evidence/protected-worktree-verification.json).
