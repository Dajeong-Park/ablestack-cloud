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

# 구현 설계

## AppCookie 런타임

`core/HAProxyConfigurator`의 폐기된 `appsession` 출력을 현대 HAProxy stick-table로 교체한다. 응답 쿠키는 `stick store-response res.cook(NAME)`으로 저장하고, 요청 쿠키는 `stick match req.cook(NAME)`으로 조회한다. 선택적인 요청 학습만 `stick on req.cook(NAME)`을 사용한다. 상태는 HAProxy 테이블에 있으며 DB에 쿠키 값을 저장하지 않는다. 정확한 쿠키 이름만 지원한다.

| 항목 | 지원·기본값 | 거부 조건 |
|---|---|---|
| cookie-name | 영문/숫자/밑줄/점/하이픈 1~128자, 생략 시 기존 안정적인 생성 이름 | 공백·구문 삽입 등 |
| length | 정수 1~256, 기본52 | 0/257/소수 |
| holdtime | 양의 정수 + ms/s/m/h/d, 기본3h, 최대24d, 무단위는 ms | 0/25d/개행/잘못된 단위 |
| request-learn | 생략/false는 조회만, 빈 플래그 또는 true는 요청도 학습 | 그 외 문자열 |
| prefix / mode | 지원하지 않음 | false를 포함한 명시적 prefix, URL 경로/쿼리 모드 |
| 중복/알 수 없는 파라미터 | 허용하지 않음 | 사전 오류 |

`VirtualRouterElement`는 해당 제공자가 처리하는 네트워크에서 라우터 미생성 경로보다 먼저 공통 의미 검증을 수행한다. `NetworkHelperImpl`의 기존 검증도 같은 검증기를 사용한다. 미지원 입력은 job 생성 전에 명확한 431 오류로 거부한다. HAProxy capability에는 지원하는 네 항목만 광고한다. 다른 제공자의 설정 계약이나 기존 프로젝트/역할 보안 정책을 넓히지 않는다.

## UI

`LoadBalancing.vue`의 세션 고정 대화상자를 VM 공통 `MoldDialog(size=md, form-actions)`와 `MoldDialogActions`로 구성했다. 방식/이름 아래 의미별 설정 카드를 두고 입력은 세로로 배치한다. 숫자 전용이던 유지시간은 단위 문자열을 받을 수 있다. 지원 범위와 기본값을 설명하고 프리플라이트로 잘못된 입력을 막는다.

선택된 LB 네트워크의 실제 capability를 프로젝트 문맥과 함께 조회한다. 조회 오류 시 저장을 막고 재조회 버튼을 제공한다. 프로젝트/자원/닫기/재조회 변경 이후 도착하는 이전 응답은 반영하지 않는다. false 문자열을 체크박스 true로 잘못 복원하지 않는다. 캐시된 다른 프로젝트 폼과 ID를 공유하지 않도록 폼 인스턴스마다 고유 이름을 부여해 label-for 연결과 키보드 접근을 유지한다.

VM의 목록·상세·NIC 탭·연결 대화상자·breadcrumb를 실제 화면으로 비교했다. 기존 LB 탭의 텍스트+아이콘 업데이트 버튼, 목록/상세 링크와 공통 반응형 테마를 유지했다. 새 CSS 배치 체계를 만들지 않았다.

## 별도 범위

#1626의 job0/job2/결과 미확인 상태, 실패 입력 복원·같은 job 재조회·중복 dispatch 차단은 미구현이다. 이번에는 대화상자의 공통 스타일과 AppCookie 계약/값 복원을 먼저 반영했다. 기존 동작 전체를 비동기 실패까지 통과했다고 표현하지 않는다.
