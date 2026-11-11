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

# 설계 및 보안 경계

## 상태 및 API 계약

`LoadBalancerStickinessDialog.vue`가 읽기/검증/제출과 공통 networkMutation 상태를 소유한다. UI의 기존 보안 정책을 유지하며 읽기·생성·삭제 권한을 각각 검사한다. 목록의 정책 버튼뿐 아니라 제출/재조회 핸들러도 검사한다. 서버 API/역할 정책은 변경하지 않는다.

| 상태 | 입력/확인 | 닫기 | 다음 동작 |
| --- | --- | --- | --- |
| 초기 조회·검증 | 잠금 | 조회 중 취소 가능 | 소유 IP/규칙/망/현재 정책·capability 확인 |
| submitting/running | 잠금·중복 차단 | X/취소/Escape 차단 | 접수 job 조회 |
| job1 | 성공 검증 후 종료 | 종료 | 목록·정책 새로고침 |
| job2 또는 명시 HTTP 거부 | 초안 보존·편집 허용 | 가능 | 최신 정책 재조회 후 보정 재시도 |
| unknown + job ID | 잠금·재전송 차단 | 숨기기 가능 | 같은 job 조회만 허용 |
| unknown + 접수 불명 | 잠금·재전송 차단 | 숨기기 가능 | 서버 이력 확인 안내 |

기존 API 응답은 createLBStickinessPolicy, deleteLBstickinessrruleresponse처럼 이름이 다르다. 공통 mixin에 기본 동작을 유지하는 receipt/entity 검증 훅을 추가하고 이 컴포넌트만 기존 응답 계약에 맞춰 해석한다. jobinstancetype=None인 정책 작업은 cmd/jobid와 성공 결과의 LB ID·정책 UUID/이름/방식을 검증한다. 삭제는 success=true를 확인한다.

매 제출 직전 listLoadBalancerRules/listNetworks/listLBStickinessPolicies로 대상 소유관계·지원 capability·현재 정책을 다시 확인한다. 마지막 조회 이후 정책이 바뀌면 POST 없이 재조회 안내를 보여주며 초안은 유지한다. Revoked 이력은 현재 정책으로 취급하지 않고 유효한 현재 정책이 여러 개면 보수적으로 차단한다. 알 수 없는 형태나 권한 없는 경로도 저장을 차단한다.

## 수명 및 중복 방지

컴포넌트를 숨겨도 결과 불확실한 receipt/초안을 보관하며 같은 규칙 재열기 때 요청하지 않는다. 불확실한 작업이 있는 동안 다른 규칙으로 덮어쓰지 않는다. 프로젝트 전환 시작 이벤트와 사용자/역할/token/API집합/route/tab/resource/rule 범위를 읽기·작업 세대에 포함한다. 늦은 Promise/작업 결과는 현재 화면을 닫거나 새 프로젝트를 갱신할 수 없다.

접수 ID가 없는 전송 불확실 상태는 현 컴포넌트 수명 안에서 자동 재요청을 막는다. API idempotency나 새 브라우저 세션 간 영구 중복 방지를 추가한 것은 아니다. 탭/프로젝트를 떠난 후 같은 초안 보존을 보장하는 것도 아니다. 범위가 바뀌면 이전 범위의 결과와 권한을 폐기한다.

## VM UI 표준

공통 MoldDialog/MoldDialogActions·세로 label/input·설정 카드·대상 dl·하단 액션을 사용한다. 상태는 기존 NetworkMutationStatus로 표시한다. 새 전역 테마/스크롤 구조를 도입하지 않았다. 공통 테마 변수와 dialog 크기/내부 스크롤로 390px에서도 버튼을 접근할 수 있다. form별 고유 name으로 label 연결을 유지한다. 실시간 resize 때 기존 열린 설정 팝업은 닫는다. VM 표준 목록·상세·탭·기존 네트워크 연결창·breadcrumb는 비교 증적으로 남겼다.
