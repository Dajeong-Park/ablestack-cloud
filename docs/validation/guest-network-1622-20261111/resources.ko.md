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

# 확인용 보관 자원

별도 삭제 지시까지 기존 자원과 새 시험 계정/역할/키를 유지한다. 키·secret·비밀번호·PSK는 공개하지 않는다.

| 클러스터 | 프로젝트 | SSL 검토 규칙 | VM·라우터·호스트 |
| --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg / `59614883-4085-4a76-99da-b8a1e3a78eed` | 10.10.31.149:19111→18443 / `9649f2d1-d4ba-42e9-8022-d764dfb45611` | qa-gn1569-31-vpn-lb-vm / r-1019-VM / ablecube31-3 |
| 32 | qa-gn1569-32-shared-reg / `cf5ec6b5-b522-4c18-ab90-a395012607c1` | 10.10.32.177:19111→18443 / `dd36a10c-b2fa-4611-a662-f20c9c4736e4` | qa-gn1569-32-vpn-lb-vm / r-489-VM / ablecube32-2 |

## 새 검토 역할

| 클러스터 | 계정 | SSL 역할 |
| --- | --- | --- |
| 31 | qa-gn1622-31-ssl-allow | listSslCerts allow, assign/remove deny |
| 31 | qa-gn1622-31-ssl-read-deny | listSslCerts deny, assign/remove deny |
| 32 | qa-gn1622-32-ssl-allow | listSslCerts allow, assign/remove deny |
| 32 | qa-gn1622-32-ssl-read-deny | listSslCerts deny, assign/remove deny |

계정/역할은 각 클러스터2개씩만 추가했다. 기존 소유자·멤버·도메인 관리자·SSL 제한·비구성원 시험 계정을 재사용했다. 새 서명 키는 SSL/작업 조회 범위로 제한했으며 기존 키를 삭제/교체하지 않았다. 실제 SSL 교체/복원 뒤 기존 전체 인증서 매핑과76 LB 정의/backend가 보존된 상태다. 확인 경로는 Public IP > 부하 분산 > 검토 규칙 설정 > SSL 인증서다.

관리 JAR 원본은 WSL ext4 `/home/ablecloud/work/gn1622-signed-ssl/backups/`와 배포 영수증에 기록된 원격 RAM 경로에 보관했다. 네트워크·VM/NIC·라우터·VPC·공인IP·VPN 서비스/사용자는 삭제하지 않았다.
