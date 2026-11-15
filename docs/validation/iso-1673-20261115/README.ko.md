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

# ISO-08 #1673 실계정 ACL·통합 UI 회귀

Epic #1664 · PR #1682 · 개발 순서 8/8 · 13번 단일 Zone/KVM.

## 설계와 검증 범위

- 기본 listVirtualMachines만 허용된 역할은 해당 API로 VM 목록/상세/ISO 탭을 읽는다. 기존 Metrics-only 역할도 유지하며 Metrics/사용 이력과 쓰기는 각각 실제 API 권한으로 제한한다. 공유 기본 역할 권한을 늘리지 않는다.
- A01~A16: Root 일반/시스템 보호, 일반 소유/공유/미공유, Domain Admin 관리/범위 밖, 프로젝트 소유/구성원/비구성원, Read-Only User/Admin, URL/local 전용 및 공유 조회/갱신·삭제/복사/배포/추출 개별 API 허용/거부를 실제 계정으로 검증한다.
- 행렬의 목록/직접 상세/Zone/선택/작업/제출/비동기 결과·회수를 UI로 확인하고 기대/실제·ID·증거를 기록한다. 시스템 원본은 읽기/보호 조건만 시험한다.
- 일반/다크와 실제1440×1000·1280×720·390×844·390×480, 긴 값·오류/빈/늦은 응답·페이지·키보드·템플릿/VM/VPC 공통 회귀를 확인한다.
- #1667 4.21/4.23 업로드와 #1672 실제 파일 수신/부팅·미디어 근거를 변경 경로와 연결한다. 업로드 변경 없이 SystemVM 재생성은 반복하지 않는다. 다중 Zone·비KVM은 합의된 NOT_RUN 범위로 기능을 유지한다.
- UI 변경만 현재 운영 입력에 적용해 필요한 자산만 배포하고 설정/backend/기존 자원을 보존한다. 전용 자원은 ID로 추적해 UI 정상 경로로 정리한다.

## 현재 상태

구현·통합 시험 준비 중이며 완료 보고가 아니다. #1673/Epic은 OPEN, PR은 Draft, CI 부채 #926·#1044는 별도 OPEN 유지한다.
