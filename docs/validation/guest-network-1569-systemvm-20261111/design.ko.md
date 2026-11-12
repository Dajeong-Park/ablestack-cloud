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

# 검증 설계·계약·중단 경계

## 범위와 기준

실행 source는 d5088214ede2f464df9b932e5acf8b62dfdff707이다. Epic branch/PR을 유지하고 기존 FT 변경·운영 자원·보안 정책을 보존한다. 새 이미지의 출처/바이트 → 템플릿 Ready/checksum → Zone routing override → 실제 router template ID/version → 이미지/실행 binary SHA → DHCP/DNS/packet → UI 재조회 순서로 연결한다.

31 GFS2·32 Glue RBD를 따로 검증한다. 스위치 VLAN 트렁크가 준비되지 않았으므로 통신용 VM과 라우터는 같은 호스트에 둔다. 호스트 간 전달·백엔드 부하 분산 측정이나 외부 경로를 같은 호스트 결과로 대체하지 않는다.

## 준비·적용

1. 기존 개체/role/provider/config·소스·UI와 템플릿 override를 기록한다.
2. WSL ext4의 독립 source archive와 Debian builder에서 실제 ISO/Packer build를 수행한다. product release와 artifact suffix를 분리한다.
3. qcow2 구조·ELF/패키지/release, 압축 round trip, read-only NBD의 dnsmasq hash를 확인한다.
4. 새 파일명을 management31의 gn1569-templates에 추가한다. WEB-INF/META-INF를 보존하고 HTTP200과 원격 SHA를 확인한다.32 관리 root 디스크에 대형 이미지를 올리지 않는다.
5. ROUTING 템플릿만 각 Zone에 등록하고 Ready/checksum 확인 후 Zone override를 바꾼다. global/SYSTEM과 다른 실행 중 라우터를 일괄 재생성하지 않는다.
6. 새 Shared 최초 NIC, 기존 Shared cleanup UI job, same-host 배치와 기존 NIC 계약을 대조한다.

## 판정

- 정상 재시작·Live Patch는 DNS 연속 표본/기존 NIC packet·dnsmasq PID/NRestarts/segfault로 판정한다.
- 요소 교체는 DNS 중단을 숨기지 않는다. 교체 전후 복구와 라우터와 독립적인 기존 NIC 통신을 따로 기록한다.
- API job1, DB 값, UI의 활성화나 keepMAC=true만으로 실제 NIC/효과를 성공으로 보지 않는다.
- 실제 오류와 도구/입력 전제 오류를 구분한다. PF cidrlist는 API 문서대로 VPC 전용이며, 비VPC는 별도 Firewall로 검증한다. 범위 PF의 start 일치 정책과 Allocated IP의 disassociate/release 구분을 유지한다.
- 통제된503은 브라우저 read 요청 한 건만 주입한다. 서버 실제 장애나 실제 backend job 실패로 표시하지 않는다.
- 실패가 나온 단계와 선행 조건이 필요한 후속은 성공으로 집계하지 않는다. 이번 5개 결함의 재현 상태를 보존하고 별도 구현 이슈로 분리한다.

## 보존·정리

기존 VM/NIC subset을 대조한다. 새 VM21/22의 추가 Shared NIC와 신규 VM25·새 네트워크/템플릿·Disabled clone·전용 인증서·실패 재현은 확인용으로 남긴다. 기존 시험 자원을 임의로 정리하지 않는다. 관리 echo/CRL helper·host 제어 IP·임시 guest route·추가 host firewall 규칙만 정리한다.31 storage threshold0.90, 원래 MTU 정책false와 역할/공유 정책을 유지한다.
