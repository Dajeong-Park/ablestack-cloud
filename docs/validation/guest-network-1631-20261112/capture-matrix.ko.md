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

# VM 표준과 UI 검증 캡처

UI 소스·컴포넌트·CSS는 변경하지 않았다. 기존 네트워크 업데이트의 MAC 유지 입력이 실제 MAC 보존 동작과 일치하도록 백엔드만 수정했다. 기존 VM 목록/상세/NIC/편집 대화상자의 레이아웃·업데이트 아이콘+텍스트·작업 메뉴·breadcrumb를 대조했다. VM 기준 캡처는31 목록·상세·NIC·편집,32 목록·NIC이며 양쪽 모든 VM 탭을 새로 검증했다고 확대하지 않는다.

네트워크 상세와 업데이트 대화상자는 양쪽1280/768/390×밝음/다크12조합이다. 대화상자 viewport 범위·페이지 수평 overflow 없음, 내부 세로 스크롤·footer 버튼, 필드 대비·모바일 단일 열과 오퍼링 우측 reload 아이콘을 확인했다. 32의 기존 경보 배너도 원본 캡처에 그대로 남겼다.

관리자 UI의 실제 즉시4테마 전환은 같은 페이지 timeOrigin을 유지했다. 프로젝트 conditional로 나가면 dashboard로 초기화되고 shared-reg로 돌아와 검색한 목록1건·실제 상세 링크·projectid/breadcrumb를 확인했다. 줄바꿈된 링크는 렌더링된 텍스트 위치를 클릭해 이동했으며 링크 전체 bounding box의 줄 사이 여백을 클릭한 시도는 성공으로 판정하지 않았다.

추가 readOnly UI 촬영은 Computer Use의 Windows URL 식별 차단으로 미완료다. 31 readOnly 로그인 시도와32 입력 실패는 캡처 성공으로 집계하지 않았다. 브라우저 제어 차단 후 별도 브라우저/프로토콜로 우회하지 않았다. 임시 viewport가 남은 이전 탭은 결과물로 표시하지 않았으며 최종 viewport 복원을 주장하지 않는다. 확인은 [자원 안내](resources.ko.md)의 실제 Mold 링크로 가능하다.

41개 원본 JPEG의 실제 이미지 크기와 동일 탭 URL/viewport 메타데이터가 일치한다. 가공·합성 화면은 없다. [캡처 검증](evidence/capture-audit.json) · [12배치](evidence/ui-layout-cases.json) · [즉시 테마](evidence/theme-switches.json) · [제어 중단 범위](evidence/ui-validation-limits.json).

| 원본 캡처 | 실제 viewport |
| --- | --- |
| [31-after-update-dialog.jpg](screenshots/31-after-update-dialog.jpg) | 1680×841 |
| [31-before-fix-update-dialog.jpg](screenshots/31-before-fix-update-dialog.jpg) | 1680×841 |
| [31-network-dark-1280.jpg](screenshots/31-network-dark-1280.jpg) | 1280×900 |
| [31-network-dark-390.jpg](screenshots/31-network-dark-390.jpg) | 390×844 |
| [31-network-dark-768.jpg](screenshots/31-network-dark-768.jpg) | 768×900 |
| [31-network-detail-light-1280.jpg](screenshots/31-network-detail-light-1280.jpg) | 1280×900 |
| [31-network-dialog-dark-1280.jpg](screenshots/31-network-dialog-dark-1280.jpg) | 1280×900 |
| [31-network-dialog-dark-390.jpg](screenshots/31-network-dialog-dark-390.jpg) | 390×844 |
| [31-network-dialog-dark-768.jpg](screenshots/31-network-dialog-dark-768.jpg) | 768×900 |
| [31-network-dialog-light-1280.jpg](screenshots/31-network-dialog-light-1280.jpg) | 1280×900 |
| [31-network-dialog-light-390.jpg](screenshots/31-network-dialog-light-390.jpg) | 390×844 |
| [31-network-dialog-light-768.jpg](screenshots/31-network-dialog-light-768.jpg) | 768×900 |
| [31-network-light-1280.jpg](screenshots/31-network-light-1280.jpg) | 1280×900 |
| [31-network-light-390.jpg](screenshots/31-network-light-390.jpg) | 390×844 |
| [31-network-light-768.jpg](screenshots/31-network-light-768.jpg) | 768×900 |
| [31-project-away-dark-1280.jpg](screenshots/31-project-away-dark-1280.jpg) | 1280×900 |
| [31-project-return-detail-dark-1280.jpg](screenshots/31-project-return-detail-dark-1280.jpg) | 1280×900 |
| [31-project-return-network-list-dark-1280.jpg](screenshots/31-project-return-network-list-dark-1280.jpg) | 1280×900 |
| [31-vm-standard-detail-light-1280.jpg](screenshots/31-vm-standard-detail-light-1280.jpg) | 1280×900 |
| [31-vm-standard-dialog-light-1280.jpg](screenshots/31-vm-standard-dialog-light-1280.jpg) | 1280×900 |
| [31-vm-standard-list-light-1280.jpg](screenshots/31-vm-standard-list-light-1280.jpg) | 1280×900 |
| [31-vm-standard-nic-light-1280.jpg](screenshots/31-vm-standard-nic-light-1280.jpg) | 1280×900 |
| [32-after-update-dialog.jpg](screenshots/32-after-update-dialog.jpg) | 1680×841 |
| [32-network-dark-1280.jpg](screenshots/32-network-dark-1280.jpg) | 1280×900 |
| [32-network-dark-390.jpg](screenshots/32-network-dark-390.jpg) | 390×844 |
| [32-network-dark-768.jpg](screenshots/32-network-dark-768.jpg) | 768×900 |
| [32-network-detail-light-1280.jpg](screenshots/32-network-detail-light-1280.jpg) | 1280×900 |
| [32-network-dialog-dark-1280.jpg](screenshots/32-network-dialog-dark-1280.jpg) | 1280×900 |
| [32-network-dialog-dark-390.jpg](screenshots/32-network-dialog-dark-390.jpg) | 390×844 |
| [32-network-dialog-dark-768.jpg](screenshots/32-network-dialog-dark-768.jpg) | 768×900 |
| [32-network-dialog-light-1280.jpg](screenshots/32-network-dialog-light-1280.jpg) | 1280×900 |
| [32-network-dialog-light-390.jpg](screenshots/32-network-dialog-light-390.jpg) | 390×844 |
| [32-network-dialog-light-768.jpg](screenshots/32-network-dialog-light-768.jpg) | 768×900 |
| [32-network-light-1280.jpg](screenshots/32-network-light-1280.jpg) | 1280×900 |
| [32-network-light-390.jpg](screenshots/32-network-light-390.jpg) | 390×844 |
| [32-network-light-768.jpg](screenshots/32-network-light-768.jpg) | 768×900 |
| [32-project-away-dark-1280.jpg](screenshots/32-project-away-dark-1280.jpg) | 1280×900 |
| [32-project-return-detail-dark-1280.jpg](screenshots/32-project-return-detail-dark-1280.jpg) | 1280×900 |
| [32-project-return-network-list-dark-1280.jpg](screenshots/32-project-return-network-list-dark-1280.jpg) | 1280×900 |
| [32-vm-standard-list-light-1280.jpg](screenshots/32-vm-standard-list-light-1280.jpg) | 1280×900 |
| [32-vm-standard-nic-light-1280.jpg](screenshots/32-vm-standard-nic-light-1280.jpg) | 1280×900 |
