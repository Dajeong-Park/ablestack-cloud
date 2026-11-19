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

# #1701 최종 UI 검증·시험 자원 정리 완료

## 완료 판정

최종 제품 `d4ccbe39956f9412cfb5be411033df141583b335`를 13번 Mold UI에서 새로고침해 추가 셀 보정과 양 테마를 확인했습니다. 남은 시험 버전/ISO 두 쌍 및 지원 파일을 모두 정리했습니다. **#1701 완료 근거를 충족했으며, Epic #1692는 후속 #1702를 남긴 8/9 단계입니다. PR #1703은 Draft를 유지합니다.**

이번 마무리에서는 제품 코드를 추가로 바꾸거나 재배포하지 않았습니다. 기배포 최종 index와 모든 정적 파일의 해시를 확인했습니다. 이전 재개 보고서의 ‘UI 확인 대기’는 이 보고서로 해소됐습니다.

## 최종 UI 확인

| 확인 항목 | 실제 결과 | 근거 |
| --- | --- | --- |
| 추가 보정 이벤트 셀 | ADD 1건·UPDATE 2건 모두 VM 표준의 녹색 ‘완료’. KISO 버전 상태로 잘못 해석된 ‘확인 필요’ 해소 | [다크](corrected-events-dark-pass.jpg), [라이트](corrected-events-light-pass.jpg) |
| 목록 주요 이름 | 긴 한글/영문 이름의 한 줄·말줄임·전체 링크 원문 유지. 이름 우선 폭·부가 열 폭·내부 가로 스크롤 보존 | [라이트 긴 이름](final-main-light-pass.jpg), [좁은 다크 창](final-main-dark-narrow.jpg) |
| 상세·breadcrumb·탭 | 긴 이름/UUID/원인을 원문으로 읽을 수 있고 VM 공통 카드·탭 배치 유지. 좁은 화면은 카드/콘텐츠를 세로로 배치 | [좁은 상세](final-detail-dark-narrow.jpg), [긴 실패 원인](final-failure-detail-light.jpg) |
| 삭제 창 | 이름·버전·ID·연결 ISO·참조 없음·영향·위험 버튼을 확인하고 전용 시험 대상만 삭제 | [실패 대상](delete-failed-target-confirmation.jpg), [Ready 대상](delete-ready-target-confirmation.jpg) |
| 검색 복귀/공통 회귀/키보드 | 앞선 기능별 검증과 실제 Windows 방향키·Enter·Tab·Esc 및 실행 버튼 초점 복귀 근거 유지. 이번 보정은 이벤트 셀 조건만 변경 | [초기 전체 검증](../kubernetes-iso-1701-20261117/README.ko.md), [네이티브 키보드 검증](../kubernetes-iso-1701-final-20261118/README.ko.md) |

1440/1280/810/390 폭과 390×540 등 작은 높이의 전체 배치 행렬은 초기 보고서에 보존했습니다. 추가 보정 후에는 실제 운영 화면에서 다크/라이트 이벤트 상태, 긴 이름 목록, 약 810px 창과 데스크톱 배치를 다시 확인했습니다. 변경하지 않은 모든 화면 크기를 새로 재실행했다고 집계하지 않습니다.

다크 이름 링크는 이전 재개에서 Chrome Computed 전경 `rgb(105,177,255)`를 확인했고, 이번에는 DevTools를 열지 않고 라이트/다크의 실제 목록을 시각적으로 확인했습니다. 배포된 기존 링크 토큰/표면 조합의 계산 대비는 다크 6.61·라이트 5.19입니다. 라이트의 Computed 실측이나 전체 화면 접근성 인증으로 표현하지 않습니다.

## 시험 자원 정리와 원본 보존

잔여 두 대상은 UI 삭제 창에서 정확한 ID와 연결 ISO를 확인한 뒤 삭제했습니다.

| 시험 버전 | 연결 ISO | 최종 확인 |
| --- | --- | --- |
| `29ce330b-a632-445e-b687-a6eacffa5523` | `ebdfe97a-e42e-418d-a072-f732bd9b1cf4` | 삭제 후 목록 3개, 해당 시험 항목 부재 |
| `8f773b4a-8802-40ea-88e6-76d2b8141e29` | `49819ec0-6527-40fc-91ce-236b9ab30c47` | 삭제 후 원래 카탈로그 2개 복원 |

전체 #1701 시험 버전/ISO **4쌍**과 빈 QCOW2 시험 템플릿 **1개**, 코멘트/아이콘의 정리를 최종 ledger에 반영했습니다. 이번 마무리에서는 계정·역할·VM·클러스터·업로드 티켓을 새로 만들지 않았습니다.

| 원래 자원 | 최종 UI 확인 |
| --- | --- |
| 카탈로그 | **2개**, 원래 `b5fabc77-be13-448e-8643-625e9ff8d1e0` / `441b3f20-0a40-48dd-becb-1573c6059867` UUID 일치 |
| 일반 ISO | **8개**, 이전 UI 원본 8개 UUID 집합과 완전히 일치. 시험 ISO 4개 ID 부재 |
| 템플릿 | **48개** |
| 계정/역할 | **3개/9개** |
| 사용자 VM/호스트 | **102개/3개** |
| CKS 클러스터 | **koral1/koral3 2개**, 기존 Stopped·1.35.9/1.36.5 상태 보존 |
| 시스템 VM | **v-245-VM/s-263-VM 2개**, 둘 다 VM/Agent 실행 중·**4.23.0.0** |

[원본 카탈로그 복원](catalog-restored-two-originals.jpg) · [원본 ISO 8개](iso-restored-eight-no-test-items.jpg) · [기존 CKS](original-cks-clusters-preserved.jpg) · [기존 시스템 VM](systemvm-originals-running-423.jpg).

`ready.iso`의 크기 1,421,312 bytes와 SHA-256 `52f55567e16b6bce822fc62657a68c883ec738e6d11cb2b1d8f70c2bb09ddf46`을 확인하고 해당 파일만 제거했습니다. 빈 전용 디렉터리 `/usr/share/cloudstack-management/webapp/qa-kiso1701-20261117/`도 제거했습니다. `ready.iso`와 먼저 삭제한 `style-template.qcow2` 모두 **404**, 디렉터리 부재를 확인했습니다. 원본 볼륨을 포맷하거나 저장소를 직접 정리하지 않았습니다.

전송 fixture는 Kubernetes 바이너리가 없는 시험 ISO이며, QCOW2도 OS 없는 빈 표시 시험 데이터였습니다. 설치·부팅·업그레이드 성공으로 집계하지 않습니다. 감사 이벤트는 삭제하지 않았습니다.

## 제품·배포 보존

- 마지막 제품 소스: `d4ccbe39956f9412cfb5be411033df141583b335`.
- 최종 index SHA-256: `e39ac0bb82fa486d8013b694f819a9a2a9d31cca07c2605069832066fc3e67d5`.
- 최종 UI 정적 파일 **7,215개 모두 기대 해시와 일치**. 변경 추가 배포는 이전 재개에서 JS/CSS/index 3개로 제한했습니다.
- 관리 JAR SHA-256 `55f802d2b22c9d4d471644c6157781cc2604e27d4ba0d7b055e4a934bb1d6171`, Mold PID **2860414**, 설정 `config.json`·`WEB-INF/web.xml`·`color.less` 보존.
- Backend/DB/Agent/SystemVM 변경·재시작 없음. 원래 4.23 실행 환경을 보존했습니다.
- 정식/운영 입력 각각 **15 suites/304 tests PASS**. 추가 셀 분기는 실제 렌더링 회귀로 검증했습니다. 현재 마무리에서는 제품 코드가 바뀌지 않아 같은 테스트를 반복 실행하지 않았습니다.

## CI 부채와 완료 범위

제품 [Lint44209208601](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44209208601)은 기존 **실패 훅16개 동일**, UI22개 변경 경로 **추가 진단0**입니다. [License44209208668](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44209208668)는 기존 **unknown4,077건**입니다. 앞선 근거 head 18a7729의 Lint/License도 동일한16개/4,077건을 확인했습니다. 새 완료 문서의 변경 범위 검사와 후속 CI는 제품 검증과 구분합니다.

기존 CI 부채 **#926·#1044는 별도 OPEN**이며 전체 CI를 GREEN으로 표시하지 않습니다.

실계정 전체 ACL/읽기 전용 VM Metrics 경계, 양 계열 업로드 통합 및 실제 미완료 업그레이드 pin UI는 후속 #1702 범위입니다. 기존 #1697의 실제4.21→새4.23 업로드 근거를 보존하며 이번 마무리에서 재실행한 것으로 집계하지 않습니다. 다중 Zone/Edge·비KVM·ARM/s390x 부팅 등 환경 없는 항목의 기능을 삭제하지 않았습니다.

## 브라우저 작업 제약

다크 모드 복원과 최종 카탈로그 화면을 확인했습니다. 제품 검증·클러스터 자원 정리가 끝난 뒤 보조 QA 탭을 선택하려는 단계에서 도구의 브라우저 URL 확인 가드가 입력을 종료했습니다. 이후 추가 Windows 입력을 하지 않았습니다. **보조 탭 정리와 원래 창 크기 원복은 확인하지 못했습니다.** 원래 사용자의 두 탭을 닫는 동작은 수행하지 않았습니다.

제출용 접근성 전사는 Mold 문서 서브트리만 유지하고 무관한 Chrome 프로필/툴바를 제외했습니다. 행 끝 공백과 DOM `data-row-key` 값만 정규화했으며 실제 자원 ID는 링크와 ledger에 유지합니다. 원본 전사·스크린샷은 로컬 검증 폴더에 보존했고 이미지 픽셀은 수정하지 않았습니다.

## 다음 개발 순서

다음은 **#1702(KISO-08) 실계정 ACL·양 계열 업로드·통합 UI 회귀**입니다. Root/DomainAdmin/ResourceAdmin/User/Read-Only/전용 제한 역할의 전체 행렬, 읽기 전용 VM Metrics 권한 경계, 4.21·4.23 업로드·arch·감사·검색/복귀·상태/삭제·최종 정리를 통합합니다.

실제 미완료 업그레이드의 source/target pin UI를 확인하려면 OPEN인 **#1707 Provider 초기화 오류 해결**이 선행돼야 합니다. 사용자가 승인한 #1700→#1702 이관 범위를 유지합니다. #1702와 Epic의 완료 판정은 아직 남아 있으며 PR Draft는 유지합니다.
