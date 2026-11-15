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

# ISO-04 #1669 수정·사용자 데이터 계약 및 13번 검증

상위 Epic #1664 · 구현 PR #1682 · 개발 순서 4/8 · 2026-11-15 KST.

## 설계

수정 창을 현재 값 보존, 명시적 변경만 저장, 재조회로 결과 확인하는 흐름으로 정리한다. 이름·설명·부팅 가능·아키텍처·OS·비밀번호 관리·동적 확장은 운영 listApis의 updateIso 파라미터에 따라 편집한다. 지원하지 않는 필드와 알 수 없는 현재 값은 덮어쓰지 않는다. false는 그대로 유지한다.

아키텍처는 x86_64·aarch64·s390x를 현재 값으로 초기화하고 옵션 label/value로 검색한다. 데이터 ISO를 부팅 가능으로 바꿀 때 None/Unknown이 아닌 실제 OS를 요구한다. OS가 바뀌면 forceupdateostype=false를 명시하며, 영향 경고를 확인하고 스위치를 켠 경우만 true를 전송한다. OS 미변경 시 이 파라미터를 보내지 않는다.

메타데이터와 사용자 데이터 연결은 별도 단계다. 연결만 바꾸면 updateIso를 호출하지 않는다. 연결/정책 변경·해제 후 listIsos로 실제 값을 확인한다. 메타데이터 저장 뒤 연결이 실패하면 입력과 이미지 ID를 유지하고 사용자 데이터 단계만 재시도한다. 응답 유실은 GET 상태 확인으로 해소하며 자동으로 변경 요청을 반복하지 않는다. 전송 전 최신 값과 비교해 다른 창의 변경을 덮어쓰지 않는다.

### ISO 설정 탭 비채택 근거

운영 UI API 문서의 updateIso는 공통 상속으로 details/cleanupdetails를 노출한다. 이 사실만으로 ISO 전용 설정 후보·편집 계약이 성립하지 않는다.

- api ResourceTag.ResourceObjectType.ISO는 metadataSupport=false다.
- ResourceMetaDataManagerImpl의 DAO map에 Template은 있으나 ISO는 없다.
- QueryManagerImpl.listDetailOptions는 Template/UserVm/VnfTemplate/DisasterRecoveryCluster를 처리하며 ISO는 지원하지 않는다.
- updateTemplateOrIso는 임의 details 저장 경로를 상속하지만 ISO에서 허용할 키·값 후보와 읽기/쓰기 제한을 정의하지 않는다.
- UserVmManagerImpl의 ISO 생성 시 details 복사 경로는 이 누락된 운영 계약을 대신하지 않는다.

따라서 #1669의 조건부 완료 기준에 따라 ISO 설정 탭을 추가하지 않는다. VM/Template의 키 후보나 listTemplates/updateTemplate를 재사용하지 않는다. 기존 ISO의 details·format·공개·추출·체크섬 등 이번 수정 범위 밖 값은 요청에서 생략하여 보존한다. 백엔드·스키마 변경은 없다.

## 검증 상태

구현 후 단위 검증과 운영 UI 입력 빌드를 진행하고 있다. 최종 UI 검증·배포·자원 정리 근거는 검증 완료 뒤 추가한다. 이 문서는 아직 완료 보고가 아니다.

## CI 부채

전체 License/Lint의 기존 부채 #926·#1044는 별도로 관리한다. 변경 경로 검사와 기준 브랜치 대비 진단을 구분하며 전체 CI 성공으로 표시하지 않는다.
