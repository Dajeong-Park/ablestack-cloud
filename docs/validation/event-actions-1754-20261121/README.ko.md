<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->

# EVT-02 이벤트 일괄 작업과 보관 상태별 삭제 검증

2026-11-21 KST에 [#1754](https://github.com/ablecloud-team/ablestack-cloud/issues/1754)의 변경을 13번 테스트 클러스터에 적용했다. **실환경 API와 UI 단위 테스트를 통과했고, 실제 브라우저 UI 검증은 대기 중이다.** Windows 세션 연결 끊김으로 컴퓨터 사용 도구에서 브라우저를 열 수 없었다.

## 구현

- 활성 이벤트를 선택하면 권한과 설정에 따라 보관·CSV·삭제가 표시된다. 보관한 이벤트는 CSV 다운로드 대상이다.
- 보관·삭제 확인 창은 VM과 같은 MoldDialog를 사용한다. 창을 열 때 대상 UUID를 확정해 개수와 영향 범위를 표시한다. 오류가 나면 업데이트로 현재 상태를 확인한 뒤 대상을 다시 선택한다.
- 서버는 선택한 이벤트 행을 한 트랜잭션에서 잠그고 전체의 권한과 보관 상태를 확인한 뒤 처리한다. 보관된 대상이 섞이면 431로 거부하고 활성 대상도 변경하지 않는다. `event.delete.enabled`가 OFF일 때 삭제 API도 거부한다.

## 13번 실환경 API

| 검증 | 결과 |
| --- | --- |
| 활성 두 건 보관 | HTTP 200, 두 UUID 모두 보관됨 |
| 보관 CSV 두 건 | CSV의 UUID 집합과 보관 전후 상태 일치 |
| 이미 보관된 대상과 활성 대상 혼합 | 삭제·보관 모두 HTTP 431, 활성 대상 유지 |
| 활성 두 건 삭제 | HTTP 200, 두 UUID 조회 결과 없음 |
| 삭제 설정 OFF | HTTP 531, 사유는 설정에서 삭제를 비활성화했다는 문구, 대상은 활성 유지 |
| 일반 사용자로 다른 계정 소유 이벤트 삭제 | HTTP 431, 대상 유지 |

테스트 계정은 5개 모두 정리했고 삭제 설정은 최초 값인 ON으로 복구했다. 시험 감사 이벤트는 보관 2건, 삭제 2건, 활성 1건이다.

## 배포와 자동 검증

- WSL 로컬·origin·upstream Europa는 `25e2ab7eda1abe17490ccd577deceb1f3f6ba63e`에서 일치했고 차이는 `0 0`이었다.
- 백엔드 집중 테스트 7건, UI 집중 테스트 23건, 변경 파일 ESLint 및 UI 빌드를 통과했다. UI 단위 테스트는 액션 표시 조건, 취소, 중복 제출 차단, 지연 응답과 오류 후 재조회를 다룬다.
- 관리 서버 JAR에는 클래스 5개를 교체했다. 다른 92,938개 엔트리의 CRC와 UI 설정은 동일했다. `mold.service` 활성 및 HTTP 응답을 확인했다.
- 배포한 관리 JAR SHA-256은 `608281ca55ad1f39c8b906faeda72f6f279b956d9931b0b1c56f7fe4cdb1fb10`이다. 704개 UI 파일을 검증했고 HTTP `index.html` SHA-256은 `0346b30ccfe730fe9b47cbdd1d8af5b9b9d0baf4f758eff6a2bb068f2c5b9970`이었다.

## 브라우저 인수 대기

Windows 재연결 후 새 시험 이벤트로 활성/보관 상태별 버튼 표시, 단건·복수 확인 창, 취소, 다른 화면에서 먼저 보관된 대상의 오류와 재조회, 삭제 설정 ON/OFF, 제한 역할을 실제 화면에서 확인한다.

[이슈 검증 댓글](https://github.com/ablecloud-team/ablestack-cloud/issues/1754#issuecomment-7054601496) · [Epic PR #1765](https://github.com/ablecloud-team/ablestack-cloud/pull/1765)
