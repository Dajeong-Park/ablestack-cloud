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

# ISO-02 등록·로컬 업로드 구현 및 검증 (#1667)

상위 Epic #1664 · 구현 PR #1682 · 13번 단일 Zone/KVM · 2026-11-15 KST.

**최종 상태: 구현·필요 산출물 배포·양 계열 업로드/UI 회귀·다운로드 4파일 검증·시험 자원 정리를 완료했다. #1667의 종료 조건을 충족했으며 Epic의 나머지 하위 이슈는 별도 진행한다.**

단위 테스트나 업로드 접수만으로 완료를 표시하지 않았다. 아래 등록·실패·복구·삭제는 실제 Mold UI에서 실행했고, 해당 UI가 받은 API 응답과 배포 런타임을 보조 근거로 대조했다.

## 구현 결과

- URL/로컬 API 스키마를 분리하고 지원하는 파라미터만 전달한다. 로컬 API의 상속된 필수 값 `format=ISO`도 보존한다. URL·파일 필수·체크섬 입력 오류를 해당 필드에 표시하고 false 값을 보존한다.
- 로컬 접수 ID는 `postuploadisoresponse.getuploadparams.id`에서 읽는다. 등록 → 파일 전송 → 서버 Ready → 사용자 데이터/정책 연결 → 완료를 분리한다. 전송 100%를 Ready로 표시하지 않는다.
- 일회 티켓은 컴포넌트 런타임에만 보관한다. 전송 전 연결 실패는 같은 미사용 티켓으로 재시도하고, POST 시도 뒤에는 재사용하지 않는다. 만료된 티켓은 전송 전에 차단한다.
- Ready 후 연결 실패는 ISO 성공과 구분한다. 같은 ID로 연결만 재시도하며 자동으로 ISO를 추가 생성하지 않는다.
- 관리자 대리 등록에서 계정/도메인이 바뀌면 이전 사용자 데이터 선택과 목록을 즉시 비운다. 조회 중 제출/재시도를 막고, 갱신된 범위에 없는 선택을 제거한다.
- SSVM의 알려진 평문 체크섬 오류를 일반 HTTP 500 대신 표시한다. 임의 HTML이나 추가 서명 문자열은 그대로 노출하지 않는다.
- MoldDialog의 고정 Header/Footer·Body 스크롤·busy/초점 계약을 사용한다. 긴 접수 이름은 한 줄 ellipsis와 전체 title을 제공한다. 목록 설명 배너를 추가하지 않았다.
- 전송 중단은 클라이언트 전송만 중단한다. 서버 취소로 표시하거나 NotUploaded 삭제/TTL을 우회하지 않는다.

서버는 `GetUploadParamsForIsoCmd → IsoUploadParams → 기존 TemplateProfile/metadata`로 checksum/arch를 전달한다. 기존 생성자를 유지했고 x86_64 기본값을 보존했다. 기존 `vm_template.checksum/arch` 열을 사용하며 신규 스키마·migration은 없다.

## 실제 런타임과 검증 커밋

| 구분 | 실제 VM / 업로드 런타임 | 이미지 릴리스 파일 | secondary JAR SHA-256 |
| --- | --- | --- | --- |
| 4.21 호환 | s-254-VM · 4.21.0.0-Mold.Diplo-202609221440 | Cloudstack Release 4.22.0 | `d5f6dbcf45df292dcfb1d12d84e30ee14f41cb4a9e70f0a1ff82aa62b9c78667` |
| 4.23 재생성 | s-255-VM · 4.23.0.0 | Cloudstack Release 4.23.0.0 | `a7c075a5936b2d7bf6a9e6453fc25d247ac0a7b33cdd91046469ca1e28ff27a3` |

4.21은 실제 agent/secondary 및 Cloud JAR 전체가 4.21인 업로드 호환 런타임이다. 이미지 릴리스 표기 4.22와 구분하며, 이를 4.21 OS 이미지로 주장하지 않는다. 버전 문자열을 고쳐서 시험하지 않았다.

원래 s-244-VM을 UI에서 재생성해 4.21 런타임을 검증한 뒤, 새 4.23 SYSTEM 이미지로 s-255-VM을 실제 생성했다. 현재 VM은 `ec08882e-81a5-4c20-b427-d9d2c0ffe12d`, 호스트 10.10.13.1, Agent Up/Running이다. 원래 콘솔 v-245-VM의 ID `147cd89a-9b5b-4bcd-a0ca-a1ac88584578`는 보존했다.

4.21 주 검증 UI는 `3003887f789`, 4.23 등록 행렬은 `5ebca2ecb09`에서 확인했다. 최종 제품 `727bed1519a`에서는 소유자 변경, 오류 표시, 긴 이름, 새로고침, 실제 로컬+APPEND 연결 실패/재시도와 Esc 취소를 다시 검증했다. 임시 cb9424 빌드는 소유자 문제 보정을 포함하는 후속 빌드로 대체했으며 배포하지 않았다.

[소스 동일성 근거](evidence/compatibility-source-equivalence.json): 4.21 확인 이후 전송/재시도/Ready/연결 6개 메서드, 등록 유틸리티, 서버 4개 파일은 동일하다. 마지막 변경은 공통 소유 범위 조회와 오류/단계 표시이며 4.23에서 해당 경로를 재검증했다. 4.21의 최신 전체 UI를 다시 실행한 것으로 표시하지 않는다.

- [4.21 실제 런타임](evidence/ssvm421-runtime.json)
- [4.23 실제 런타임](evidence/ssvm423-runtime.json)
- [최종 배포 입력과 경계](evidence/source-boundary.json)

## 등록 행렬

관리자·일반 소유자 × URL/로컬 × 부팅/비부팅의 8개 조합을 각 계열에서 모두 Ready까지 확인했다. 아래 checksum은 실제 UI 조회 응답의 저장 값이다. 전체 ID/이름/크기/해시는 [행렬 JSON](evidence/registration-matrix.json)에 있다.

| 계열 | 소유자 | 방식 | 부팅 가능 | checksum | arch | 정책 | Ready |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.21 | 관리자 | URL | 아니오 | MD5 | x86_64 | APPEND | true |
| 4.21 | 관리자 | URL | 예 | SHA-256 | x86_64 | 미선택 | true |
| 4.21 | 관리자 | local | 아니오 | MD5 | x86_64 | APPEND | true |
| 4.21 | 관리자 | local | 예 | MD5 | x86_64 | 미선택 | true |
| 4.21 | 일반 사용자 | URL | 아니오 | SHA-256 | aarch64 | ALLOWOVERRIDE | true |
| 4.21 | 일반 사용자 | URL | 예 | MD5 | x86_64 | 미선택 | true |
| 4.21 | 일반 사용자 | local | 아니오 | SHA-256 | aarch64 | 미선택 | true |
| 4.21 | 일반 사용자 | local | 예 | SHA-256 | x86_64 | DENYOVERRIDE | true |
| 4.23 | 관리자 | URL | 아니오 | SHA-256 | x86_64 | 미선택 | true |
| 4.23 | 관리자 | URL | 예 | MD5 | x86_64 | 미선택 | true |
| 4.23 | 관리자 | local | 아니오 | MD5 | x86_64 | APPEND | true |
| 4.23 | 관리자 | local | 예 | SHA-256 | x86_64 | 미선택 | true |
| 4.23 | 일반 사용자 | URL | 아니오 | SHA-256 | x86_64 | ALLOWOVERRIDE | true |
| 4.23 | 일반 사용자 | URL | 예 | SHA-256 | x86_64 | 미선택 | true |
| 4.23 | 일반 사용자 | local | 아니오 | MD5 | s390x | 미선택 | true |
| 4.23 | 일반 사용자 | local | 예 | SHA-256 | x86_64 | DENYOVERRIDE | true |

aarch64/s390x는 비부팅 데이터 ISO의 메타데이터 저장 검증이다. ARM/IBM 게스트 부팅이나 다중 Zone·비KVM 검증을 주장하지 않는다. 부팅 ISO는 실제 부트 카탈로그를 가진 CorePure64-16.2이며, 여기서 검증한 것은 등록/Ready/부팅 플래그·OS 값이다.

## 실패·복구·표준 UI 회귀

| 항목 | 실제 UI 결과 |
| --- | --- |
| URL/파일/체크섬 필드 오류 | URL 형식·필수 파일·이름·잘못된 체크섬 입력 오류 표시, 유효성 오류 시 개체 생성 없음 |
| MD5/SHA-256 불일치 | 전송 거절 → DOWNLOAD_ERROR/Ready=false → 정상 UI 삭제. 최종 화면에 실제 checksum mismatch 사유 표시 |
| 전송 전 연결 실패 | 해당 업로드 origin만 일시 차단/즉시 복구. 같은 ID·미사용 티켓 재시도로 Ready, 새 할당 0건 |
| 전송 중 중단 | 실제 전송 2%에서 UI 중단 확인, 같은 티켓 재전송 없음, 오류 상태의 정상 UI 삭제 |
| Ready 후 연결 실패 | 선택한 임시 사용자 데이터를 다른 UI에서 삭제한 뒤 제출. Ready는 유지되고 연결만 실패 |
| 같은 ID 연결 재시도 | 제거된 선택 비움/재시도 비활성 확인 후 유효 항목 선택. linkUserDataToTemplate만 재실행, 할당/파일 POST 0건 |
| 이중 클릭 | 관리자 4.23 로컬 업로드의 실제 double-click에서 getUploadParamsForIso 1건 |
| 재방문/새로고침 | 대리 등록 상세 재조회/새로고침에서 등록 쓰기 요청 0건 |
| 전송 전 Esc | 생성되지 않고 닫힘, 초점이 ISO 등록 버튼으로 복귀 |
| 긴 이름 | 한 줄 높이 22px, clientWidth 662/scrollWidth 1092, ellipsis와 전체 title 일치 |
| 소유자 변경 | admin 사용자 데이터 선택 후 QA 계정으로 변경 시 즉시 초기화, QA 소유 항목만 선택 가능. 대리 등록의 실제 소유자·APPEND 저장 확인 |
| 실제 서명 만료 | UI 설정 upload.operation.timeout=60을 변경 없이 확인. 약 61분 유지 뒤 만료 안내, 같은 ID 보존, 파일 POST/새 할당 각 0건 |

만료 티켓은 4.21에서 발급하고 컴포넌트를 유지한 채 4.23 재생성 뒤 만료 시각에 확인했다. 서버 요약은 DOWNLOAD_ERROR였고 정상 삭제했다. 이를 이번에 서버 ABANDONED를 재현한 결과로 표시하지 않는다. 기존 ISO-01의 실제 ABANDONED 근거와 취소/TTL 코드는 유지한다. 전역 timeout·시계·DB 상태를 바꾸지 않았다.

13번 실제 전송은 HTTP다. HTTPS 인증서 신뢰 안내는 origin만 제공하는 기존 경로를 보존하고 단위 회귀로 확인했다. 브라우저 보안 경고를 우회하지 않았다.

- [UI 관찰/요청 대조 기록](evidence/ui-cases.json)
- [최종 소유자 변경 화면](screenshots/final-owner-scope-cleared.jpg)
- [최종 로컬 Ready/APPEND](screenshots/final-local-ready-append.jpg)
- [체크섬 오류 사유와 전송 단계](screenshots/final-checksum-reason-and-stage.jpg)
- [연결 실패 후 제거된 선택 비움](screenshots/final-link-failed-cleared-selection.jpg)
- [실제 만료 차단](screenshots/real-expiry-blocked.jpg)
- [60분 설정 보존](screenshots/upload-timeout-unchanged-60min.jpg)

## 배포와 복구 경계

관리 JAR의 기존 런타임을 기준으로 다음 4개 클래스만 필요한 멤버/메서드를 병합했다. 다른 JAR 엔트리와 메서드는 보존했다.

- `org/apache/cloudstack/api/command/user/iso/GetUploadParamsForIsoCmd`
- `com/cloud/storage/upload/params/UploadParamsBase`
- `com/cloud/storage/upload/params/IsoUploadParams`
- `com/cloud/template/TemplateAdapterBase`

원본 관리 JAR은 `8fe7c6611dd1983084a3de8b5ed70b78f05a4551931022a4f1c0af5bb9f5e2c6`, 배포 JAR은 `97bdbed5f8f6f33edd4576a572269265ebc2c0037f7fa476423e1175c158b224`다. 복구본은 `/var/tmp/iso1667-backend-backup-m6uv_b0z`에 있다. 관리 서비스 재시작은 1회이며 현재 PID 2545994/active다. 비인증 health probe의 정상 401을 실패로 본 배포 도구는 중단 후 실 JAR/PID/UI 로그인으로 상태를 확정했고 추가 restart/rollback은 하지 않았다.

최종 UI는 기존 운영 입력에 이번 파일과 ISO 번역만 반영해 빌드했다. 마지막 정정은 정적 자산 4개만 배포했다. index SHA-256은 `b8535f1a516b4e01cf34aac77be3748d8ed09c475c3a86790dd4612d75de1a4e`, 실행 app은 `app.60966e72.js`다. 마지막 복구본은 `/var/tmp/iso1667-20261115-ui-backup-2vwnp7fu`다.

7036개 원래 자산을 보존했고 기존 경로 덮어쓰기는 index/en/ko뿐이다. 누적 새 hashed 자산 15개와 이전 복구 자산을 보존했다. config.json·WEB-INF/web.xml·color.less·관리 PID 및 무관 자산의 예상 밖 변화는 0개다.

4.21 재생성용 임시 bootstrap ZIP은 3개 호스트 모두 원래 4.23 SHA `fba45526bd0b4b2b0cd691a5accd9adae60f5b1de0a66e4606c0ce653ffa0aca`로 복구했다. 호스트 agent 데몬은 재시작하지 않았다.

- [백엔드 병합 근거](evidence/backend-patch.json)
- [백엔드 배포 확정](evidence/backend-deployment.json)
- [최종 UI 배포](evidence/ui-deployment.json)
- [최종 런타임·보존 해시](evidence/runtime-final.json)

## 필수 검사와 CI 부채 분리

| 검사 | 결과 |
| --- | --- |
| 이번 JS/Vue 5개 경로 ESLint | 통과 |
| UI 회귀 8개 묶음 | 122개 통과, 실제 배포 입력도 동일 |
| 기능 Maven -am 빌드 / 서버 계약 | 통과, 계약 4개. 기존 Checkstyle 게이트는 명시적으로 분리 |
| 실제 패치 관리 런타임 classpath | 같은 계약 4개 통과 |
| 생산 UI 빌드 | 통과, 722.1초 |
| 변경 밖 Checkstyle | API 46/server 218, 변경 파일 지적 0 |
| 전체 License/RAT | 실패 4077개, 기준과 파일 집합 동일, 추가/제거 0 |
| 소스 727bed 전체 Lint | 실패 hook 16개, 실패 진단의 변경 경로 0, 매칭한 기존 11173개 경로는 기준과 동일 |
| 검증 기록 pre-commit / 수동 hook | 두 단계 통과, CI와 같은 Python 3.11 환경 사용 |
| 수신 파일 검증 | 4개 모두 실제 크기·SHA-256 일치 |

전체 pre-commit의 통과한 identity 파일 나열을 진단으로 세지 않았다. 실제 실패 hook 부분만 분리해 변경 경로와 대조했다. 수동 hook 단계는 앞 단계 실패 때문에 건너뛰었으며 전체 CI 성공으로 표시하지 않는다.

기존 Build/License/Lint는 #926, 전체 pre-commit의 기존 링크·권한·문서 오류는 #1044에서 계속 관리한다. 새 기능과 기존 부채를 한 건으로 처리하지 않는다. 이 검증 기록 커밋의 CI는 별도로 다시 실행된다.

- [Lint 로그](evidence/final-lint.log)
- [UI 테스트](evidence/final-ui-tests.log)
- [실제 빌드 입력 테스트](evidence/runtime-input-tests.log)
- [서버 계약 요약](evidence/server-tests.json)
- [Checkstyle 분류](evidence/checkstyle-classification.json)
- [RAT 기준 대조](evidence/rat-comparison.json)
- [전체 pre-commit 분류](evidence/precommit-classification.json)
- [검증 기록 대상 검사](evidence/focused-report-checks.json)

## 수신 파일 검증과 최종 정리

사용자가 Mold UI에서 4개 ISO를 직접 다운로드한 뒤, 실제 수신 파일을 로컬에서 읽어 크기와 SHA-256을 계산했다. 2026-11-15 09:32 KST에 원본 기대값과 4건 모두 정확히 일치함을 확인했다. 추출 job이나 서버 저장 checksum으로 실수신 검증을 대신하지 않았다.

| 등록/입력 checksum | 수신 ISO 파일 | 실제 크기 | 실제 SHA-256 | 기대값 대조 |
| --- | --- | --- | --- | --- |
| 4.21 / MD5 | `qa-iso1667-url421-md5.iso` | 1,525,760 bytes | `171cc1569c3078e9b4b9e0d88338ba8ac990fb0843a431193c63d60669662ca4` | 일치 |
| 4.21 / SHA-256 | `qa-iso1667-owner421-sha256.iso` | 24,434,688 bytes | `c954b2900fbbd38c2da156525819de8c80c4cc7a7ffde61a89b10f4a99985ebc` | 일치 |
| 4.23 / MD5 | `qa-iso1667-admin-local423-md5.iso` | 1,525,760 bytes | `171cc1569c3078e9b4b9e0d88338ba8ac990fb0843a431193c63d60669662ca4` | 일치 |
| 4.23 / SHA-256 | `qa-iso1667-owner-local423-sha256.iso` | 24,434,688 bytes | `c954b2900fbbd38c2da156525819de8c80c4cc7a7ffde61a89b10f4a99985ebc` | 일치 |

4.21 등록 개체도 현재 4.23 SSVM에서 수신했다. 이 파일 확인을 4.21 agent가 직접 다운로드를 제공한 결과로 소급하지 않는다. 4.21 업로드 런타임 검증과 수신 파일 검증의 시점을 구분했다.

파일 일치 확인 후 남은 ISO 4개 → 사용자 데이터 2개 → 시험 계정 1개 순서로 실제 UI에서 정리했다. 사용자 데이터의 VM/템플릿/ISO 참조가 모두 0인 것을 확인한 뒤 삭제했다. 시험 계정은 인스턴스/볼륨/IP 0을 확인하고 제품 절차대로 비활성화한 후 이름을 입력해 삭제했다.

- 시험 ISO 25개 전부 정상 UI 삭제, 남은 시험 ISO 0개
- 시험 사용자 데이터 4개 전부 삭제(앞 단계 임시 항목 2개 포함), 잔여 0개
- 시험 계정 1개 삭제, 잔여 0개
- 원래 ISO 8개 ID 집합 일치, 계정 3개·역할 9개·사용자 데이터 0개 확인
- 현재 s-255-VM/4.23 및 원래 console v-245-VM 모두 실행 중/Agent Up 보존

운영 SYSTEM 이미지는 4.23 현재 factory `1cce97d2-a4b6-49c7-871a-3f52d70ce858`와 보호된 4.21 호환 복구 이미지 `460c3e5f-a873-4ca1-8242-a96d92eae233` 두 개를 유지한다. 두 이미지가 Ready인 것을 최종 UI로 확인했다. QA 자원과 구분하며 SYSTEM 삭제 권한을 우회하지 않았다.

임시 ISO HTTP 파일 2개와 4.21 재생성용 HTTP 이미지 1개는 해시 확인 후 제거했고 각각 404를 확인했다. 기존 4.23 원본 파일과 복구본은 보존했다. 이번 마감 단계에서는 제품 코드 변경이나 추가 배포가 없다.

검증 기록 커밋 `3db8e028ee0`의 실제 CI도 확인했다. License run43646306006은 기준과 동일한 4077개 집합이며 추가/제거 0개다. 전체 Lint run43646306057은 기존 실패 hook 16개, 변경 경로 진단 0개다. #926·#1044는 해결/종료로 표시하지 않고 별도 관리한다.

- [실제 수신 파일 크기·SHA-256](evidence/download-receipts.json)
- [마감 변경의 pre-commit·수동 검사](evidence/final-cleanup-checks.json)
- [최종 정리 및 원래 ISO ID 대조](evidence/final-cleanup.json)
- [자원별 삭제 기록](evidence/resource-ledger.json)
- [전체 UI 관찰 기록](evidence/ui-cases.json)
- [최종 ISO 8개 목록](screenshots/final-cleanup-catalog.jpg)
- [계정 3개 보존](screenshots/final-cleanup-accounts.jpg)
- [사용자 데이터 0개](screenshots/final-cleanup-userdata.jpg)
- [직전 보고서 커밋의 Lint 대조](evidence/report-head-precommit-classification.json)
- [직전 보고서 커밋의 License 대조](evidence/report-head-ci.json)
- [HTTP 파일 정리](evidence/http-fixtures-cleanup.json)
- [근거 안전 검사](evidence/artifact-safety.json)

이슈 #1667의 기능 검증과 시험 자원 정리 종료 조건을 모두 충족했다. 최종 결과는 Epic #1664와 PR #1682에 갱신하며, Epic 전체 종료와 PR 병합은 이번 단계의 작업이 아니다.
