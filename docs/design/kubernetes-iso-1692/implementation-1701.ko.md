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

# #1701 VM 표준 스타일 정렬 설계와 적용 범위

## 기준과 문제

13번 운영 VM의 breadcrumb·InfoCard·세로 탭·라벨/값·편집 창을 직접 비교했다. VM 탭 rail은 약 100px, 콘텐츠 상단 여백은 47px, 상세 행 padding은 `12px 0`이다. 기존 KISO는 rail 71px, 상단 25px, 상세 행 좌우 8px로 달랐다.

기존 KISO 목록의 이름은 75px인데 상태/CPU/RAM은 113/154/171px이었다. 긴 이름의 행 높이는 1280/810/390 폭에서 각각 69/113/333px이었다. #1694의 템플릿 이름 고정 아이콘·유연 링크 슬롯을 KISO 전용 분기에도 적용한다. 템플릿 자체의 분기와 링크는 유지한다.

## 배치와 접근성

- 이름 420px(모바일 280px), 부가 열 112~180px, 열 선택 36px. 표는 고정 레이아웃·한 줄 ellipsis·내부 가로 스크롤을 사용한다. 실제 원문을 데이터에서 자르지 않는다.
- 전체 이름·부가 값·열 제목·현재 breadcrumb·Zone 원인은 hover/focus 툴팁으로 읽는다. `KeyboardTooltip`은 원래 링크/초점 요소를 그대로 유지하고 Escape로 툴팁만 닫는다.
- 가로 스크롤 영역을 Tab으로 선택하고 좌우/Home/End로 이동한다. 자식 링크/정렬/체크박스의 키 입력은 가로채지 않는다.
- 열 선택은 네이티브 버튼→체크박스 팝업이다. Enter로 열기, 첫 체크박스 초점, Space 변경, Escape 닫기와 버튼 초점 복귀를 제공한다. Ant Tooltip이 내부 가시성을 RAF로 반영하므로 표시 다음 프레임에 초점을 옮긴다. `visible` 갱신은 명시적으로 연결한다.
- VM과 같은 공통 semantic toolbar, 탭 rail 최소 100px, 상단 여백 22px 추가, 상세 `12px 0`을 사용한다. KISO route 클래스로 범위를 제한한다.
- 좁은 화면에서 툴바/검색/페이지네이션은 줄바꿈하고 표 안에서 스크롤한다. CPU/메모리 양식은 575px 이하에서 세로로 배치한다. 대화상자의 대상/영향 정보는 테마 토큰을 사용하며 긴 UUID/URL/오류는 필요한 곳에서 줄바꿈한다.

## 실제 UI 검증에서 보완한 경계

- 상세 이벤트 표도 공통 `ListView`를 사용하므로 route 이름만으로 주 목록을 판단하지 않는다. 상세 ID가 없는 주 목록에만 이름 폭·상태 셀·스크롤 규칙을 적용한다. 이벤트의 Completed 등을 버전 사용 설정으로 잘못 해석하지 않는 회귀 테스트를 추가했다.
- 라이트 모드의 기존 이름 링크 색상은 흰색 배경과 대비 3.24였다. KISO 목록에만 기존 `--ui-link` 토큰을 적용한다. VM·템플릿·ISO의 기존 링크 색상은 이번 수정 대상에 포함하지 않는다.

## 긴 입력의 명확한 거절과 복구

스타일 검증에서 API가 허용한 URL 길이 255를 넘으면 gateway 431로 명령 실행 전에 거절되지만 UI가 결과 불명으로 남는 문제를 재현했다.

API discovery에 길이가 있으면 양 모드의 문자열 검증에 사용한다. discovery에 없는 값은 임의 길이로 자르지 않는다. URL 등록에서 정확한 gateway 사전 실행 길이 거절 서명과 알려진 필드가 확인된 경우에만 중복 제출 journal을 해제하고 해당 필드 오류/편집 상태로 돌아간다. 일반 431·서버 오류·응답 유실의 결과 불명 보호는 유지한다. 로컬 전송 티켓이 접수된 뒤의 복구 방식은 변경하지 않는다.

## 배포와 검증 경계

정식 소스는 최신 로컬 기준 `aff74eee0d835891f9209492514f6c2d204bc138`에서 재배치했다. 기존 운영 공통 UI의 의도된 차이를 보존하기 위해 동일한 운영 빌드 입력 경로에 이번 KISO 변경만 적용하고 파일별 해시를 기록한다. UI 정적 파일 델타만 배포하며 Backend/DB/Agent/SystemVM은 변경하지 않는다.

실제 검증은 UI로 수행한다. 1440/1280/810/390, 작은 높이, 양 테마, 긴 한글/영문·원문·실패, 모달/키보드와 VM/템플릿/ISO 회귀를 확인하고 전용 자원만 정리한다. 실제 미완료 업그레이드 pin UI는 사용자 승인대로 #1707 해결 후 #1702에서 검증한다. 기존 CI #926·#1044는 별도 관리한다.
