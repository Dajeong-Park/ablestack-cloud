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

# 확인용 자원·정리·보호

사용자 확인 전 기존/새 시험 네트워크·VM·NIC를 삭제하지 않는다. 양쪽 관리자·QA 프로젝트의 Shared 범위 화면을 열어 두었다.

| 사이트 | 네트워크 /VLAN | 신규 VM | 추가 서브넷 /DHCP 주소 | 라우터·호스트 |
| --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg /2790 | qa-gn1628-31-subnet-vm26 /i-440-1031-VM | 10.249.31.0/24,100–105 /VM102・DHCP alias103 | r-1028-VM /ablecube31-3 |
| 32 | qa-gn1569-32-shared-reg /2791 | qa-gn1628-32-subnet-vm26 /i-252-508-VM | 10.249.32.0/24,100–105 /VM102・DHCP alias103 | r-502-VM /ablecube32-2 |

VM26은 원래 QA 프로젝트에 있으며 기본 L2 control172.26.x.26과 Shared10.249.x.102의2 NIC를 유지한다. 새 Shared MAC은02:16:28:xx:49:26이고 NetworkManager qa-gn1628-xx-data profile은 auto DHCP·never-default·ignore-auto-dns다. 기본 경로를 바꾸지 않는다. 원래9/10 VM과28/31 NIC, 다른 시험망은 보존했다.

31의 새 VM 첫 생성만 ConfigDrive가 Secondary 사용률90% 한도에 걸려 실패했다. 당시 여유 약32GB를 확인하고 이번 요청의 새 Error VM756cf565-c7f0-4cb6-aa55-c6b6e031bbde만 API로 정리한 뒤 한도를 임시0.92로 조정해 재생성했다. 즉시 finally에서 원래0.90 응답과 동일함을 확인했고 이후 management 재시작도 원래 값으로 수행했다. 정상 확인 VM은 남겼다. [실패](evidence/31-owned-vm26-first-deploy-failure.json) · [원복](evidence/31-capacity-restored.json).

production networks table 전체 SQL 백업과 이전 JAR는 /home/ablecloud/work/gn1628-shared-subnet/backups에 비공개 보관한다. 내용·비밀번호·개인 키는 저장소에 게시하지 않는다. 격리 회귀 DB qa_gn1628_schema_31/32의 마지막 fixture도 보관한다.

두 감시 프로세스를 사이트마다 중지했고 host control bridge 임시172.26.x.254 주소를 제거했다. 원래 host 주소 집합은 같다. 정상 시험망·추가 범위·VM26·NIC·DHCP profile·기존 SystemVM 템플릿/라우터는 유지한다. [31 계측 정리](evidence/31-host-control-probe-cleaned.json) · [32 계측 정리](evidence/32-host-control-probe-cleaned.json).

비공개 작업 스크립트/인증 파일은 원래 dirty FT 작업과 분리된 scratch에만 둔다. Native 보호 worktree 8개/13,203파일, WSL 14개/107파일의 HEAD·상태·diff·파일 해시가 작업 전후 모두 같음을 확인했다. [보호 검증](evidence/protected-worktree-verification.json).
