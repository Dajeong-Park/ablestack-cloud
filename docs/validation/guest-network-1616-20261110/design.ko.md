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

# 원인과 안전한 복구 설계

1. **자원 부족:**31 VPC SourceNat 할당이 기존 Public IP 풀 소진으로 실패했다. warm VM 배치530의 내부 원인도 CPU/메모리 부족이 아니라 `InsufficientVirtualNetworkCapacityException: Unable to allocate vnet`이었다. 오래된 NAT 망을 정상 삭제해 VLAN176을 반환하고 첫 대조 Tier를 구현했다.
2. **실패 정리 재진입:** 철회는 메모리 규칙을 Revoke로 바꾼다. DB에 Add/Active로 보인다는 사실만으로 실제 호출의 규칙 상태를 판단할 수 없다. InternalLoadBalancerElement의 Revoke-only 경로는 기존 Running VM만 찾아 적용하며 없으면 정리할 대상이 없는 것으로 끝낸다. Active/혼합 규칙과 적용 실패는 기존 오류 전달을 유지한다.
3. **정상 최초 시작 재진입:** 같은 VM이 네트워크 Implementing 중 자기 VmWorkStart를 다시 호출할 때만 시작을 유예한다. 현재 async job이 base VO이면 VmWorkJobDao의 typed row로 VM id를 확인한다. 직렬화된 작업 인자/인증 정보를 파싱하지 않는다. 다른 VM/다른 명령/문맥 없음/외부 Starting은 성공 처리하지 않는다. 시작 완료 경로가 저장 규칙을 HAProxy에 적용한 뒤 Running이 된다.
4. **실패 Tier 잔류:** v1은 job2를 빠르게 반환했지만 Shutdown/check_for_gc=0으로 남았다. 최종 a1은 VM 작업이 풀린 뒤 안전 조건을 검사해 정상 shutdownNetwork로 Allocated까지 끝낸다. 이전 실패 자원의 다음 시도 전에도 같은 복구를 수행한다. User NIC>0, controller Starting/Running 등 불안정 상태, pending VM work가 있으면 거부하며 원래 시작 오류를 가리지 않는다. DB 상태 강제 갱신과 전체 네트워크 GC 설정 변경은 없다.

수정은 InternalLoadBalancerElement/VMManagerImpl 두 제품 클래스다. 테스트3파일과 기존 테스트 bean 설정1파일을 추가/보완했다. Revoke6·자기 job8·실패 복구8검사와 기존40검사를 모두 통과했다. 집중 mock 검사는 동시성 전체를 증명하지 않으므로 실제 자원 부족·VM job·재시도·게스트 NIC/HAProxy 결과를 함께 남겼다.

[실패/복구 선별 로그](evidence/31-final-startup-and-recovery-selected.json) · [최초 시작31](evidence/31-allocated-start-selected.json) · [최초 시작32](evidence/32-allocated-start-selected.json) · [최종 정리0](evidence/31-final-failed-start-no-residuals.json).

## 배포와 롤백

최종 제품 a1a44f18272의 두 .class만 기존 fat JAR에 반영했다. JAR SHA256 `cb8790a671e199152900e9a5a6d1495ce456baa8b945169309a262ac03cc6f31`. 각 관리 서비스를 재시작했고 active/HTTP/API/정적670파일을 재확인했다. 기존 관리 webapp 전체 교체/삭제는 하지 않았다. WEB-INF는 양쪽 존재하며 META-INF는 최종 조회 양쪽 부재다. 배포 전후 webapp 보호 경로는 동일했다.

기존 JAR 전체는 WSL ext4 `/home/ablecloud/work/gn1616/backups/`에 SHA 이름으로 보관했다. 최초 `6999ab4695027faa6dedff0ca4fe1a25f5a24a109346babb11cbe8c48adf6f97.jar`, v1 `17f8a0d85acb5b0a6b28743e0c6a5fd0d681f4c101e5b218df94d6b350cbab03.jar`. 최종 직전 원격 RAM 백업 경로는 배포 receipt에 있다. RAM 파일은 재부팅 시 사라지므로 durable WSL 백업을 롤백 기준으로 한다. 32 디스크 여유를 고려해 기존 서버 백업을 삭제하지 않았다.

[31 배포](evidence/31-backend-deployment.json) · [32 배포](evidence/32-backend-deployment.json) · [31 최종 감사](evidence/31-final-deployment-audit.json) · [32 최종 감사](evidence/32-final-deployment-audit.json).
