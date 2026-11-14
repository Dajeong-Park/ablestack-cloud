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

# VPC Epic #1650 / PR #1660 최종 코드 리뷰·검증

2026-11-15. 대상은 #1651~#1659의 구현과 최신 Europa 병합 정합성이다. 기존 가상머신용 네트워크 시험은 재집계하지 않았다.

## 검토 결론과 수정

최신 Europa를 통합하고 아래 두 비동기 문맥 오류를 수정했다. 이 범위의 추가 차단 결함은 발견하지 않았다.

- 기준선: 2c4045f1606f58085188c5cb1a203429cad0bf3e.
- 검토 시작: 2053ded5ba5614f537b4cc5c44f6f85d5aa991d1.
- 통합 SHA는 [통합 증적](evidence/merge-source.json)을 참조한다.
- 최종 제품: ce4b96dfdb5148a04be9dd29828e408c77fbe39a.

1. **정적 경로 태그**: 입력 검증을 기다리는 동안 프로젝트·VPC·라우트·세션·권한·화면이 바뀌면 이전 입력이 전송될 수 있었다. 검증 시작 시 대상과 입력을 고정하고 완료 후 같은 문맥인지 재검사한다. 늦은 응답·콜백도 폐기한다.
2. **VPC ACL**: 검증 중 VPC가 바뀌면 이전 초안이 새 VPC ID로 전송되거나, 이전 작업 콜백이 새 대화상자를 닫을 수 있었다. 요청 세대·문맥·수명 검사를 적용하고 문맥 변경 시 이전 폼과 상태를 무효화한다.

실제 Vue 컴포넌트에서 검증 Promise 완료를 지연시킨 재현은 수정 전 **7 FAIL / 2 PASS**, 수정 후 **9 PASS**이다.
이는 결정적 컴포넌트 재현이다. 실환경에서 잘못된 프로젝트로 쓰기를 발생시키는 재현은 수행하지 않았고, 최종 UI의 정상 태그·ACL 전송을 각각 검증했다.

최신 Europa와 충돌한 두 locale, ResourceView, Breadcrumb, AutogenView의 5개 파일은 양쪽 기능을 보존했다.
템플릿 목록 복귀·상세 탭 준비 상태·권한 처리와 VPC/오퍼링/게이트웨이 라우팅·표준 목록 도구 모음을 함께 유지했다.
오퍼링 제공자/상속, 비동기 접수와 최종 결과, 소유 범위, 게이트웨이 후보, 재시작/전환 복구, 조건부 생성, 공통 UI와 정적 경로 표시를 검토했다.
[충돌 해소](evidence/conflict-resolution.json) · [소스 점검](evidence/source-audit.json).

## 로컬 검증

모든 빌드·시험은 WSL ext4의 dhslove 복제본에서 수행했다. 전체 Cloud/Release 빌드를 실행하지 않았다.

| 검사 | 결과 |
| --- | --- |
| VPC·공통 UI·템플릿 집중 회귀 | **55 suites / 1,186 tests PASS** |
| 전체 UI | 411 suites 중 405 PASS / 6 FAIL, 6,349 tests 중 **6,336 PASS / 13 FAIL** |
| 최신 Europa의 실패 6 suites 재검사 | 45 PASS / **동일한 13 FAIL**, 실패 이름 집합 일치 |
| PR 변경 JS/Vue lint | PASS |
| 변경 코드 codespell / 알려진 접속정보 리터럴 검사 | PASS / 일치 0 |
| Maven 변경 모듈 api,server | PASS, VpcOfferingJoinDaoImplTest **4 PASS** |
| 변경 Java 3개 Checkstyle | 위반 0 |
| UI production build | PASS, 1055.0초, Node v20.20.2, npm 10.8.2 |
| 추적 파일만의 RAT 비교 | 제품/기준선 모두 **4,077건**, 신규 0 |

전체 UI와 RAT가 전역 성공이라는 의미는 아니다. 기존 실패는 이 Epic 범위 밖이며 수정·별도 이슈 생성을 하지 않았다.
전체 UI 실패 파일은 SnapshotTabs, SmbShareRequestContract, CreationSourceDeployment, VmGroupOwnership,
storageConfigDispatchFailure, storageIscsiPreparationFailure이고 최신 기준선과 내용이 같다.

[집중 결과](evidence/focused-summary.json) · [전체/기준선 비교](evidence/full-test-summary.json) ·
[실패 이름](evidence/baseline-failures-summary.json) · [수정 전 재현](evidence/validation-race-before.json) ·
[Maven](evidence/maven-modules-result.json) · [Checkstyle](evidence/checkstyle-receipt.json) ·
[RAT 차이](evidence/rat-comparison.json) · [빌드·소스 해시](evidence/build-result.json).

처음 시작한 전체 UI 검사는 수정 필요성을 발견한 뒤 중단했으며 위 집계는 수정 후 완료 실행이다.
node_modules가 포함된 작업 디렉터리의 RAT 시도는 중단하고 추적 파일 전용 깨끗한 export로 대체했다.

## 31(GFS2)·32(RBD) 배포 및 실제 UI

동일한 최종 제품 정적 자산을 양쪽 활성 webapp에 배포했다. 전체 manifest 해시, HTTP 200,
WEB-INF/META-INF·설정·관리 JAR·Mold PID·대형 이미지 보존 및 VPC/FTCTL marker를 확인했다.
서버 JAR·DB·호스트·qemu 패키지는 배포하지 않았다.

- index SHA256: c9a486302ff2d8121d73cf68471d4b134356b5f3362b9d1e1f0e74ba46d61e40.
- app: js/app.205cf31e.js.
- [31 활성 배포](evidence/31-active-deployment-verification.json) · [32 활성 배포](evidence/32-active-deployment-verification.json).
- 실제 UI에서 전용 VPC의 ACL 생성 및 정적 경로 태그 추가를 양쪽 각각 1회 수행했다. POST 파라미터·응답·최종 API 조회/작업 결과와 UI 표시를 대조했다.
- [31 UI/API](evidence/31-ui-api-oracle.json) · [32 UI/API](evidence/32-ui-api-oracle.json).
- 최종 소스의 VPC 목록/상세/탭/대화상자 및 공유 템플릿 내비게이션을 확인하고, 대표 light/dark·모바일 화면을 검사했다. 전체 반응형 12조합은 #1659의 기존 증적을 유지하며 이번 결과로 중복 집계하지 않는다.
- [최종 브라우저 확인](evidence/ui-final-summary.json).

## 정리와 보존

전용 VPC 2개·next-hop 라우트 2개·ACL 2개·태그 2개를 정상 API로 정리했다.
삭제 작업 결과를 확인하고 기존 12종 UUID·주요 설정·계정 사용량 및 원래 작업 트리의 FTCTL 3개 파일 해시를 보존했다.
임시 브라우저 테마·화면 크기도 원복했다.

[31 정리](evidence/31-cleanup.json) · [32 정리](evidence/32-cleanup.json) ·
[31 보존](evidence/31-preservation.json) · [32 보존](evidence/32-preservation.json) ·
[FTCTL 보존](evidence/ftctl-worktree-preservation.json).

## 선행 이슈 증적과 경계

| 이슈 | 완료 범위 / 보고서 |
| --- | --- |
| #1651 | [오퍼링 복제 제공자 보존](../vpc-1651-20261113/README.ko.md) |
| #1652 | [복제 활성화·명시 false·상속](../vpc-1652-20261113/README.ko.md) |
| #1653 | [오퍼링 생성·복제 비동기 결과와 복구](../vpc-1653-20261114/README.ko.md) |
| #1654 | [프라이빗 게이트웨이 후보·검증·복구](../vpc-1654-20261114/README.ko.md) |
| #1655 | [단일/일괄 재시작 결과와 복구](../vpc-1655-20261114/README.ko.md) |
| #1656 | [오퍼링/Tier 전환·부분 실패 재개](../vpc-1656-20261114/README.ko.md) |
| #1657 | [조건부 생성 후보·진단·접수 복원](../vpc-1657-20261114/README.ko.md) |
| #1658 | [VM 표준 UI·집중 회귀](../vpc-1658-20261114/README.ko.md) |
| #1659 | [next-hop 빈 링크·정상 링크·반응형](../vpc-1659-20261114/README.ko.md) |

기존 시험의 미실행·예외·정리 경계는 각 보고서를 따른다. #1212/#1213 전체 완료를 주장하지 않는다.
일반 네트워크·라우터 패킷 회귀나 이슈 외 기능을 추가하지 않았다. 별도 이슈 생성 없음.

GitHub 검사는 로컬 검사와 구분한다. License Check의 4,077건은 위 기준선 비교와 동일하며,
초기 충돌 검사 실패는 충돌이 아닌 라벨 제거 권한 오류였다. [초기 검사 로그 요약](evidence/github-checks-initial.json).
최종 head의 GitHub 검사·병합 SHA·Epic 종료 상태는 PR #1660 및 Epic #1650의 최종 보고에서 확인한다.
