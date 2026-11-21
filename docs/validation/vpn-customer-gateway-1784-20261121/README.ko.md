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

# Epic #1784 VPN 고객 게이트웨이 31·32 구현 검증

2026-11-21 KST에 Mold **네트워크 → VPN 고객 게이트웨이**를 31번(GFS2)과 32번(RBD) 관리 UI에서 검증했다. 제품 소스는 `2f00bdadf30e720b675bcc4040ecd0bf2a825a3d`이고 서버 검색 변경은 `89c14d9de9f`에 포함된다. [Epic #1784](https://github.com/ablecloud-team/ablestack-cloud/issues/1784) · [PR #1791](https://github.com/ablecloud-team/ablestack-cloud/pull/1791)

## 이슈별 결과

| 이슈 | 31 GFS2 | 32 RBD | 브라우저와 서버에서 확인한 결과 |
| --- | --- | --- | --- |
| [#1785](https://github.com/ablecloud-team/ablestack-cloud/issues/1785) | 통과 | 통과 | 각 클러스터 390·1280px 라이트·다크 4조합에서 일괄 확인창 화면·DOM·툴팁·접근성 속성에 두 시험 키가 없었다. 취소 POST 0건, 확인 POST 2건은 선택한 UUID만 전송했으며 두 작업이 모두 성공했다. |
| [#1786](https://github.com/ablecloud-team/ablestack-cloud/issues/1786) | 통과 | 통과 | 이름 전체·접두어·UUID 키워드·미일치·정확 UUID를 확인했다. 삭제한 행은 이름·UUID 조회에서 0건이다. 페이지 크기 1에서 총 2건과 서로 다른 행을 받았다. 같은 이름을 계정과 프로젝트에 만들고 소유 범위별 결과를 확인했다. 필터 선택지 로딩 중 입력한 UUID가 유지됐고 상세에서 목록으로 돌아와도 정확 ID 필터가 남았다. |
| [#1787](https://github.com/ablecloud-team/ablestack-cloud/issues/1787) | 통과 | 통과 | 실제 중복 이름 편집은 접수 후 job 2 / 431이었고 창과 입력이 유지됐다. 이름을 고쳐 재제출하자 job 1, 목록/상세 재조회가 성공했다. 통제 503에서 암호 정책 재시도로 복구했다. 통제 job 조회 503 네 번 뒤 같은 job을 한 번 더 재조회했다. 최초 POST 1건, 조회 5건이며 실패 메시지에 주입한 시험 키는 마스킹됐다. 일괄 작업은 실제 성공 한 건과 통제 실패 한 건의 결과·대상 보존을 확인했다. |
| [#1788](https://github.com/ablecloud-team/ablestack-cloud/issues/1788) | 통과 | 통과 | 기본 보기, 전체 프로젝트에서 명시적으로 선택한 프로젝트, 헤더에서 선택한 프로젝트, 관리자의 계정·도메인 지정이 실제 소유자와 일치했다. 제한 역할은 계정 지정이 노출되지 않았다. 이전 소유자의 통제 지연 응답이 새 폼을 덮어쓰지 않았다. |
| [#1789](https://github.com/ablecloud-team/ablestack-cloud/issues/1789) | 통과 | 통과 | 잘못된 피어·CIDR·86401초는 필드 오류와 POST 0건을 확인했다. 이름을 생략한 DNS 피어는 자동 이름, 쉼표로 정규화된 CIDR, IKE 86400초·ESP 기본 3600초로 저장됐다. IKEv1 선택 시 분할 옵션이 숨겨졌고 IKEv2·ESP PFS를 설정한 후 편집 초기값이 유지됐다. |
| [#1790](https://github.com/ablecloud-team/ablestack-cloud/issues/1790) | 통과 | 통과 | 390·768·1280px 라이트·다크에서 각 6조합을 VM 목록·상세·NIC·편집창과 비교했다. 목록의 이름·원격 피어 열, 상세·이벤트·코멘트, IKE/ESP 구획, 고정 푸터, 개별 삭제 대상·영향 안내를 확인했다. 키보드로 생성/삭제 창을 열고 취소한 뒤 해당 버튼으로 포커스가 돌아왔다. 상세 본문 일반 텍스트 대비 표본의 최솟값은 양쪽 7.56:1이었다. |

## 빌드와 검증 범위

- WSL ext4에서 최신 `api` 의존 모듈을 갱신하고 변경한 `server` Maven 모듈을 빌드했다. `Site2SiteVpnConnectionSearchTest`와 `Site2SiteVpnManagerImplTest` 총 50개가 통과했다. 변경 UI 파일 ESLint와 `VpnCustomerGateway`, `MoldDialog`, `jobTracker` 단위 테스트 3개 스위트가 통과했다. `AutogenActionFocus`의 세 실패는 시작 커밋에서도 같은 `$route.meta` 예외로 재현됐다.
- 표준 UI 빌드의 Webpack 소스맵 후처리가 지연돼 31·32에는 동일 소스에서 소스맵·JS 압축·모듈 결합을 끈 검증용 정적 번들을 적용했다. 이 설정은 제품 저장소에 커밋하지 않았다. 활성 `index.html` SHA-256은 양쪽 모두 `da7ce5286fb2d50b359b6b38d629e4f937689baca55504ec1dc185572a43a1e4`다.
- 서버 모듈에서 빌드한 `Site2SiteVpnManagerImpl.class`를 시험 관리 JAR에 적용했다. 클래스 SHA-256은 `9b9cb74fa8921674698ac67d2fd554a12e20c224867025e397e8e97e59eeccca`다. 관리 서비스 재기동 후 검색을 실제 UI/API로 확인했다.
- UI 배포는 클러스터당 정적 파일 731개를 확인했다. `WEB-INF`와 런타임 설정의 해시가 보존됐고 양쪽 `/client/`는 HTTP 200이었다. FTCTL 공통 번들 마커도 확인했다.
- 시험 게이트웨이·프로젝트·계정을 정리했다. 시험 전후 기본/전체 프로젝트 조회의 기존 게이트웨이 식별자가 각각 일치했고 활성 시험 항목은 0건이었다. 실제 터널과 VPC VPN은 선행 검증 범위를 사용했다. [#1569](https://github.com/ablecloud-team/ablestack-cloud/issues/1569) · [#1610](https://github.com/ablecloud-team/ablestack-cloud/issues/1610)
- GitHub License Check는 작업 시작 커밋과 제품 커밋 모두 미승인 4,077개였다. [시작 커밋 License Check](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44908070297) · [제품 커밋 License Check](https://github.com/ablecloud-team/ablestack-cloud/actions/runs/44912919258)
