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

# 사용자 확인용 시험 자원

기존 네트워크·VM·NIC는 삭제하지 않았다. VR은 검증한 재생성 동작에 따라 교체됐고 최종 새 VR과 시험 자원을 남겼다. 관리자로 각 shared-reg 프로젝트를 선택하고 아래 링크의 네트워크 상세/가상 라우터 탭과 VM25 NIC를 확인한다. 이번 role UI 확인 시31 읽기 전용 로그인이 시도됐으므로 브라우저의 현재 계정을 확인하고 필요한 경우 기존 admin으로 로그인한다. 비밀번호·API key는 게시하지 않는다.

| 사이트 | 네트워크 | 확인 VM /guest IP | 최종 VR /Public IP /MAC |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-mtu-mac](http://10.10.31.10:8080/client/#/guestnetwork/dad25fd1-a475-47fc-bab3-c7ee4968a3df?projectid=59614883-4085-4a76-99da-b8a1e3a78eed) | qa-gn1569-31-systemvm-vm25 /10.250.31.10 | r-1042-VM /10.10.31.143 /1e:1f:1b:00:00:30 |
| 32 | [qa-gn1569-32-mtu-mac](http://10.10.32.10:8080/client/#/guestnetwork/aa3f205b-1da6-4e26-bf51-24ef1616f830?projectid=cf5ec6b5-b522-4c18-ab90-a395012607c1) | qa-gn1569-32-systemvm-vm25 /10.250.32.10 | r-519-VM /10.10.32.103 /1e:01:41:00:00:07 |

최종 keepMAC=true, 원래 nat 오퍼링, review1631.x.internal 도메인을 유지한다. 최종 MAC은 의도적으로 수행한 false 대조 시험에서 새로 선택된 값이다. 그 뒤 true 재생성과 원래 오퍼링 복귀에서 이 값이 유지됐다. 최초 시험 MAC과 최종 MAC이 다르다는 사실을 true 실패로 해석하지 않도록 각 전환 증적을 함께 보관했다.

VM25와 VR은31-3/32-2의 같은 호스트다. 전체21 VM/63 API NIC·기존 공유/역할/프로젝트 구성원을 보존했고 VM25의 실제 libvirt NIC는31 5개/32 6개다. 기존 Shared router·VM21/22/26·오퍼링/템플릿·이전 시험 자원도 남겼다.

Source NAT 확인용 ICMP egress는 VM25 source/32→같은 host destination/32, type8/code0로 한정해 보관한다. metadata 시험 키는 제거했고 원래 역할/계정·비밀번호·공유 정책을 바꾸지 않았다. DHCP profile이 추가됐다면 non-default/ignore-auto-dns로 보관하며 기존 main default route는 보존했다. 계측 Shared 감시 서비스는 중지했고 host의 임시172.26.x.254 주소는 원래 주소 집합과 대조 후 제거했다. policy route/rule1631도 제거했다.

[31 보존](evidence/31-final-preservation.json) · [32](evidence/32-final-preservation.json) · [31 host 정리](evidence/31-host-control-probe-cleaned.json) · [32](evidence/32-host-control-probe-cleaned.json). 배포 전 전체 JAR 두 개는 WSL /home/ablecloud/work/gn1631-public-mac/backups에 비공개 보관한다. [작업트리 보호 대조](evidence/protected-worktree-verification.json).
