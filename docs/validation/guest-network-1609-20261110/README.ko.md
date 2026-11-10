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

# #1609 PSK 기본 평문 노출 차단

31 GFS2·32 Glue RBD에 UI를 반영하고 기본 마스킹·명시적 표시/숨김/복사·프로젝트 전환·반응형·다크모드를 검증했다. API 반환/권한 정책은 유지했다. Epic #1554 브랜치와 Draft PR #1577을 유지한다.

## 변경한 UI와 VM 표준

| 화면 | 변경 |
|---|---|
| VPC > VPN 접속 표 | PSK 고정 마스크. 목록에는 표시/복사 동작을 두지 않음 |
| 사이트 간 VPN 연결·고객 게이트웨이 목록 | 저장한 PSK 열을 포함해 고정 마스크 |
| 사이트 간 VPN 연결·고객 게이트웨이 상세 | 공통 VpnPsk, 표시/숨김 아이콘+텍스트 버튼 뒤 우측 복사 아이콘 버튼 |
| Public IP > 가상 사설망(VPN) | 같은 공통 표시·숨김·복사 사용 |
| 고객 게이트웨이 생성·수정 입력 | Ant 비밀번호 입력, 기본 숨김, 문맥 변경 시 입력 제거/닫기. 기존500px 고정 폼 폭을 뷰포트 기준 반응형 폭/최대500px로 변경 |
| 프로젝트 선택 | 전환 시작 즉시 키 표시/동작과 편집 입력 폐기. 권한 조회 완료를 기다리지 않음 |

VM 메뉴의 공통 목록/상세 렌더러·Ant 버튼/아이콘·세로 폼·테마 색상을 재사용했다. 표시 텍스트 버튼을 먼저 두고 복사 아이콘을 우측에 배치했다. 좁은 폭에서 줄바꿈하고, 기존 breadcrumb/탭/스크롤 구조를 유지해 실제 VM 상세/NIC/연결 창과 비교했다. VPC VPN 생성 창 자체의 알려진 차이는 #1610으로 남긴다.

## 결과와 증적

- 72개 화면/폭/테마 조합과 6개 상세의 실제 복사/붙여넣기, 프로젝트 왕복·즉시 테마·탭/갱신/새로고침 초기화를 확인했다.
- 로컬 lint·134 tests·UI 빌드 통과. 양쪽 활성 정적 파일664개/HTTP200/서버 파일·JAR 보존.
- [검증 내용과 제한](test-results.ko.md) · [캡처 119장](capture-matrix.ko.md) · [확인용 자원과 직접 UI 링크](resources.ko.md).
- 제품 `50129ccae1adfd162621c6fff9828805ba360013`. 확인용 시험 자원은 삭제하지 않았다.

## 후속 순서

1. #1610 VPC VPN 게이트웨이/접속 생성 창의 job 상태·중복 방지·성공 닫기·실패 입력 보존과 VM 표준.
2. #1569 VPN 역할/사용자 철회, 외부·VPC·Internal LB 및 오퍼링 잔여 검증. LB 백엔드 부하분산 측정 제외.
3. 제공자가 준비되면 Health Monitor 정상 상태·장애 복구. 사용자 확인에 따라 현재 환경 차단으로 유지한다.
4. 준비된 PVLAN·IPv6·Routed/BGP·외부 DNS 조건 및 63행 최종 통합.

#1609의 노출 결함은 해결했다. #1610이 남아 C06/P09 실패, 전체63행의 실패2·부분52·환경차단6·적용제외3·완료0 판정은 유지한다. Epic #1554/#1569와 PR #1577 전체 완료를 주장하지 않는다.
