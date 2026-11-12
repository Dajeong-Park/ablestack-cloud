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

# #1610 VPC VPN 생성 대화상자 개선

31 GFS2·32 Glue RBD에 UI만 반영하고 생성 작업·실패 복구·프로젝트 전환·반응형·다크모드를 검증했다. API와 기존 권한 정책은 유지한다. Epic #1554 브랜치 `dhslove/epic-1554-guest-networks`와 Draft PR #1577을 유지한다.

## 변경한 UI와 적용한 VM 표준

| UI | 변경 |
|---|---|
| VPC > VPN 게이트웨이 > 생성 | 공통 MoldDialog(md720), 대상 VPC·프로젝트, 세로 IP 폼, 본문 스크롤과 고정 footer 취소/확인 |
| VPC > VPN 접속 > 생성 | 같은 표준, GW 표시·고객 GW 선택·수동 대기를 세로로 배치. ‘정적’을 이 창에서 ‘수동 대기’로 표시하고 한쪽만 설정하는 설명 제공 |
| 공통 비동기 상태 | 조회/검증/제출/진행/성공/확정실패/불확실 분리. 진행 중 중복·닫기 차단, job1 후 닫기+목록 갱신, 실패 시 창·입력·오류 보존 |
| 작업 복구 | 제출 전에 customjobid와 비밀값 없는 영수증 보관, 응답 유실·조회 장애는 같은 job만 재조회. 불확실 상태는 단일 경고와 작업ID 표시 |
| 문맥/범위 | VPC·프로젝트·사용자·역할·권한·세션·경로 변경 시 이전 후보/콜백 폐기. 소유 범위를 명시하고 제출 전 후보 재검증 |

실제 VM NIC 목록/상세/탭/네트워크 연결창과 비교했다. 기존 공통 breadcrumb/스크롤 구조에서 목록↔상세↔탭을 이동했고, 390/768/1280px·라이트/다크의 생성창24조합과 프로젝트 왕복·즉시 테마를 확인했다. 버튼은 아이콘+텍스트의 재조회, footer 취소/확인을 사용한다.

## 결과

- 양쪽 실제 GW·접속 생성 POST1/job1/창 자동 종료/목록1. 통제 job2 입력 보존과 수정 재시도, 실제 접수 응답 유실·같은ID 복구, IP/고객GW 조회503 차단·복구.
- 로컬 lint·183 tests·UI 빌드 통과. 양쪽664정적파일/HTTP200/서버 파일·JAR/PID/설정 보존. 제품 `730c638c2537c71ce92739e4ade8fa22edcb4377`.
- [검증 내용·제한](test-results.ko.md) · [캡처 85장](capture-matrix.ko.md) · [보관 자원·직접 UI 링크](resources.ko.md).
- 기존 시험 자원과 신규 VPC3개/tier3개/GW3개/고객GW2개/접속2개를 보관한다. 새 VM 생성/삭제0.

## 후속 순서

1. #1569 VPN 역할·사용자 철회 및 외부/VPC/Internal LB·오퍼링 잔여 통합 회귀. LB 백엔드 부하분산 측정 제외.
2. 제공자 준비 시 Health Monitor 정상 상태·장애 복구. 현재 사용자 확인대로 환경 차단.
3. 준비된 PVLAN·IPv6·Routed/BGP·외부 DNS와63행 최종 통합.

#1609/#1610의 알려진 결함을 해소해 C06/P09는 실패에서 부분으로 변경한다. 전체63행은 실패0·부분54·환경차단6·적용제외3·완료0이다. #1569/Epic/PR 전체 완료를 뜻하지 않는다.
