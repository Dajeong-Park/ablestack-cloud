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

# ASN-03 / #1711 범위 삭제

Epic #1708, 초안 PR #1716의 세 번째 구현이다. 기준 소스는 `5a33947a5d66471624a9177b54c6a73c26072bc6`, 작업 브랜치는 `dhslove/epic-1708-asnumbers`다.

## 구현

- 행의 삭제 동작을 VM 기준 `MoldDialog(md=720)` 확인 화면으로 변경했다. Zone 이름·UUID, 범위 UUID·시작/종료·전체 수·조회한 할당 수와 영향 경고를 읽기 순서대로 표시한다. 고정 footer의 취소/위험 삭제 버튼과 공통 busy/Escape 보호를 사용한다.
- `deleteASNRange` 권한을 생성 권한과 독립적으로 확인한다. 조회 API 권한이 없거나 응답/대상/전체 수/할당 수가 검증되지 않으면 삭제하지 않는다. 컨텍스트에는 Zone, 사용자·역할, 프로젝트, API 권한 집합, 로그인 토큰이 포함된다. 인증값은 증적 파일이나 영구 저장소에 기록하지 않는다. 로그인 컨텍스트 키와 미확정 추적은 현재 브라우저 페이지의 메모리에만 존재한다.
- 확인을 열 때 UUID·범위를 고정하고 제출 전 Zone/범위/할당 수를 다시 읽는다. 재조회 중부터 중복 제출을 막으며, 단일 확인에서 삭제 POST는 한 번만 보낸다. 정상 취소는 원래 행의 네이티브 버튼으로 포커스를 돌린다.
- 실패 시 대상과 이전 목록을 유지한다. 거부 응답 뒤에는 재조회가 필요하다. 통신 실패/불명확 응답은 같은 페이지의 추적 상태에 남기고 자동 재시도하지 않는다. 성공 후 갱신 실패는 성공 수신 사실과 목록 동기화 실패를 분리한다. UUID 부재를 확인한 미확정 요청은 정보 알림으로 동기화하며 새 성공 알림으로 바꾸지 않는다.
- 삭제 확인은 Zone 요약, 전체 범위, 관련 ASN 목록을 재조회한 뒤 완료한다. 삭제된 UUID를 다시 필터로 보내지 않고 Zone 기준 번호 목록을 조회한다. 다른 로그인/Zone/권한으로 바뀐 뒤 도착한 응답은 새 화면을 갱신하지 않는다.
- 서버 할당/생성/삭제는 Zone → 범위 → 번호 순으로 DB 잠금을 사용한다. 삭제 직전 할당 검사는 현재 값을 읽는 `FOR UPDATE` 조회다. 사용 중 번호가 있으면 범위 전체를 거부하고, 번호 제거 뒤 범위 제거가 실패하면 롤백한다. 이미 할당된 명시 번호를 다른 요청이 덮어쓰지 못한다. 할당 불가 시 기존 네트워크/VPC 호출부의 정리 경로가 처리하는 CloudRuntimeException을 발생시키며, 무시되던 false 반환으로 요청을 계속하지 않는다.
- `listASNumbers`와 `listASNRanges`의 정상 0건만 JSON/XML에 `count: 0`을 명시한다. 빈 `{}`·실패·누락된 count를 0건으로 간주하지 않는다. 다른 목록의 직렬화와 ASN 조회 필터/권한은 유지한다.

실환경 취소 검증 중 Tooltip 컴포넌트 루트가 DOM 요소가 아닌 경우 포커스 복귀에서 TypeError가 발생했다. 행의 네이티브 span ref를 사용하도록 수정하고 회귀 테스트를 추가했다. 등록 전용 재확인 문구도 삭제 전용 문구로 분리했다. Teleport된 footer 버튼의 Ctrl+Enter 전달 누락도 별도 처리와 실제 Teleport 회귀 테스트로 보완했다.

## 검증 범위와 자료

[실행 결과](RESULTS.ko.md) · [모듈 빌드·배포·복원](BUILD-DEPLOY.ko.md)

- 로컬: API 19개, schema 5개, 서버 23개, UI 70개. schema는 실제 GenericDao/H2 잠금, 서버는 생산 Transaction과 JDBC row lock을 사용하는 경쟁/롤백 fixture다. 변경 Java 9개 Checkstyle, UI lint/production build를 실행했다.
- 31 GFS2·32 RBD: API 각 15항목으로 삭제/중복 거부·0건 JSON/XML·읽기 전용 역할의 API 거부와 대상 보존을 확인했다. UI에서 같은 역할의 삭제 버튼 숨김도 확인했다. 최종 UI 삭제/레이아웃·정리 결과는 실행 결과 표에 기록한다.
- JSP/서버 디렉터리와 runtime config를 보존하며 정적 파일만 갱신한다. JAR은 대상 메서드만 overlay하고 다른 메서드/fields 및 다른 ZIP entry byte를 보존했다. 이는 전체 관리 JAR을 새로 빌드한 결과와 같다는 의미가 아니다.

ISP/BGP 세션, 경로 광고, 실할당/통신은 검증하지 않았다. 할당/삭제 경쟁과 소유 연결 보존은 제어된 DB fixture 결과다. 기존 네트워크/VPC/VNF/Public IP 전체 체인을 재시험하지 않았다. 전체 Cloud 빌드·수동 Actions·전체 모듈 Checkstyle·전체 UI 회귀는 실행하지 않았다.

다음 대상은 **#1712 / P3 ASN-04**다. 선행 #1710은 완료됐고, 이 변경의 명시적인 0건 계약과 삭제 후 범위 후보 무효화를 검색/URL 설계에 이어 사용한다. #1713은 #1709/#1711/#1712 완료 후 진행한다.
