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

# #1697 로컬 업로드 설계

로컬 API의 arch를 x86_64/aarch64/s390x로 검증하고 내부 GetUploadParamsForIsoCmd에 전달합니다. 기본값은 기존 x86_64를 유지합니다. 버전 등록 메서드에 KUBERNETES.VERSION.ADD를 선언하고 생성된 버전 UUID를 감사 리소스로 연결합니다. child ISO 이벤트와 구분합니다. DB 스키마 변경은 없습니다.

새 UploadKubernetesIso는 운영 MoldDialog를 사용합니다. API 요청 전에 정확히 하나의 비어 있지 않은 ISO 파일·이름·Zone·버전·CPU/RAM·체크섬·지원 arch를 검증합니다. 교체·제거는 자원을 만들지 않으며 다중 선택을 거절합니다. Edge는 로컬 전송 대상에서 제외합니다.

티켓 발급·인증서 연결 확인·전송·서버 준비는 별도 단계입니다. 실제 전송 Promise를 await하고100% 전송을 Ready로 해석하지 않습니다. parent는 반환된 child ISO UUID와 저장 옵션을 대조해 찾고, 일반 ISO 관측 모델로 준비를 재조회합니다.

티켓은 런타임 메모리에만 둡니다. 만료 전송을 막고, 시도한 일회성 링크는 실패/중단 후 재사용하지 않습니다. 인증서 사전 확인만 실패한 경우에는 미사용 티켓으로 재시도합니다. 인증서 신뢰는 브라우저의 정상 절차를 따릅니다.

계정/역할/API/프로젝트/세션 변경과 컴포넌트 종료 시 업로드를 중단하고 티켓을 폐기하며 늦은 응답을 무시합니다. 같은 탭의 기존 해시 보호에 로컬 모드·파일 식별을 추가해 미완료 양식 재열기가 새 티켓을 발급하지 않게 합니다. URL·서명·티켓·세션 원문은 저장하지 않습니다.

실패 뒤 결과 확인은 기존 ISO/버전을 읽기만 하며 자동 삭제·자동 재등록하지 않습니다. 연결 ISO가 기존 클러스터/업그레이드에 참조된 경우 서버의 기존 삭제 잠금을 유지합니다. parent/ISO 이동으로 명시적으로 확인·정리합니다.

13번에서 실제4.21과4.23 agent/secondary 런타임을 각각 확인하고 UI 파일 전송·Ready·x86_64/aarch64 저장·버전 ADD 감사·정리를 검증해야 합니다. OS 이미지 릴리스와 실제 JAR 계열은 따로 기록합니다. ARM 메타데이터 시험을 물리 ARM 부팅으로 주장하지 않습니다. 최종4.23 factory/SSVM을 복구하고 콘솔 VM을 보존합니다.

배포는 기존 운영 UI 입력의 이번 변경만 적용하고 관리 서버 JAR의2개 변경 클래스만 반영합니다. Agent/전체 서버 패키지를 배포하지 않습니다. 임시 SystemVM bootstrap은 검증 목적이며 원래 값으로 복원합니다. 기존 CI 부채 #926·#1044는 별도로 유지합니다.
