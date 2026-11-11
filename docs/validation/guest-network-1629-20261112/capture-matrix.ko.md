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

# UI 표준·캡처

UI 소스/스타일·활성 static675개는 그대로다. 기존 **컴퓨트 > 가상머신** 목록·상세·NIC 탭·연결 대화상자·breadcrumb와 Shared IP 표/툴바/페이지를 실제 비교했다. 같은 reload 아이콘+업데이트 텍스트, 네트워크/VM 링크와 모바일 표의 수평 스크롤을 유지했다. [24개 레이아웃 측정](evidence/ip-layout-cases.json) · [12주체 역할 UI](evidence/role-ui-checks.json) · [프로젝트/이동](evidence/navigation-cases.json).

90개의 최종 원본 JPEG는 각각 실제 viewport 크기·대상 클러스터와 일치하며 편집/리사이즈하지 않았다. 메타데이터의 탭 연결 오류를 발견해 해당31번 화면을 다시 수집했다. 123번 관측 중 같은 이름으로 갱신된33개의 이전 메타데이터는 제외하고 최종90개 파일과 마지막 메타데이터를 대조했다. 31-member-project-default-cleared는 전환 도중의 경과 프레임이고 stable 캡처/측정으로 판정했다. **반응형 배치 판정은 아래24조합의48장**을 근거로 한다. [이미지 해시·크기·용도](evidence/capture-audit.json) · [파일별 최종 문맥](evidence/captures.json).

## 역할·복구·표준 화면

| 구분 | 31 | 32 |
| --- | --- | --- |
| 실제 수정 전531 | [구성원](screenshots/31-before-member-ip531.jpg) | [읽기 전용](screenshots/32-before-readonly-ip531.jpg) |
| 수정 후 원래 탭 정상 복구 | [구성원](screenshots/31-member-ip-recovered.jpg) | [읽기 전용](screenshots/32-readonly-ip-recovered.jpg) |
| 소유자18개 | [소유자](screenshots/31-owner-ip-authorized.jpg) | [소유자](screenshots/32-owner-ip-authorized.jpg) |
| DomainAdmin18개 | [DomainAdmin](screenshots/31-domainAdmin-ip-authorized.jpg) | [DomainAdmin](screenshots/32-domainAdmin-ip-authorized.jpg) |
| 비구성원 프로젝트 비노출 | [차단](screenshots/31-nonmember-no-project.jpg) | [차단](screenshots/32-nonmember-no-project.jpg) |
| 읽기 전용 VM NIC 쓰기 버튼0 | [NIC](screenshots/31-readonly-vm-nics-guard.jpg) | [NIC](screenshots/32-readonly-vm-nics-guard.jpg) |
| VM 목록·breadcrumb | [목록](screenshots/31-readonly-vm-list-breadcrumb.jpg) | [목록](screenshots/32-readonly-vm-list-breadcrumb.jpg) |
| VM 표준 연결 대화상자 | [연결창](screenshots/31-member-nic-dialog-standard.jpg) | [연결창](screenshots/32-member-nic-dialog-standard.jpg) |
| 프로젝트 기본 문맥 데이터 제거 | [안정 상태](screenshots/31-member-project-default-stable.jpg) | [읽기 전용](screenshots/32-readOnly-project-default.jpg) |
| 관리자 최종 확인 화면 | [Shared IP](screenshots/31-final-admin-shared-ip.jpg) | [Shared IP](screenshots/32-final-admin-shared-ip.jpg) |

## 반응형·밝음/다크24조합

| 사이트 | 역할 | 테마 | 폭 | 실제 스크롤 좌·우 |
| --- | --- | --- | --- | --- |
| 31 | member | light | 1280 | [주소](screenshots/31-member-ip-light-1280-addresses.jpg) · [VM 링크](screenshots/31-member-ip-light-1280-links.jpg) |
| 31 | member | light | 768 | [주소](screenshots/31-member-ip-light-768-addresses.jpg) · [VM 링크](screenshots/31-member-ip-light-768-links.jpg) |
| 31 | member | light | 390 | [주소](screenshots/31-member-ip-light-390-addresses.jpg) · [VM 링크](screenshots/31-member-ip-light-390-links.jpg) |
| 31 | member | dark | 1280 | [주소](screenshots/31-member-ip-dark-1280-addresses.jpg) · [VM 링크](screenshots/31-member-ip-dark-1280-links.jpg) |
| 31 | member | dark | 768 | [주소](screenshots/31-member-ip-dark-768-addresses.jpg) · [VM 링크](screenshots/31-member-ip-dark-768-links.jpg) |
| 31 | member | dark | 390 | [주소](screenshots/31-member-ip-dark-390-addresses.jpg) · [VM 링크](screenshots/31-member-ip-dark-390-links.jpg) |
| 31 | readOnly | light | 1280 | [주소](screenshots/31-readOnly-ip-light-1280-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-light-1280-links.jpg) |
| 31 | readOnly | light | 768 | [주소](screenshots/31-readOnly-ip-light-768-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-light-768-links.jpg) |
| 31 | readOnly | light | 390 | [주소](screenshots/31-readOnly-ip-light-390-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-light-390-links.jpg) |
| 31 | readOnly | dark | 1280 | [주소](screenshots/31-readOnly-ip-dark-1280-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-dark-1280-links.jpg) |
| 31 | readOnly | dark | 768 | [주소](screenshots/31-readOnly-ip-dark-768-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-dark-768-links.jpg) |
| 31 | readOnly | dark | 390 | [주소](screenshots/31-readOnly-ip-dark-390-addresses.jpg) · [VM 링크](screenshots/31-readOnly-ip-dark-390-links.jpg) |
| 32 | member | light | 1280 | [주소](screenshots/32-member-ip-light-1280-addresses.jpg) · [VM 링크](screenshots/32-member-ip-light-1280-links.jpg) |
| 32 | member | light | 768 | [주소](screenshots/32-member-ip-light-768-addresses.jpg) · [VM 링크](screenshots/32-member-ip-light-768-links.jpg) |
| 32 | member | light | 390 | [주소](screenshots/32-member-ip-light-390-addresses.jpg) · [VM 링크](screenshots/32-member-ip-light-390-links.jpg) |
| 32 | member | dark | 1280 | [주소](screenshots/32-member-ip-dark-1280-addresses.jpg) · [VM 링크](screenshots/32-member-ip-dark-1280-links.jpg) |
| 32 | member | dark | 768 | [주소](screenshots/32-member-ip-dark-768-addresses.jpg) · [VM 링크](screenshots/32-member-ip-dark-768-links.jpg) |
| 32 | member | dark | 390 | [주소](screenshots/32-member-ip-dark-390-addresses.jpg) · [VM 링크](screenshots/32-member-ip-dark-390-links.jpg) |
| 32 | readOnly | light | 1280 | [주소](screenshots/32-readOnly-ip-light-1280-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-light-1280-links.jpg) |
| 32 | readOnly | light | 768 | [주소](screenshots/32-readOnly-ip-light-768-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-light-768-links.jpg) |
| 32 | readOnly | light | 390 | [주소](screenshots/32-readOnly-ip-light-390-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-light-390-links.jpg) |
| 32 | readOnly | dark | 1280 | [주소](screenshots/32-readOnly-ip-dark-1280-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-dark-1280-links.jpg) |
| 32 | readOnly | dark | 768 | [주소](screenshots/32-readOnly-ip-dark-768-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-dark-768-links.jpg) |
| 32 | readOnly | dark | 390 | [주소](screenshots/32-readOnly-ip-dark-390-addresses.jpg) · [VM 링크](screenshots/32-readOnly-ip-dark-390-links.jpg) |

각 조합에서 프로젝트 할당6개·VM 링크6개·정상 업데이트·페이지 범위와 문서 폭을 대조했다. 작은 화면의 표는 내부 수평 스크롤로 모든 열에 도달했다.

일반 역할에는 원래 테마 설정 메뉴가 없다. 관리자 UI에서 밝음/다크를 설정한 뒤 기존 로그인 경로로 각 역할의 양쪽 테마 가독성을 검증했다. 관리자 화면의 실제6전환은 document timeOrigin이 그대로여서 새로고침 없는 즉시 전환이다. 권한별로 숨긴 설정 메뉴를 노출시키지 않았다. [테마 관측](evidence/theme-switches.json).

31의 브라우저 제어 연결은 새 탭으로 복구했다. 양쪽 최종 탭은 관리자·QA 프로젝트·추가 서브넷 VM26이 보이는 IP 페이지2이며 임시 viewport override를 해제하고 열어 두었다. [최종 문맥](evidence/final-ui-context.json).
