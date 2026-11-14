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

# #1659 next-hop 정적 경로의 게이트웨이 링크 설계

상위 [Epic #1650](https://github.com/ablecloud-team/ablestack-cloud/issues/1650),
누적 [Draft PR #1660](https://github.com/ablecloud-team/ablestack-cloud/pull/1660),
브랜치 `dhslove/epic-1650-vpc`, 기준 `6bc8c1b56a19d58e22bf8951fd623f28d3fa025f`.

## 실환경 근거

31 GFS2와 32 RBD에서 현재 배포된 #1658 UI로 각각 전용 VPC·게이트웨이를 만들고
두 경로를 실제 UI로 생성했다. VPC는 start=false이며 전용 라우터0이다.
총4개 UI createStaticRoute POST는 실제 terminal jobstatus=1이고 최종 Active 자원과 일치했다.
[31 요청/job/자원](evidence/31-design-ui-api-oracle.json), [32 요청/job/자원](evidence/32-design-ui-api-oracle.json).

| 방식 | 실제 요청 | 실제 응답 | 수정 전 UI |
| --- | --- | --- | --- |
| next-hop | vpcid+nexthop+cidr | vpcgatewayid/vpcgatewayip 없음, nexthop 존재 | 빈 링크 `#/privategw/undefined`, tabIndex0 |
| 게이트웨이 | gatewayid+cidr, vpcid/nexthop 미전송 | vpcgatewayid와 vpcgatewayip 존재 | 정상 IP·상세 링크 |

양쪽에서 같은 결함을 재현했다. API 응답은 정상이고 API·Java·DB 수정은 필요 없다.
[31 수정 전 DOM](evidence/31-before-ui.json), [32 수정 전 DOM](evidence/32-before-ui.json).

## 채택 변경

`StaticRoutesTab.vue`의 게이트웨이 셀만 수정한다.
`vpcgatewayid`와 `vpcgatewayip`가 모두 공백이 아닌 문자열일 때 기존 router-link를 유지한다.
그 외에는 비대화형 span의 `-`를 표시한다. 없는 ID를 추정하거나 nexthop으로 게이트웨이 링크를 만들지 않는다.
별도 클래스·색·컬럼·라벨·width·공통 프레임 변경 없이 VM 공통 표와 #1658의 가로 스크롤을 재사용한다.
라우트 생성·삭제 API, 파라미터, 비동기 추적, 경로/태그 폼은 변경하지 않는다.

## 검증 계약

- 실제 컴포넌트·설치된 Ant Table·Vue Router로 ID/IP 부재·null·빈 문자열·공백8조합에서 `-`와 focusable 자식0을 검증한다.
- 완전한 응답은 VPC/게이트웨이 두 부모 화면 모두 IP·href·키보드 링크를 유지한다.
- 수정 전 동일 테스트 실패를 확인한 뒤 수정 후 새 테스트10개와 기존 VPC 집중 회귀·변경 lint를 실행한다.
- 양쪽 활성 webapp에 동일 UI를 정적 allowlist로 배포한다. WEB-INF/META-INF·설정·JAR·PID를 보존하고 /client/ HTTP200과 manifest 전체 해시를 확인한다.
- 최종 UI에서 next-hop `-`/빈 링크0·게이트웨이 링크 상세 이동·실제 Tab/Enter·390/768/1280 light/dark 가독성과 표 스크롤을 확인한다.
- 전용 경로4개를 실제 UI로 삭제하고 job 및 최종 부재를 확인한 뒤 전용 게이트웨이·VPC만 정상 API로 정리한다.
- 기존12종 UUID·주요 설정·계정 사용량과 별도 FTCTL 수정 파일을 전후 비교한다.

## 범위와 한계

일반 네트워크/ACL/NAT/PF/LB/VPN·실제 패킷·라우터 시작·마이그레이션을 반복하지 않는다.
공통 프레임 #1212/#1213, 외부 제공자·IPv6/BGP·전역 테스트의 기존 실패를 수정 범위에 포함하지 않는다.
UI만 WSL ext4에서 빌드하며 Maven·전체 Cloud·Release Actions·호스트 배포를 시작하지 않는다.
범위 밖 신규 이슈를 생성하지 않는다. Epic 전체 완료 여부와 PR 병합은 구분한다.
