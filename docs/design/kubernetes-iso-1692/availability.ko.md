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

# #1699 쿠버네티스 ISO 상세·가용성·Zone 설계

버전의 Enabled/Disabled는 사용 허용 설정이며 연결 ISO의 준비 완료를 뜻하지 않습니다. 기존 카탈로그 API의17개 필드는 유지하고, 실제 가용성은 독립적으로 허용된 listIsos의 Zone별 읽기로 관측합니다. Backend 응답/DB/권한을 확장하지 않습니다.

## 화면 구조

- 기존 ResourceLayout/InfoCard와 VM 상세의 라벨 위·값 아래,12px/8px 행 간격·테마 토큰을 사용합니다. InfoCard의 버전 사용 설정과 ISO 가용성은 별도 표시합니다.
- 상세 → Zone → 이벤트 순서입니다. 설정·코멘트 entity API가 없으므로 이름만 추가하지 않습니다. 이벤트 권한이 없으면 탭을 숨기고 해당 deep link는 유효 탭으로 복구합니다.
- 상세에는 이름/ID/시맨틱 버전/사용 설정/등록 범위/Zone ID/연결 ISO와 ID/가용성/ISO 등록 상태/arch/CPU/RAM/HA/오토스케일링/직접 다운로드/생성일과 Root 전용 URL을 표시합니다. 누락은 미제공·알 수 없음으로 표시하고 false/0을 유지합니다. 허용된 ID/URL 원문 복사는 기존 TooltipButton/TemplateDetailValue를 재사용합니다.
- 목록의 버전 사용 설정과 미조회 ISO 가용성을 분리합니다. 서버가 보고한 Ready/Allocated는 tooltip의 등록 상태로 보존하고, 실제 가용성으로 추정하지 않습니다. 전역은 모든 Zone으로 표시하고 undefined 링크를 만들지 않습니다.
- Zone은 읽기 전용 툴바·검색·표·페이지/크기 선택, 저장소 확장·진행률·원인을 제공합니다. 일반 ISO의 변경/추출/VM 작업을 복제하지 않습니다. 허용된 ISO 상세 이동만 제공합니다.

## 읽기와 소유 범위

- 카탈로그만 읽을 수 있는 역할은 버전 상세를 계속 표시하고 ISO 영역에 권한 제한을 표시합니다. 이 경우 listIsos를 요청하지 않습니다. 공통 InfoCard의 KISO 링크 검증도 생략해 무조건 호출하던 경로를 차단합니다.
- listIsos가 허용되면 Root는 all, 일반 계정은 executable 범위로 정확한 child UUID만 읽습니다. 등록 Zone이 특정이면 해당 Zone을 사용하고, 전역은 Zone 필터를 추가하지 않습니다. project/account/domain/VM Metrics/쓰기 권한을 읽기 선행조건으로 요구하지 않습니다.
- showunique=false·500개 페이지를 모두 읽고 count 일치·대상 ISO/Zone UUID·중복·잘못된 다운로드 상세를 검증합니다. 페이지를 임의로 잘라 전체 Zone 준비로 주장하지 않습니다.
- 읽기 성공/빈 목록/권한 제한/인증 만료/연결 실패/잘못된 응답과 실제 다운로드 실패를 구분합니다. 카탈로그/ISO 메타데이터의 Ready를 가용성 관측의 대체물로 사용하지 않습니다.
- 단일 Summary 관측을 상세/Zone/요약이 공유합니다. 계정/역할/API/세션/프로젝트/버전/child/등록 범위를 SHA-256 소유 키로 구분합니다. 탭 이동은 관측을 유지하고 이전 범위 응답은 폐기합니다. 토큰 원문은 props/URL/증거에 담지 않습니다.
- 10초 갱신은 같은 범위에서 이전 행을 유지해 Zone 확장을 접지 않습니다. 실패가 확인되면 Ready 표시/링크를 해제하고 실패 상태를 보여줍니다. 중복 읽기를 막고 비활성/해제 시 발행·타이머를 중단합니다.
- 저장소 원인은 기존 안전한 진단 표시를 재사용해 제어 문자, URL 인증/쿼리와 명명된 비밀 값을 가립니다. Root 전용 원본 URL 복사는 별도 허용 필드이며 임의로 원문을 바꾸지 않습니다.

## 검증과 배포

13번 UI에서 원래 자원을 보존하고 전용 정상 전역/체크섬 실패/직접 다운로드/진행 자원을 생성해 상태·필드·복귀·키보드·원문을 확인합니다. 승인된 카탈로그만/ISO 읽기 추가 User 역할·계정2세트로 링크·URL·쓰기/VM 권한 경계를 확인한 뒤 모두 삭제합니다. 다중 Zone/Edge의 실환경이 없으면 NOT_RUN으로 남기고 부분 Zone 등의 표시 계약은 별도 합성 읽기 UI/단위 사례로 명시합니다.

생산 빌드는 기존13번 운영 입력의 변경만 적용합니다. UI 정적 자산만 배포하고 JAR/PID·설정과 무관 자산을 보존합니다. #1700 상태 변경/삭제, #1701 최종 스타일·공통 아이콘, #1702 전체 ACL/통합 게이트와 CI #926·#1044는 각각 분리합니다.
