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

# 신규 결함과 개선 설계

## #1625 AppCookie 런타임 적합성

양쪽 UI 실제 생성 job2/530과 VR 후보 문법 오류, 31 API 재현을 근거로 등록했다. core HAProxyConfigurator가 appsession을 만들지만 설치 HAProxy2.6.12는 이를 지원하지 않는다. SourceBased의 stick-table은 실제 정상이다. 기존 live 후보 검사 덕분에 실행 설정/TLS는 보호됐다.

현대 HAProxy의 응답 쿠키 저장/요청 쿠키 조회 stick-table 경로로 바꾸되 length/holdtime/request-learn/prefix/mode의 의미와 제약을 명시해 동등성을 검증한다. 지원하지 못하는 옵션은 UI/API 적합성 단계에서 구체적으로 거부하고 capability/UI 후보를 실제 지원과 일치시킨다. 후보 문법 검사 후 교체·실패 rollback·SSL chain/backendssl·다른 LB와 프로젝트/역할 보안 정책을 유지한다. 부하분산 측정은 제외하고 단일 backend의 실제 문법·쿠키 규칙·TLS 및 다른 정책/오퍼링 조합으로 검증한다.

## #1626 정책 대화상자 비동기 상태·입력 보존

handleAddStickinessPolicy의 dispatch finally가 closeModal을 호출하며 job2/조회 오류도 창을 닫는다. 실제 양쪽 AppCookie jobid→job2에서 초안 유실을 확인했다. a-modal 경로를 VM 표준 MoldDialog/MoldDialogActions·세로 폼으로 맞추고 식별/방식별 설정을 구분한다. 이번 모바일 실측에서는 overflow를 재현하지 않았으므로 이를 결함으로 주장하지 않는다.

기존 공통 network mutation 도구로 dispatch/job0/job1/job2/결과 미확인을 처리한다. job1에만 닫고 431/503/job2는 방식/이름/입력/기존 목록을 유지한다. 접수 jobid의 재조회는 같은 job만 사용하고 결과 미확인 중 재전송을 차단한다. busy 상태의 중복 클릭/Ctrl+Enter/닫기/방식 변경을 제어한다. 생성/삭제 권한을 각각 UI·handler에서 확인하며 프로젝트/역할/user/resource/탭의 늦은 응답을 취소/무시한다. API나 기존 보안 정책은 바꾸지 않는다.

두 이슈는 #1625→#1626 순서로 구현한 뒤 31/32 UI/API/runtime/TLS·정책 성공과 실패·프로젝트·모바일/다크를 재검증한다. 이번 실행은 검증/설계 등록 범위로 두 결함을 수정했다고 보고하지 않는다.
