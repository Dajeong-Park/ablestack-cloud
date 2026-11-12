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

# #1569 종료 여부와 남은 검증

**종료 불가·OPEN 유지**가 현재 판정이다. 이번 SystemVM 새 build/배포·DHCP/DNS/통신 목표는 검증했지만 #1569 전체 잔여 시험 완료가 아니다.

| 클러스터 | 실패 행 | 부분 행 | 환경 차단 | 적용 제외 | 전체 행 완료 |
| --- | --- | --- | --- | --- | --- |
| 31 | 7 | 47 | 6 | 3 | 0 |
| 32 | 9 | 45 | 6 | 3 | 0 |

| 순서/이슈 | 실환경 재현 | 미해결 내용 | 대표 영향 |
| --- | --- | --- | --- |
| [#1630](https://github.com/ablecloud-team/ablestack-cloud/issues/1630) | 31 | NIC 추가 job2 뒤 DB/API의 Allocated NIC 잔류·실제 libvirt에는 없는데 UI 활성화 | C03/C05/C06/M02 |
| [#1628](https://github.com/ablecloud-team/ablestack-cloud/issues/1628) | 32 | Shared 추가 IPv4 서브넷 530: networks.cidr 18·gateway 15인 기존 스키마 | S06 |
| [#1629](https://github.com/ablecloud-team/ablestack-cloud/issues/1629) | 31·32 | 프로젝트에 공유된 Shared는 조회되지만 member/readOnly IP 조회531 | C07/S05/M02 |
| [#1631](https://github.com/ablecloud-team/ablestack-cloud/issues/1631) | 32 | Public MAC 유지=true에서 도메인 단독 수정의 VR 재생성 후 실제 MAC 변경 | I01/I06/I07 |
| [#1632](https://github.com/ablecloud-team/ablestack-cloud/issues/1632) | 31·32 | 정상 CRL·서명 OCSP·관리 서버 HTTP200을 준비해도 기본 SSL 폐기 검사 정상 체인530 | P07 |

이 카운트는 한 결함이 여러 계약에 미치는 영향을 포함한다. 직접 새 실행이 없는 부분 행과 미실행 세부 조합을 [63행](coverage.ko.md)에 공개했다. 조건부 환경을 충족하지 못한 행도 완료로 전환하지 않았다.

기존 공유 DNS의 dnsmasq 충돌 수정이 새 ISO build/최초/재생성·일반/Live Patch에서 적용되는 것은 확인했다. 그러나 새5개 실패와 남은 지원 조합·환경 조건을 해소하거나 명시적으로 범위를 결정하기 전 전체 이슈를 닫지 않는다. 기존 #1586도 별도 열린 후속이다.

첫 구현 대상은 **#1630**이다. 실패 NIC/예약과 UI 활성 오표시를 안전하게 해결해31의 다음 검증 기반을 복구하고, #1628→#1629→#1631→#1632 순서로 진행한다.
