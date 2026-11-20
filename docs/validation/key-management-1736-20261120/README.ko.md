<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the License at
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing
permissions and limitations under the License.
-->

# KM-09 사용 볼륨·관련 키 및 참조 집계

2026-11-20 KST에 13번 개발 클러스터의 Mold 웹 UI에서 [#1736](https://github.com/ablecloud-team/ablestack-cloud/issues/1736)을 검증했다. 시험 자원은 UI에서 만들고 삭제했다. 요청 증거는 명령, 메서드, 상태, 관련 UUID·검색 조건과 건수만 기록했다.

## 구현 계약

KMS 사용 볼륨과 HSM 관련 키 탭은 부모 UUID로 목록을 조회한다. 부모의 소유 범위와 활성 프로젝트를 반영한다. 표의 현재 페이지와 서버 전체 건수를 별도로 표시한다. 상세로 이동한 뒤 돌아오면 탭의 검색·페이지를 복원한다. 기존 전역 목록 링크도 같은 관련성 필터를 전달한다.

정확한 ID로 읽은 응답에 참조 요약을 선택적으로 포함한다. KMS 키는 삭제 검사 기준의 실제 볼륨과 래핑 키를 집계하고, HSM은 현재 연결 키와 해당 HSM의 활성·이전·보관 KEK 버전에 남은 래핑 키를 집계한다. 래핑 키는 버전과 일대일로 결합해 한 번만 센다. KMS 요약은 루트 관리자 또는 키 소유 계정의 볼륨 읽기 권한을 확인한다. HSM 요약은 KMS 키 읽기 권한이 있는 루트 관리자에게 제공한다. 목록 응답, 제한된 공개 응답 및 읽기 권한이 부족한 경우에는 집계를 생략한다. KM-07은 이 API와 UI의 `kmsUsage`를 재사용한다.

## 13번 UI 검증

| 시나리오 | 결과 |
| --- | --- |
| 실제 HSM 관련 키 조회 | 시험 키를 만들기 전 0건, 회전 후 1건, 페이지 크기 10으로 11건의 두 번째 페이지를 확인했다. 동일한 범위에서 탭 검색, 관련 상세, 탭 새로고침 및 복귀, 전역 목록 필터를 확인했다. |
| 실제 회전·대상 삭제 | Database HSM 간에 시험 키를 회전해 현재 관련 키가 이동하는 것을 확인했다. 다른 탭에서 키를 삭제한 뒤 원래 사용 볼륨 탭을 업데이트해 대상 없음 표시를 확인했다. |
| 프로젝트와 제한된 공개 응답 | 기본 범위와 프로젝트에서 같은 이름의 서로 다른 키 UUID를 만들고, 각각의 HSM 탭에서 일치하는 대상을 확인했다. 일반 User의 공개 프로파일 응답에는 집계가 없었고 UI는 확인할 수 없음을 표시했다. |
| 후보 오류와 지연 응답 | 브라우저에서 403·503 및 이전 HSM의 지연 응답을 통제했다. 권한 부족·실패를 구분했고 이전 문맥의 행과 건수를 표시하지 않았다. 응답 복구 후 재조회 성공을 확인했다. |
| HCI/RBD 볼륨과 이전 참조 | 실제 사용 볼륨 0건을 확인했다. 양수 볼륨 행·상세 복귀, 볼륨 0건과 래핑 키 3건, 현재 HSM 키 0건과 이전 KEK 경유 래핑 키 4건은 브라우저 통제 응답으로 확인했다. 볼륨과 래핑 데이터를 변경하는 실제 암호화 전환은 #1025에서 다룬다. |

검증에 사용한 활성 시험 KMS 키·HSM 프로파일·프로젝트·계정이 모두 0건임을 읽기 전용으로 다시 확인했다.

## WSL 집중 테스트와 개발 적용

- WSL 로컬 베이스·upstream `a050d30bcedf81b95396748ab21b2f00c74171f1`. 양방향 차이 `0 0`.
- 기능 커밋 `b50368794f9047ffe6ffae9df12cfdb34b6cd752`. 동기화된 로컬 베이스에 기존 Epic 커밋 18개를 패치 변경 없이 재배치했다.
- WSL 백엔드 집중 124건, UI 집중 175건 통과. 변경 Java Checkstyle 0건과 UI ESLint 통과.
- 관리 서버 JAR의 클래스 8개를 교체했다. 나머지 92,933개 엔트리의 내용이 일치했다. 적용 후 JAR SHA-256 `8686477f19fbba963e7b757162dba8ea6c608ad7a6b58982f25e7322a6320b28`.
- WSL UI 개발 빌드의 파일 700개를 검증했다. 적용된 `index.html` SHA-256 `996a6e6584f5b13e475c1ece9d917ae0e4a8dc816c8e46b0654ec0b8c914f3eb`. 기존 UI 설정을 유지했다.
- 배포 백업 `/var/lib/cloudstack/management/key-management-1736-backup-20261120/`. 검증 후 `mold.service` 활성, 웹 클라이언트 HTTP 200.

### 대표 검증 대상 UUID

| 자원 | UUID |
| --- | --- |
| 시험 HSM A | `a4e3d3a5-ead7-42bf-bfae-df3144981f6e` |
| 시험 HSM B | `5d6285e2-12f9-4695-b99e-843bd5510324` |
| 회전 시험 키 | `cefa27f7-a760-4cc7-873b-158993e2e08b` |
| 2페이지 및 다른 탭 삭제 시험 키 | `eb1c5800-02b3-4ef0-8623-9e21dc4d952a` |
| 프로젝트 | `f027ccdb-72b5-43bd-ad44-00840cc1a07f` |
| 프로젝트 HSM | `c52e46e5-81a3-46f1-bbb2-5e7b930bab63` |
| 프로젝트 동명 키 | `e8d81989-9469-41a9-b809-a7d01fc4e42b` |
| 기본 범위 동명 키 | `026f1af8-14b5-41a1-872c-50c1abbb6c0c` |
| 공개 HSM | `d5193309-df01-4e5f-8d70-4cf9da2775fd` |
