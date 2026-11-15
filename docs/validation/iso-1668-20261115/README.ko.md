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

# ISO-03 #1668 공유·ACL 구현 및 13번 최종 검증

상위 Epic #1664 · 구현 PR #1682 · 개발 순서 3/8 · 2026-11-15 KST.

## 결과

**기능 구현·필요 범위 배포·실계정 UI 검증·시험 자원 정리를 완료했다.** 제품 커밋은 `802fab97140116cc68f4f7700e197f3c520cb278`이다. #1668 종료 조건을 충족했으며 Epic 전체 완료나 PR 병합을 의미하지 않는다.

- 변경 경로 Lint/집중 hook, canonical **16 suites / 257 tests**, 운영 입력 **16 suites / 245 tests** 통과. [검사 요약과 로그 해시](evidence/checks.json).
- 13번 단일 Zone·KVM에서 Root 관리자, 일반 소유자, 공유/회수 수신자, 구체적 프로젝트 범위, 도메인 관리자, 읽기 전용 및 API 일부 거부를 실제 계정 UI로 확인했다.
- ISO 5개·템플릿 3개·계정 5개·역할 1개·프로젝트 2개·도메인 1개를 UI로 정상 정리했다. 전용 VM·네트워크·볼륨·사용자 데이터는 생성하지 않았다.
- 기존 ISO **8개 ID 집합 일치**, 템플릿 **48개**, 계정 **3개**, 역할 **9개**, 프로젝트 **0개**, 도메인 **ROOT**, 사용자 데이터 **0개**를 최종 UI에서 확인했다.
- `s-255-VM`과 `v-245-VM`은 실행 중/Agent Up, 버전 4.23.0.0을 유지했다. 백엔드·Mold PID·설정·테마와 기존 정적 자산을 보존했다.
- 전체 License의 4,077개 경로와 전체 Lint의 기존 실패 hook 16개는 기준과 일치하며 이번 PR 변경 경로의 신규 진단은 0이다. 기존 #926·#1044를 별도 OPEN 관리한다. **전체 CI 성공으로 표시하지 않는다.**

## API 계약과 구현

### 실제 권한 응답과 현재 공유

13번 `listIsoPermissions`는 `listtemplatepermissionsresponse.templatepermission` 단일 객체를 반환한다. 명시적 ISO 루트와 검증된 legacy template wrapper를 각각 지원하되 두 루트가 함께 있거나 ID·오류·배열 타입이 잘못되면 거절한다. 실패를 정상 빈 공유로 바꾸지 않는다.

비공개 이미지 응답에는 소유 계정 또는 소유 프로젝트가 자동 포함된다. 실제 현재 공유의 계정 이름·프로젝트 UUID를 정규화하고 소유자는 회수 대상에서 제외한다. 계정 목록을 조회할 수 없는 일반 소유자도 현재 허용 목록에서 특정 수신자를 선택해 회수할 수 있다.

추가/제거/초기화 전 권한을 다시 읽어 동시 변경을 감지한다. 선택하지 않은 대상은 유지하며 POST 후 재조회한 실제 집합과 기대 집합을 비교한다. 결과 읽기가 실패하면 변경 POST를 반복하지 않고 GET 결과 확인으로 이어간다. 서버가 거절한 이유를 유지하고 성공을 표시하지 않는다.

초기화는 모든 계정·프로젝트 공유와 공개·추천을 해제한다. 추출 가능 값은 유지한다. 영향 설명·확인 체크 및 결과 재조회를 실제 UI로 검증했다.

### 조회 범위와 변경 권한

이미지의 **소유 프로젝트 정보는 호출자의 프로젝트 접근 권한이 아니다.** 프로젝트 소유 ISO를 프로젝트 비구성원 개인 계정에 공유했을 때 상세는 보이지만 Zone·태그 조회가 소유 프로젝트 ID를 잘못 전달해 실패하는 경로를 재현했다. ISO Zone과 이미지 태그 조회는 개인 보기 또는 현재 선택한 프로젝트 범위를 유지하도록 교정했다. 태그의 기존 변경 대상 범위와 비이미지 리소스 계약은 유지한다.

서버 `DomainChecker`와 공유 변경의 실제 거절 결과를 기준으로 UI 조건을 맞췄다. 같은 도메인이라는 이유만으로 다른 소유자 이미지의 변경 권한을 추정하지 않는다. 도메인 관리자의 직접 소유 이미지 변경은 유지한다. 프로젝트 구성원의 일반 이미지 작업과 공유 위임 조건도 구분한다. 프로젝트 소유 이미지의 공유 위임은 서버가 허용하는 클라우드 관리자 범위로 표시하며 일반 구성원에게 실패하는 메뉴를 노출하지 않는다. **서버 ACL은 변경하지 않았다.**

일반 ISO 개인 소유자의 extractable 변경 예외는 유지했다. API의 조회/변경 지원을 따로 검사해 조회 API만 거부된 계정의 공유 관리 진입은 막고 허용된 다른 작업은 유지한다. 시스템 이미지 변경을 실제 시험 대상으로 삼지 않았다.

### Zone·공통 템플릿·대화상자

기본 Zone 행·Ready·상태 표시를 저장소 상세 권한과 분리했다. 제한 응답의 선택 필드가 없어도 기본 행을 유지한다. 정상 빈 실행 가능 조회에만 shared 보조 조회를 적용하며 오류·잘못된 응답·이전 범위 응답에는 우회 조회를 하지 않는다.

1666 적용 뒤 실제 User의 기존 Zone은 이미 총 1개/행 1개였다. 이번 작업은 그 행·건수를 유지하고 숨겨진 상태를 표시하며 조회 범위와 작업 조건을 보강한 것이다. 기존 행 수 보정을 이번 변경만의 성과로 소급하지 않는다.

공통 권한 창은 MoldDialog를 사용한다. 현재 공유·고정 footer·busy 중 제출/닫기 제한·오류·결과 재확인을 제공한다. 템플릿도 계정·프로젝트 추가/특정 제거/초기화를 실제 UI로 회귀했다. 읽기 전용 템플릿 Zone에 남던 선택 체크박스는 삭제 API·소유 범위·현재 행·갱신 상태에 맞춰 교정했다. 권한/소유 범위 변경 시 선택을 지우며 허용된 관리자 행·일괄 삭제는 정상 동작한다.

## 실제 UI 검증 행렬

계정·ISO·템플릿·프로젝트·도메인·역할 생성, 수정, 공유, 회수 및 삭제는 실제 Mold UI로 수행했다. CDP는 UI가 발생시킨 요청 관찰과 명시적 XHR 오류 재현에만 사용했다. 직접 API/DB 변경으로 UI 성공을 대신하지 않았다.

| 구분 | 실제 확인 | 결과 |
|---|---|---|
| Root 관리자 | 실제 legacy 권한 조회, 계정 B/C 추가, B만 회수, C 보존, 재조회 및 B 목록/직접 상세 차단 | 통과 |
| 일반 개인 소유자 | 목록 전체 조회 없이 수동 이름 추가, 현재 공유에서 B만 회수·C 보존, 초기화 | 통과 |
| 일반 소유자 예외 | extractable true/false 저장과 다운로드 메뉴 표시/제거 | 통과 |
| 공유 수신자 | 제한 응답에서도 Zone 총 1개/표시 1개·상태·Ready 유지, 변경/선택 차단 | 통과 |
| 미공유·회수 수신자 | 특정 계정 또는 프로젝트 회수 후 목록·직접 상세 접근 차단 | 통과 |
| 프로젝트 수신자 | P1/P2 추가, 개인 계정 공유 제거 후 프로젝트 공유 보존, P1만 회수·P2 보존, 초기화 | 통과 |
| 프로젝트 소유 이미지 | Root 소유 P1의 ISO와 템플릿을 비구성원 C 개인 계정에 공유, 개인 범위의 Zone·태그 정상 조회, C 회수 후 접근 차단·소유자 자원 유지 | 통과 |
| 일반 프로젝트 구성원 | 구체적 P1에서 조회·행 선택과 허용된 일반 작업 유지, 공유 위임 POST 거절, 최종 ISO/템플릿 공유 메뉴 숨김 | 통과 |
| 도메인 관리자 | 소유 ISO 계정 추가/회수 및 정상 삭제, 동일 도메인 타 소유자 조회는 유지·변경 차단, 전용 자원 변경 POST 거절, 도메인 밖 직접 접근 거절 | 통과 |
| 읽기 전용 User | 역할 전환 직후 기존 창의 템플릿 변경 POST 거절·기존 공유 유지, 새 로그인에서 변경 메뉴/Zone 선택 제거 | 통과 |
| 일부 API 허용 User | 실제 UI listApis에서 두 listPermissions 거부·두 updatePermissions 및 일반 수정/삭제 허용 확인, ISO/템플릿 공유 관리만 숨김·다른 허용 작업 유지 | 통과 |
| 템플릿 공통 회귀 | 계정 B/C 및 P1/P2 추가, B/P1 선택 회수·C/P2 보존, 초기화·수신자 차단, 최종 관리자 행/일괄 삭제 | 통과 |

시험 B/C 계정 생성에서 기본 역할이 남았던 것을 발견해 User로 교정하고 실제 계정 목록·재로그인으로 검증했다. 교정 전 읽기 관찰은 일반 User ACL 근거에서 제외했으며 잘못된 역할 세션에서 자원을 변경하지 않았다.

### 실패·경합·중복 제출 방지

- 실제 권한 GET 차단: 오류와 재시도를 표시하고 현재 공유를 빈 목록으로 표현하지 않으며 변경을 막았다. 차단 해제 후 GET 재시도로 실제 공유를 복구했다.
- Root 두 창 동시 변경: 새 권한 집합을 표시하고 대상 선택을 비웠다. 오래된 제출에서는 GET 1회, POST 0회를 확인했다.
- 실제 POST 처리 후 결과 GET만 실패: 변경을 재제출하지 않고 상태 확인으로 전환했다. 복구 버튼은 GET만 전송했고 전체 변경 POST는 1회였다. XHR 진단 설정은 해제했다.
- 존재하지 않는 계정·읽기 전용 역할·비소유자 변경: 서버 거절 사유, 성공 표시 0 및 실제 공유 불변을 확인했다.
- 잘못된 응답·이전 범위 응답·동시 제출 및 제한 필드 계약은 단위 테스트로 보강했다. 실제 서버가 malformed payload를 반환했다고 주장하지 않는다.

[121개 UI 관찰 기록](evidence/ui-cases.json)은 결함 재현·실패·정리 기록을 포함하므로 121개 전부를 성공 시험 수로 해석하지 않는다. [관찰 판정 보정](evidence/ui-case-disposition.json)을 함께 확인한다.

## 화면 근거

- [회수 대상 누락 전](screenshots/before-remove-targets-empty.jpg) · [실제 회수 대상 복원](screenshots/after-remove-targets.jpg)
- [B만 회수하고 C 유지](screenshots/account-selective-removal.jpg) · [P1만 회수하고 P2 유지](screenshots/project-selective-removal.jpg)
- [권한 조회 실패 차단](screenshots/permission-read-error.jpg)
- [프로젝트 개인 수신자 오류 전](screenshots/project-personal-receiver-scope-before.jpg) · [ISO 보정 후](screenshots/project-personal-receiver-scope-after.jpg) · [템플릿 보정 후](screenshots/project-template-personal-receiver-after.jpg)
- [읽기 전용 선택 전](screenshots/readonly-template-selection-before.jpg) · [선택 보정 후](screenshots/readonly-template-selection-after.jpg)
- [도메인 비소유 변경 차단](screenshots/domain-nonowner-actions-after.jpg) · [허용된 관리자 삭제 결과 유지](screenshots/template-authorized-delete-result.jpg)
- [일반 테마](screenshots/permission-dialog-light.jpg) · [다크 기본 화면](screenshots/permission-dialog-dark-default.jpg) · [기존 ISO 최종 목록](screenshots/final-original-iso-list.jpg)

900×600 viewport 변경 요청은 실제 브라우저에 적용되지 않았다. 기록된 실제 크기는 1680×897이므로 **좁은 화면 통과로 계산하지 않는다**. 명시적 좁은/낮은 화면과 전체 키보드 조합은 #1673 통합 회귀에 남긴다. 일반/다크 기본 화면과 실제 위젯의 키보드 연산 선택은 확인했다.

## 빌드·운영 입력·배포 경계

작업 시작과 재개 시 로컬/upstream/origin 기준 `ablestack-europa`는 `1046a5dc3f21cb9cca0ab6881dd906d64b591e80`, 차이 0/0이었다. 기존 기능 브랜치 `dhslove/epic-1664-iso`를 갱신한 로컬 기준에서 검증했고 origin 기능 브랜치에만 push했다.

운영 입력 `/root/work/.build-iso1667-20261115/ui`에 이번 8개 UI 소스·번역 키와 관련 테스트만 합성했다. ResourceTags는 현재 운영판과 canonical의 무관한 복구 기능 차이가 있어 읽기 범위 패치만 운영판에 적용했다. 이미지 태그 읽기 helper는 canonical/runtime가 바이트 단위로 같고, 운영 태그 변경/복구 코드는 기존 입력 그대로다. canonical 257개와 운영 입력 245개의 차이 12개는 이 무관한 복구 기능 차이에 따른 것이다.

| 단계 | 제품 SHA | 정적 자산 쓰기 | index SHA-256 |
|---|---|---:|---|
| 최초 | d29095f30128fb3dd412cd602a2957c1a19c986f | 9 | 2330b986cf26fb30492ec50480ef8a869b683acf6742dc9e6f49f75a36776391 |
| 선택·소유권 보정 | f66f3799be02b7fd97447d370d0af0b170145884 | 4 | 7e67412582bc27ee843466f7bbee81244ee6f6ca1e948b1d8e602bf9764e5c29 |
| 최종 조회 범위 보정 | 802fab97140116cc68f4f7700e197f3c520cb278 | 5 | 1170070d18c24110fca7cdfdfc264f95c9db3dfb690252a231ba42eee5966650 |

중복 index 쓰기를 포함한 단계별 수치다. 최종 앱은 `js/app.8f9be75f.js`이다. 이전 해시 자산을 지우지 않았고, 배포 전후 현재 전체 자산 집합이 예상 패치 결과와 정확히 같음을 확인했다. 새 백엔드·호스트 JAR, DB 마이그레이션, Mold/Agent 재시작 및 SystemVM 재생성은 없다.

- 최종 Mold PID: `2545994` 유지.
- 백엔드 JAR SHA-256: `97bdbed5f8f6f33edd4576a572269265ebc2c0037f7fa476423e1175c158b224` 유지.
- `config.json`, `WEB-INF/web.xml`, `color.less`와 원래 테마·창 크기 보존. 전용 계정과 관리자 검증 세션은 로그아웃했다.
- [최종 운영 해시](evidence/final-runtime.json) · [배포 manifest](evidence/deploy-files.json) · [소스 경계](evidence/source-boundary.json) · [태그 운영 입력 동등성](evidence/tag-read-runtime-compatibility.json)

이번 작업의 실제 UI 회귀는 현재 4.23 SystemVM에서 수행했다. 등록/전송 코드와 서버 런타임을 바꾸지 않았고 [#1667의 4.21·4.23 업로드 검증](../iso-1667-20261115/README.ko.md)을 보존했다. 이번 이슈에서 두 계열을 다시 재생성·검증했다고 표시하지 않는다.

## 정리와 기존 자원 보존

[자원 원장](evidence/resource-ledger.json)에서 생성한 ISO 5/5, 템플릿 3/3, 계정 5/5, 역할 1/1, 프로젝트 2/2, 도메인 1/1의 정상 UI 삭제를 추적했다. 공유를 회수하고 연관 이미지·프로젝트를 먼저 정리한 후 해당 계정·역할을 삭제했으며 계정은 VM/볼륨/IP 0 확인·비활성화·정확한 이름 입력 후 삭제했다. 도메인에는 계정·VM이 없음을 확인했다. 강제 이미지 삭제나 DB 정리를 사용하지 않았다.

최종 QA 잔여는 모두 0이다. 원래 ISO 8개 ID·템플릿 48개·계정 3개·역할 9개·ROOT 도메인·사용자 데이터 0개를 보존했다. 기존 운영 SYSTEM 이미지와 VM을 변경하지 않았고 `s-255-VM`, `v-245-VM`의 실행/Agent Up을 UI로 확인했다. 진단 차단·요청 제어·viewport는 원복했으며 인증값·비밀번호·서명·일회 URL을 이슈/PR/파일에 저장하지 않았다.

## CI 부채와 다음 순서

- 변경 경로 Lint와 집중 pre-commit/수동 hook 58개 파일 검사를 모두 통과했다. 전체 pre-commit 실패 뒤 전체 수동 stage가 자동 생략된 것과 변경 경로 검증을 구분한다.
- [License 비교](evidence/final-rat-comparison.json): 기준/제품 모두 Unknown 4,077개, 추가·제거 0. [문서 포함 staged 검사](evidence/report-rat-comparison.json)도 추가 0이다. GitHub [제품 License run](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/43672694743)도 같은 기존 실패다. #926 별도 유지.
- [Lint 비교](evidence/final-precommit-classification.json): [제품 Lint run](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/43672694710)의 기존 실패 hook 16개 동일, 진단 경로 11,172개, PR 변경 경로 신규 진단 0. #1044 별도 유지.
- 문서 마감 커밋의 전역 CI가 추가 실행되면 제품 코드 검증 SHA와 구분한다. 전체 CI 성공이나 부채 해결로 표시하지 않는다.
- 다음 개발 순서는 **#1669 ISO-04 수정·부팅/arch·설정 계약**이다. 목록·breadcrumb·이름 우선 열과 상세·Zone 시각 표준화는 #1670·#1671, 다운로드/VM 소비는 #1672, 다중 Zone·비KVM·좁은 화면 등 전체 통합 회귀는 #1673에 남긴다. 멀티 Zone 기능은 유지한다.
