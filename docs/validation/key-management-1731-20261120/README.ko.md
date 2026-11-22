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

# KM-04 키관리 검색과 메타데이터 검증

로컬 베이스와 origin/upstream의 ablestack-europa는 ebce1bfb72a22e2f0d6a21e6b553b152240f07a1에서 일치한다. 구현 커밋은 fb9f33fbb2c0e0b73bc4092df9d9cd30a146af37다.

KMS 활성 필터와 HSM 활성·공개·프로토콜 필터를 연결했다. 전체는 해당 API 인자를 생략하고 예와 아니오는 각각 true와 false를 보낸다. 키워드, 존, HSM 프로파일, 도메인, 계정과 프로젝트의 적용값은 URL과 같은 정규화 함수를 사용한다. 조건 변경과 칩 제거는 첫 페이지로 이동한다. 프로젝트 문맥은 계정·도메인 조건과 함께 전송하지 않는다. 삭제된 HSM을 선택한 검색은 전체 키 조회로 바꾸지 않고 필터 해제 안내를 표시한다.

고급 검색은 기존 VM 목록의 팝오버·필터 칩을 사용한다. KMS/HSM의 서버 count와 page를 그대로 표시하며 목록에서 전역 정렬 UI를 제공하지 않는다. 조회 실패·권한 오류·정상 0건은 각각 표시한다. 설치 provider를 프로토콜 후보의 우선에 두고 기존 문자열도 검색할 수 있다.

KMS 상세에는 알고리즘·현재 길이·버전을 표시한다. HSM은 벤더·프로토콜·소유/존 범위·활성 설정·연결 상태를 구분한다. 서버가 state를 제공하지 않으면 연결 상태 미제공으로 표시한다. ID 복사와 소유자/존 링크는 공통 상세 헤더를 사용한다. KEK 라벨의 역할 조건과 서버의 제한 응답 및 마스킹을 유지했다. 서버와 DB 스키마 변경은 없다.

## 검증

| 시나리오 | 13번 관측 |
| --- | --- |
| HSM 필터 | enabled=false, ispublic=true, protocol=database 조합 1건. ispublic=false와 ROOT/admin 조합 1건 |
| 키워드·상태 동기화 | 위 조건에 키워드 추가 0건. 새로고침 후 입력·칩 복원. 초기화로 전체 조회 |
| KMS 필터 | 비활성 0건. 활성·시험 HSM·13-Zone 조합 1건. 활성 칩 제거 후 HSM 및 존 유지, page=1 |
| 프로젝트 | 명시적 프로젝트 필터 1건. 상단 프로젝트 전환 후 기존 키워드 초기화, 해당 프로젝트 프로파일만 표시 |
| 일반 User | 타 계정 키·비공개 HSM·관리자 생성 동작 미표시. 공개 HSM의 제한된 상세 조회 |
| KMS 상세 | 시험 길이 192, AES/GCM/NoPadding, 버전 1, UUID와 존 표시 |
| HSM 상세 | 긴 벤더 및 이름, 모든 존/특정 존, 계정/프로젝트/공개 범위, 누락 벤더, 연결 상태 미제공 |
| HSM 삭제 후 재조회 | 기존 필터를 재방문해 후보 조회 0건과 오류 안내 확인. 전체 키 목록으로 확대하지 않음 |
| 최종 정리 | 시험 키 1개·HSM 3개·프로젝트 1개·User 계정 1개 제거. 기본 Database HSM Disabled 확인 |

[부분 API 관측](ui-api.json) · [비활성·공개·프로토콜 조합](04-hsm-false-public-protocol.jpg) · [HSM 상세](05-hsm-vendor-metadata.jpg) · [프로젝트 범위](08-active-project-scope.jpg) · [일반 User 상세](02-user-public-profile.jpg) · [삭제된 HSM 안내](10-deleted-profile-filter.jpg)

WSL 단위 테스트 87건/5개 묶음 통과. 수정 UI ESLint 오류 0. upstream의 VPN 공통 컴포넌트 변경과 병합한 뒤 KMS 및 VPN 집중 회귀를 재실행했다. 전체 시나리오는 재기준화 전 검증 번들로 수행하고, 재기준화 후 번들에서 HSM 필터·메타데이터·KMS 정상 0건을 다시 확인했다. 비릴리즈용 production 모드 번들을 적용했으며 출시 빌드는 GitHub Actions 정책을 따른다. [실행·배포·정리 대조](verification.json)

일반 User로 실제 UI를 확인했다. DomainAdmin의 선택 범위는 집중 테스트로 확인했으며 별도 DomainAdmin 세션은 미실행이다. 실제 HSM 연결과 암호화 볼륨 작업은 기존 #1025 범위다. 가상머신 표준의 breadcrumb·목록·상세·탭·탭 콘텐츠·대화상자 전체 통일은 #1737에서 검증한다.
