<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this
work for additional information regarding copyright ownership. The ASF
licenses this file under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may
obtain a copy at http://www.apache.org/licenses/LICENSE-2.0 . Unless required
by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS. -->

# 빌드·배포·보존 검증

## 로컬 검증

Windows의 `dhslove/epic-1708-asnumbers` 작업 트리에서 구현하고, WSL ext4 `/home/ablecloud/work/dhslove/cloud-asnumbers-1713`에서 변경 모듈만 빌드했다. 기존 FTCTL 작업 트리의 변경은 보존했다. 전체 Cloud 빌드·수동 Actions·qemu 빌드/배포는 수행하지 않았다.

| 범위 | 결과 |
| --- | --- |
| api | 10 tests PASS: 공통 해제 정책 1, release 명령 2, list 명령 7 |
| engine/schema | ASNumberDaoQueryTest 7 PASS |
| server | Query 9, RangeDeletion 15, ReleasePolicy 3, ApiResponseHelper 1 = 28 PASS |
| 배포 payload | 정상 빌드와 같은 45 tests를 실제 overlay 클래스에 다시 실행하여 PASS. 실행 후 빌드 클래스 원복 |
| UI ASN | 8 suites / 78 tests PASS. 변경 뒤 Autogen 7·Operations/Tools 8·ReleaseDialog 6 등을 해당 변경에 맞춰 재검증 |
| UI 공통 경계 | PublicIpNetworkLink / ListViewProjectReference / ListViewAccounts / MoldDialog 4 suites / 44 tests PASS |
| lint·형식 | 변경 UI ESLint, Java 16 files Checkstyle, Python helper flake8/구문 검사, git diff --check PASS |
| UI production | Node 20.20.2, source map 제외 production build PASS. 기존 Browserslist/caniuse 안내가 있으며 빌드 실패로 취급하지 않음 |

테스트 JUnit의 실제 suite·tests/failures/errors/skipped 값과 정적 검사 입력 해시는 EVIDENCE.json에 있다. 변경 없는 전체 UI 회귀·전체 Cloud 모듈 빌드·전체 모듈 Checkstyle은 실행하지 않았다. 전체 CI 성공을 의미하지 않는다.

## 배포 경계

현재 서버 JAR은 저장소 기준 전체와 다르므로 `prepare-overlay.py`가 소유 메서드·신규 DTO 필드만 합성했다. 신규 순수 API 정책 클래스를 포함한 payload 9개 클래스에 대해 나머지 JAR entry 바이트를 보존한다. 원래 BGP 익명 클래스도 유지했다.

- BGPServiceImpl: 21개 무관 메서드와 기존 필드 보존. 해제/사유 계산/범위 제한 DAO 경로만 변경.
- ApiResponseHelper: ASN 응답 생성만 교체, 206개 무관 메서드 보존.
- List/Release 명령: 각각 10/4개 무관 메서드 보존.
- ASNumberResponse: 기존 35개 메서드·필드 보존, additive boolean/string 필드와 접근자 추가.
- 서비스/DAO 인터페이스와 구현: 기존 계약을 보존하고 페이지 사유·Zone+ASN finder만 추가.

양쪽 서비스 재시작 뒤 HTTP 200·WEB-INF·원래 config hash·설치된 클래스 hash를 확인했다. 정적 UI는 활성 `/usr/share/cloudstack-management/webapp`의 허용된 산출물만 덮었고 기존 디렉터리/해시 이름 자산을 삭제하지 않았다. WEB-INF·META-INF 정책·서버 설정·기존 FTCTL marker를 보존했다. 마지막 정적 배포는 JAR·서비스 PID를 바꾸지 않았다. 관리 로그 최근 20,000줄에 class linkage 오류가 없었다. 기존 라우터/인프라 경보의 해결이나 관리 로그 전체 정상성을 선언하지 않는다.

| 클러스터 | 최종 관리 JAR SHA256 | 최종 index.html SHA256 |
| --- | --- | --- |
| 31 | `e6c685e612f6c2458ece8ca9247e4f8bab6cfd7b057a550e18ae3a3b54242404` | `78d18488f6fabadf17013cfc340e539a7833892c875f6730a71a86324652b627` |
| 32 | `357abffd36e0f9e233004c00ef16e3ad4edb791c9b27e0001bbb844ae594fa71` | `78d18488f6fabadf17013cfc340e539a7833892c875f6730a71a86324652b627` |

최종 UI payload SHA256: `24eda7602d3f3f73f5d38679a2c0ce274369582cdbfbdd27e3dea45d078edfbd`.

72개 화면의 시각 검토에 사용한 CSS·구조를 유지한 채, 이후 선택 초기화와 삭제된 필터의 오해를 부르는 공통 stale 안내만 보정했다. 이 동작은 최종 배포 번들에서 다시 확인했다. 최종 브라우저의 실제 로드 script URL·정상 빈 목록·라이트/viewport 복원 값도 증적에 기록했다.

## 백업과 복원

원본 관리 JAR 백업은 31 `/root/asn1713-server-20261118-140828/cloudstack-before.jar`, 32 `/root/asn1713-server-20261118-140947/cloudstack-before.jar`이다. 배포 전 hash와 보존 manifest를 함께 저장했다. JAR 복원이 필요하면 현재 hash가 이 작업의 최종 값과 같은지 확인한 후 mold를 중지하고 해당 원본을 같은 경로로 권한/소유권을 보존해 복사한 뒤 시작한다. HTTP 200·WEB-INF·config·runtime API를 재확인한다.

ASN-05 적용 전 UI 백업은 31 `/root/asn1713-ui-20261118-141241`, 32 `/root/asn1713-ui-20261118-141300`이다. 해당 `static-before.tgz`를 webapp의 **기록된 정적 경로만** 복원한다. 서버 디렉터리를 교체하거나 rsync --delete를 사용하지 않는다. 가장 최근 UI 백업은 직전 번들 복원용이며 전체 ASN-05 이전 복원에는 위 최초 백업을 사용한다. 모든 UI 백업 목록·현재 hash는 EVIDENCE.json에 있다.

## 라이선스·자동 CI

격리 WSL RAT 작업 트리에서 PR base `aff74eee0d835891f9209492514f6c2d204bc138`와 비교한 미승인 파일은 **4,077개로 동일, 추가/삭제 0개**였다. 새 Java·Vue·JS·검증 helper에는 ASF header를 적용했다. 이 비교는 기존 라이선스 문제를 해결하거나 자동 License Check/Lint가 성공했다는 뜻이 아니다. 새 HEAD 자동 CI 상태는 PR 갱신 기록에서 별도로 보고한다. 전체 Cloud Actions는 요청하지 않았다.
