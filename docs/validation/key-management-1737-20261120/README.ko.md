<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing
permissions and limitations under the License.
-->

# KM-10 키관리 UI 표준 및 최종 통합 검증

13번 개발 Mold UI의 같은 배포에서 가상머신 breadcrumb·목록·상세·볼륨·NIC·이벤트와 편집 대화상자를 읽기 전용 기준으로 삼았다. KMS와 HSM은 공통 Breadcrumb, ListView, ResourceLayout, ResourceView, DetailsTab, EventsTab, Status와 MoldDialog를 사용한다. 검색과 프로젝트 범위는 앞 과제의 계약을 인수한다.

| 대상 | 적용 및 확인 |
| --- | --- |
| breadcrumb와 목록 제어 | 위치, 도움말, 업데이트와 작업을 공통 배치로 표시한다. 표시 필터는 기존 활성 상태 검색에 연결하며 검색과 칩의 문맥을 유지한다. |
| 목록 | 이름 열 기본 너비를 320px로 지정했다. 셀을 한 줄로 유지하며 넘치는 내용은 말줄임으로 표시한다. 마우스를 올리거나 키보드 포커스를 주면 전체 내용이 보이며 Escape로 닫는다. 가로 스크롤은 표 내부에서 처리한다. |
| 상세와 탭 콘텐츠 | 상태를 배지와 현지화 텍스트로 표시한다. 버전, 공유 범위, 공급자, UUID와 긴 이름의 가독성을 확인했다. 탭 배치, 검색·업데이트, 관련 자원, 이벤트와 빈 상태는 VM 공통 레이아웃을 사용한다. |
| 대화상자 8개 | KMS 생성·수정·회전·전환·삭제와 HSM 추가·수정·삭제의 헤더, 도움말, 세로 폼, 본문 스크롤, 고정 footer 및 취소 포커스를 확인했다. HSM 생성은 Database·PKCS#11 두 분기를 열었고 PIN은 가짜 값의 표시·마스킹을 검증했다. |
| 테마와 대비 | 브라우저의 실제 라이트·다크 모드를 확인했다. 이름 링크, 표 제목, 표시 필터와 대화상자 제목의 렌더 색 값으로 텍스트 대비를 측정했다. |

VM 볼륨 생성·연결과 VM 삭제 사전 확인 창도 읽기 전용으로 열어 캡처했다. VM 편집의 공통 MoldDialog를 헤더·스크롤·고정 footer 기준으로 삼고, VM 삭제 사전 확인의 대상·차단 표현을 위험 작업 기준에 포함했다. VM 삭제 확인의 기존 액션 위치는 본문이며 KMS/HSM의 작업 버튼은 공통 footer에 둔다.

## UI 통합 회귀

- UI에서 만든 KMS/HSM의 활성 범위, 초기 포커스·취소/Enter/Escape, 제출 직전 참조 재조회, 회전, 비활성화/재활성화, 삭제·복귀와 시험 정리를 확인했다.
- 일반 사용자와 도메인 관리자는 실제 임시 계정에서 공개 HSM 조회와 제한된 관리 기능을 확인했다. 기본 범위와 프로젝트의 동명 키에는 서로 다른 UUID가 전달됐다.
- 이전 KEK 참조·조회 권한/오류·Unknown 및 후보의 양수 전환은 브라우저에서 응답을 통제했다. RBD 환경에서 실제 암호화 볼륨 전환·게스트 I/O·실물 HSM 장애·다중 관리 서버 검증은 [#1025](https://github.com/ablecloud-team/ablestack-cloud/issues/1025)의 범위다.

## 배포와 화면 비교

- 로컬 베이스·upstream `a050d30bcedf81b95396748ab21b2f00c74171f1`, 차이 `0 0`. 구현 커밋 `2ee740c743528b28ab5be4003006a44f4919a3d5`.
- WSL 집중 테스트 190건, 변경 파일 ESLint 및 개발용 UI 빌드 통과.
- 적용한 UI 파일 700개, `index.html` SHA-256 `06ee7c28f8da2a2850c464e05ba7f18d54a7efdbf2d9b43307e3eceee5dc7187`. 비교 VM과 키관리 화면은 같은 정적 번들을 사용했다.
- 관리 서버 JAR SHA-256 `8686477f19fbba963e7b757162dba8ea6c608ad7a6b58982f25e7322a6320b28`. `mold.service` 상태 활성, 웹 클라이언트 HTTP 200. 활성 키, HSM, 프로젝트, 계정과 도메인 시험 개체 0건.
- 짝지은 캡처 204장과 상세 JSON은 13번 검증을 수행한 WSL의 `/root/work/key-management-1737/ui-evidence/`에 보관했다. 기존 자원의 캡처는 로컬에 보관한다.

| 테마·화면 | 이름 열 KMS / HSM | breadcrumb 및 탭 글자 VM / KMS / HSM | 최소 텍스트 대비 | 대화상자 |
| --- | --- | --- | --- | --- |
| light-1440x900 | 360px / 349px | 14px/14px/14px · 14px/14px/14px | 5.00:1 | 8개 + PKCS#11 |
| light-768x1024 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 5.00:1 | 8개 + PKCS#11 |
| light-390x844 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 5.06:1 | 8개 + PKCS#11 |
| light-390x480 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 5.01:1 | 8개 + PKCS#11 |
| dark-1440x900 | 360px / 349px | 14px/14px/14px · 14px/14px/14px | 6.10:1 | 8개 + PKCS#11 |
| dark-768x1024 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 6.10:1 | 8개 + PKCS#11 |
| dark-390x844 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 6.10:1 | 8개 + PKCS#11 |
| dark-390x480 | 320px / 320px | 14px/14px/14px · 14px/14px/14px | 6.10:1 | 8개 + PKCS#11 |
