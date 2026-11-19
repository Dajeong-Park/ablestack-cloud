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

# 실제 UI·API 통합 결과

## 범위와 판정

31 GFS2·32 RBD 모두 ISP 없는 ASN 관리 계약을 검증했다. 기존 네트워크/VPC/VNF/Public IP 전체 체인을 반복하지 않았다. 화면·대화상자는 VM 공통 구성에 맞췄으며 별도 ASN 상세/CRUD 화면을 만들지 않았다.

| 검사 | 양쪽 결과 |
| --- | --- |
| 빈 목록 → ASN 범위 관리 → 선택 Zone 상세 AS 번호 탭 | 정상. 실제 `/zone/<UUID>` URL과 고정된 목록 복귀 경로 확인 |
| UI 범위 생성 | 64512–64514, 4200000000–4200000002 각 3개 생성. 각 제출 1 POST, 동기 성공 뒤 목록/요약 재조회 |
| 32비트 정확 검색·범위 검색 | 4200000000 정확 결과 1개, 선택 Zone의 상위 범위 3개. 마우스/키보드 적용·URL 유지 확인 |
| 목록 왕복·페이지 | 31의 2페이지/pagesize=2 → Zone 관리 → 원래 3–4/6 표시·검색/페이지 URL 복귀 확인. 다중 Zone/미지원/조회 실패는 단위 fixture |
| 값·참조 | 가용 행의 네트워크/VPC/소유자/할당 일시 `—`, 실제 네트워크/VPC 이름과 UUID가 있으면 조회 권한에 맞는 링크, 로케일 일시·행 UUID 복사 표시 |
| 리소스별 해제 상태 | 새 응답 두 필드와 listApis boolean/string 계약 확인. 실제 통제된 망/VPC 참조는 eligible, 참조 없는 할당 행은 missingreference·버튼 비활성·직접 해제 431 |
| 권한 | 임시 Admin 읽기 전용 역할은 같은 eligible 응답을 읽지만 release API 432. UI 해제 버튼 숨김, 기존 범위 탭의 생성 비활성/삭제 버튼 부재 |
| 해제 확인/취소 | Zone UUID·ASN·행 UUID·할당/참조·영향 표시. 양쪽 취소 구간에 정상 조회가 기록되고 해제 POST 0개. 32 Escape 취소 확인 |
| 해제 실행 | 31 Ctrl+Enter, 32 double-click에서 각각 1 POST. 이후 양쪽 네트워크/VPC 참조 행의 가용 전환·참조/할당 일시 제거 확인 |
| 최종 선택 상태 | 수정 후 양쪽 네트워크/VPC 해제 완료 시 체크 0개, 다음 한 행 선택·해제 가능. 해제 전/후 같은 대상 재조회, API payload는 zoneid/asnumber만 사용 |
| 삭제·후보 갱신 | 기존 ASN-03 확인창에서 시험 4개 범위를 모두 UI 삭제. 삭제된 범위 URL은 UUID를 유지한 채 차단하고, 초기화 후 정상 0건. Zone 재선택 후 후보에 삭제 범위 없음 |
| 정리 | 범위·번호 각 0, 임시 계정·역할 없음. 기존 Zone/망/VPC/오퍼링/BGP 피어 UUID·개수·선택 주요 설정값 보존 |

각 클러스터 API 검증 파일은 가용 12·할당 17·해제 후 14개 assertion을 기록했다. 일부 공통 조회를 상태별로 반복했으므로 고유한 기능 43개라는 의미가 아니다. 별도로 API 카탈로그와 권한 거부/리소스 조건의 독립성을 확인했다. 세부 assertion 이름·판정과 API 변경 계약은 EVIDENCE.json에 정리했다.

## 제어된 할당 fixture와 한계

ISP가 없어 실제 동적 네트워크/VPC 생성으로 ASN을 할당하지 않았다. **이 작업에서 UI로 만든 새 ASN 행에만** 테스트 참조와 할당 플래그를 기록하고 UI/API 해제를 수행했다. 기존 망/VPC/오퍼링 행은 읽기만 했으며 변경하지 않았다. 최종 선택 초기화 수정을 확인하려고 같은 폐기 대상 행을 다시 할당 상태로 만들어 해제를 재검증했다. 참조 누락용 새 행은 guard가 있는 SQL로 원래 가용 상태로 되돌린 뒤 범위를 UI 삭제했다.

specifyasnumber=true 망/VPC 거부, false 성공, Free no-op, 누락/불명 참조, 동일 ASN의 다른 Zone, 삭제/할당 경쟁, 최신 오퍼링·트랜잭션 rollback은 H2/Mockito/명령 단위 fixture로 검증했다. 실제 두 클러스터는 각각 단일 Zone이며, 기존 오퍼링에 true 항목이 없어 이 조건의 실제 ISP 할당·교차 Zone 실동작 PASS로 확대하지 않는다. BGP 세션·경로 광고·외부 통신은 #1636의 환경 확보 후 별도 범위다.

## UI 화면 행렬

두 클러스터 × 1280/768/390px × 라이트/다크 = **12조합**에서 목록·고급 검색·Zone 상세의 AS 번호 탭·생성·삭제·해제 **72개 화면 상태**를 확인했다. 긴 UUID/리소스 이름, 채운 입력 뒤 영구 label, 읽기 순서, MD 대화상자 너비·내용 스크롤·고정 footer, 키보드 초점, 처리 중 작업 차단을 확인했다. 목록·Zone의 가로 스크롤은 표의 열을 보존한다.

측정한 ASN label/도움말/상태 태그/참조 링크/경고 문구의 텍스트 대비 최솟값은 라이트 **4.65:1**, 다크 **6.61:1**이었다. 해당 표본의 평면 배경 합성 계산이며 전체 제품 접근성 인증이나 비활성 컨트롤의 전수 검사 결과가 아니다. 생성 도움말은 라이트 7.56:1·다크 7.13:1 이상이었다. 초기 공통 다크 스타일이 태그 토큰을 덮는 문제는 ASN 영역의 구체적인 선택자로 보정했다.

화면 행렬은 최종 CSS/배치로 수집했다. 이후 Autogen 이벤트의 체크 초기화와 ASN 전용 오류 안내 중복 제거는 같은 배치를 유지하는 작은 로직 수정이며 최종 번들에서 해당 동작을 추가 확인했다. 32의 기존 시스템 경보 3건은 검증 전부터 있던 공통 알림으로 ASN 결함으로 분류하지 않았다.

## 증적과 복원

대표 화면은 screenshots/, 전체 검사 요약은 EVIDENCE.json, 상세 화면의 치수·footer·대비 표본은 matrix-curated.json을 참조한다. 원시 요청/전체 자원 목록은 인증값을 제외한 로컬 증적으로 보관하며 커밋에는 필요한 요약만 포함한다. 요청 부재 판정은 같은 구간의 정상 GET과 함께 확인했으며, 수집이 비어 있던 예비 구간을 0 POST 증거로 사용하지 않았다.

임시 테마는 양쪽 원래 라이트로 되돌렸고 viewport override를 해제했다. 최종 적용 UI·API·정리 상태와 runtime hash는 BUILD.ko.md/EVIDENCE.json에 기록한다.

시각 행렬의 CSS·배치는 최종 번들과 동일하다. 이후 선택 초기화와 삭제 후 전용 오류 안내 보정은 최종 번들을 다시 로드해 별도로 재검증했다.
