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

# #1695 쿠버네티스 ISO 공통 계약

## 범위

URL/로컬 등록, 조회, 상태 변경, 삭제가 공유하는 capability·응답·요청 소유 범위를 구현합니다. RootAdmin 쓰기와 isourl 보호를 유지합니다. 일반 ISO 소유/공유 및 VM Metrics 권한으로 카탈로그 권한을 대체하지 않습니다. 상세/Zone 표시 개편은 #1699, 검색/count는 #1698, URL 검증과 로컬 전송 수명주기는 각각 #1696·#1697에서 이어갑니다.

## API와 필드

| 명령 | 권한/범위 | 처리 |
| --- | --- | --- |
| listKubernetesSupportedVersions | 해당 API가 허용된 계정. 시스템 소유 전역 카탈로그 | id/keyword/zoneid/minimumsemanticversion/minimumkubernetesversionid/arch/page/pagesize만 전달. 프로젝트·일반 ISO 필터·VM Metrics 제거 |
| addKubernetesSupportedVersion | RootAdmin + 개별 API grant | URL 모드 자체 설명·스키마 사용. name 선택(현재 UI 필수는 #1696), semanticversion/mincpunumber/minmemory 필수, zoneid 생략은 모든 Zone. url/checksum/directdownload/arch는 URL 모드 필드 |
| getUploadParamsForKubernetesSupportedVersion | RootAdmin + 개별 API grant | URL API 설명을 요구하지 않음. 상속 name/format/zoneid 필수, format=ISO. semanticversion/mincpunumber/minmemory 필수, checksum 선택. account/domainid/projectid는 상속되지만 관리자 코드가 시스템 ISO/전역 버전을 생성하므로 UI에서 보내지 않음 |
| updateKubernetesSupportedVersion | RootAdmin + 개별 API grant + 현재 리소스 | id/state만 수정. 소유자 쓰기나 이름 편집으로 확대하지 않음 |
| deleteKubernetesSupportedVersion | RootAdmin + 개별 API grant + 현재 리소스 | 기존 서버 참조 잠금 유지. #1700에서 확인/영향/부분 실패 UI 개선 |

로컬 API는 현재 arch를 선언/전달하지 않습니다. 로컬 양식에서 서버 스키마에 없는 arch 선택을 숨기고, 지원하지 않는 필드는 요청에서 제외합니다. #1697이 backend의 arch 계약·내부 ISO 전달·감사 이벤트와 실제4.21/4.23 전송을 구현/검증합니다. 이 단계는 양 계열 업로드 완료 선언이 아닙니다.

list/add/upload/update/delete를 개별로 판정합니다. UI 접근을 위한 listApis/listCapabilities 같은 기존 세션 부트스트랩과 업무 권한은 구분합니다. Zone 조회는 등록 양식에만 필요하며 카탈로그 읽기에 요구하지 않습니다.

## 응답·상태 모델

- list 응답의 정확한 envelope·행 배열·UUID·count를 검증합니다. 누락 응답/오류 객체/중첩 오류·잘못된 count를 빈 목록으로 바꾸지 않습니다.
- 알려진 빈 목록과 ID 상세 미존재를 구분합니다. count가 없는 최소 상세는 읽을 수 있지만 비어 있지 않은 목록에서 전체 건수를 추정하지 않습니다.
- false/0은 보존하고 누락된 boolean은 undefined로 둡니다. 알 수 없는 버전 상태는 enabled/disabled로 추측하지 않습니다.
- 특정 Zone은 유효 UUID가 있어야 링크 대상이 됩니다. 완전한 카탈로그 응답에서 semanticversion은 있지만 Zone 두 필드가 생략된 경우는 서버의 전역 표현입니다. 임의의 부분 응답은 unknown, 명시적 null/빈 Zone은 all, -1은 유효 Zone UUID가 아닙니다.
- directdownload의 false/true/누락을 구분합니다. RootAdmin 이외의 응답 사본에서는 isourl을 제거하고 상세 필드도 노출하지 않습니다.
- 버전 Enabled/Disabled와 ISO 가용성은 독립적입니다. isostate=Ready만으로 Zone별 준비 완료를 확정하지 않습니다. ISO 관측은 unqueried/loading/forbidden/expired/network/failed/missing/invalid와 실제 조회 결과로 분리하며 기존 ISO 가용성 모델을 재사용합니다.
- 업로드 ticket은 중첩 getuploadparams 및 직접 필드 응답을 검증합니다. id/postURL/signature/expires/metadata가 없으면 전송하지 않습니다. ticket.id는 ISO ID이며 버전 UUID로 간주하지 않습니다. ticket 및 세션 값은 런타임 메모리에서만 다룹니다.
- add/update 접수는 실제 버전 레코드가 있어야 성공으로 처리합니다. 접수 성공을 ISO Ready로 바꾸지 않습니다.

## 요청과 오류

계정·역할·허용 API/스키마·프로젝트·세션·선택 리소스가 달라지면 이전 요청 세대·화면 데이터·선택·열 스키마·대화상자를 무효화합니다. 카탈로그 자체가 전역이어도 UI의 이전 계정/프로젝트 응답은 재사용하지 않습니다.

401 세션 만료, 명령 not available for user/403/531 권한 거절, 404 미존재, 네트워크 실패, 서버 오류, 잘못된 응답을 분리해 재시도 가능한 화면을 유지합니다. 거절된 조회에 오래된 행과 작업 메뉴를 남기지 않습니다. 실제 인증 만료의 기존 로그인 경로는 유지합니다.

API wrapper의 readScope는 명시적으로 전달한 요청에만 적용되는 로컬 Axios config입니다. wire payload나 URL에는 들어가지 않으며, 이전 세션의 늦은401이 새 로그인 세션을 종료하지 않도록 기존 preserveOnFailure 경로에 연결합니다.

## 검사와 운영 검증

새 경계 검사와 기존 API/템플릿/ISO 회귀의 첫 정상 실행은6 suites/121 tests PASS입니다. 운영13번 UI·시험 계정 정리·배포 산출물 결과는 후속 검증 보고서에 기록합니다. 소스 검사만으로 실제 ACL·업로드·가용성 통과를 선언하지 않습니다. 기존 전체 CI 부채 #926·#1044는 분리합니다.
