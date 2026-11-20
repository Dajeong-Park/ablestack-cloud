<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->

# KM-05 작업 가용성 및 후보 상태 검증

2026-11-20 KST에 13번 개발 클러스터의 Mold 웹 UI에서 [#1732](https://github.com/ablecloud-team/ablestack-cloud/issues/1732)를 검증했다. 기능 실행은 브라우저에서 했으며 UI가 발생시킨 요청과 결과를 함께 확인했다.

## WSL 집중 검증

| 대상 | 결과 |
| --- | --- |
| `server -am` KMSManagerImpl 계열 및 전환 권한 테스트 | 120건 통과 |
| 작업 가용성·검색·작업 복구·전환·HSM 폼 Jest | 5개 묶음 102건 통과 |
| 변경 Java Checkstyle 및 UI ESLint | 오류 0건 |
| UI 개발 적용 번들 | 빌드 성공. Webpack이 정적 파일 크기 경고를 보고했다. |

공개·도메인 공유·계정·프로젝트·존별 조합과 만료된 문맥의 지연 응답은 WSL 테스트에서 검증했다. 기본 Database HSM의 서버 삭제 거부도 단위 테스트에서 확인했다.

## 13번 클러스터 UI

| 시나리오 | 결과 |
| --- | --- |
| 활성 후보가 없는 키 생성 | 관리자에게 HSM 등록·활성화 링크, 일반 User에게 관리자 문의 안내를 표시했다. 확인은 비활성화됐다. |
| 후보 조회 실패 | UI 브라우저에서 HSM 목록의 GET 응답에 403·530을 주입했다. 권한 부족과 재조회 가능한 실패를 별도로 표시했다. |
| 기본 Database HSM의 삭제 보호 | 시스템 소유 기본 프로파일의 삭제를 UI에서 차단했다. 동일 이름으로 만든 일반 프로파일은 정확한 별도 UUID를 확인한 뒤 UI에서 삭제했다. |
| 비활성 KMS 키 | 수정과 재활성화가 가능했다. 교체와 볼륨 전환은 비활성 상태로 이유를 표시했다. |
| 교체 직전 상태 변경 | 교체 창이 열린 상태에서 다른 탭으로 현재 HSM을 비활성화했다. 현재 HSM 유지 시 교체 POST 0건, 다른 활성 HSM을 직접 선택한 뒤 교체 POST 1건과 대상 반영을 확인했다. |
| 프로젝트 후보 | 시험 프로젝트의 HSM은 해당 프로젝트를 선택했을 때 후보로 표시됐다. 프로젝트 선택 해제 후 선택된 후보를 폐기하고 제출을 차단했다. |
| HCI/RBD의 볼륨 전환 | 적합 후보 0건을 표시했고 전환 POST 0건이었다. 암호화 볼륨의 실제 전환·데이터 I/O와 실물 HSM 검증은 #1025 인수 범위에 남는다. |

기본 시스템 프로파일은 Disabled를 유지했다. 시험용 KMS 키, HSM 프로파일, User 계정, 프로젝트는 UI에서 삭제했으며 마지막 읽기 전용 점검에서 활성 시험 리소스 0건을 확인했다.

## 배포 증거

- WSL 로컬 베이스·upstream `b2e0ff6086ca1813dbddc961d5c35b122aa4a99f`. 양방향 차이 `0 0`.
- 기능 커밋 `7588a721d554a7d186b8bde2ae33ed4d1c1280d0`. 기존 Epic 브랜치를 동기화된 로컬 베이스 위에 재배치했다.
- 13번 `mold.service` 상태 `active`, Mold 웹 클라이언트 HTTP 200. 관리 서버 JAR의 대상 클래스 3개를 교체했고 기존 나머지 92,938개 엔트리의 파일 내용은 일치했다.
- 변경 후 클래스 배포 JAR의 SHA-256 `fa40cedca0ea6a6c7bb7a123b2af38aff4172ee763062e2f72eeb32d6ea61cb0`.
- 배포 UI `index.html` SHA-256 `77aba8c92a52df66e3990b5122e2439ca582ab0feeb0be47231b8983dc13f7b2`. 정적 파일 698개를 해시로 확인했고 기존 `config.json`을 유지했다.
- 개발 적용 백업 `/var/lib/cloudstack/management/key-management-1732-backup-20261120/`. 호스트 에이전트 및 DB 스키마 변경은 없었다.

### 시험 대상 식별자

| 자원 | UUID |
| --- | --- |
| 시험 KMS 키 | `1d1164dd-1938-4038-8187-2e09414e1d8b` |
| 기존 대상 시험 HSM | `1887b740-3ae8-4994-bd39-35e2b56ead18` |
| 명시적 대체 시험 HSM | `aad43c2d-7034-4e56-9fb3-b01ccca49193` |
| 일반 User 계정 | `f21a3e5c-79e1-4317-a36d-1ff8e19659ab` |
| 시험 프로젝트 | `8b562e74-879e-4d76-b3df-4dc61372e4c5` |
| 프로젝트 HSM | `2931f7fb-e170-4a08-b7cb-c697bd2dcf71` |
