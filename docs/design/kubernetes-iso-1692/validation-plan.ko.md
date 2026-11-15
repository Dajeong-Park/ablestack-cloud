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

# UI 중심 검증 계획

## 공통 원칙

실제 업무 조작은 UI를 기준으로 수행합니다. 소스/테스트/SSH는 계약 분석·의미 있는 자동 검사·배포/파일 증거·잔여 확인을 보완합니다. 직접 API/DB로 UI 실패를 우회하거나 화면을 검증했다고 표시하지 않습니다. 시험 prefix/ID·요청 단계·최종 값·정리 기록을 이슈별 ledger에 남깁니다.

| 구분 | 필수 사례 | 확인 결과 |
| --- | --- | --- |
| URL | 정상 체크섬/기본 MD5/다른 지원 알고리즘, 오형식/길이, URL 오류·버전/CPU/RAM 경계 | 필드 오류·서버 계약·등록 접수/Ready 분리 |
| 로컬 | 파일 없음/교체/제거/중복, 티켓 실패/만료, XHR 중단/재시도/계정 전환 | 로딩 복구·중복0·부분 자원 정리·서명 비노출 |
| arch | x86_64/aarch64 및 지원된 선택, 부정 값 | parent/ISO 저장값 일치. 실제 ARM 부팅과 구분 |
| 업로더 | 실제4.21 후4.23 SystemVM 계열 확인 | 각 계열 UI 전송·Ready·파일/체크섬·정리 |
| 검색 | keyword/Zone/arch/최소 semantic/id·동시 최소 조건 거절 | count/page·페이지 경계·정렬·복귀 |
| 가용성 | Ready/진행/실패/일부/조회 실패/권한 없음/인증 만료 | 실패≠없음, 상태와 허용 작업 구분 |
| 변경 | Enabled/Disabled·동시 변경·권한 회수·결과 불명 | 정확한 대상/현재값/재조회·과잉 재시도 방지 |
| 삭제 | 비참조·활성 클러스터·미완료 업그레이드 pin·ISO 실패 | 서버 보호·버전 보존·부분 정리·잔여0 |
| 스타일 | VM 표준 목록/breadcrumb/상세/Zone/이벤트/모달 | 양 테마·여러 폭·키보드·초점 |
| 이름 | Ubuntu 등 OS/사용자 아이콘/코멘트·긴 이름/UUID | 실제 가시 폭·링크·툴팁·한 줄 |
| 소비 | 허용된 연결 ISO·CKS 참조/소비 | 권한 유지·진짜 바이너리 사용. transport fixture로 CKS 성공 주장 금지 |

## 실계정 ACL 행렬

UI/API capability가 실제 저장 역할과 일치하는 계정으로 수행합니다. 초기 분석의 Root 세션을 다른 역할의 통과 증거로 대신하지 않습니다.

| 계정/역할 | 목록/직접 상세 | child ISO/URL | 등록/상태/삭제 |
| --- | --- | --- | --- |
| Root Admin | 허용 | 허용된 ISO/Root URL | 독립 API capability에 따라 허용 |
| Root Read-Only Admin | 허용된 읽기 | Root URL 정책과 child 읽기 | 모두 차단, 쓰기 요청0 |
| Domain Admin | 허용된 카탈로그 읽기 | Root URL 비노출, child 권한 유지 | 카탈로그 Admin 쓰기 확대 금지 |
| Resource Admin | 허용된 읽기 | 권한 없는 child는 제한 상태 | 역할의 미허용 쓰기 차단 |
| User | 허용된 읽기 | Root URL 비노출 | 미허용 쓰기 차단 |
| Read-Only User | 허용된 읽기 | 제한 범위 보존 | 쓰기0, VM Metrics를 읽기 선행으로 요구하지 않음 |
| local API만 있는 제한 역할 | 허용된 읽기 | URL API 설명 없이 local 폼 | local 허용·URL/state/delete 미허용 구분 |
| URL API만 있는 제한 역할 | 허용된 읽기 | URL 폼만 | local 티켓 요청0 |
| list만 있는 제한 역할 | 목록/직접 상세 | child 실패≠없음 | 작업/대화상자 우회 금지 |
| 권한 회수/계정 전환 | 오래된 요청 폐기 | 이전 소유 범위/URL 캐시 폐기 | 진행 작업 결과 불명은 재조회 |

동일 역할이라도 계정·도메인·프로젝트 전환이 있는 경우 범위를 교차합니다. 일반 ISO의 소유/공유 정책은 KISO 글로벌 카탈로그와 분리해 연결 경로에서만 검증합니다.

## 집중 검사 후보

제품 구현 시 실제 변경에 맞춰 선택하며 이번 준비 단계에서 실행 완료로 주장하지 않습니다.

```bash
cd /root/work/ablestack-cloud/ui
npm run test:unit -- --runInBand --runTestsByPath tests/unit/components/view/ListViewTemplateType.spec.js tests/unit/components/view/TemplateSearchForm.spec.js tests/unit/utils/templateSearch.spec.js
# 새 KISO model/search/upload 테스트는 해당 구현에서 추가 후 경로를 확정한다.
npm run lint -- --no-fix <실제-변경-Vue/JS-파일>
# UI 변경이 있을 때만 npm run build
```

Backend 후보는 `KubernetesVersionManagerImplTest`, `KubernetesVersionServiceTest`, `KubernetesVersionDeletionReferenceTest`, `KubernetesVersionReferencesTest`입니다. manager 필터/count·arch 전달·참조 보존 경계를 검사하고 구현을 그대로 복사한 테스트를 만들지 않습니다. 모듈 빌드 의존이 부족하면 원인을 분리하고 전체 빌드를 무조건 반복하지 않습니다.

## 배포·원복·정리

- 배포 전후 index/변경 정적 파일 hash, Backend jar/설정/PID, 원래 KISO/ISO/템플릿·VM·SystemVM ID를 기록합니다.
- UI만 바뀌면 Backend/Agent 재시작·SystemVM 교체를 하지 않습니다. 양 계열 업로드 단계에서만 명시한 계획에 따라 전용 환경 전환을 수행합니다.
- 참조 중 실제 운영 바이너리/클러스터는 삭제 시험 대상으로 사용하지 않습니다. 시험 버전·ISO·계정·역할·전용 클러스터/VM·HTTP 파일의 정확한 ID를 정리합니다.
- 삭제 실패/결과 불명 자원을 완료로 합산하지 않습니다. 원래 템플릿48·KISO2·ISO8 같은 수량은 구현 시작 시 다시 확인하고 당시 ID 목록으로 보존합니다.
- 다중 Zone/Edge/비KVM/ARM·s390x 부팅 환경이 없으면 NOT_RUN으로 유지합니다. 기능을 삭제해 완료 범위를 줄이지 않습니다.
- 변경 범위 검사/기능 실패와 기존 CI 부채 #926·#1044를 분리해 원인·추가 진단 여부를 보고합니다.

## 목업 검토 기록

브라우저 시각/상호작용 검토는 `mockup-qa.ko.md`에 별도 기록합니다. 목업 PASS는 실제 제품/실계정/양 업로더의 기능 검증 PASS가 아닙니다.
