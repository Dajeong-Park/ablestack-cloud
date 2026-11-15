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

# Public IP #1686 구현·배포 및 UI 검증 중단 기록

검증일: 2026-11-16 KST. 상위 Epic #1684, 구현 이슈 #1686. **현재 상태: 구현·양쪽 배포 완료, 실환경 UI 검증 미완료. 이슈를 종료하지 않는다.** #1685는 사용자 요청에 따라 CLOSED 상태를 확인했다.

## 구현 범위

- Public IP 상세 메타데이터의 없는 `vlan`을 실제 `vlanname`/`vlanid`로 복원했다. VLAN 값, 범위 UUID, 공용 네트워크, 연결된 게스트 네트워크, VPC를 구분한다.
- `vlan://untagged`는 태그 없음과 원문을 함께 보여준다. 알려진 `vlan://숫자`만 변환하며 알 수 없는 제공자 문자열을 유지한다. 값 없음과 응답에서 필드 미제공을 구분한다.
- 범위 UUID는 복사 대상으로 제공하며 임의 상세 경로를 만들지 않는다. `networkid/networkname`은 공용 네트워크 출처로 표시하고 게스트 네트워크로 연결하지 않는다. 실제 `associatednetworkid/name`, `vpcid/name`만 권한과 유효한 ID를 확인해 기존 경로로 연결한다.
- 가상머신과 동일한 `AutogenView` → `ResourceView`/`InfoCard`/`DetailsTab` 구조와 테마 토큰을 사용한다. 필드 표시를 위한 추가 이름 조회나 관리자 필드 복구 API는 없다.
- IP/프로젝트/역할/세션 전환에서 읽기 범위를 무효화하고 이전 상세를 지운다. 같은 IP의 일시적인 갱신 실패는 마지막 값과 재시도 안내를 유지하며 권한 거부/소실 응답은 값을 지운다.
- 목록 참조 #1688, 필터 #1689, 사용자 표시 설정 #1687은 변경하지 않았다. Java/DB/API 권한 및 기존 네트워크·VPC·VNF 서비스 동작도 변경하지 않았다.

## 로컬 검증

- 구현 커밋: `7d627e65743181bccd5b14e1c645291ca5da57c4`.
- 집중 단위 테스트: **6 suites / 114 tests PASS** (`tests.log`). VLAN/네트워크 표시 조합, 숨김 필드, 상세 응답 검증, 일시 실패 보존, 권한 거부 초기화, IP·프로젝트·역할·세션 지연 응답 폐기, 기존 예약·VM 대화상자·VM 참조 회귀를 포함한다.
- 변경 파일 lint PASS (`lint.log`).
- WSL ext4 `/home/ablecloud/work/issue-1685-public-ip/ui`에서 production UI build PASS (`build.log`). `build-production.cjs`는 source map을 끄며 실행 코드는 production으로 최적화한다. 전체 Cloud 빌드나 Actions 전체 빌드를 요청·실행하지 않았다.
- 단위 테스트는 아래 실환경 미완료 항목을 대체하는 결과로 계산하지 않는다.

## 배포 결과

| 검증 | 31 GFS2 | 32 RBD |
|---|---|---|
| `/client/` | HTTP 200 | HTTP 200 |
| 활성 경로 | `/usr/share/cloudstack-management/webapp` | 동일 |
| WEB-INF 및 서버 파일·config | 보존 확인 | 보존 확인 |
| 관리 프로세스 PID | 2245419 유지 | 2563495 유지 |
| 백엔드 JAR | SHA256 불변 | SHA256 불변 |
| 정적 파일 | artifact의 파일 SHA256 대조 통과 | 동일 |
| 백업 | `/root/publicip1686-ui-20261115-212614` | `/root/publicip1686-ui-20261115-212636` |

양쪽 활성 `index.html` SHA256: `582f34e815afed1337cc0a9fc155b2cfd982d0d6aa00dae8c1f1e83423f9a38a`.
UI artifact SHA256: `47bba9245116af6bb80bb33d8ace37fe727dcd27afcf0b14b13c273016c1b9c5`.
신규 `public-ip-detail-value` 및 기존 예약·FTCTL·VNF·VM 번들 표식을 확인했다. 서버 디렉터리 교체, rsync 삭제 옵션, 백엔드 재배포와 서비스 재시작은 하지 않았다. 자세한 기록은 `deploy-31.log`, `deploy-32.log`에 있다.

## 실제 UI 확인 및 남은 항목

- 31 `10.10.31.105`와 32 `10.10.32.103`의 **Free 관리자 상세**에서 VLAN untagged/원문/범위 UUID와 API가 반환한 공용 네트워크 UUID를 대조했다. 연결된 게스트 네트워크와 VPC는 대시이며 공용 네트워크에는 게스트망 링크가 없다 (`ui-cases.json`).
- 32 배포 전 화면에는 VLAN이 없었고 네트워크 항목만 있었다 (`32-before-vlan-missing.jpg`). 31 배포 후 화면은 `31-Free-admin.jpg`에 있다.
- **복사는 미완료**: UUID 복사 버튼의 성공 알림은 표시됐다. 그러나 브라우저 도구 클립보드 읽기와 붙여넣기는 UUID와 불일치했다 (`copy-result.json`). 브라우저의 가상 클립보드/입력 경로와 앱 실제 복사 중 어느 쪽의 원인인지 확정하지 않았다. 성공 알림만으로 복사 PASS를 선언하지 않는다.
- 실제 OS 입력으로 원인을 구분하려고 Chrome 창을 선택하는 과정에서 Computer Use 도구가 현재 URL을 확신할 수 없다는 이유로 **이번 턴의 UI 제어를 중단**했다. 제어 중단 이후 브라우저 우회 자동화는 실행하지 않았다.
- 따라서 **Reserved/Allocated 실제 상세**, 기존 VM/VPC 링크 이동, 일반 User/DomainAdmin의 서버 VLAN 생략 응답, 동일 IP 503 유지/재시도, 이전 IP 지연 응답, 긴 값/태그/이름만·ID만·미응답 응답 주입, 1280/768/390 × light/dark는 이번 실환경 PASS로 기록하지 않는다.
- 다음 작업은 이 #1686의 복사 원인 확인과 위 남은 UI 행렬이다. 이를 완료해 이슈를 종료한 뒤 순서상 다음 P2 **#1687 사용자 표시 여부의 관리자 설정과 비동기 결과 확인**을 진행한다.

## 시험 자원 및 기존 작업 보존

역할별 읽기 시험용 일반 User 1개(31), 독립 도메인과 DomainAdmin 1개(32)를 만들었으나 UI 제어가 중단돼 예약 단계는 시작하지 않았다. **IP 예약/VM/네트워크/VPC 생성은 0건**이다. 생성 계정 2개와 도메인 1개를 API로 정리한 뒤 목록에서 제거를 확인했다 (`fixtures.json`).

`*-inventory-before.json`과 `*-inventory-after.json`은 허용된 필드만 투영한 값이다. 두 클러스터의 IP/네트워크/VPC/VM/계정/도메인/프로젝트/스토리지 풀 **16개 비교 모두 동일**하다 (`preservation-check.json`). IP 상태는 31 Free18/Reserved0/Allocated35, 32 Free84/Reserved0/Allocated18로 복원됐다. 기존 Windows FTCTL 작업 트리 HEAD와 변경된 3개 추적 파일 SHA256도 동일하다 (`protected-worktree-*.json`).

## 종료 판단

#1685 CLOSED. **#1686 OPEN 유지**. 구현과 배포는 완료했으나 요구된 실환경 검증이 끝나지 않아 종료 기준을 충족하지 않았다. PR #1691은 기존 Epic 브랜치에서 누적하며 병합하지 않는다. 원격 저장소 전체 CI와 위 집중 로컬 검증은 별도 결과다.
