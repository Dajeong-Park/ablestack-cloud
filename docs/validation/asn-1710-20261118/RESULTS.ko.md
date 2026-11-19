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

# ASN-02 실행 결과

2026-11-18 KST. 31 GFS2/32 RBD의 실제 API와 Chrome UI를 사용했다. 아래 45개 항목은 각 클러스터에서 독립 실행했고, 이후 UI 대조 및 시험 범위 정리를 수행했다.

| 순서 | API 항목 | 31 | 32 |
|---:|---|---|---|
| 1 | `asnumber-long-metadata` | PASS | PASS |
| 2 | `small-fixture-64512` | PASS | PASS |
| 3 | `exact-keyword-id-64512` | PASS | PASS |
| 4 | `exact-keyword-id-64513` | PASS | PASS |
| 5 | `exact-keyword-id-64514` | PASS | PASS |
| 6 | `small-fixture-4200000000` | PASS | PASS |
| 7 | `exact-keyword-id-4200000000` | PASS | PASS |
| 8 | `exact-keyword-id-4200000001` | PASS | PASS |
| 9 | `exact-keyword-id-4200000002` | PASS | PASS |
| 10 | `valid-empty-0` | PASS | PASS |
| 11 | `valid-empty-23456` | PASS | PASS |
| 12 | `valid-empty-65535` | PASS | PASS |
| 13 | `valid-empty-2147483647` | PASS | PASS |
| 14 | `valid-empty-2147483648` | PASS | PASS |
| 15 | `valid-empty-4294967294` | PASS | PASS |
| 16 | `valid-empty-4294967295` | PASS | PASS |
| 17 | `valid-empty-4200000010` | PASS | PASS |
| 18 | `invalid-''` | PASS | PASS |
| 19 | `invalid-' '` | PASS | PASS |
| 20 | `invalid-'-1'` | PASS | PASS |
| 21 | `invalid-'-0'` | PASS | PASS |
| 22 | `invalid-'+1'` | PASS | PASS |
| 23 | `invalid-'1.5'` | PASS | PASS |
| 24 | `invalid-'1e3'` | PASS | PASS |
| 25 | `invalid-'1.10'` | PASS | PASS |
| 26 | `invalid-'1,000'` | PASS | PASS |
| 27 | `invalid-'abc'` | PASS | PASS |
| 28 | `invalid-'１２'` | PASS | PASS |
| 29 | `invalid-'4294967296'` | PASS | PASS |
| 30 | `invalid-'9223372036854775808'` | PASS | PASS |
| 31 | `invalid-' 4200000000 '` | PASS | PASS |
| 32 | `invalid-'1\n'` | PASS | PASS |
| 33 | `exact-and-range` | PASS | PASS |
| 34 | `wrong-range` | PASS | PASS |
| 35 | `free` | PASS | PASS |
| 36 | `allocated` | PASS | PASS |
| 37 | `keyword-and-match` | PASS | PASS |
| 38 | `keyword-and-mismatch` | PASS | PASS |
| 39 | `network-and` | PASS | PASS |
| 40 | `vpc-and` | PASS | PASS |
| 41 | `owner-and` | PASS | PASS |
| 42 | `leading-zero-decimal` | PASS | PASS |
| 43 | `exact-page-total` | PASS | PASS |
| 44 | `list-page-total` | PASS | PASS |
| 45 | `invalid-does-not-change-fixture` | PASS | PASS |

## UI와 정확 API 대조

| 클러스터 | UI keyword | 전체 10진 표시 | UI/API UUID | 총건수 |
|---|---|---|---|---:|
| 31 | 4200000000 | PASS | `b55dc17b-51fe-4383-af3c-a9169551c4dd` 동일 | 1 |
| 31 | 64512 | PASS | `fd04700b-ef71-4cfb-a7ea-3f4623a1930e` 동일 | 1 |
| 32 | 4200000000 | PASS | `e54d658d-ee48-4786-a0ca-49e6bebe00ad` 동일 | 1 |
| 32 | 64512 | PASS | `44061bca-5cb5-4d56-8154-546aa71b5cf2` 동일 | 1 |

UI 결과는 실제 필터 조작 뒤 listASNumbers 응답과 보이는 셀/페이지 문구를 함께 확인했다. CDP response body에서 인증값을 저장하지 않고 번호/UUID만 추출했으며 요청 cursor의 truncated/hasMore=false를 확인했다. 32의 첫 API 로그인 시도는 관리 서비스 재시작 완료 전이라 연결이 거부됐고 객체 생성은 없었다. 배포 건강성 HTTP 200 이후 동일 전체 45항목을 정상 실행했다.

## 정리와 자원 보존

| 항목 | 31 전/후 | 32 전/후 |
|---|---:|---:|
| Zone | 1/1 | 1/1 |
| 네트워크 | 31/31 | 17/17 |
| VPC | 2/2 | 1/1 |
| 네트워크 오퍼링 | 33/33 | 24/24 |
| VPC 오퍼링 | 7/7 | 7/7 |
| BGP 피어 | 0/0 | 0/0 |
| 스토리지 | 1/1 | 1/1 |
| 시험 후 ASN 범위/번호 | 0/0 | 0/0 |

기존 UUID 및 선택 주요 필드 14개 비교가 동일하며 의미상 순서가 없는 service/provider/capability/tags 배열은 정규화했다. 생성 시 반환된 두 범위 ID만 클러스터별로 삭제했고, 두 API의 범위/번호 전체 0건과 UI 업데이트 뒤 데이터 없음·전체 0건을 확인했다. 이 비교는 전체 DB 이력 또는 물리 파일 감사가 아니다.

실할당/다른 소유자·교차 Zone 및 예약 번호 레코드 일치, legacy 42000000000의 keyword 검색/정확 조회 거부는 제어된 DAO fixture 결과다. 실환경에서 기존 망·오퍼링·피어를 바꾸거나 ISP/BGP 통신을 실행하지 않았다.
