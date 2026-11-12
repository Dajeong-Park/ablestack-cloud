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

# 설계와 적용 범위

## 실패 경계

`NetworkOrchestrator.createNicForVm`은 신규 NIC와 신규 VM-network 매핑의 소유권을 추적한다. 매핑 생성·네트워크 구현·NIC 준비 중 capacity/resource/runtime 실패에서 이번 할당만 되돌린다. ID/VM/network/UUID를 대조하고 기존 시스템 NIC 재사용은 보존한다. 준비 결과가 null인 경로도 실패 정리 대상이다. 정리 오류는 원래 오류에 suppressed로 남긴다.

`VirtualMachineManagerImpl`은 NIC TO 변환도 정리 경계 안에서 수행한다. 명확한 호스트 거절은 준비 자원을 되돌린다. timeout/agent unavailable/응답 누락은 실제 hotplug 성공 가능성을 버리지 않고 NIC 예약과 private `hotplug.outcome=Unknown`을 보존한다. PVLAN rollback 실패도 불명확 상태로 취급한다. 자동 무한 재시도·다른 기존 NIC 삭제는 하지 않는다.

## API와 UI 계약

`NicResponse.state`는 Cloud NIC의 할당 수명주기다. 새 `attachmentstate`는 알려진 `Unknown`만 내보내며 임의 private detail은 응답에 노출하지 않는다. 기존 권한·project scope와 명령 접근 정책은 유지한다.

`VmNicsTab.vue`는 VM 표준의 목록·태그·툴바·대화상자 구조를 유지하고 상태 열을 분리한다. 기존 `isnicsupported`/관리 설정을 실제 연결 상태로 해석하지 않는다. 실행 중 `Allocated` 및 `Unknown`은 경고하고 안전하지 않은 변경 작업을 가드한다. 연결 해제는 기존 명시적 확인 경로를 유지한다. 백엔드 응답을 근거로 연결 성공을 단정하지 않으며 운영자가 런타임 확인 후 복구할 수 있게 한다.

## 변경 파일과 검증 소유권

제품 변경은 API response/helper, orchestration 두 클래스, VM NIC 탭·상태 유틸, 한글/영문 locale이다. 집중 테스트는 준비 실패의 신규/기존 자원 구분, host negative/unknown/변환 실패/PVLAN 경계, API 필드·private 값 제한, UI 표시·작업 가드다. 기본 보안 정책이나 호스트 네트워크 제공자를 변경하지 않는다.

31에서는 Isolated 구현 실패, 32에서는 Shared 라우터 준비 실패와 정상 복구를 실제 UI로 검증했다. 네트워크 유형 전체 기능이 이번 이슈에서 모두 완료됐다는 의미는 아니다.
