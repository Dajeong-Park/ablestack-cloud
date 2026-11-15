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

# ISO-07 #1672 다운로드·부팅/데이터 미디어 소비

Epic #1664 · PR #1682 · 개발 순서 7/8 · 2026-11-15 KST.

## 설계

- ISO 다운로드를 기존 MoldDialog로 표시하고 이름/ID/Zone, 준비·조회 실패·다시 준비·파일 받기를 현지화한다. job 완료는 준비 완료이며 실제 수신 완료와 구분한다. 일회 URL은 해당 창 메모리에서만 유지하고 raw HTML·로그·문서·전역 알림에 넣지 않는다. 인증서/브라우저 보호는 유지한다.
- 부팅 ISO는 엄격한 ready/bootable 값과 실제 접근 가능한 Zone·arch/OS 경로를 사용한다. 고전 위저드의 ISO/템플릿 선선택은 요청한 ID와 일치시킨다.
- 데이터 미디어는 기존 VM 선택 → 동일 VmIsoManager로 연결한다. ISO 상세 작업과 Zone에 같은 진입 컴포넌트를 사용하고 attach/detach 쓰기·폴링을 복제하지 않는다.
- 공통 VM 미디어 후보는 공유 필터를 포함해 페이지 수집하고 기존 장치/한도/상태·ConfigDrive의 서버 제공 cap과 권한을 보존한다. 이미 연결된 항목·한도/상태 오류를 구분한다. 세션/프로젝트/역할/API 경계의 늦은 응답을 폐기한다.

## 검증 계획과 배포 범위

URL 데이터 ISO·로컬 부팅 ISO의 실제 추출/수신 크기·SHA-256, 전용 VM의 실제 부팅과 데이터 미디어 연결/해제·중복/한도/상태/권한, ISO/VM 탭·작업 진입과 키보드/테마/좁은 화면을 확인한다. 기존 사용자 VM은 변경하지 않으며 사용한 자원을 ID로 추적해 정리한다. 13번 단일 Zone·KVM 범위를 유지하고 다중 Zone·비KVM 성공으로 기록하지 않는다.

UI 자산만 변경하고 현재 운영 입력에 이번 delta를 적용한다. 기준 로컬/상위 ablestack-europa는 1046a5dc3f21cb9cca0ab6881dd906d64b591e80, 차이 0/0을 확인했다. 전체 CI 부채 #926·#1044는 별도 OPEN 관리한다.

## 현재 상태

구현과 단위 검사 중이다. 제품 배포·최종 UI 검증·수신/정리·이슈 종료 전이며 완료 보고가 아니다.
