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

# 확인용 자원과 정리 내역

확인 전 시험 자원을 삭제하지 않는다. 양쪽 Root 관리자·QA 프로젝트·VM NIC 확인 화면을 열어 두고 임시 반응형 viewport override는 원복했다.

| 사이트 | 프로젝트 | VM | 검토 NIC·네트워크 | 라우터·호스트 |
| --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg | qa-gn1569-31-systemvm-vm25 / i-440-1026-VM | 10.250.31.10 /02:16:30:31:00:01, qa-gn1569-31-mtu-mac | r-1029-VM /31-3 |
| 32 | qa-gn1569-32-shared-reg | qa-gn1569-32-systemvm-vm25 / i-252-500-VM | 10.251.32.10 /02:16:30:32:00:01, qa-gn1630-32-recovery | r-507-VM /32-2 |

31의 이전 실패 ghost NIC `9cd949a8-49d4-4529-ae5a-7fd857e1569e`만 사용자 승인 범위에서 명시적 UI 해제로 정리했다. 재현 사진·API/DB/runtime 증거는 남겼다. 같은 네트워크에서 새 NIC의 실패0잔류→재시도 성공을 검증했다. 원래 정상 NIC31개수4/32개수5의 ID·IP·MAC·device/default와 VM host/Running 상태를 보존했다.

31 VLAN 풀은 API 표시151–200과 달리 실제 기존 DB에44도 할당되어 있었다. 기존51개 row를 보존한 채3230 하나를 추가하고 QA 프로젝트에 전용 할당했다. 최종 범위44-44,151-200,3230-3230이다. 기존 VLAN을 삭제/재할당하거나 스위치·호스트 제공자를 바꾸지 않았다. 추가3230과 전용 할당은 확인용으로 유지한다.

32 Shared `1919f15c-687b-4c44-b0a0-55c9927ac3f0`, VLAN3231 및 전용 network offering `a4fad840-6f10-4e30-b7a3-69ac868ffb99`, system service offering `60de74f9-4eba-46d4-899f-7be36661da06`을 유지한다. 실패 주입은 이 전용 offering의 unmatched hosttag로 한정했고 최종 hosttag는 기존 `ablecube32-2`다. 다른 호스트 태그/공용 오퍼링을 수정하지 않았다.

실제 통신용 새 NIC의 `qa-gn1630-31-nic`·`qa-gn1630-32-nic` DHCP profile은 남긴다. 기존 default route/DNS 변경을 피하도록 설정했다. host control bridge 임시172.26.x.254 주소와 sampler는 제거·중지했고 기존 host 주소 집합이 일치한다. 이전 SystemVM 템플릿·라우터·기존 검토용 자원은 보존한다.

보호 대상 Native8개 worktree/13148개 파일, WSL14개 worktree/107개 파일의 before/after HEAD·dirty diff·파일 해시가 동일했다. 비공개 credential·개인 키·원본 작업 스크립트는 공개 문서에 포함하지 않는다.

[자원 UUID·최종 API/runtime](evidence/final-preservation.json) · [31 VLAN 기존값 보존](evidence/31-vlan-extension-preservation.json) · [31 임시 probe 정리](evidence/31-host-control-probe-cleaned.json) · [32 임시 probe 정리](evidence/32-host-control-probe-cleaned.json)
