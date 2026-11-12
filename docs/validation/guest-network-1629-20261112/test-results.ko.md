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

# UI·API·런타임 검증 결과

## 역할별 수정 전후144행

사이트별6주체×3문맥×두 API의36행을 수정 전과 후에 실행했다(총144행). 양쪽에서 구성원/readOnly의 올바른 프로젝트 IP 조회2행씩만531→200/6개로 바뀌었다. 나머지34행씩의 허용/거부·건수는 같았다. 아래 각 칸은 listNetworks · listPublicIpAddresses다. 성공은200/개수, 실패는API 오류 코드다.

| 사이트 | 주체 | 올바른 프로젝트 | projectid 생략 | 다른 유효 프로젝트 |
| --- | --- | --- | --- | --- |
| 31 | root | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 200/0개 · 200/18개 |
| 31 | owner | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 432 · 432 |
| 31 | domainAdmin | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 401 · 401 |
| 31 | 구성원 | 200/1개 · 200/6개 | 200/0개 · 531 | 432 · 432 |
| 31 | readOnly | 200/1개 · 200/6개 | 200/0개 · 531 | 432 · 432 |
| 31 | 비구성원 | 432 · 432 | 200/0개 · 531 | 432 · 432 |
| 32 | root | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 200/0개 · 200/18개 |
| 32 | owner | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 432 · 432 |
| 32 | domainAdmin | 200/1개 · 200/18개 | 200/1개 · 200/18개 | 401 · 401 |
| 32 | 구성원 | 200/1개 · 200/6개 | 200/0개 · 531 | 432 · 432 |
| 32 | readOnly | 200/1개 · 200/6개 | 200/0개 · 531 | 432 · 432 |
| 32 | 비구성원 | 432 · 432 | 200/0개 · 531 | 432 · 432 |

Root의 다른 프로젝트 직접 IP 전체 조회는 기존 관리자 권한이다. UI의 네트워크 상세는 listNetworks0개에 따라 제거됐다. 그 외 잘못된 프로젝트의432/401, 비구성원·개인 문맥의432/531 거부를 유지했다.

[31 수정 전](evidence/31-before-role-query-matrix.json) · [31 수정 후](evidence/31-after-role-query-matrix.json) · [32 수정 전](evidence/32-before-role-query-matrix.json) · [32 수정 후](evidence/32-after-role-query-matrix.json)

## 선택자·정보 노출·명시 역할 거부

두 일반 역할×사이트당5조건(총20): 자기 IP 필터/ID, 다른 소유자의 할당 IP ID, Free IP ID, 페이지2를 검사했다. 허용 VM/IP만 반환하고 다른 소유자·Free ID는0개다. 현재 false 설정을 수정하지 않았다. [31 선택자](evidence/31-selector-scope-regression.json) · [32 선택자](evidence/32-selector-scope-regression.json).

전용 기존 QA customReadDeny 역할에 listPublicIpAddresses deny 한 규칙만 임시 추가해 실제401·job없음을 확인하고 finally에서 그 규칙만 삭제했다. 기존 역할/규칙 응답이 정확히 복원되고 같은 조회가 정상 복구됐다. 읽기 전용 addNicToVirtualMachine·createVlanIpRange도401/432·job없음이다. 대상은 이미 연결된 NIC/중복 범위여서 예상 밖 허용 시에도 정상 자원을 수정하지 않도록 구성했다. [31 명시 거부](evidence/31-project-role-explicit-deny.json) · [32 명시 거부](evidence/32-project-role-explicit-deny.json) · [31 쓰기 거부](evidence/31-readonly-writes-denied.json) · [32 쓰기 거부](evidence/32-readonly-writes-denied.json).

API 반환 VM/IP6쌍과 원래21 VM/NIC63개, 범위3개씩, NetworkPermissions·프로젝트 구성원·역할 규칙·Free 정책의 보존을 검증했다. [31 보존](evidence/31-final-preservation.json) · [32 보존](evidence/32-final-preservation.json).

## 실제 DHCP·DNS·기존 NIC 통신

기존 #1628 VM26/Shared NIC를 재사용했다. 실제 DISCOVER/OFFER/REQUEST/ACK 및 ciaddr를 가진 unicast 갱신, IP10.249.x.102·MAC02:16:28:xx:49:26·mask255.255.255.0·서버 alias10.249.x.103을 대조했다. 새 NIC source-bound DNS UDP/TCP 각각12/12, router ICMP10/10이다. [31 실제 DHCP](evidence/31-actual-dhcp-after-deploy.json) · [32 실제 DHCP](evidence/32-actual-dhcp-after-deploy.json).

기존 VM25 Shared10.247.x.110에서 peer VM21의10.247.x.58로 ICMP·SSH를, 기존 router DNS로 UDP/TCP 질의를 감시했다. 배포 전부터 UI/역할 검증 종료까지 사이트당1586표본 네 항목이 모두 성공했다. 동일 호스트31-3/32-2 경로이며 외부 gateway·스위치 trunk 경유 판정은 아니다. [31 전체 요약/raw](evidence/31-communication-summary.json) · [31 raw](evidence/31-shared-peer-samples.json) · [32 요약](evidence/32-communication-summary.json) · [32 raw](evidence/32-shared-peer-samples.json).

VM26의 실제 libvirt2 NIC/API2 NIC와 MAC을 대조하고 VM21/22/26의 주소·기본 경로를 보존했다. DHCP 비기본 NIC의 gateway/DNS 옵션 생략은 기존 계약이다. 라우터 재시작 명령이나 VM/NIC 재생성은 하지 않았다. [31 런타임](evidence/31-retained-vm-runtime-nic.json) · [32 런타임](evidence/32-retained-vm-runtime-nic.json).

## 로컬 테스트와 활성 배포

| 테스트 | 건수 |
| --- | --- |
| SharedNetworkIpProjectAccessTest | 10 |
| ManagementServerImplTest | 44 |
| NetworkAvailableGuestIpsTest | 9 |
| ApiResponseHelperIpVmTest | 6 |
| SharedSubnetRouterBootTest | 5 |

74건 실패/오류/skip0, 모듈 Checkstyle 통과. WSL ext4에서 api/server만 로컬 빌드했고 전체 Cloud 빌드·수동 Actions·UI 재빌드는 없다. Maven rat.skip=true이므로 전체 RAT 성공을 뜻하지 않는다. [모듈 결과](evidence/module-result.json) · [JUnit·활성 static675개 검증](evidence/final-static-and-tests.json).

활성 /usr/share/cloudstack-management/lib의 JAR를 원본 전체 백업·같은 파일시스템 rollback hardlink로 보호하고 변경 계열6클래스만 교체했다. 양쪽 원본 나머지204865 entry가 같고 이전 수정 marker를 보존했다. HTTP200·WEB-INF/META-INF/config·static675파일 불일치0을 확인했다. [31 배포](evidence/31-backend-deployment.json) · [32 배포](evidence/32-backend-deployment.json) · [31 임시 link 해제](evidence/31-rollback-link-released.json) · [32 해제](evidence/32-rollback-link-released.json).

## UI·검증 한계

Root/owner/DomainAdmin/member/readOnly/nonMember의 실제 UI 결과가 API와 일치했다. 구성원·읽기 전용의24폭/테마 조합, VM 링크·NIC2개·읽기 전용 쓰기 버튼0, VM 상세/목록/breadcrumb/연결창과 프로젝트 데이터 제거·복귀를 확인했다. [UI·90개 캡처](capture-matrix.ko.md).

초기 단위 테스트의 mock entity 누락, API harness의 page 누락, 32 관리 서비스 준비 전 연결 거부는 시험 준비 오류를 정정한 뒤 다시 검증했다. 브라우저의 입력 연결 오류는 기존 Chrome의 새31 탭과 기본 접근성 입력으로 복구했다. 이를 제품 기능 성공/실패로 집계하지 않았다. 원래 Shared531 UI는 양쪽에서 실제 재현 후 정상 복구했다.

등록된 구현 head 체크는 Merge Conflict Check 성공뿐이고 전체 Cloud CI 결과는 없다. [등록 체크](evidence/source-ci-snapshot.json). 이 회귀는 현재 IPv4 프로젝트 공유 조건이며 IPv6/외부 제공자/전체 Epic의 미구성 조건을 통과로 올리지 않는다. 공개 문서·JSON/JPEG·인증 값 제외와 다른 작업 보호 결과도 보관한다. [문서 검사](evidence/scoped-document-checks.json) · [공개 산출물 검사](evidence/public-artifact-audit.json) · [보호 검증](evidence/protected-worktree-verification.json).
