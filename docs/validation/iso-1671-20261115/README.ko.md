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

# ISO-06 #1671 상세·Zone·작업 대화상자

Epic #1664 · PR #1682 · 개발 순서 6/8 · 2026-11-15 KST.

## 설계

- VM/템플릿 공통 ResourceLayout·탭 스킨·MoldDialog/Actions를 ISO 조건으로 재사용한다. 별도 공통 대화상자 스타일을 만들지 않는다.
- Zone은 고정 도구 영역(일괄 삭제 수·업데이트·우측 검색), 표·저장소 섹션·하단 페이지로 구성한다. 읽기·행·선택·일괄 작업에 같은 ISO-01 ACL 모델을 적용한다.
- Zone 이름 검색은 읽은 모든 Zone을 대상으로 한 뒤 페이지를 나눈다. 데이터 수집이 실패/불완전하면 성공한 빈 목록으로 바꾸지 않는다. 소유자 조회는 self/all 및 현재 프로젝트 범위로 실패 ISO도 포함하며 공유 수신자 읽기 계약은 유지한다.
- Primary/Secondary 섹션, 상태 현지화·progress·미확인 값과 공통 테마 토큰을 사용한다. 정보가 생략되면 저장소 이름·ID·준비 상태를 추정하지 않는다.
- 복사/삭제는 선택 이름·ID·Zone·영향과 개별 결과를 유지한다. copyIso의 copytemplateresponse 계약을 보존하고 접수→job 완료→대상 Zone Ready/삭제 부재를 구분한다.
- 원본·이미 복사 중인 것을 포함한 기존 Zone·중복 목적지는 제외한다. 일부 실패만 명시적으로 재시도한다. 전송 결과가 불확실하면 GET으로 확인하며 자동 POST 재전송은 하지 않는다.
- 대화상자 동안 부모 자동 갱신을 보류하고, busy 중 제출/닫기/뒤로가기를 막는다. 계정·권한·프로젝트·세션 경계 변경 시 기존 작업과 늦은 응답을 폐기한다.
- ISO 상세의 boolean은 예/아니오/알 수 없음, 크기는 적절한 이진 단위와 정확한 byte tooltip, ID/체크섬/URL은 원문 전체와 기존 복사 계약을 사용한다. 템플릿·VM 표현은 바꾸지 않는다.

## 검증 계획

13번 단일 Zone에서 일반 소유자/읽기 전용 역할, Ready·체크섬 실패 ISO, 개별/일괄 삭제, 실패/결과 미확인 복구, 입력/선택/초점, 명암·390px 화면과 공통 화면을 검증한다. 실제 다중 Zone·비KVM은 기존 합의대로 NOT_RUN으로 구분하고 기능을 유지한다. 다중 Zone·중복·부분 실패·job 완료와 Ready 지연은 단위 시나리오로 별도 검증한다.

## 현재 상태

구현·집중 검사 중이며 실제 배포·UI 검증·시험 자원 정리 전이다. 아직 완료 보고가 아니다. 기존 CI 부채 #926·#1044는 별도 OPEN 관리한다.
