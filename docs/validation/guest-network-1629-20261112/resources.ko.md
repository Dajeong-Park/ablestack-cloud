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

# 확인용 자원과 정리

기존 네트워크/VM/NIC를 생성·삭제하거나 권한 공유 범위를 바꾸지 않았다. #1628에서 남긴 다음 자원과 모든 기존 시험 자원을 유지한다.

| 사이트 | Shared 네트워크 | 프로젝트 | 확인 VM | Shared IP /MAC |
| --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg /87601b32-f211-4609-819f-6d0f4810b788 | 59614883-4085-4a76-99da-b8a1e3a78eed | qa-gn1628-31-subnet-vm26 | 10.249.31.102 /02:16:28:31:49:26 |
| 32 | qa-gn1569-32-shared-reg /a57a394e-71a6-4748-9fc3-9bcdc40ed3bd | cf5ec6b5-b522-4c18-ab90-a395012607c1 | qa-gn1628-32-subnet-vm26 | 10.249.32.102 /02:16:28:32:49:26 |

기존 r-1028-VM/ablecube31-3와 r-502-VM/ablecube32-2, VLAN2790/2791, 원래 범위3개씩과 VM21/22/25/26·DHCP profile·템플릿/오퍼링을 남겼다. 전체21 VM/63 NIC가 원래 ID·주소·MAC·기본 NIC·VM host/Running을 유지한다.

확인을 위해 관리자로 QA 프로젝트를 선택하고 네트워크의 IP 주소 탭을 연다. 전체18개는 기존 관리자 범위다. 기존 프로젝트 구성원·읽기 전용 사용자로 같은 프로젝트를 선택하면 해당 프로젝트 할당6개와 VM 링크를 볼 수 있다. 비밀번호·API key는 보고서에 게시하지 않는다.

임시 explicit deny 한 규칙은 finally에서 제거해 원래 역할 규칙을 복원했다. Free IP 정책 false·NetworkPermissions·구성원/역할을 보존했다. 시험 계정 비밀번호는 변경하지 않았다.

임시 Shared peer 감시 서비스는 양쪽에서 중지했고 host control bridge의172.26.x.254 주소를 제거해 원래 주소 집합과 같음을 확인했다. 정상 네트워크·VM·NIC는 정리하지 않았다. [31 정리](evidence/31-host-control-probe-cleaned.json) · [32 정리](evidence/32-host-control-probe-cleaned.json).

전체 이전 JAR 두 개는 /home/ablecloud/work/gn1629-shared-ip/backups에 비공개 보관한다. 배포 후 임시 rollback hardlink만 제거했고 WEB-INF/META-INF/config는 보존했다. [31 백업/배포](evidence/31-backend-deployment.json) · [32](evidence/32-backend-deployment.json).

Native dirty worktree8개/13269파일, WSL14개/107파일의 HEAD·상태·diff·파일 해시가 작업 전후 같음을 확인했다. 이번 비공개 scratch와 별도 P07 작업 scratch는 제외하며 원래 FT 소스는 보호 대상이다. [보호 결과](evidence/protected-worktree-verification.json).
