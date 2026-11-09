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

# #1569 남은 역할·반응형·테마·프로젝트 UI 검증

2026-11-09. 31 GFS2·32 Glue RBD에서 직전 VPC/Shared 검증의 **남은 UI 범위를 완료**했다. 제품 코드·API·보안 정책을 변경하거나 새 UI/JAR을 배포하지 않았다. 기존 Epic 브랜치 `dhslove/epic-1554-guest-networks`와 Draft PR #1577을 유지한다. **광범위한 조건부 회귀가 남아 #1569 전체는 Open**이다.

[원본 캡처 121장](capture-matrix.ko.md) · [유지 자원](resources.ko.md) · [검사 요약](evidence/summary.json) · [UI 상태/DOM](evidence/ui-state.json) · [배치 측정](evidence/layout.json) · [직전 VPC/Shared 실제 통신](../guest-network-1569-vpc-shared-20261109/README.ko.md)

## 역할 UI와 API의 일치

로그아웃→실제 로그인→개인/프로젝트 선택을 통해 검증했다. API 세션을 브라우저에 주입하지 않았다. 두 클러스터 모두 아래 개인 범위가 동일했다.

| 개인 역할 | all | domain-only | subdomains | account |
| --- | --- | --- | --- | --- |
| 소유자 | 표시 | 표시 | 표시 | 표시 |
| 같은 도메인 peer | 표시 | 표시 | 표시 | 제외 |
| 하위 도메인 사용자 | 표시 | 제외 | 표시 | 제외 |
| 외부 도메인 사용자 | 표시 | 제외 | 제외 | 제외 |
| DomainAdmin | 표시 | 표시 | 표시 | 표시 |

Root 관리자는 네 망을 표시했다. 프로젝트 일반 멤버/관리자/읽기 전용은 공유된 account 망을 포함해 네 범위를 조회했다. 일반 멤버와 관리자의 VM21 **기존 네트워크 연결창**에서 네 망이 모두 후보로 표시됐다. 대화상자를 취소해 자원은 변경하지 않았다. 실제 연결/DHCP/통신은 직전 실행의 별도 증적을 유지하며 이번 후보 확인만으로 새 연결 성공을 주장하지 않는다.

읽기 전용은 이 검증용 프로젝트 역할 `scope-readonly`이며, 아래 네트워크 관련 9개 명령을 deny하도록 기존에 구성된 역할이다. 제품의 모든 API가 읽기 전용인 전역 역할을 뜻하지 않는다.

- 양쪽 프로젝트 목록에서 네트워크 생성이, VM NIC 탭에서 생성/연결/분리 버튼이 숨겨졌다. 네트워크 상세의 수정/재시작/삭제 작업도 노출되지 않았다.
- 유효한 시험 개체를 대상으로 `createNetwork`, `updateNetwork`, `addNicToVirtualMachine`, `removeNicFromVirtualMachine`, `createNetworkPermissions`, `removeNetworkPermissions`, `resetNetworkPermissions`, `deleteNetwork`, `restartNetwork`를 직접 요청했다. **양쪽 18건 모두 401**로 거부됐다.
- specifyvlan Shared의 권한 관리/주소 범위/라우터 등 관리자 전용 기능은 비관리자 UI에서 숨겼다. 네트워크 권한 탭 직접 URL에서도 노출 가능한 상세 탭이 표시됐다. DomainAdmin을 포함한 비관리자의 Shared 쓰기 정책을 완화하지 않았다.
- API 검증 전후와 모든 UI 검증 후의 프로젝트 VM 상태·호스트·NIC ID/망/IP/MAC/기본 여부 및 공유 권한 1건이 일치한다.

[31 읽기 전용 API](evidence/31-readonly-api.json) · [32 읽기 전용 API](evidence/32-readonly-api.json) · [31 전/후](evidence/31-after-ui.json) · [32 전/후](evidence/32-after-ui.json).

## VM 메뉴 UI 표준·반응형

새 UI 수정은 없다. 기존 VM 공통 구조와 네트워크 화면을 실제로 대조했다.

| 범위 | 이번 실행 |
| --- | --- |
| 기본 행렬 | 31/32 × 390/768/1280px × 라이트/다크 × 네트워크 목록·Shared IP 탭·Shared 권한 탭·VM NIC 탭·기존 연결창 = **60개 배치 검사 통과** |
| 공통 breadcrumb | 본문 스크롤 기준 sticky와 현재 viewport 안의 폭 유지. NIC 6개 상세에서 새로고침 없이 390→768→1280→390px, **추가 6개 확대/축소 검사 통과** |
| 목록 | 네 Shared 망 검색·결과·링크를 확인. 작은 화면의 표는 내부 가로 스크롤을 사용하며 페이지 전체 가로 넘침은 0 |
| 상세/탭 | VM 요약/탭, 네트워크 요약/상세·IP·권한 탭과 관련 VM 링크를 확인. 권한 탭은 작업 버튼이 안내문 위에 있고 업데이트는 reload 아이콘+텍스트 |
| 대화상자 | VM 표준 MoldDialog, 세로 라벨과 VM/Zone/프로젝트 문맥, 선택/주소/MAC/기본값 입력, 취소·연결 footer를 확인. 12개 기본 행렬의 창 모두 viewport 안에 배치 |
| 비관리자 작은 화면 | 31 일반 멤버·32 프로젝트 관리자의 390/768px VM NIC 탭과 연결창을 추가 확인. 읽기 전용 제한은 양쪽 실제 역할 UI와 직접 API에서 대조 |
| Shared IP 페이지 | 32 account 망 2페이지의 VM22 `10.236.32.215`, VM23 `10.236.32.214`와 VM 링크를 확인. 첫 페이지의 빈/가능 주소를 할당 VM 조회 결과로 혼동하지 않음 |
| 확인용 VPC | 두 svc-review VPC의 Public IP 탭, Source NAT와 추가 IP·상태 및 breadcrumb/관련 문맥을 확인 |

라이트·다크 전환은 **실제 관리자 페이지 스타일 메뉴**로 실행했다. 현재 화면이 새로고침 없이 바뀐 뒤 목록→네트워크 상세/탭→VM 상세/연결창으로 이동해 테마가 유지됐다. 다시 라이트로 전환하는 경로도 양쪽 확인했다. body class만 수동 변경하거나 브라우저 저장소를 조작해 성공 화면을 만들지 않았다. 비관리자에게 관리자 전용 테마 메뉴를 새로 노출하지 않았다. 테마 행렬은 관리자 문맥이며 모든 역할×모든 테마/폭의 전수 조합을 뜻하지 않는다.

기본/프로젝트 왕복은 31 일반 멤버·관리자와 32 일반 멤버·관리자, 양쪽 Root에서 확인했다. 확정된 프로젝트와 대시보드 이동을 기다린 뒤 목록/상세로 재진입했다. 개인/프로젝트의 후보 범위가 복구됐고 기존 망·NIC를 유지했다. 프로젝트 검색은 debounce 완료와 실제 후보를 기다렸다. 검색 초기화 아이콘으로 기본 보기를 선택하는 경로도 확인했다. 초기 자동화의 미확정 옵션 선택과 시간 초과는 성공 건수에서 제외했다.

브라우저 제어는 입력/DOM 조회·브라우저 자체 캡처 경로로 복구했다. 과거의 Windows URL 판별 중단을 반복하지 않았다. 한 번의 긴 검증 호출이 실행 제한을 넘었지만 저장한 증적에서 이어서 수행했다. 기본 행렬 60개·동적 폭 6개의 실제 측정과 121개 원본 JPEG의 **live viewport/디코딩 치수/해시가 모두 일치**한다. [이미지 무결성](evidence/image-validation.json). 스크린샷 중 사용자가 스크롤한 위치의 캡처는 화면 일부이며, 전체 내용이 한 화면에 들어간다는 판정이 아니다. 본문 스크롤 위치의 의미별 앵커 보존까지 보장한 검사는 아니다.

## 보존과 후속 순서

이번에는 네트워크·VM·NIC·프로젝트 역할을 생성/삭제/수정하지 않았다. 18개 쓰기 거부 요청과 조회, 브라우저 표시 설정만 실행했다. 두 svc-review VPC와 네 Shared 망, VM22/23의 각 6개 NIC, VM24의 VPC NIC, 개인 역할 VM·공유 권한·시험 계정을 유지했다. 네트워크 인증/접근 정책과 QGA 보안 설정은 변경하지 않았다. 임시 viewport 제한을 해제하고 31 라이트 VPC 화면·32 다크 Shared IP 화면을 사용자 확인용 탭으로 남겼다.

이전 UI 미완료 표시는 이번 검증으로 해소한다. 다만 Epic 63행은 적용 조건 전체를 포함하므로 각 클러스터 부분52·미실행2·환경차단6·적용제외3을 유지하며 #1569를 종결하지 않는다.

1. **다음 실행:** VPN/LB UI·API의 개설·연관·실패 복구/삭제 영향, 지원 제공자의 Health Monitor·AutoScale과 LB 설정 확장 조합(P08/O08). 사용자가 제외한 LB 백엔드 부하분산 측정은 하지 않는다.
2. 준비된 제공자/스위치부터 호스트 간 PVLAN·Shared PVLAN 라우터, IPv6·Routed/BGP·외부 DNS 조건을 검증한다. 준비되지 않은 환경은 차단으로 남긴다.
3. 남은 부분 행과 역할/제공자 조합을 통합한 뒤 #1569/Epic 완료 여부를 판정한다.

제품 변경이 없어 새 빌드·배포나 전체 Cloud 빌드를 실행하지 않았다. 증적 검사·실환경 UI/API 검증과 저장소 전체 CI는 구분한다. 주 FT 작업 추적 diff 해시는 시작 기준과 동일하다.
