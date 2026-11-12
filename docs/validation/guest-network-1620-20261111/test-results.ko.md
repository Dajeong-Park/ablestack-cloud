<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

# 실행 결과와 판정 범위

| 검증 | 31 | 32 | 근거 |
| --- | --- | --- | --- |
| 수정 전 projectid 생략 우회 | 재현 | 재현 | `*-live-baseline-repro.json` |
| API 행렬55건 | 허용29 / 거부26 | 허용29 / 거부26 | `*-role-api-matrix.json` |
| 서명 SSL 쓰기4건 | 모두401 / 작업0 | 모두401 / 작업0 | `*-signed-api-checks.json` |
| 키 제한 보존 | 세션 VM조회 허용 / 서명 키 거부432 | 동일 | 위 파일의 keyRestrictionControl |
| 권한 거부 전후 런타임 | 설정·PEM hash/mtime·PID 동일 | 동일 | `*-denied-runtime-preservation.json` |
| 소유자 UI 교체·해제·복구 | 실제 POST / job1 각1건 | 동일 | `*-ui-owner-*.json` |
| 최종 지문·실제 TLS | 원래 B지문 / HTTP200 / 본문 | 동일 | `*-final-tls-runtime.json` |
| VM 표준·프로젝트·테마 | 비교/왕복/즉시 전환 확인 | 동일 | ui-state/layout/instant-theme 기록 |
| SSL 모바일 표준 | #1619 실패 유지 | #1619 실패 유지 | 390px light/dark 캡처 |
| 서명 조회에 projectid 지정 | #1622 관찰401 | 동일 | `*-signed-project-read-observation.json` |
| 활성 배포 | 새 JAR/PID·정적670 동일·HTTP200 | 동일 | `*-active-deployment-audit.json` |

루트 관리자·프로젝트 소유자·일반 구성원·도메인 관리자는 projectid 생략/일치에서 교체·제거·복구6작업씩 성공했다. SSL 두 API만 거부하는 전용 프로젝트 역할과 비구성원은 생략/일치에서 거부됐다. 여섯 주체의 불일치 프로젝트도 거부됐으며 기존 상위 검사 때문에 일부 응답은432다. 20개의 이 음성 요청 전후 런타임이 동일했다. 별도 거부 반복6건에서도 작업이 생성되지 않았다.

세부 역할은 assign만 허용/remove 거부의 강제 교체 성공, remove만 허용/assign 거부의 제거 성공을 확인하고 정확히 두 deny로 원복했다. 개인 LB는31 루트 소유·32 일반 사용자 소유에서 변경3작업이 허용됐고 프로젝트 불일치/비소유자는 거부됐다. 개인19120 규칙에는 backend/FW를 붙이지 않았으므로 개인 LB 통신 성공으로 계산하지 않는다.

신규 회귀22건을 원래 제품 소스에 대입하면22실패/오류0, 수정 후 관련7 suite 총62통과/오류0이다. 첫 baseline 메서드 필터가0건을 선택한 실행은 결과로 쓰지 않고 클래스 전체로 재실행했다. 최종 모듈 `mvn -pl server -Drat.skip=true -Dtest=... package` 성공. RAT skip은 모듈 빌드 옵션이며 라이선스 검증 통과를 뜻하지 않는다. 자동 PR CI와 전체 Cloud 빌드는 별개다.

UI는 실제 세션에서 작업했다. 32번 교체 직후 캡처 `32-owner-certificate-swap-pending.jpg`는 job0 진행 중이다. 완료 증거는 같은 job의 `32-ui-owner-swap-jobs.json` job1이며, 해제·복구 캡처는 완료 상태다. DOM의 숨은 이전 modal을 기다려 한 번 timeout 난 수집 조건은 보이는 modal로 바로잡았다. 요청 중복 실행으로 보정하지 않았다.

각 클러스터에서 밝음/다크 ×390/768/1280의 SSL 창6조합과 VM 기준 배치를 확인했다. 관리자 테마의 밝음↔다크 모두 performance.timeOrigin이 같아 새로고침 없는 전환이다. 제한 역할은 테마를 상속했다. 전체 페이지 가로 overflow0과 SSL 창 내부의117px 폭/잘림은 구분했다. UI 권한 버튼 누락과401 후 잠김은 #1619에 남아 있으며 서버 차단 성공을 UI 표준 전체 통과로 표시하지 않는다.

서명 요청은 v3/HMAC-SHA256/만료시각을 사용했다. projectid 없는 SSL 조회 성공으로 키 인증을 확인했고 SSL 쓰기의 생략 경로는 신규 worker의401 메시지를 받았다. 별도 서명 조회 불일치는 #1622로 분리했다. 이번 작업 전 서명 조회 결과를 측정하지 않았으므로 이를 기존 결과나 이번 수정으로 인한 회귀라고 단정하지 않는다.

VPN 서비스/사용자/PSK는 유지했지만 인증서 적용 중 활성 VPN 클라이언트를 사용하지 않았다. #1621 연속성을 이 결과로 재검증했다고 계산하지 않는다. LB 분산/부하 측정도 제외했다. UI401가 기존 세션 만료 메시지까지 표시하는 현상은 #1619 범위로 기록하며, 서버 새 로그인 후 권한 검사는 일관됐다.
