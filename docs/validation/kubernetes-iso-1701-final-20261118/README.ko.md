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

# #1701 재개 검증과 추가 셀 보정 — 2026-11-18

**최종 완료 상태:** [2026-11-18 최종 UI 검증·정리 보고서](../kubernetes-iso-1701-close-20261118/README.ko.md). 아래는 제어 복구와 최종 확인을 기다리던 당시의 중간 기록입니다.

## 현재 상태

**#1701은 OPEN입니다. 최종 보정본 UI 확인과 두 시험 버전/ISO의 정리가 남아 있습니다.** Epic #1692는 7/9, PR #1703은 Draft입니다. 검증 완료 전에는 이슈를 닫지 않습니다.

Chrome 제어를 복구해 실제 키보드 경로와 다크 링크의 계산 색상을 확인했습니다. 추가로 이벤트 셀에 남아 있던 잘못된 분기를 발견해 구현·회귀·생산 빌드·13번 추가 배포까지 마쳤습니다. 이후 DevTools에 초점이 있는 상태에서 Windows 제어 도구가 현재 브라우저 URL을 확정하지 못해 이번 턴의 앱 입력을 중단했습니다. 사용자에게 DevTools를 닫고 Mold 화면을 클릭한 뒤 알려달라는 복구 안내를 보냈으며, 이 중단 이후 다른 UI 경로로 우회하지 않았습니다.

제출용 접근성 전사는 Mold/DevTools 문서 서브트리만 유지해 무관한 Chrome 프로필/툴바 내용을 제외했으며, 행 끝 공백을 정리하고 DOM의 `data-row-key` 값을 `[resource-id]`로 정규화했습니다. 이 값은 공개 자원 UUID이며, 실제 식별자는 링크와 자원 ledger에 유지했습니다. 원본 전사와 스크린샷은 로컬 검증 폴더에 보존했습니다. 이미지 픽셀은 수정하지 않았습니다.

## 실제 UI에서 확인한 내용

- Chrome의 정상 Mold 페이지, 기존 관리자 세션과 남은 버전 4개(원본 2개/시험 2개)를 확인했습니다. 대시보드 VM 102개·시스템 VM 2개·물리 호스트 3개도 유지됐습니다.
- 긴 한글/영문 이름은 한 줄 말줄임과 전체 링크 원문을 유지합니다. 최종 배포된 이름 링크가 다크 테마의 `--ui-link`를 사용함을 Chrome Computed UI의 `rgb(105, 177, 255)`로 확인했습니다.
- 상태 선택기에 실제 포인터로 초점을 둔 뒤 Windows 방향키 Down→Enter로 ‘사용 중지’를 선택했습니다. Tab으로 취소 버튼에 이동하고 Esc로 창을 닫은 다음, Enter로 원래 작업 메뉴가 다시 열리는 동작까지 확인했습니다. 저장하지 않고 취소했으므로 시험 버전 상태는 Enabled를 유지합니다.
- UIA의 `focused_element` 문자열은 일부 시점에 주소창으로 지연 갱신됐으므로 통과 근거로 삼지 않았습니다. 선택값, 가시 초점 테두리, Esc 다음 Enter로 실행 메뉴가 다시 열리는 실제 동작을 근거로 삼았습니다.
- 일반 목록 갱신과 전체 새로고침 후에는 Console의 기존 누적 RenderIcon 오류가 재발하지 않았습니다. 새 결함으로 확정하거나 광범위한 공통 아이콘 변경을 추가하지 않았습니다.

[상태 옵션 키보드 선택](native-state-down-enter-selected.jpg) · [Tab 초점](native-state-tab-cancel-focus.jpg) · [Esc 후 Enter 재실행](native-escape-focus-enter-reopened-actions.jpg) · [실제 다크 계산 색상](dark-link-computed-visible.jpg).

다크 표면 토큰 `#22282f`와 실제 확인한 전경의 조합 대비는 6.61입니다. 라이트 토큰 `#0969da`/흰색 조합의 계산값은 5.19이나 **라이트 최종 UI 재확인은 아직 대기**입니다. 이는 전체 화면 접근성 인증이 아닙니다.

이벤트의 [‘확인 필요’ 재현 화면](before-cell-correction-events-dark.jpg)은 추가 셀 보정 **전**의 증거입니다. 보정 후 UI 통과 자료가 아닙니다.

## 추가 발견과 구현

이전 보정은 목록 레이아웃 판별에서 상세 ID를 제외했지만, `ListView.vue`의 실제 셀 분기는 여전히 route 이름만 검사했습니다. 따라서 상세 이벤트의 Completed 상태가 KISO 버전 상태로 해석돼 ‘확인 필요’로 표시됐습니다.

이 셀 분기도 동일한 `isKubernetesIsoMainList` 조건을 사용하도록 수정했습니다. 회귀는 실제 bodyCell을 렌더링해 상세 이벤트가 표준 Status 컴포넌트로 Completed를 전달하고, 주 목록의 Enabled는 계속 KISO 전용 상태 셀을 사용하는지 확인합니다. computed 조건만 검사하던 기존 회귀의 빈틈을 보완했습니다.

- 제품 소스: `d4ccbe39956f9412cfb5be411033df141583b335`.
- 정식/운영 빌드 입력 각각 **15 suites/304 tests PASS**. 변경 ESLint와 범위 pre-commit PASS.
- **이 추가 보정본의 운영 이벤트 상태 표시는 UI 재확인 대기**입니다. 보정 전 재현 화면을 보정 후 통과로 집계하지 않습니다.

## 빌드·추가 배포와 보존

작업 시작 시 upstream/origin을 각각 fetch하고 로컬 기준 `ablestack-europa`와 upstream의 차이 0/0을 확인했습니다. 기능 브랜치에서 커밋하고 origin feature에만 push했습니다. 기준 SHA는 `aff74eee0d835891f9209492514f6c2d204bc138`입니다.

기존 운영 입력 `/root/work/.build-iso-vnf-sync-20261116-bm2k765y/ui`의 공통 UI 차이를 보존하고 이번 한 줄 수정만 적용했습니다. 정식/운영 입력의 파일별 해시는 `build-boundary.json`에 있습니다.

- 생산 빌드 **787.3초/PASS**.
- `js/app.ef81ff75.js`, `css/app.db04de3e.css`, `index.html` **3개만 추가 배포**했습니다.
- 최종 index SHA-256: `e39ac0bb82fa486d8013b694f819a9a2a9d31cca07c2605069832066fc3e67d5`.
- 기존 파일 **7,212개**, 설정 3개, 관리 JAR `55f802d2b22c9d4d471644c6157781cc2604e27d4ba0d7b055e4a934bb1d6171`, Mold PID **2860414**를 보존하고 실제 HTTP 해시를 확인했습니다.
- Backend/DB/Agent/SystemVM 변경·재시작은 없습니다.

## 자원 정리

이전 URL·로컬 추가 시험 2쌍과 템플릿/코멘트/아이콘은 삭제 완료 상태를 유지합니다. 삭제한 빈 QCOW2 시험 템플릿의 HTTP 지원 파일 `style-template.qcow2`도 원본 해시를 확인한 뒤 제거했고 **404**를 확인했습니다.

남은 자원은 다음과 같습니다. UI에서 삭제 완료와 원래 목록 보존을 확인한 뒤에만 잔여 0으로 기록해야 합니다.

| 버전 | 연결 ISO | 용도 |
| --- | --- | --- |
| `8f773b4a-8802-40ea-88e6-76d2b8141e29` | `49819ec0-6527-40fc-91ce-236b9ab30c47` | 긴 한글·Ready |
| `29ce330b-a632-445e-b687-a6eacffa5523` | `ebdfe97a-e42e-418d-a072-f732bd9b1cf4` | 긴 영문·실제 체크섬 실패 |

HTTP 지원 파일은 `/usr/share/cloudstack-management/webapp/qa-kiso1701-20261117/ready.iso` 하나가 남았습니다. 크기 1,421,312 bytes, SHA-256 `52f55567e16b6bce822fc62657a68c883ec738e6d11cb2b1d8f70c2bb09ddf46`입니다. 버전/ISO 정리 후 해당 전용 파일과 빈 디렉터리를 제거하고 404를 확인해야 합니다.

이번 재개에서는 새 버전·계정·역할·VM·클러스터를 생성하지 않았습니다. 기존 원본 목록과 Chrome 다크 모드·원래 창 크기 복원은 마지막 UI 확인에서 마무리해야 합니다.

## CI 부채 분리

추가 제품 소스의 [Lint 44209208601](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44209208601)은 기준과 동일한 **16개 실패 훅**, 이번 UI 22개 변경 경로의 **추가 진단 0**입니다. [License 44209208668](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44209208668)는 기존 **unknown 4,077건**입니다.

기존 CI 부채 #926·#1044의 OPEN 상태를 다시 확인했습니다. 전체 CI를 GREEN으로 표시하지 않습니다. 이후 근거 문서 head의 CI는 제품 소스 검증과 구분합니다.

## 화면 복구 후 완료 순서

1. DevTools를 닫고 정상 Mold 페이지에 초점을 둡니다. 이후 DevTools를 다시 열지 않고 기존 UI와 Windows 키보드 경로로 확인합니다.
2. Mold 새로고침 후 긴 한글 버전의 이벤트가 표준 이벤트 상태를 표시하는지 확인합니다. 보정 전의 ‘확인 필요’ 화면과 구분합니다.
3. 라이트·다크 목록 이름과 긴 값, 좁은 화면을 확인합니다. 앞선 1440/1280/810/390·작은 높이의 배치 근거는 [이전 보고서](../kubernetes-iso-1701-20261117/README.ko.md)에 유지합니다.
4. 위 버전/ISO 2쌍을 UI로 정리하고 카탈로그 2·ISO 8·템플릿 48·VM 102·계정 3·역할 9·기존 CKS 클러스터 2·시스템 VM 2의 원본 보존을 확인합니다. HTTP 지원 파일을 제거합니다.
5. 다크 모드와 원래 Chrome 창 크기를 복원하고 #1701을 닫습니다. Epic을 8/9로 갱신하고 PR에 최종 결과를 반영합니다.

다음 개발 순서는 **#1702(KISO-08) 실계정 ACL·양 계열 업로드·통합 UI 회귀**입니다. 실제 미완료 업그레이드 source/target pin UI는 사용자 승인으로 이관된 **#1707 Provider 초기화 오류 해결**이 선행돼야 합니다. #1707은 현재 OPEN입니다. 이번 단계에서 #1702를 시작하거나 Epic 완료로 집계하지 않습니다.
