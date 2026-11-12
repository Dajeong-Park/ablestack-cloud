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

# 후속 순서

1. **기능 회귀/범위·종료 평가 자료를 Epic #1554·#1569·PR #1577에 통합한다.** 알려진 기능 수정 후속은 모두 CLOSED, 준비된 잔여 검증은 통과했다. 원래63행과 새 기능/표시 판정을 구분해 보관한다.
2. **Epic 종료 검토 자료로 사용한다.** 요청 범위는 종료 준비이므로 이번에 병합/종료를 실행하지 않는다. 미구성 조건을 실패나 PASS로 바꾸지 않고 `closure-preparation.ko.md`의 경계를 유지한다. 용량 부족·P3 UI를 중요한 오류나 종료 차단으로 취급하지 않는다.
3. **선택 UI 후속은 #1634→#1635 순으로 관리한다.** 각각 태그 no-job 응답 유실의 복구 안내, 댓글255문자 안내다. 둘 다 P3·API 수정 없이 개선할 항목이며 기능 회귀 종료와 분리한다.
4. **독립 자원 정리는 #1586에서 진행한다.** 네트워크 Epic의 필수 후속/종료 gate에서 제외한다. 이번 확인 자원은 사용자 삭제 지시 전 유지한다.
5. **환경이 준비될 때만 조건부 확장 검증을 실행한다.** IPv6/BGP/외부 DNS/Health Monitor/OvS/독립 VPN client/이중화·전용 Kubernetes fixture 등을 기존 실행 경계 표와 연결한다. 준비되지 않은 자원을 새 제품 오류 이슈로 만들지 않는다. LB 분산/부하 측정은 제외한다.

현재 사용자에게 추가 접속 정보나 환경 준비를 요구하지 않는다. 별도 제공자/독립 client가 없다는 기존 답변을 유지한다.
