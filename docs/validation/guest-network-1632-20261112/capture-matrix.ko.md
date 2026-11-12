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

# UI 표준·원본 캡처

원본 JPEG56개를 actual URL·viewport·픽셀 크기·theme·SHA256과 대조했다. 합성/확대 편집 이미지를 사용하지 않았다. [전체 검증 메타데이터](evidence/capture-audit.json).

## 변경한 화면과 표준

프로젝트/계정 공용 인증서 탭의 툴바·페이지 이동/표 스크롤·등록 대화상자를 변경했다. VM 목록/상세/NIC/기존 네트워크 연결창의 primary-first 작업 배치, reload 아이콘+텍스트, MoldDialog md·세로 폼·footer·theme token·모바일 여백을 적용했다. 글로벌 breadcrumb/탭/스크롤 스타일은 기존 VM ResourceView를 재사용했다. API source의 기본 검사 true와 UI 기본 체크도 일치한다.

기존390px 화면의30vw 창은 약117px로 접혔다. 개선 창은 모바일 여백 안에서 입력/체크/취소/보내기를 읽을 수 있다. 양쪽390/768/1280×light/dark12조합과 프로젝트 상세 화면에서 즉시4테마 전환(동일 timeOrigin), 실제 프로젝트2왕복·목록2쪽 이동을 확인했다. [12조합](evidence/ui-layout-cases.json) · [즉시 테마](evidence/theme-switches.json).

관리자와 비관리자 SSL 조회 허용/거부 UI를 양쪽 촬영했다. 새 탭이 기존 캐시 app.dcbb851d.js를 사용한 역할 관측은 제외하고 새 자산 app.e01a5204.js로 갱신해 다시 검증했다. 최종 role/review 사진은 배포 자산 URL까지 기록했다. VM 기준 사진 일부는 UI 배포 전 동일한 기존 VM 화면이다. 이번 변경은 VM 컴포넌트를 수정하지 않는다.

실패 입력 보존은 원본 boolean/해시 대조 후 **PEM 칸을 실제 UI로 비워 촬영**했다. 따라서 실패 사진은 지워진 입력이 보이며 보존 증명은 대응 JSON이다. 일부 SSL 할당 사진의 등록 실패 알림은 직전 의도된530 대조이고, 화면의 실제 할당 작업은 별도 job1 완료다.32의 기존 Wall/리소스 경보 배너도 이번 SSL 결함으로 집계하지 않았다.

## 전체 사진 목록

| 원본 | 픽셀·viewport | 실제 route |
| --- | --- | --- |
| [31-after-certificate-dialog-dark-1280.jpg](screenshots/31-after-certificate-dialog-dark-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-before-certificate-dialog-dark-1920.jpg](screenshots/31-before-certificate-dialog-dark-1920.jpg) | 1920×871 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-before-certificate-dialog-dark-390.jpg](screenshots/31-before-certificate-dialog-dark-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-dark-1280.jpg](screenshots/31-certificate-dialog-dark-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-dark-390.jpg](screenshots/31-certificate-dialog-dark-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-dark-768.jpg](screenshots/31-certificate-dialog-dark-768.jpg) | 768×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-light-1280.jpg](screenshots/31-certificate-dialog-light-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-light-390.jpg](screenshots/31-certificate-dialog-light-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-dialog-light-768.jpg](screenshots/31-certificate-dialog-light-768.jpg) | 768×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-dark-1280.jpg](screenshots/31-certificate-tab-dark-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-dark-390.jpg](screenshots/31-certificate-tab-dark-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-dark-768.jpg](screenshots/31-certificate-tab-dark-768.jpg) | 768×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-light-1280.jpg](screenshots/31-certificate-tab-light-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-light-390.jpg](screenshots/31-certificate-tab-light-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-certificate-tab-light-768.jpg](screenshots/31-certificate-tab-light-768.jpg) | 768×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-project-away.jpg](screenshots/31-project-away.jpg) | 1280×900 | project/dc9a2e6e-c977-44c2-b87c-dcf3d8e70687?tab=certificates |
| [31-project-return.jpg](screenshots/31-project-return.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-review-certificates.jpg](screenshots/31-review-certificates.jpg) | 1920×871 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-role-read-allow-dark-1280.jpg](screenshots/31-role-read-allow-dark-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-role-read-deny-dark-1280.jpg](screenshots/31-role-read-deny-dark-1280.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-role-read-deny-dark-390.jpg](screenshots/31-role-read-deny-dark-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-role-upload-dialog-dark-390.jpg](screenshots/31-role-upload-dialog-dark-390.jpg) | 390×844 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-ui-failure-after-clearing-pem.jpg](screenshots/31-ui-failure-after-clearing-pem.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-ui-ssl-assigned.jpg](screenshots/31-ui-ssl-assigned.jpg) | 1280×900 | publicip/c5e732ec-1388-47f7-8e2d-d214df9aacc0?tab=loadbalancing |
| [31-ui-upload-success-page2.jpg](screenshots/31-ui-upload-success-page2.jpg) | 1280×900 | project/59614883-4085-4a76-99da-b8a1e3a78eed?tab=certificates |
| [31-vm-standard-detail-light-1280.jpg](screenshots/31-vm-standard-detail-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf |
| [31-vm-standard-dialog-light-1280.jpg](screenshots/31-vm-standard-dialog-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-standard-list-light-1280.jpg](screenshots/31-vm-standard-list-light-1280.jpg) | 1280×900 | vm |
| [31-vm-standard-nic-dark-390.jpg](screenshots/31-vm-standard-nic-dark-390.jpg) | 390×844 | vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [31-vm-standard-nic-light-1280.jpg](screenshots/31-vm-standard-nic-light-1280.jpg) | 1280×900 | vm/551067c6-fbfb-40df-8313-037e21de78cf?tab=nics |
| [32-certificate-dialog-dark-1280.jpg](screenshots/32-certificate-dialog-dark-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-dialog-dark-390.jpg](screenshots/32-certificate-dialog-dark-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-dialog-dark-768.jpg](screenshots/32-certificate-dialog-dark-768.jpg) | 768×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-dialog-light-1280.jpg](screenshots/32-certificate-dialog-light-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-dialog-light-390.jpg](screenshots/32-certificate-dialog-light-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-dialog-light-768.jpg](screenshots/32-certificate-dialog-light-768.jpg) | 768×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-dark-1280.jpg](screenshots/32-certificate-tab-dark-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-dark-390.jpg](screenshots/32-certificate-tab-dark-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-dark-768.jpg](screenshots/32-certificate-tab-dark-768.jpg) | 768×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-light-1280.jpg](screenshots/32-certificate-tab-light-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-light-390.jpg](screenshots/32-certificate-tab-light-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-certificate-tab-light-768.jpg](screenshots/32-certificate-tab-light-768.jpg) | 768×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-project-away.jpg](screenshots/32-project-away.jpg) | 1920×871 | project/f794c1da-2d1a-4918-92ca-ed192dcdb5df?tab=certificates |
| [32-project-return.jpg](screenshots/32-project-return.jpg) | 1920×871 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-review-certificates.jpg](screenshots/32-review-certificates.jpg) | 1920×871 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-role-read-allow-dark-1280.jpg](screenshots/32-role-read-allow-dark-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-role-read-deny-dark-1280.jpg](screenshots/32-role-read-deny-dark-1280.jpg) | 1280×900 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-role-read-deny-dark-390.jpg](screenshots/32-role-read-deny-dark-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-role-upload-dialog-dark-390.jpg](screenshots/32-role-upload-dialog-dark-390.jpg) | 390×844 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-ui-failure-after-clearing-pem.jpg](screenshots/32-ui-failure-after-clearing-pem.jpg) | 1920×871 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-ui-ssl-assigned.jpg](screenshots/32-ui-ssl-assigned.jpg) | 1920×871 | publicip/5224658f-43e9-4fb4-92cb-a90284fe1b23?tab=loadbalancing |
| [32-ui-upload-success-page2.jpg](screenshots/32-ui-upload-success-page2.jpg) | 1920×871 | project/cf5ec6b5-b522-4c18-ab90-a395012607c1?tab=certificates |
| [32-vm-standard-detail-dark-1280.jpg](screenshots/32-vm-standard-detail-dark-1280.jpg) | 1280×900 | vm/e3ddbdd1-ccd7-4299-9461-a33d25d6b645 |
| [32-vm-standard-dialog-dark-1280.jpg](screenshots/32-vm-standard-dialog-dark-1280.jpg) | 1280×900 | vm/e3ddbdd1-ccd7-4299-9461-a33d25d6b645?tab=nics |
| [32-vm-standard-list-dark-1280.jpg](screenshots/32-vm-standard-list-dark-1280.jpg) | 1280×900 | vm |
| [32-vm-standard-nic-dark-1280.jpg](screenshots/32-vm-standard-nic-dark-1280.jpg) | 1280×900 | vm/e3ddbdd1-ccd7-4299-9461-a33d25d6b645?tab=nics |
