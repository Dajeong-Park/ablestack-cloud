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

# ASN-04에 전달하는 정확 번호 조회 계약

이 문서는 #1710에서 구현한 서버 계약을 #1712의 검색 UI에 전달한다. 새 UI 구현은 포함하지 않는다.

| 항목 | 계약 |
|---|---|
| 명령/타입 | listASNumbers / asnumber metadata **long**, Java Long, 응답 long/Long 유지 |
| 값 | 0~4294967295의 ASCII 10진 정수. 0·23456·65535·4294967295도 조회 인자로 허용 |
| 생략 | optional. 필터를 지울 때 인자 자체를 제거. 빈 문자열/공백 전송은 431 |
| 정상/없음 | 정상 0건이며 오류와 구분. 일치하면 EQ 결과, count는 전체 건수 |
| 부정 값 | 부호(음수·+), 소수·지수·ASDOT·쉼표·문자·non-ASCII 숫자·초과 값은 431 |
| leading zero | 서버는 10진 값으로 수용. UI/URL/chip은 정규화한 전체 10진 표기 |
| 다른 필터 | Zone·범위·할당·망/VPC·소유자와 AND. keyword도 함께 주면 AND이며 LIKE 대체 호출이 아님 |
| 페이지 | page/pagesize를 함께 전송. 응답 count를 현재 페이지 길이로 덮어쓰지 않음 |
| 권한 | 기존 caller의 free/소유자·도메인 제한 유지. 정확 번호가 권한 우회 수단이 아님 |
| 기존 비정상 데이터 | 정확 조회 지원 범위는 확장하지 않음. keyword/범위로 조사 가능, 자동 정리 없음 |

UI는 VM 공통 SearchView/ListView를 유지하고 text input+numeric inputmode를 사용한다. 양 끝 공백은 UI에서 먼저 제거하고 ASCII 숫자·정수·범위를 확인한 뒤 문자열로 직렬화한다. 32비트 signed 변환, parseInt 뒤 bitwise 연산, 과학 표기를 사용하지 않는다. 지원 상한은 JavaScript 안전 정수 범위 안이므로 검사 후 `String(Number(raw))`로 leading zero를 정규화할 수 있다. 검사 전에 문자열 일부만 잘라 읽으면 안 된다.

등록은 #1709의 1~4294967294/특수 번호 차단/범위 1000개 정책이며 조회와 다르다. 예약 번호 조회 허용을 등록 허용으로 표현하지 않는다. URL/입력/검색 chip의 잘못된 값은 쓰기/API 조회 이전에 안내하고, 431/통신 오류와 정상 0건·재조회 실패를 각각 표시한다. 기존 keyword는 유지한다.

31·32에서 metadata=long, 64512와 4200000000의 정확 API/실제 UI keyword의 같은 UUID·숫자 결과를 확인했다. 0·23456·65535·4294967295는 실제 API에서 정상 0건, 저장 레코드가 있을 때의 응답은 실제 GenericDao/H2 fixture로 확인했다. 정확 번호 UI의 URL 복원·소유자 컨텍스트 전환·chip 해제는 #1712에서 이어 검증한다.
