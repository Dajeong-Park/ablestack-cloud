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

# ISO-02 등록·로컬 업로드 설계 및 검증 (#1667)

상위 Epic #1664, 구현 PR #1682. #1666의 공통 계약 뒤 등록·전송·Ready·사용자 데이터 연결을 구현한다. 이 문서는 진행 기록이며 미실행 항목을 통과로 표시하지 않는다.

## 확정 설계

- URL 등록과 로컬 업로드는 각각 실제 API 스키마의 지원 필드만 보낸다. HTTP/HTTPS/file URL은 서버 UriUtils 계약을 따른다. 파일·이름·Zone·부팅/OS·체크섬 오류는 폼에서 검사한다. false 값과 서버 기본 아키텍처를 보존한다.
- MoldDialog의 고정 header/footer, 본문 스크롤, busy·focus 계약을 재사용한다. 이름은 한 줄 말줄임과 전체 title을 제공한다. 상시 목록 설명 배너를 추가하지 않는다.
- 로컬 접수 ID는 postuploadisoresponse.getuploadparams.id에서 읽는다. 서명·일회 URL·헤더는 컴포넌트 런타임에만 보관하고 전송 시도 뒤 폐기한다. 저장소나 이슈 근거에 기록하지 않는다.
- 등록 요청 → 파일 전송 → 서버 Ready 확인 → 선택한 사용자 데이터/정책 연결 → 완료 순으로 진행한다. 전송 100% 또는 HTTP 접수만으로 성공을 표시하지 않는다. URL 등록도 Ready를 확인한 뒤 연결한다.
- 사용자 데이터 연결 실패는 이미 준비된 ISO와 구분한다. 같은 ID로 연결만 재시도하며 새 등록이나 파일 재전송을 하지 않는다. 옵션은 소유자/프로젝트 범위를 따르고 오래된 조회를 버린다.
- 전송 전 연결 실패는 같은 미사용 티켓으로 재시도한다. 전송을 시도한 뒤의 실패는 일회 URL을 재사용하지 않고 등록된 ISO의 상태를 확인한다. 만료 티켓은 전송 전에 차단한다.
- 중복 클릭·유효성 검사 대기·계정/권한/프로젝트 변경·컴포넌트 해제 후 응답을 방어한다. 새로고침 뒤 자동 등록을 하지 않는다. 계정이나 프로젝트가 바뀌면 이전 ID/파일/티켓을 화면에 재사용하지 않는다.
- 전송 전 폼 취소는 서버 개체를 만들지 않는다. ID 발급 뒤 닫기는 서버 취소로 표시하지 않는다. 기존 NotUploaded/UploadInProgress 삭제 금지와 정상 ABANDONED/실패 정리를 유지한다. 전역 timeout·DB 상태 수정을 사용하지 않는다.

## 서버 변경과 호환성

checksum/arch를 GetUploadParamsForIsoCmd → IsoUploadParams → 기존 TemplateProfile/업로드 metadata 경로로 전달한다. 기존 IsoUploadParams 생성자를 보존하고 새 생성자를 추가한다. 기존 vm_template.checksum/arch를 사용하며 신규 테이블·열·migration은 없다.

13번의 실제 관리 JAR을 기준으로 API arch 필드/접근자, checksum setter, 새 생성자, ISO prepare 메서드만 병합한다. 변경 클래스는 다음 네 개다.

- org/apache/cloudstack/api/command/user/iso/GetUploadParamsForIsoCmd
- com/cloud/storage/upload/params/UploadParamsBase
- com/cloud/storage/upload/params/IsoUploadParams
- com/cloud/template/TemplateAdapterBase

무관 메서드와 JAR 엔트리는 보존하고 실제 런타임 classpath로 계약 테스트를 다시 수행한다. 관리 서비스 재시작이 필요하므로 배포 전 JAR·PID·설정을 기록하고 복구본을 만든다. 호스트 agent와 전체 Cloud 배포는 수행하지 않는다.

## 단계별 수용 검증

| 단계 | 필수 확인 | 상태 |
| --- | --- | --- |
| 코드/빌드 | 변경 경로 Lint, UI 단계 회귀, 서버 계약·실제 런타임 계약 | 진행 중 |
| 4.21 환경 | 이미지와 agent 버전 확인, 관리자/소유자 URL·로컬, MD5/SHA-256, 정상/불일치, 사용자 데이터 정책 | 미실행 |
| 4.23 재생성 | 4.21 검증 후 실제 새 SSVM 생성, 이미지/agent/자산 해시, 동일 업로드·실패 회귀 | 미실행 |
| 실패/재시도 | 취소, 전송 전 실패, 전송 후 실패, Ready 후 연결 실패와 같은 ID 재시도, 만료, 중복/재방문 | 미실행 |
| 정리/배포 경계 | 시험 ISO/계정/사용자 데이터 정리, 원래 개체 보존, 필요한 UI/서버 자산만 배포 | 미실행 |

현재 실제 SSVM은 s-244-VM / 4.23.0.0이다. 4.21을 먼저 검증할 환경을 구성하고, 그 뒤 4.23으로 재생성한다. 시스템 VM 이미지·bootstrap 런타임은 버전과 해시를 별도 기록하며 기존 산출물과 console proxy를 보존한다. 보호된 SYSTEM 이미지 중 재생성/복구에 필요한 운영 산출물은 임시 QA ISO와 구분해 최종 보고에 명시한다.

## 기존 CI 부채

첫 표준 Maven 실행은 API Checkstyle 46건으로 중단됐다. 모두 변경 밖 파일이며 신규 API 파일의 지적은 0이다. server 독립 검사에서도 기존 218건과 변경 파일 지적 0을 확인했다. 기능 빌드/테스트는 이 기존 style 게이트를 구분해 수행했으며 전체 CI 성공으로 기록하지 않는다. #926·#1044와 신규 회귀를 계속 분리한다.
