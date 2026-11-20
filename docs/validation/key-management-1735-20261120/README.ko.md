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

# KM-08 목록 문맥과 삭제 후 복귀 검증

2026-11-20 KST에 13번 Mold 개발 UI에서 [#1735](https://github.com/ablecloud-team/ablestack-cloud/issues/1735)를 검증했다. 시험용 자원을 웹 UI에서 만들고 삭제했다. UI에서 발생한 요청의 명령·메서드·상태와 확인에 필요한 필터·UUID만 관찰했다.

## 동작

목록 문맥은 상세로 이동한 브라우저 이력 항목에 보관한다. 리소스 종류·UUID와 현재 로그인·프로젝트 범위가 일치할 때만 허용된 목록 조건을 복원한다. 브라우저 새로고침 때 외부 로그인 쿼리를 정리해도 키관리 이력 상태는 유지된다. 직접 링크나 새 탭은 현재 범위의 기본 목록으로 복귀한다.

삭제 완료와 대상 부재를 확인한 뒤 해당 목록으로 replace한다. 성공한 목록 응답의 최신 건수를 기준으로 페이지를 보정한다. 목록 API의 정렬은 서버의 기존 ID 순서를 사용한다.

## 13번 UI 검증

| 시나리오 | 확인 내용 |
| --- | --- |
| HSM 목록 복귀 | 검색·활성·프로토콜 조건과 2페이지를 적용했다. 목록→상세→이벤트, 새로고침 및 뒤로·앞으로에서 복귀 문맥을 확인했다. 페이지 크기를 UI에서 1에서 20으로 바꾼 뒤 복귀에도 반영됐다. |
| KMS 목록 복귀 | 검색·활성·HSM 필터를 적용한 2페이지가 breadcrumb로 복원됐다. 같은 상세 주소를 새 탭에서 열었을 때 기본 목록으로 복귀했다. |
| KMS 및 HSM 삭제 | 목록의 마지막 페이지 행을 삭제하고 기존 필터·페이지 크기를 유지한 채 1페이지로 보정했다. 다른 종류의 목록에서 직접 연 KMS 상세, 새 탭에서 연 HSM 상세도 삭제 후 각각 자신의 목록으로 복귀했다. |
| 삭제 직후 목록 오류 | 시험 브라우저에서 목록 GET 503 응답을 주입했다. 2페이지를 유지했고 재조회가 성공한 뒤 최신 건수에 따라 1페이지로 이동했다. |
| 삭제 결과 미확정 | 시험 브라우저에서 삭제 요청의 전송을 중단했다. 결과 미확정 안내를 닫은 뒤 상세에 머물렀다. 이후 정상 요청과 결과 확인에서 복귀했다. |
| 상세 오류 | 통제한 404·403·503·연결 실패를 구분했다. 재시도 가능한 오류에서 응답을 복구하자 대상 상세가 표시됐다. |
| 동일한 이름의 새 UUID | 실제 삭제된 이전 UUID는 대상 없음으로 표시됐다. 동일한 이름으로 생성한 새 UUID는 직접 조회할 수 있었고 별도의 개체로 삭제했다. |
| 프로젝트와 지연 응답 | 프로젝트 전환 후 이전 검색 문맥을 폐기하고 활성 프로젝트의 목록을 표시했다. 이전 상세의 지연 오류가 현재 상세를 덮어쓰지 않았다. |
| breadcrumb 표시와 접근 | 기본·프로젝트 테마에서 390px 긴 이름 줄바꿈과 키보드 링크 이동을 확인했다. 가상머신 전체 스타일 비교는 #1737에서 수행한다. |

도메인·계정·존·공개 여부 조합은 WSL 테스트에서 함께 확인했다. 시험 자원은 UI에서 정리했고 읽기 전용 점검에서 잔여가 없음을 확인했다.

## 코드와 배포

- 로컬 베이스와 upstream `b2e0ff6086ca1813dbddc961d5c35b122aa4a99f`. 차이는 `0 0`.
- 기능 커밋 `3fec1db277478b0229b7bf6286f738c6b99ff56f`.
- WSL 집중 테스트 10개 묶음, 166건 통과. 변경 파일 ESLint 오류 0건. WSL 개발 UI 빌드 성공.
- 13번 `mold.service`는 `active`, 웹 클라이언트 HTTP 200. 관리 서버 실행 JAR SHA-256 `fa40cedca0ea6a6c7bb7a123b2af38aff4172ee763062e2f72eeb32d6ea61cb0`는 #1732 검증과 일치했다.
- UI `index.html` SHA-256 `c26b417a0473c221524a38fb719b522ed6e4b1da9cf889323e32576cde3f3719`. 정적 파일 698개 해시 일치, 기존 `config.json` 유지.
- 백업 경로 `/var/lib/cloudstack/management/key-management-1735-backup-20261120/ui`.

### 시험에 사용한 UUID

| 개체 | UUID |
| --- | --- |
| KMS 키 A | `80a7bfac-7cb7-4a31-9941-b720626ab68c` |
| KMS 키 B | `c2529565-9a59-4760-af0c-b4c13df4f9dd` |
| HSM A | `14d40b1b-487b-4024-b0e3-943ace942b5b` |
| HSM B | `4a0531c4-5714-4363-ac10-e87ea416f061` |
| HSM B와 같은 이름의 새 프로파일 | `6bdc0aa2-db52-4bd5-b8af-73d2285d9f3b` |
| 시험 프로젝트 | `119da4ea-8254-45ec-855d-bd983b27c907` |
| 프로젝트 HSM | `52534494-fa19-4d54-95fa-790238c2e2b4` |
| 새 탭 삭제용 HSM | `7e64381a-3c1f-4433-aec2-65d006496da3` |
