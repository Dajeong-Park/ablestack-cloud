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

# #1701 구현·초기 UI 검증과 최종 확인 대기

현재 재개 상태는 [2026-11-18 재개 보고서](../kubernetes-iso-1701-final-20261118/README.ko.md)를 따릅니다. 아래는 2026-11-17 시점의 기록입니다.

## 현재 상태

**#1701은 OPEN입니다. 최종 보정본 UI 확인과 남은 시험 자원 정리가 완료되지 않았습니다.** Chrome의 실제 키 입력을 추가 확인하려고 Windows 앱 제어를 연결하던 중, 제어 도구가 현재 브라우저 URL을 확정할 수 없어 이번 턴의 Computer Use를 중단했습니다. 제어 종료 이후 UI 조작을 다른 경로로 우회하지 않았습니다.

제품 최종 소스는 `eb790ccf174eafca7f06ac17fc7e491f660fa869`입니다. 정식/운영 입력 각각 15 suites/302 tests PASS. #1701 구현은 완료했지만 검증 완료로 집계하거나 이슈를 닫지 않습니다. Epic #1692는 7/9 완료, PR #1703은 Draft를 유지합니다.

## 변경과 VM 기준 비교

[설계](../../design/kubernetes-iso-1692/implementation-1701.ko.md)를 기준으로 운영 VM 목록·상세·편집 창과 비교했습니다.

| 항목 | 개선 전 관찰 | 적용과 초기 운영 UI 확인 |
| --- | --- | --- |
| 목록 | 이름 75px, 상태/CPU/RAM 113/154/171px. 긴 이름은 1280/810/390 폭에서 행 높이 69/113/333px | 이름 420px/모바일 280px, 부가 열 112~180px. 양 테마·1440/1280/810/390에서 행 높이 47px 한 줄, 원문 보존·ellipsis·hover/focus 툴팁 |
| breadcrumb | 긴 이름이 높이와 배치를 밀어냄 | 현재 이름을 한 줄 말줄임하고 focus/Esc 툴팁. 검색 목록 복귀 URL과 count 4 유지 확인 |
| 상세/탭 | KISO rail 약 71px, 카드 상단 간격 25px. VM은 100px/47px | 공통 rail 최소 100px·상단 22px 추가·상세 padding `12px 0`. 모바일은 가로 탭과 내부 표 스크롤 |
| Zone | 좁은 화면에서 긴 상태/원인/저장소 접근 확인 필요 | 실제 Ready와 체크섬 실패, 확장 저장소 표, 전체 원인 focus 툴팁과 Esc를 양 테마·810/390에서 확인 |
| 대화상자 | 기존 MoldDialog와 대상/영향 표의 테마 및 작은 높이 점검 필요 | URL/로컬/상태/삭제 창, 대상·UUID·긴 이름·본문 스크롤·하단 버튼을 1280 및 390×540에서 확인. CPU/RAM은 좁은 화면에 세로 배치 |
| 공통 회귀 | Ubuntu 아이콘·커스텀 아이콘·코멘트가 주요 이름을 압박할 수 있음 | 시험 템플릿 이름·커스텀 이미지·코멘트 병존 및 기본 Ubuntu SVG 복원 후 모두 47px 행/전체 링크 원문 유지. VM 상세/편집 취소, 일반 ISO 목록/상세/Zone 회귀 확인 |

초기 배포 화면의 주요 근거:

- [VM 표준 상세](reference-vm-detail-dark-1280.jpg), [VM 표준 편집](reference-vm-dialog-dark-1280.jpg)
- [개선 전 목록](before-long-list-390.jpg), [초기 배포 목록 390](after-list-light-390x844.jpg), [초기 배포 상세](after-detail-dark-1280x900.jpg)
- [Zone 실패/확장](after-error-expanded-light-1280.jpg), [상태 창 390×540](after-state-modal-dark-390x540.jpg), [삭제 창](after-delete-modal-light-1280.jpg)
- [템플릿 이미지/코멘트 병존](after-template-custom-comment-light-1280.jpg), [기본 Ubuntu 아이콘 복원](after-template-ubuntu-fallback-light-1280.jpg)

이 화면들은 첫 배포 `a374df51ab1`의 근거입니다. 아래 두 보정이 들어간 최종 소스의 UI 검증으로 대신하지 않습니다.

## 실제 UI에서 추가 발견해 수정한 항목

1. 상세 이벤트 표도 공통 ListView를 사용해 주 목록 전용 상태 셀/폭이 적용됐습니다. 상세 ID가 없는 경우만 주 목록으로 판단하도록 수정하고 중첩 이벤트 회귀를 추가했습니다. **최종 운영 이벤트 UI 재확인 대기**입니다.
2. 라이트 목록 이름 링크는 기존 색상 `#1890ff`로 대비 3.24였습니다. KISO 목록만 기존 `--ui-link` 토큰을 사용하도록 수정했습니다. **최종 양 테마 링크 색상/대비 재측정 대기**입니다.
3. 길이 초과 URL이 gateway 431로 명령 실행 전에 거절돼도 결과 불명으로 남는 오류를 재현했습니다. API discovery 길이를 검증에 사용하고 정확한 사전 실행 길이 거절만 편집 상태로 복구합니다. 일반 431/서버 오류/응답 유실의 결과 불명 보호는 유지합니다. 운영 UI에서 길이 초과 오류→URL 수정→같은 버전 1.36.75 정상 접수/Ready를 확인했습니다.

## UI 검증 근거와 경계

- 새 열 선택 버튼은 Enter→첫 체크박스 초점, Space로 CPU 열 숨김/복원, Esc→버튼 초점 복귀 PASS. 스크롤 영역의 좌우/Home/End와 이름 툴팁 focus/Esc PASS.
- URL 양식 첫 필드 Tab→이름, Esc→URL 등록 버튼 복귀 PASS. 로컬 창 Esc→로컬 등록 버튼, 삭제 창 Esc→작업 버튼 복귀 PASS.
- 상태 선택은 포인터로 실제 Disabled/Enabled 저장을 확인했습니다. Disabled 중에도 ISO Ready가 별도로 표시됩니다. 표준 Select의 실제 OS 방향키 선택 전체 경로는 Chrome 네이티브 제어 연결 중 중단되어 새 PASS로 집계하지 않습니다.
- URL 정상/긴 이름/전역 범위·실제 잘못된 SHA-256 실패와 원문·긴 URL 표시를 확인했습니다. 로컬 파일 미선택 필드 오류/로딩 해제 및 유효 파일 업로드→준비 완료도 확인했습니다.
- 이번 로컬 smoke의 업로더는 기존 4.23 계열입니다. 4.21→새 4.23 양 계열의 기능 근거는 #1697에 유지하며 이번 스타일 변경에서 재실행한 것으로 집계하지 않습니다.
- 첫 배포 표본 대비: Zone/오류 텍스트 최소 다크 9.18, 라이트 7.56, 상세 텍스트 9.18/7.56. 목록 링크의 3.24는 미해결로 숨기지 않고 최종 보정/재측정 대기로 기록합니다. 전체 화면 WCAG 인증으로 해석하지 않습니다.
- 실제 UI 조회·생성·변경·삭제만 사용했습니다. SSH는 정적 파일·지원 fixture·해시/프로세스 검증에만 사용했습니다. API/DB 직접 쓰기로 UI 검증이나 자원 정리를 대체하지 않았습니다.

## 빌드와 배포

로컬 기준 `ablestack-europa`를 최신 upstream `aff74eee0d835891f9209492514f6c2d204bc138`로 먼저 갱신하고 작업 브랜치를 재배치했습니다. 기준/upstream 차이 0/0을 확인했으며 feature만 origin에 push했습니다.

운영 공통 UI의 의도된 차이를 보존한 동일 빌드 입력 `/root/work/.build-iso-vnf-sync-20261116-bm2k765y/ui`에 이번 변경만 적용했습니다. 파일별 정식/운영 소스 해시는 build-boundary에 기록했습니다.

- 첫 생산 빌드 1,102.8초/PASS, UI 정적 17개만 배포. 이전 파일 7,194개, 설정 3개·관리 JAR/PID 보존, 모든 변경 파일의 실제 HTTP 해시 확인.
- 이벤트 보정 중간 빌드는 링크 대비 보정을 함께 넣기 위해 중단했고 배포하지 않았습니다.
- 최종 생산 빌드 759.1초/PASS. JS `app.227b8030.js`, CSS `app.1a2043f7.css`, index 3개만 추가 배포했습니다. 이전 파일 7,210개·설정·JAR/PID 보존 및 실제 HTTP 해시 일치를 확인했습니다. 최종 index SHA-256은 `56dcd47216e95fe2d09fd7b6ca88a82ac95d89f98bedc4628db69eb8770293ea`입니다. **이 최종 보정본의 브라우저 UI 재확인은 대기**입니다.
- 첫 배포 index SHA-256 `250d31cb0107ed4c5d51ba73f6cdda6abce9fa3a042c2d7b15ae2a94a46ad7b1`, 관리 JAR `55f802d2b22c9d4d471644c6157781cc2604e27d4ba0d7b055e4a934bb1d6171`, Mold PID `2860414`. Backend/DB/Agent/SystemVM 변경·재시작 없음.

## 테스트 자원과 남은 정리

전송 fixture는 ISO9660 검증용 1,421,312 bytes, SHA-256 `52f55567e16b6bce822fc62657a68c883ec738e6d11cb2b1d8f70c2bb09ddf46`입니다. Kubernetes 바이너리나 부팅 성공을 검증하는 이미지가 아닙니다. Ubuntu 표시 시험 QCOW2도 OS 없는 빈 시험 디스크이며 VM을 생성하지 않았습니다.

- URL 복구 버전 `1919e370-4ea6-4653-a369-333403317d5e` / ISO `376c395f-2049-4213-8a33-f55550617e5a`: UI 삭제 후 목록 부재 확인.
- 로컬 버전 `2f6952f9-efec-48dc-9be9-50d7bb0f08db` / ISO `9258423c-1c5b-4003-869f-ccd0f70090ab`: UI 삭제 후 목록 부재 확인.
- 템플릿 `8b663eaa-7d9d-47cd-9376-3564ac4749fb`: 코멘트 1개·커스텀 아이콘 먼저 삭제, Zone 삭제 작업 성공 1/실패 0, 검색 결과 없음 확인.
- **남음**: 긴 한글 버전 `8f773b4a-8802-40ea-88e6-76d2b8141e29` / ISO `49819ec0-6527-40fc-91ce-236b9ab30c47`, 긴 영문 실패 버전 `29ce330b-a632-445e-b687-a6eacffa5523` / ISO `ebdfe97a-e42e-418d-a072-f732bd9b1cf4`.
- **남음**: HTTP fixture 디렉터리 `/usr/share/cloudstack-management/webapp/qa-kiso1701-20261117/`의 `ready.iso`, `style-template.qcow2`. 두 버전 정리 후 전용 파일만 제거/404 확인해야 합니다.
- 새 계정·역할·클러스터·VM은 만들지 않았습니다. 원래 카탈로그 2개·ISO 8개·템플릿 48개·VM 102개·계정 3개·역할 9개·클러스터 2개·4.23 SystemVM 2개는 정리 완료 시 최종 UI 재확인이 필요합니다.
- 제어 중단 시 IAB는 라이트/1280×900 시험 설정입니다. 재개 후 원래 다크/기본 viewport를 복원해야 합니다. 태스크 시험 탭은 handoff로 유지하지 않았습니다. 사용자의 원래 Mold/GitHub/Chrome 탭을 닫거나 이동하지 않았습니다.

## CI 부채와 후속

- 정식/운영 회귀 각각 302개, 전체 UI ESLint 오류 0(최초 전체 검사 및 이후 변경 파일 검사), 변경 범위 pre-commit PASS/해당 없음.
- 로컬 pre-commit 기본 Python 3.9는 최신 yamllint 요구 버전과 맞지 않아, 저장소 설정을 수정하지 않고 동일 설정의 임시 사본에서 Python 3.11로 실행했습니다. CI도 Python 3.11을 사용합니다.
- 최초 제품 Lint [44022837072](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44022837072)는 최신 upstream 선행 [44014220817](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44014220817)과 **실패 훅 16개 동일, 이번 22개 변경 경로 추가 진단 0**입니다.
- 제품 최종 소스 License [44026717976](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44026717976)는 기준과 동일한 unknown 4,077건입니다. 최종 소스 Lint [44026717872](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44026717872)는 이 문서 작성 시점에 실행 중이었으며 기존 부채와 구분합니다. 후속 문서 push로 취소되거나 새 head에서 다시 실행될 수 있으므로 최종 상태는 PR의 최신 실행을 따릅니다. 결과는 `ci-final-product-lint-status.json`에 기록했습니다.
- #926·#1044는 별도 OPEN이며 전체 CI를 GREEN으로 표시하지 않습니다.
- #1702 전체 ACL/통합 UI 회귀와 사용자 승인으로 이관된 #1707→#1702 실제 미완료 업그레이드 pin UI는 이번 통과 범위가 아닙니다. 다중 Zone/Edge·비KVM·ARM 부팅도 실행하지 않았으며 기능을 삭제하지 않았습니다.

## 재개 시 완료 순서

1. 최종 index/소스 배포 정보를 확인하고 브라우저를 새로고침합니다.
2. 이벤트 표가 주 목록 전용 분기를 쓰지 않는지, 실제 이벤트 상태와 자동 폭을 확인합니다.
3. 양 테마 목록 이름 링크가 `--ui-link`를 사용하고 읽을 수 있는 대비를 갖는지 재측정합니다. 1440/1280/810/390 및 작은 높이에서 마지막 회귀를 확인합니다.
4. 필요하다면 실제 키 입력 선택기의 남은 확인을 수행합니다. 이미 확인한 열 선택·툴팁·MoldDialog 초점 근거와 구분합니다.
5. 남은 버전/ISO 2쌍과 HTTP 파일 정리, 원래 목록/환경·다크/viewport 복원을 UI로 확인합니다.
6. 위 작업이 끝난 뒤에만 #1701을 닫고 Epic을 8/9로 갱신합니다. PR Draft와 CI 부채 분리는 유지합니다.
