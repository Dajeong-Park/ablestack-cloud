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

# #1634 태그 미확인 결과의 복구 설계

기존 ResourceTags는 작업 ID를 받지 못한 제출을 미확인 상태로 유지해 중복 제출을 막았다. 그러나 태그를 새로고침한 뒤에도 같은 세션에서 이 상태를 종료할 경로가 없었다. API와 권한 정책을 유지하면서 운영자가 현재 결과를 확인한 뒤 추적만 종료하는 경로를 추가한다.

## 화면과 동작

| 상태 | 제공하는 동작 | 쓰기 요청 |
| --- | --- | --- |
| 준비·제출·처리 중 | 중복 제출 차단 | 최초 요청만 |
| 미확인·작업 ID 있음 | 원래 작업 ID 다시 조회 | 재제출 없음 |
| 미확인·작업 ID 없음 | 현재 태그 확인 및 추적 종료 대화상자 | 조회만 |
| 명확한 실패 | 기존 명시적 재시도 | 사용자 실행 시 새 요청 |
| 추적 종료·결과 미확정 | 초안 보존, 별도 변경은 직접 실행 | 종료 자체는 없음 |
| 완료 | 기존 실제 성공 표시 및 목록 갱신 | 추가 제출 없음 |

복구 대화상자는 대상 자원·프로젝트·원래 키/값·수신하지 못한 작업 ID를 구분하고, 마지막 조회 시각과 같은 키의 현재 태그를 보여준다. 현재 상태가 요청 후 상태와 일치해도 원래 작업 성공으로 판정하지 않는다. 반대로 일치하지 않아도 실패로 판정하지 않는다. 지연 반영 가능성과 서버 작업이 취소되지 않는다는 한계를 안내한다.

사용자는 최신 조회가 성공한 뒤 확인란을 선택해야 추적을 종료할 수 있다. 조회·확인·종료는 createTags/deleteTags를 호출하지 않는다. 추가 초안은 유지되며 다음 쓰기는 별도 사용자 실행과 기존 권한·대상 확인을 거친다.

## 상태 보존과 범위 보호

- 원래 POST 응답 대기가 끝나지 않았으면 추적 종료를 제공하지 않는다. 늦은 실제 job ID는 기존 추적 경로로 처리한다.
- 조회 증거는 작업 sequence·조회 식별자·조회 시각에 묶는다. 취소·화면·프로젝트 변경·재조회·재로그인·새로고침 후 오래된 확인을 재사용하지 않는다.
- 조회 실패나 불완전/다른 대상의 응답은 미확인 잠금을 유지한다. 401/403 계열 조회 실패의 기존 데이터 가시성 정책도 유지한다.
- 추적 종료 기록을 브라우저에 저장할 수 없으면 잠금을 해제하지 않는다. 완료/실패로 바꾸는 대신 별도 acknowledged 상태로 보존한다.
- 로그인 identity/session 및 자원 소유/프로젝트 context 분리는 기존 구조를 유지한다. 조회 가능한 읽기 전용 범위에서 로컬 추적을 종료하더라도 새 쓰기 권한이 생기지 않는다.

## VM UI 표준

MoldDialog md 크기·본문 스크롤·모바일 footer·취소/주요 버튼, 의미별 대상 요약과 세로 배치, 아이콘+텍스트 업데이트를 사용한다. 기존 공통 테마 색상을 이어받고 긴 키·값·UUID는 줄바꿈한다. ResourceTags 공통 컴포넌트이므로 VM·네트워크·Public IP 등 기존 사용 화면에 동일하게 적용한다.

## 검증 설계

단위 회귀는 job ID 유무·응답 대기·원래 job 재조회·결과 일치/불일치·재조회 실패·다른 대상·오래된 확인·저장 실패·역할·화면 전환·명시적 후속 요청을 다룬다. 실제 31·32 UI에서는 통제된 제출 전 503, 서버 접수 후 응답 유실, 명확한 거부, job 조회 실패와 성공 지연을 구분한다. 서버의 실제 태그와 job을 API로 대조하고 원래 태그/NIC/자원을 보존한다.

브라우저 실패 주입은 지정된 시험 요청만 대상으로 한다. 서버 장애나 실제 성공을 가장하지 않으며 주입 단계·실제 서버 전달 여부·후속 POST 수를 증적에 명시한다. 최종 결과와 원본 캡처는 검증 보고서에 별도로 기록한다.
