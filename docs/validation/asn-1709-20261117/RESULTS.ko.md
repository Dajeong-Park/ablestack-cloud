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

# ASN-01 실행 결과 (2026-11-17 KST)

## API 실환경 결과

각 54개 검사항목에는 정리 확인도 포함한다. small fixture만 사용했다. 전체 API 응답과 인증값은 게시하지 않는다.

| 순서 | 확인 항목 | 31 GFS2 | 32 RBD |
|---:|---|---|---|
| 1 | `invalid:/` | PASS (431) | PASS (431) |
| 2 | `invalid: / ` | PASS (431) | PASS (431) |
| 3 | `invalid:-1/-1` | PASS (431) | PASS (431) |
| 4 | `invalid:+1/+1` | PASS (431) | PASS (431) |
| 5 | `invalid:1.5/1.5` | PASS (431) | PASS (431) |
| 6 | `invalid:1e3/1e3` | PASS (431) | PASS (431) |
| 7 | `invalid:1.10/1.10` | PASS (431) | PASS (431) |
| 8 | `invalid:1,000/1,000` | PASS (431) | PASS (431) |
| 9 | `invalid:12x/12x` | PASS (431) | PASS (431) |
| 10 | `invalid:１２/１２` | PASS (431) | PASS (431) |
| 11 | `invalid:0/0` | PASS (431) | PASS (431) |
| 12 | `invalid:4294967295/4294967295` | PASS (431) | PASS (431) |
| 13 | `invalid:4294967296/4294967296` | PASS (431) | PASS (431) |
| 14 | `invalid:9223372036854775808/9223372036854775808` | PASS (431) | PASS (431) |
| 15 | `invalid:20/10` | PASS (431) | PASS (431) |
| 16 | `invalid:23456/23456` | PASS (431) | PASS (431) |
| 17 | `invalid:23455/23457` | PASS (431) | PASS (431) |
| 18 | `invalid:65535/65535` | PASS (431) | PASS (431) |
| 19 | `invalid:65534/65536` | PASS (431) | PASS (431) |
| 20 | `invalid:4200010000/4200011000` | PASS (431) | PASS (431) |
| 21 | `api-string-contract` | PASS | PASS |
| 22 | `valid:1/1` | PASS | PASS |
| 23 | `members-exact` | PASS | PASS |
| 24 | `overlap-rejected` | PASS (431) | PASS (431) |
| 25 | `overlap-rejected` | PASS (431) | PASS (431) |
| 26 | `생성한 범위 ID로 정리` | PASS | PASS |
| 27 | `valid:64512/64535` | PASS | PASS |
| 28 | `members-exact` | PASS | PASS |
| 29 | `overlap-rejected` | PASS (431) | PASS (431) |
| 30 | `overlap-rejected` | PASS (431) | PASS (431) |
| 31 | `생성한 범위 ID로 정리` | PASS | PASS |
| 32 | `valid:2147483648/2147483648` | PASS | PASS |
| 33 | `members-exact` | PASS | PASS |
| 34 | `overlap-rejected` | PASS (431) | PASS (431) |
| 35 | `overlap-rejected` | PASS (431) | PASS (431) |
| 36 | `생성한 범위 ID로 정리` | PASS | PASS |
| 37 | `valid:4200000000/4200000002` | PASS | PASS |
| 38 | `members-exact` | PASS | PASS |
| 39 | `overlap-rejected` | PASS (431) | PASS (431) |
| 40 | `overlap-rejected` | PASS (431) | PASS (431) |
| 41 | `생성한 범위 ID로 정리` | PASS | PASS |
| 42 | `valid:4294967294/4294967294` | PASS | PASS |
| 43 | `members-exact` | PASS | PASS |
| 44 | `overlap-rejected` | PASS (431) | PASS (431) |
| 45 | `overlap-rejected` | PASS (431) | PASS (431) |
| 46 | `생성한 범위 ID로 정리` | PASS | PASS |
| 47 | `valid: 4200000010 / 4200000010 ` | PASS | PASS |
| 48 | `members-exact` | PASS | PASS |
| 49 | `overlap-rejected` | PASS (431) | PASS (431) |
| 50 | `overlap-rejected` | PASS (431) | PASS (431) |
| 51 | `생성한 범위 ID로 정리` | PASS | PASS |
| 52 | `mysql-concurrent-overlap` | PASS | PASS |
| 53 | `생성한 범위 ID로 정리` | PASS | PASS |
| 54 | `empty-restored` | PASS | PASS |

유효 입력: 1, 64512~64535, 2147483648, 4200000000~4200000002, 4294967294 및 양 끝 공백. 유효 범위마다 번호 전체를 조회해 값/개수/범위 ID를 대조한 후 정리했다. 동일 Zone의 2개 동시 MySQL 요청은 성공 1건·431 1건, 범위 1건·번호 3건이었다.

## 실제 UI 결과

Chrome에서 UI 조작과 CDP 요청 관찰로 확인했다. 각 클러스터 15개 잘못된 입력은 생성 요청 0건이며 첫 오류 필드에 포커스가 이동했다.

| 입력 시작/종료 | 31 | 32 |
|---|---|---|
| `(빈 값)` / `(빈 값)` | PASS | PASS |
| `-1` / `-1` | PASS | PASS |
| `+1` / `+1` | PASS | PASS |
| `1.5` / `1.5` | PASS | PASS |
| `1e3` / `1e3` | PASS | PASS |
| `1.10` / `1.10` | PASS | PASS |
| `abc` / `abc` | PASS | PASS |
| `0` / `0` | PASS | PASS |
| `4294967295` / `4294967295` | PASS | PASS |
| `4294967296` / `4294967296` | PASS | PASS |
| `9223372036854775808` / `9223372036854775808` | PASS | PASS |
| `23455` / `23457` | PASS | PASS |
| `65534` / `65536` | PASS | PASS |
| `20` / `10` | PASS | PASS |
| `4200010000` / `4200011000` | PASS | PASS |

- 31: 버튼으로 4200000300~4200000302 등록 → listASNRanges → listASNumbers 전체 확인 → 성공/목록. 같은 범위 재등록 시 431, 입력 유지. UI 삭제로 정리.
- 32: 시작 입력 양 끝 공백, Ctrl+Enter 등록 → 정규화한 POST 1건 → 범위·번호 조회 후 성공/목록. 같은 범위 재등록 시 431, 입력 유지. UI 삭제로 정리.
- timeout/조회 실패·동일 in-flight 클릭/키보드·권한/로그인/Zone 전환은 제어된 UI 단위 테스트로 검증했다. 실환경 장애 주입 또는 권한 계정 생성은 하지 않았다.
- 실환경 첫 확인에서 오류 포커스 누락을 발견해 finishFailed/직접 검증 실패 양쪽을 보완했고, 최종 번들에서 위 30개 입력을 재확인했다.

## 반응형 결과

| 클러스터 | 테마 | CSS 폭×높이 | 모달 폭 | 수평 넘침 | footer 화면 내 |
|---|---|---|---:|---|---|
| 31 | light | 1280×900 | 720 | 없음 | 예 |
| 31 | light | 768×900 | 720 | 없음 | 예 |
| 31 | light | 390×900 | 366 | 없음 | 예 |
| 31 | dark | 1280×900 | 720 | 없음 | 예 |
| 31 | dark | 768×900 | 720 | 없음 | 예 |
| 31 | dark | 390×900 | 366 | 없음 | 예 |
| 32 | light | 1280×900 | 720 | 없음 | 예 |
| 32 | light | 768×900 | 720 | 없음 | 예 |
| 32 | light | 390×900 | 366 | 없음 | 예 |
| 32 | dark | 1280×900 | 720 | 없음 | 예 |
| 32 | dark | 768×900 | 720 | 없음 | 예 |
| 32 | dark | 390×900 | 366 | 없음 | 예 |

12개 조합의 DOM 경계와 라이트/다크 실제 렌더링을 확인했다. 브라우저 viewport 변경 직후 첫 캡처에는 이전 레이아웃 paint가 남을 수 있어 32 대표 이미지는 렌더링 완료 후 다시 캡처했다. 원래 라이트 테마와 viewport를 복원했다.

## 기존 자원 보존

Zone·네트워크·VPC·네트워크 오퍼링·VPC 오퍼링·BGP 피어·스토리지의 주요 설정 14개 비교가 동일하다. 32의 두 네트워크 오퍼링은 service 배열의 순서만 바뀌어 원시 배열 비교는 달랐으며, provider/capability를 포함한 내용은 동일하다. 의미상 순서가 없는 목록을 정규화해 비교했다. 양쪽 범위·번호 0건 복구 4개 확인도 PASS다.

| 항목 | 31 전/후 | 32 전/후 |
|---|---:|---:|---|
| 네트워크 | 31/31 | 17/17 |
| VPC | 2/2 | 1/1 |
| 네트워크 오퍼링 | 33/33 | 24/24 |
| VPC 오퍼링 | 7/7 | 7/7 |
| BGP 피어 | 0/0 | 0/0 |
| ASN 범위/번호 | 0/0 | 0/0 |

이 결과는 선택 API 필드 비교이며 DB 이력·물리 파일 전체 감사 또는 기존 네트워크/VPC/VNF/Public IP 기능의 재시험 결과가 아니다.
