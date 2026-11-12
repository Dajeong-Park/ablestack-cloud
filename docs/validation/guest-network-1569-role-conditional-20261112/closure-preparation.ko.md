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

# Epic 종료 준비 평가

## 현재 판단

**후속 기능 수정 이슈의 미해결 결함0, 준비된 잔여 기능 회귀 통과로 종료 준비가 가능하다.** #1554의 정식 하위56개 중 열린 항목은 통합 회귀 #1569와 UI #1634·#1635다. 기능 수정 하위 이슈는 모두 CLOSED다. UI 두 건은 P3 비차단이며 자원 부족을 기능 결함으로 승격하지 않는다. #1586은 정식 하위/차단 관계 없이 독립 자원 정리 이슈로 분리됐다.

이번 요청은 종료 준비이므로 Epic·#1569를 닫거나 PR을 병합하지 않았다. 실제 실행 범위와 아래 조건을 보존한 종료 자료를 게시한다. 전체63행이 모든 가능한 조합에서 PASS라는 표현은 사용하지 않는다. 과거 부분54/환경6/적용제외3은 당시 실행 범위의 역사적 통합 판정이며, 부분이라는 이유만으로 중요한 제품 오류가 남았다는 의미가 아니다.

| 구분 | 이번 판단 | 종료 준비에서의 처리 |
| --- | --- | --- |
| 알려진 네트워크 기능 수정 이슈 | 모두 CLOSED, 준비된 회귀 통과 | 기능 오류 차단 없음 |
| #1634 태그 no-job 응답 유실 복구 | P3 UI | 비차단 선택 개선 |
| #1635 댓글 문자 수 안내 | P3 UI | 비차단 선택 개선 |
| #1586 Glue/libvirt 자원 정리 | 독립 자원 관리 | 네트워크 Epic에서 제외 |
| VLAN/Public IP/secondary 용량 | 시험 선행 조건을 준비해 재시도 | 오류 이슈로 등록하지 않음 |
| 미구성 제공자/프로토콜/배치 | 아래 실행 조건으로 구분 | 실패나 PASS로 바꾸지 않음 |

## 검증 경계와 조건부 미실행

| 조건 | 실제 준비 상태 | 실행한 범위/남긴 경계 |
| --- | --- | --- |
| IPv6/DualStack·IPv6 firewall | 양쪽 IPv6 offering 비활성·범위0 | IPv4 경로 검증, IPv6 실제 패킷 미실행 |
| ASN/BGP/routed | AS·피어 미구성 | 정상 세션/route packet 미실행 |
| 외부 DNS Zone/Server | 양쪽0 | VR 자체 DNS/UDP/TCP 검증, 외부 Zone 연결 미실행 |
| Health Monitor | Netscaler 없음·Tungsten 비활성; 사용자 별도 없음 확인 | 미지원 거부/잔여0, 정상 provider health 미실행 |
| PVLAN/OvS·다른 isolation provider | 현재 Linux Bridge | Linux Bridge 거부/가드 검증, OvS 격리 정상 통신 주장 안 함 |
| VPN 독립 동시 client2대 | 사용자 별도 없음 확인 | 단일 client 순차 철회/인증/복구, 독립 동시 통신 미실행 |
| switch guest VLAN trunk | 미구성 | 모든 해당 backend 실통신은 VR/VM 같은 host; cross-host trunk 미실행 |
| live redundant VR/모든 MTU·CIDR·제공자 조합 | 이중화 시험망 등 별도 fixture 미구성 | 단일 VR 일반/요소 재생성/Live Patch 및 지원 오퍼링 왕복 확인; exhaustive 조합 미실행 |
| Kubernetes 관리 규칙 파괴 테스트 | 운영 자원만 존재 | UI 잠금/운영 원본 보존, 전용 소유자 fixture 삭제 테스트 미실행; AutoScale 전용6그룹 거부 확인 |
| LB backend 분산/부하 | 사용자 제외 | 단일 backend 반영·장애/복구·TLS만 검증 |

미구성 조건은 제품 오류나 단순 용량 부족 이슈로 새로 등록하지 않았다. 나중에 해당 배치/제공자가 준비되면 이 표의 조건부 시험만 별도 실행할 수 있다. 확인된 기능 결함이 있을 때에만 새 제품 결함으로 분류한다.

## 최종 자료

- 기존21 VM/63 NIC, 구성원·역할·프로젝트 권한 원본을 대조했다. 추가 Shared 확인 VM2대와31 전용 Public Tier NIC를 남겼다.
- 실제 배포본/UI675파일·JAR hash·HTTP200·WEB-INF, 최종 단일 TLS chain3/verify0/200 및 HAProxy 문법·점검을 확인했다.
- 관리자/owner/peer/readOnly/DomainAdmin/비구성원 UI와 API·191캡처·76배치·즉시 테마9전환·프로젝트2왕복을 기록했다. UI 소스 변경0이다.
- 독립 #1586과 비차단 UI 후속을 분리하고 Epic/회귀/PR 상단을 현재 판단으로 갱신한다.
- 전체 Cloud 빌드나 수동 GitHub Actions는 실행하지 않았다. 이번 문서 체크와 원래 소스 CI를 구분한다.
