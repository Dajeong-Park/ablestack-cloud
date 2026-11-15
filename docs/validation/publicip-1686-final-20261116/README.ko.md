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

# Public IP #1686 최종 구현·31/32 UI 검증 완료 보고

검증일: 2026-11-16 KST. Epic #1684의 PIP-02 / #1686 완료 보고다. 이전 `publicip-1686-20261116/`의 중단 시점 기록 이후 남은 실환경 검증과 복사 안내 수정을 완료했다. #1685는 이미 종료됐으며 #1686도 이 결과를 근거로 종료한다. PR #1691은 누적 Epic PR이고 미병합이다.

## 결과와 변경

- 실제 API 필드 `vlanname/vlanid`를 VM 공통 상세 구조 `ResourceView/InfoCard/DetailsTab`에 표시한다. 태그 없음과 원문, 숫자 태그, 제공자가 반환한 알 수 없는 문자열, 값 없음, 응답에서 미제공을 구분한다. `vlanid`는 VLAN 범위 UUID이며 태그 번호로 설명하거나 임의 경로로 이동하지 않는다.
- `networkid/networkname`은 공용 네트워크 출처다. 실제 연결 게스트망 `associatednetworkid/name` 및 `vpcid/name`과 별도로 표시한다. 공용 네트워크에 게스트망 링크를 만들지 않고, 게스트망/VPC는 권한과 유효한 ID가 있을 때만 기존 경로로 연결한다. 이름만 있으면 일반 텍스트, ID만 있으면 해당 ID를 표시한다.
- IP·프로젝트·역할·세션 범위를 바꾸면 이전 읽기를 무효화한다. 같은 IP의 일시적인 읽기 실패는 마지막 값과 재시도를 유지하며 늦은 이전 IP 응답은 새 화면에 적용하지 않는다. 서버가 생략한 VLAN을 관리자 API로 복구하지 않는다.
- 이번 후속 수정은 공통 `TooltipButton`이 clipboard 성공/실패 이벤트를 전달하도록 하고 Public IP 값 위젯이 그 결과에 따라 알림을 표시하도록 했다. **클릭만으로 성공 알림을 내보내던 동작을 제거**했다. 실패하면 식별자가 화면에 남고 직접 선택·재시도할 수 있게 안내한다.

최종 실행 코드 커밋: `b9def040458c60e4b648fc1c8ef70901371dd5f4`. 기본 상세 구현은 `7d627e65743181bccd5b14e1c645291ca5da57c4`에 있다. Java/API 권한/DB 변경은 없다. #1687 표시 설정, #1688 목록 참조, #1689 검색, #1690 표현 통합은 이 변경에 포함하지 않는다.

## UUID 복사 불일치 판정

`copy-diagnosis.json`에서 브라우저의 실제 `document.execCommand('copy')` 반환은 **true**, 선택 원문은 현재 IP의 VLAN 범위 UUID와 정확히 같았다. 같은 시점 자동화 도구의 세션 클립보드는 미리 넣은 검사 문자열을 유지했다. UUID 매핑 오류가 아니라 **레거시 브라우저 복사를 도구의 세션 클립보드 읽기가 반영하지 못하는 관찰 경로 차이**로 판단했다.

이와 별개로 앱이 실제 결과 전에 성공을 알리는 문제는 위와 같이 수정했다. 배포된 UI에서 31·32 각각 실제 복사 명령 true/정확한 선택 UUID/성공 안내를 확인했다. 브라우저 명령의 false를 주입하면 오류 안내만 표시했고, 31에서는 Enter 키로도 실제 복사를 확인했다. 총 **5개 복사 경계 PASS** (`copy-checks.json`). false 주입은 실패 UI 시험이며 서버 장애나 실제 클립보드 장애 발생으로 기록하지 않는다.

검증 기준은 브라우저의 복사 명령 결과·선택 원문·실제 성공/실패 콜백이다. 외부 Windows 앱 붙여넣기나 OS 클립보드 직접 읽기의 PASS를 주장하는 결과는 아니다. 브라우저 복사 명령을 감싼 관찰/실패 주입은 모두 복원했다.

## 실제 서버·UI 결과

| 대상 | 31 GFS2 | 32 RBD | 증거 |
|---|---|---|---|
| Free / Reserved / Allocated 상세 | PASS | PASS | `ui-cases.json`, 상태별 JPG/TXT |
| 공용망과 실제 연결망 구분 | PASS | PASS | API 표본 6개와 화면 대조 |
| 기존 게스트망·VPC·VM 링크 이동 | PASS | PASS | `link-checks.json`의 URL/대상 제목 |
| User VLAN 미응답 | PASS | PASS | `*-Reserved-User.json`, User 화면 |
| DomainAdmin VLAN 미응답 | PASS | PASS | `*-Reserved-DomainAdmin.json`, DomainAdmin 화면 |
| 같은 IP 503 시 값 보존·재시도 | PASS | PASS | `read-checks.json`, 503 화면 |
| 늦은 이전 IP 응답 폐기 | PASS | PASS | 이전 응답 재개 후 새 IP/연결망 유지 |
| 1280 / 768 / 390 × light/dark | 6 PASS | 6 PASS | `ui-layouts.json`, 크기별 JPG |
| 시험 정리 후 Free·소유자 잔상 제거 | PASS | PASS | `ui-cleanup.json`, 최종 Free 화면 |

- 실제 API와 대조한 Allocated 표본은 클러스터별 일반 연결망, VPC, 프로젝트 VM IP 각 1개다. 공용망은 ID만 반환한 실제 계약대로 표시하며 조회로 이름을 덧붙이지 않았다.
- `*-Reserved-Admin.json`은 시험 준비의 `reserveIpAddress` 동기 응답 투영이다. 상세의 `listPublicIpAddresses` 읽기와 같은 필드 집합으로 취급하지 않는다. 실제 Reserved 상세는 서버 조회 화면으로 확인했고, 합성 응답은 이 최소 표본에 시험 필드를 명시해 구성했다. 합성 표본에 범위 UUID가 없으면 정상적으로 미제공을 표시한다.
- VM 기준의 상세/요약·breadcrumb·업데이트·작업 메뉴·탭과 테마 토큰을 재사용한다. 반응형 12개 조합에서 페이지/새 필드의 가로 넘침이 없고 UUID 및 복사 버튼이 표시됐다. 390px에서 세로 스크롤로 상세에 접근했다.
- 실제 Root Admin 응답의 VLAN 원문/UUID와 달리 User/DomainAdmin의 4개 서버 응답은 두 필드를 생략한다. 실제 UI는 “이 응답에서 미제공”이며 숨겨진 UUID의 복사 버튼이나 이전 관리자 값이 남지 않았다 (`role-checks.json`). 역할별 시험은 이 읽기 계약의 변경 경계이며 기존 전체 서비스/권한 행렬을 반복하지 않았다.
- 503은 상세 GET에만 주입했다. 양쪽 모두 마지막 값과 실패 안내를 보존하고 재시도로 복구됐다. 이전 Allocated IP의 GET를 중지한 뒤 다른 Reserved IP를 열고 이전 GET를 재개했을 때도 새 IP와 빈 연결망이 유지됐다. 실제 서버 장애나 NAT/네트워크 변경 시험은 아니다.
- 태그 `vlan://123`, 긴 공용/게스트망/VPC 이름, 이름만/ID만, null, 알 수 없는 긴 제공자 문자열과 HTML처럼 보이는 문자는 **합성 API 응답 6개 조합**으로 확인했다. 실제 인프라 VLAN/망을 추가하지 않았다 (`synthetic-checks.json`). 긴 이름·제공자 문자열의 390px 4개 추가 측정도 넘침이 없다. 실제 서버의 VLAN 값은 untagged다.
- 한국어/영어 변경 라벨과 영어 복사 안내를 확인한 뒤 한국어·라이트·기본 보기로 복원하고 임시 탭/화면 크기/응답 주입을 정리했다. 초기에 32번 viewport 도구가 다른 탭 크기를 적용한 측정은 제외하고 실제 `innerWidth`를 확인해 다시 측정했다 (`viewport-tool-mismatch.json`).

관찰한 전용 refresh/case 구간의 288개 GET에서 공용 source networkid의 이름 보완용 `listNetworks`와 `listVlanIpRanges`는 0건이었다. 기존 연결망/VPC 문맥·아이콘 조회는 유지한다. `ui-requests.json`은 명령과 허용된 범위 인자만 기록하며, 관찰 밖 또는 잘린 구간 전체의 요청 부재를 주장하지 않는다. 값 위젯/변환 도우미에도 API 조회가 없다.

## 로컬 검증과 배포

- 집중 테스트 **6 suites / 117 tests PASS**, 변경 파일 lint PASS. Clipboard 결과 이벤트 연결과 클릭만으로 성공하지 않는 경계를 추가했다. 기존 상세 범위 가드·예약·VM 대화상자·VM 참조 회귀를 포함한다 (`tests.log`, `lint.log`).
- WSL ext4 `/home/ablecloud/work/issue-1685-public-ip/ui`에서 source map 없는 production UI build PASS (`build.log`, `build-production.cjs`). 전체 Cloud 빌드나 Actions 전체 빌드는 요청/실행하지 않았다.
- 양쪽 활성 UI는 `/usr/share/cloudstack-management/webapp`이며, artifact의 정적 파일 SHA256 전체 대조가 통과했다. WEB-INF 및 서버 파일/config, 관리 PID와 백엔드 JAR SHA256을 배포 전후 대조했다. 서비스 재시작은 없다. 신규 복사 안내와 기존 Public IP·FTCTL·VNF·VM 표식도 활성 JS에서 확인했다.

| 항목 | 31 | 32 |
|---|---|---|
| HTTP | 200 | 200 |
| 관리 PID 유지 | 2245419 | 2563495 |
| 정적 파일 백업 | `/root/publicip1686final-ui-20261115-214306` | `/root/publicip1686final-ui-20261115-214332` |

양쪽 `index.html` SHA256: `3d659c182a9310b1b36237c15c6bb752125e358c0f758c60bfcd6321affbae10`.
Artifact SHA256: `2883e00f5631c15886552615817d96124020a56e876ff8fc42f5f938c12e86f6`.
배포 로그는 `deploy-31.log`, `deploy-32.log`, 소스는 `build-source.txt`에 있다. 로컬 집중 검증과 PR의 저장소 전체 CI는 구분하며 최신 등록 검사 결과는 PR #1691을 참조한다.

## 시험 자원 정리와 보존

클러스터별 독립 도메인 1개, User/DomainAdmin 계정 각 1개와 전용 Free IP 1개를 사용했다. 총 **계정 4개·도메인 2개를 삭제**했고 시험 예약 2개를 해제했다. UI에서는 새 VM/네트워크/VPC/스토리지/규칙을 생성하거나 기존 서비스 설정을 바꾸지 않았다 (`fixtures.json`).

| 최종 IP 상태 | 31 | 32 |
|---|---:|---:|
| Free | 18 | 84 |
| Reserved | 0 | 0 |
| Allocated | 35 | 18 |

두 클러스터의 IP/네트워크/VPC/VM/계정/도메인/프로젝트/스토리지 풀 **16개 범위의 UUID 및 선택 필드 비교가 모두 동일**하다 (`preservation-check.json`). Windows 원래 FTCTL 작업 트리 HEAD와 변경된 추적 3개 파일 SHA256도 동일하다 (`protected-worktree-*.json`). DB/호스트 전체 파일의 전수 감사나 예약 이력 동일성을 주장하는 비교는 아니다.

## 이슈 상태와 다음 진행

- **#1685 CLOSED, #1686 완료 후 CLOSED**. Epic #1684의 완료 항목은 2/6이며 나머지 4개는 Open이다. PR #1691은 두 구현을 누적하며 미병합이다.
- 다음 P2는 **#1687 Public IP 사용자 표시 여부의 관리자 설정과 비동기 결과 확인**이다. Root Admin의 예약 `fordisplay` 옵션과 안정된 Reserved/Allocated 표시 설정 편집, 실제 update job 결과·미확정/재진입·중복 요청 방지 및 원래 값 복원을 담당한다.
- #1688 목록 참조·#1689 검색과는 VLAN 범위 UUID 및 공용/연결망의 의미를 공유했다. 위 필드 계약의 일치를 확인한 결과이며 아직 구현하지 않은 목록/검색 전체 또는 최종 결합 회귀를 완료했다는 의미는 아니다. 해당 구현과 #1690 최종 통합은 각 후속 이슈에서 진행한다.
