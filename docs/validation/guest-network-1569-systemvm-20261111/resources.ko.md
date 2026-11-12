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

# 확인용 자원·보존·정리

| 사이트 | 종류 | 이름/주소 | 식별자/상태 |
| --- | --- | --- | --- |
| 31 | 프로젝트 | qa-gn1569-31-shared-reg | 59614883-4085-4a76-99da-b8a1e3a78eed |
| 31 | 기존 Shared / 새 이미지로 요소 재생성 | qa-gn1569-31-shared-reg | 87601b32-f211-4609-819f-6d0f4810b788 |
| 31 | 재생성 Shared VR | r-1028-VM / 10.247.31.51 | 32037dd3-3f5b-46a1-b12e-224a13233f64 |
| 31 | 새 Shared / 새 이미지 최초 생성 | qa-gn1569-31-systemvm-newrouter | 05fdfafc-9b68-404f-9018-bd9ff272b4bd |
| 31 | 새 Shared VR | r-1027-VM / 10.248.31.52 | 8510d190-a0d9-4274-9529-17ee441e7152 |
| 31 | 신규 VM25 | qa-gn1569-31-systemvm-vm25 | 5989ced4-0f5a-4e18-9179-46531819d602 |
| 31 | 검토용 추가 Shared 범위 | 10.247.31.110–112 | VM25의 .110 신규 임대 보관 |
| 32 | 프로젝트 | qa-gn1569-32-shared-reg | cf5ec6b5-b522-4c18-ab90-a395012607c1 |
| 32 | 기존 Shared / 새 이미지로 요소 재생성 | qa-gn1569-32-shared-reg | a57a394e-71a6-4748-9fc3-9bcdc40ed3bd |
| 32 | 재생성 Shared VR | r-502-VM / 10.247.32.51 | 815c0909-a541-4aa2-8e83-2e33d3b4ac5a |
| 32 | 새 Shared / 새 이미지 최초 생성 | qa-gn1569-32-systemvm-newrouter | a9d0586b-368e-4a2e-b5c5-86e4d7fc4a8e |
| 32 | 새 Shared VR | r-501-VM / 10.248.32.51 | 2b46f166-c6d6-41ed-89a9-d1fba1f7c3a5 |
| 32 | 신규 VM25 | qa-gn1569-32-systemvm-vm25 | effa8f4f-53e7-46f0-9520-d61c34a1569c |
| 32 | 검토용 추가 Shared 범위 | 10.247.32.110–112 | VM25의 .110 신규 임대 보관 |

## 실패 재현 자원

- 31 qa-gn1569-31-mtu-mac / dad25fd1-a475-47fc-bab3-c7ee4968a3df: Allocated·라우터 없음·SourceNat10.10.31.143 할당. VM25의 실패 NIC9cd949a8-49d4-4529-ae5a-7fd857e1569e는 DB Allocated/device4인데 실제 XML에는 없다. #1630 구현/확인 전 이 상태를 유지한다.
- 32 qa-gn1569-32-mtu-mac / aa3f205b-1da6-4e26-bf51-24ef1616f830: r-506-VM, SourceNat10.10.32.103, guest 할당CIDR10.250.32.0/25·networkCIDR/24·domain recheck32.mtu.internal. VM25의 .10 NIC는 실제 존재/DHCP/DNS 정상. Public MAC이1e:01:b1:00:00:07→1e:01:f3:00:00:07로 바뀐 분리 재현을 남긴다.
- qa-gn1569-31/32-final-clone-shared/l2/nat/vpc-internal/false: 전부 Disabled인 신규 clone10개.
- qa-gn1569-31/32-revocation-good-false: 정상 PEM/키/체인 대조 upload 성공 인증서2개. LB 미할당. 기본 검사 성공 인증서라고 표현하지 않는다.
- Shared UI tag qa1569-ui-final=한글 literal은 검토용으로 보관했다. 시험 코멘트/임시 tag CRUD는 삭제했고 원래 tag·기존 코멘트를 보존했다.

## 설정과 helper

새 ROUTING 템플릿과 management31의 새 압축 이미지·기존 r2 파일을 유지한다. Zone router.template.kvm만 SystemVM-gn1569-full-20261111-KVM으로 전환했다. global/SYSTEM은 그대로다.

임시 storage threshold는0.90 복원. management echo20681/20682, host172.26.x.254와 전용 guest return routes, 추가 management firewall 규칙은 제거했다. 신규 VM25 내부의 제한된 단일 TCP/UDP 확인 서비스는 남겼다.

CRL/OCSP 공개 helper20683은 중지하고 추가 firewall rule을 제거했다. 공개 파일은 management31 /var/tmp/qa-gn1569-revocation-public에 보관하며 개인 키는 없다. CA 개인 재료는 WSL /home/ablecloud/work/gn1569-systemvm/revocation의700 작업 폴더와 local private scratch에만 있다. #1632 후속에서는 원본 helper를 재개해 사용하고 기존 보안 정책을 끄지 않는다.

관리자 확인 탭2개는 원래 다크 테마·실제 브라우저 크기로 남겼다. 새 helper로 만든 Cloud 자원/실패 상태를 확인 전에 삭제하지 않는다.

## 보호 검증

기존 VM/원래 NIC major state/ID/IP/MAC/default 변경·누락0. [31](evidence/31-preservation-comparison.json), [32](evidence/32-preservation-comparison.json). Native8/13020과 WSL14/107 보호 스냅샷 동일. WSL 비교 기준은 이전 인계 스냅샷이다.
