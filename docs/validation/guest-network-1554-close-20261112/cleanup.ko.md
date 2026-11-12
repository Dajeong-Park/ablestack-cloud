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

# 오래된 시험 자원 정리

qa-gn Epic 소유 자원만 식별해 최신 기능/역할 회귀와 참조 의존성을 남겼다. 비QA 운영/타 시험 자원은 제외했다. 일반 API와 async job으로 정리했으며 DB 직접 수정·강제 삭제를 사용하지 않았다.

| 클러스터 | 제거 VM/VNF/AS | 분리 보조 NIC | 제거 망 | 제거 VPC | 잔존 VM/망/VPC | 가용 Public IP |
| --- | --- | --- | --- | --- | --- | --- |
| 31 GFS2 | 17 | 9 | 74 | 7 | 14/16/3 | 1 → 18 |
| 32 Glue RBD | 16 | 9 | 80 | 9 | 15/16/3 | 59 → 84 |

옛 QA VR47개가 정리됐고 알려진 root volume79개(GFS2파일38·Glue RBD image41)의 물리 부재, DB Expunged/removed, 전체 호스트 domain 부재를 확인했다. 남긴 volume을 양성 대조해 경로 접근 오류에 의한 거짓 부재를 배제했다. AutoScale4그룹·중복 Public LB30규칙·미사용 SSL26개·network offering23개·옛 template6개·빈 project6개·미사용 account12개·유휴 Public IP5개를 추가 정리했다. 사용 중 service/disk offering은 유지했다.

남긴 VM의 기본 NIC·유효 보조 NIC ID/MAC/IP·host를 전후 비교하고 API/libvirt 일치를 확인했다. 비QA VM/network/VPC와 NIC 안정 필드도 유지됐다. 최신 프로젝트 구성원9개·역할5개·권한 규칙은 원본 그대로다. 정리 과정의 정상 참조 거부/시험 입력은 바로잡고 최종 상태를 확인했으며 새 제품 오류로 등록하지 않았다.

| 정리 후 실제 확인 | 31 | 32 |
| --- | --- | --- |
| Shared 기존 peer → 새 기본 Shared VM | DNS UDP12/TCP12·ICMP5·SSH 성공 | 동일 |
| VPN | PPP 연결·ICMP5·SSH3 성공 | 동일 |
| TLS | chain3·Root/SNI verify0·HTTP200 | 동일 |
| HAProxy 문법/건강 점검 | exit0/0 | 동일 |
| 관리서버 | 기존 배포 hash·HTTP200·WEB-INF 보존 | 동일 |

이 시점의 DHCP 기존 임대/통신 확인은 신규 임대·갱신을 다시 강제했다는 뜻이 아니다. 신규/갱신은 [직전 회귀](../guest-network-1569-role-conditional-20261112/test-results.ko.md) 근거를 유지한다. VPN client·임시 host probe 주소는 제거했다. 확인용 서버 자원은 남겼다.

[31 최종 상태](evidence/31-cleanup-verification.json) · [32 최종 상태](evidence/32-cleanup-verification.json) · [31 통신](evidence/31-after-cleanup-service-regression.json) · [32 통신](evidence/32-after-cleanup-service-regression.json) · [제거 명세](evidence/removed-resources.json) · [API job 요약](evidence/cleanup-api-job-summary.json)
