<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at
//
  http://www.apache.org/licenses/LICENSE-2.0
//
Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# ISO-01 공통 계약 설계 및 검증 (#1666)

상위 Epic #1664. UI 정적 자산만 변경한다. 등록 전송/재시도는 #1667, 공유 응답 및 공유 Zone 렌더링은 #1668, 목록/상세/탭/대화상자의 본격적인 VM 스타일 정렬은 후속 이슈 범위다.

## 설계

- `isoModel.js`는 서버 원문을 변경하지 않고 표시용 복사본만 만든다. boolean true/false와 문자열 true/false를 해석하며 누락 값을 임의의 true로 만들지 않는다. 선택적 저장소 정보가 없어도 서버 Ready=true는 사용 가능이다.
- URL 등록과 로컬 업로드는 각각 registerIso / getUploadParamsForIso의 API 허용 여부와 파라미터 메타데이터를 확인한다. 버전 문자열로 추측하지 않는다. arch 미지원은 비활성 필드의 설명으로 표시하고, 메타데이터 미확인 상태의 제출은 차단한다.
- 기존 가용성 컴포넌트를 재사용해 목록·InfoCard·Zone의 표시를 통일한다. ABANDONED/UPLOAD_ERROR/DOWNLOAD_ERROR는 실패이며 다운로드 100%만으로 Ready를 만들지 않는다. 대표 Zone 응답은 전체 Zone 검증 결과로 표시하지 않는다.
- ISO 목록의 state를 공통 customRender로 덮어쓰지 않는다. ID·이름·원래 서버 필드와 관련 없는 값을 보존한다.
- 소유자/프로젝트/API/시스템 리소스/Ready/bootable 판단을 하나의 helper로 연결한다. 루트 도메인 숫자 비교를 사용하지 않는다. UI 판단은 서버 ACL을 대체하지 않는다.
- Zone 데이터는 계정·역할·API 목록·프로젝트·ISO 범위에 묶고, 범위가 바뀌거나 새로고침에 실패하면 이전 선택으로 작업을 실행하지 않는다. 실패 응답은 정상적인 빈 목록과 구분한다.

## 작업 조건

모든 작업은 해당 API의 실제 허용 항목과 ISO ID를 필요로 한다. 정보 부족은 허용 근거가 아니다.

| 작업 | 추가 조건 |
| --- | --- |
| URL 등록 | registerIso, 사용 가능한 Zone, 선택 모드의 파라미터 메타데이터 |
| 로컬 업로드 | getUploadParamsForIso, 사용 가능한 Zone, 선택 모드의 파라미터 메타데이터; registerIso와 독립 |
| 수정·공유·복사 | 비시스템 ISO 소유 범위 + Ready |
| 계정/프로젝트 공유 | 위 조건 + listIsoPermissions |
| 삭제 | 비시스템 ISO 소유 범위 + Ready 또는 확인된 실패; 전송 시작 대기/진행 상태 제외 |
| 다운로드 | 비시스템 ISO 소유 범위 + Ready + 루트 관리자 또는 isextractable=true |
| VM 생성 | listIsos + deployVirtualMachine + Ready + bootable=true; 읽을 수 있는 공유 ISO 사용 가능 |
| 일괄 삭제 | 각 행의 삭제 조건을 선택 시점·실행 시점에 재확인 |

루트 관리자는 타 계정의 일반 ISO를 관리할 수 있다. 개인 계정은 일치하는 account/domainid, 프로젝트는 현재 선택된 projectid를 요구한다. 시스템 ISO는 관리자에게도 수정·공유·복사·삭제·추출 작업을 제공하지 않는다. 비부팅 ISO의 VM 생성 버튼은 이유를 표시하고 비활성화한다.

## 배포 경계

기준 브랜치 1046a5dc3f21cb9cca0ab6881dd906d64b591e80. 배포 입력은 13번 실제 index SHA-256 a70a72b89234fc6d3b5592e17f0be63a7adbbe25b8fa2330aa2cf6fce57976c9와 일치하는 기존 UI 아카이브다. 여기에 이번 소스 차이와 네 개 번역 항목만 적용해 빌드한다. 전체 최신 브랜치의 무관한 UI 변경을 배포하지 않는다. backend JAR·DB·서비스·설정·테마 변수·이전 해시 자산을 보존하고 index는 마지막에 교체한다.

## 검증 결과

최종 실행 결과와 실제 UI/정리 근거는 완료 후 이 문서와 evidence 파일에 기록한다. 미실행 사례를 PASS로 기록하지 않는다. 현재 환경은 단일 Zone/KVM이며 실제 다중 Zone·비KVM·구형 서버는 별도 환경 검증 대상이다. 관련 불완전 관측/메타데이터 계약은 단위 테스트로 검증한다.

기존 저장소 전체 CI 부채 #926·#1044는 별도 관리한다. 변경 경로 Lint/단위 테스트/빌드와 실제 UI 결과를 기준으로 이번 변경의 회귀를 판단하며 전체 CI 성공으로 확대하지 않는다.
