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

# API·권한·수명주기 계약

## 현행 계약과 결정

| 기능 | 현행 API/응답 | UI 설계 결정 |
| --- | --- | --- |
| 조회 | listKubernetesSupportedVersions: id/keyword/zoneid/minimumsemanticversion/minimumkubernetesversionid/arch·page/pagesize | 조건 전체 적용 뒤 count/page. 최소 버전 방식은 하나만 허용. 같은 계정/권한 범위에서만 복귀 컨텍스트 재사용 |
| URL | addKubernetesSupportedVersion: 이름(선택)·버전·Zone(선택)·URL·체크섬·CPU/RAM·directdownload·arch | 특정/모든 Zone 보존, 필드별 서버 경계, false 누락 금지. 등록 접수 후 실제 ISO 가용성 재조회 |
| 로컬 | getUploadParamsForKubernetesSupportedVersion: name/format/zoneid 상속 필수, checksum/CPU/RAM/버전, 소유 필드 상속 | format=ISO 내부 제공. 시스템 소유 글로벌 카탈로그에 일반 소유/프로젝트 폼을 기계적으로 추가하지 않음. arch 명시 계약 추가·ISO 전달 필요 |
| 상태 | updateKubernetesSupportedVersion: id/state | Enabled/Disabled만 변경. 이름/버전/최소 자원의 임의 편집 API로 확대하지 않음 |
| 삭제 | deleteKubernetesSupportedVersion: id, 기존 참조 잠금 | 활성 클러스터·미완료 업그레이드 source/target pin 유지, ISO 삭제 실패 시 버전 보존, 최종 서버 재검증 |
| 응답 | id/name/semanticversion/isoid/isoname/isourl/isostate/arch/zoneid/zonename/supportsha/supportsautoscaling/state/mincpunumber/minmemory/created/directdownload | 17개 의미를 대조. ID는 이미 InfoCard 복사 제공. Root 전용 URL 보호, false 누락 금지, 범위 없음과 조회 실패 구분 |

## 권한 경계

카탈로그 list는 Admin/ResourceAdmin/DomainAdmin/User API 역할 계약, 4개 쓰기는 Admin 계약입니다. 실제 사용자 허용 여부는 저장된 역할의 API capability를 함께 사용합니다. roletype만으로 버튼을 열지 않고 URL/local/state/delete를 독립적으로 판정합니다.

- URL 등록 API 없이 local만 있는 경우 local 양식은 열려야 합니다. URL API description 객체를 필수 참조하지 않습니다.
- Read-Only는 허용된 목록·직접 상세를 읽습니다. child ISO 조회가 거절되면 해당 부분만 제한으로 표시합니다. VM Metrics/쓰기 API 실패가 기본 읽기를 차단하지 않습니다.
- 일반 ISO의 “소유자이므로 수정 가능” 정책을 시스템 소유 KISO 카탈로그에 그대로 적용하지 않습니다.
- isourl은 RootAdmin만 반환하는 현행 계약을 보존합니다. 조회 모델에 없는 URL을 다른 API로 우회해서 복원하지 않습니다.
- 계정/역할/프로젝트/리소스/선택 Zone을 요청 소유 범위에 포함하고 오래된 응답을 폐기합니다.

## 결과 상태

| 모델 | 값 예시 | 동작 |
| --- | --- | --- |
| 버전 허용 | Enabled / Disabled | 새 소비 허용과 관련된 관리 상태. ISO 실제 가용성/다운로드 성공과 별도 |
| 읽기 | 미조회 / 로딩 / 조회 성공 / 실패 / 권한 제한 / 인증 만료 | 실패·거절을 빈 목록으로 바꾸지 않음. 이전 성공 데이터가 있으면 오래된 데이터임을 표시하며 보존 가능 |
| ISO 가용성 | Ready / 진행 중 / 실패 / 일부 Zone 실패 / 확인 불가 | child ISO·Zone 읽기로 판정. TemplateJoinVO.state만으로 전송 성공을 확정하지 않음 |
| 등록/업로드 | 입력 검증 / 티켓 발급 / 전송 / 서버 처리 / Ready / 실패 / 중단 / 만료 / 결과 불명 | 단계와 resource ID를 추적. 티켓 메타데이터·서명·자격 정보를 보고서/로그에 저장하지 않음 |
| 변경/삭제 | 미전송 / 요청 중 / 완료 / 거절 / 실패 / 결과 불명 | 결과 불명 시 먼저 재조회. 무조건 POST 재실행/연쇄 삭제 금지 |

## 체크섬과 자원 경계

서버의 유효 문법은 기본 MD5 32hex 또는 `{<algorithm>}<hex>`입니다. SHA-256은 `{SHA-256}<64hex>`입니다. 단순 `sha256:<hex>`와 접두사 없는64hex는 SHA-256으로 해석하지 않습니다. 기존 `validTemplateChecksum`의 허용 알고리즘과 길이를 재사용합니다. 목업은 검토 사례로 MD5/SHA-256만 표현하며 제품 지원 알고리즘을 두 개로 축소하는 설계가 아닙니다.

최소 CPU 2, RAM 2048MB, 정수, 현재 서버 최소 버전 1.11.0을 UI와 맞춥니다. 실제 구현 시 서버 상수 변경 여부를 재조회하고 숫자를 임의로 완화/강화하지 않습니다.

## 소스상 복구 후보

local path의 response nested shape, handleUpload Promise 미반환, 티켓 발급 finally에서 조기 loading 해제, 무효 티켓·중단·재시도·부분 자원 정리를 구현 단계에서 검증합니다. 초기 분석은 실제 네트워크 만료·계정 전환 전체 행렬을 통과했다는 뜻이 아닙니다. 기존 참조 잠금과 시스템 소유 자원 정리를 직접 API/DB 호출로 우회하지 않습니다.
