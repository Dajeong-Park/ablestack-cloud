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

# #1608 AutoScale 그룹 업데이트 실패 입력 보존

2026-11-10. **31 GFS2·32 Glue(Ceph) RBD에 UI만 배포**하고 실제 비동기431 실패·입력 보존·수정 성공·접수 응답 유실 복구를 확인했다. 제품 커밋 `8f27a55dfeb78a488f56bc5d07070414617f5daf`. Epic 브랜치 `dhslove/epic-1554-guest-networks`·Draft PR [#1577](https://github.com/ablecloud-team/ablestack-cloud/pull/1577)을 유지한다. #1608 구현 범위 완료이며 #1554/#1569 전체는 Open이다.

[원본 캡처 89장](capture-matrix.ko.md) · [확인용 자원/직접 UI 링크](resources.ko.md) · [검증 요약](evidence/summary.json) · [60개 배치](evidence/ui-matrix.json) · [DOM/입력](evidence/ui-state.json) · [로컬 검사](test-results.ko.md).

## 변경한 UI와 VM 표준

변경 대상은 **컴퓨트 > 오토스케일 VM 그룹 > 작업 > 오토스케일 VM 그룹 업데이트**다. 기존 공통 action 창은 job 접수 직후 닫혀 나중에 실패해도 입력을 잃었다. 이 action을 자체 job 추적을 가진 `AutoScaleGroupUpdate.vue`로 연결했다.

- VM 메뉴의 **MoldDialog(md 720px)·세로 폼·하단 취소/확인·본문 스크롤·모바일 폭·테마 색상**을 적용했다. 이름/최소/최대/비활성 그룹의 폴링 주기를 한 열로 배치했다. 별도 리본이나 본문 중복 제출 버튼은 없다.
- 서버 스냅샷과 편집 초안을 분리했다. 실패하면 **창·모든 입력·서버 오류 코드/문구를 유지**한다. 부모 목록/상세 새로고침으로 초안을 덮지 않는다. 사용자가 명시적으로 누르는 **reload 아이콘+‘서버 값 다시 불러오기’**만 서버 값으로 초기화한다.
- 성공(jobstatus1) 후에만 창을 닫고 상세를 갱신한다. 진행 중 중복 제출·닫기/Escape를 막는다. 확정 실패(jobstatus2)는 초안을 편집해 재시도할 수 있다.
- 접수/조회 결과가 불확실하면 초안·작업 ID를 유지하고 수정/재전송을 막는다. 하단 동작은 **‘작업 결과 다시 확인’**으로 바뀌고 기존 ID를 조회한다. 닫기/다시 열기·새로고침·프로젝트 왕복 후 같은 사용자/역할/프로젝트/그룹 문맥에서 복구한다.
- 기존 API의 `customjobid`를 사용해 접수 전에 복구 ID를 만든다. pending/unknown의 ID·초안만 sessionStorage에 보관하며 인증 토큰/비밀 정보는 저장하지 않는다. 프로젝트·역할·경로·권한/로그인 문맥 변경 시 창을 종료하고 이전 callback을 폐기한다. 기존 서버 검증·API 권한·보안 정책은 유지하며 API/Java 변경은 없다.

## 실제 UI·API 결과

| 경로 | 31·32 결과 |
| --- | --- |
| 개선 전 재현 | 정책 duration60에 interval120을 UI 제출 → 실제 job2/431. 창이 닫히고 재개방 시 서버60으로 돌아가 초안 유실. 개선 전 캡처/서버 job 보관 |
| 개선 후 실제 실패 | 이름 `qa-gn1608-{31,32}-review`, 최소/최대1, interval120 제출 → job2/431. 창과 이름/1/1/120·오류 문구 유지, 다시 편집 가능. 서버는 이전 이름/interval60 유지 |
| 같은 창에서 보정 | interval만60으로 고쳐 제출 → 각각 job1. 성공 후 창 닫힘·상세/서버 이름·60 일치, DISABLED·멤버1/Running 유지 |
| 접수 응답 유실 | 실제 update POST의 HTTP200 **응답 단계**에서 해당 그룹 XHR만503으로 대체. 이어 해당 custom ID 조회3회만503 → 결과 불확실·입력 readonly·작업 ID·재확인 버튼 유지. 서버 update는 실제 접수/성공 |
| 재조회 복구 | 가로채기를 제거한 뒤 같은 custom ID job1 확인. 31은 재확인 버튼, 32는 취소→기본 보기→원 프로젝트→재개방으로 복구. 복구 구간 updateAutoScaleVmGroup **0건**, query ID가 원 접수 ID와 일치. 완료 후 창 닫힘 |
| 프로젝트·화면 이동 | 양쪽 기본 보기/원 프로젝트 왕복. 목록→상세 운영 탭→수정→취소→VM NIC/기존 네트워크 연결 창 이동. 취소한120 초안이 새 편집 창에 남지 않고 서버60으로 시작 |

[31 최종 서버/job/요청/호스트](evidence/31-final-verification.json) · [32 최종](evidence/32-final-verification.json) · [31 접수 유실 proof](evidence/31-loss-proof.json) · [32 proof](evidence/32-loss-proof.json). 실제 실패431은 통제된 실패가 아닌 서버 정책 검증 결과다. 503은 브라우저에서 한정한 복구 시험이며 서버 API/설정·DB를 수정하지 않았다.

31의 최초 가로채기 설정은 POST command가 URL 아닌 본문에 있어 응답 유실을 만들지 못하고 조회 timeout만 재현했다. 이 정상 접수 job(`c7ca4b21-31bc-44cb-9119-65f76c1fb0d3`)은 기존 ID로 성공 확인 후 종료했다. 이후 첫 응답 유실 job(`0a66317b-2cc9-4186-bb52-1dde8c8c2191`)도 프로젝트 왕복/새로고침 후 복구했으나 요청 버퍼 일부가 만료돼 횟수 증거로 사용하지 않았다. 최종 양쪽 증거는 accepted 응답/3회 조회 실패와 별도 복구 구간 기록으로 판정한다. 추가 정상 업데이트는 같은 이름/1/1/60이며 새 자원 생성·중복 VM 배포는 없다.

## 반응형·즉시 테마·표준 비교

**31/32 ×라이트/다크 ×390/768/1280px ×5화면(그룹 목록·상세 운영 탭·업데이트 창·VM NIC 기준·VM 기존 네트워크 연결 창)=60개 검사 통과.** 페이지 가로 넘침0, sticky breadcrumb 폭/위치, 대화상자/footer viewport 범위를 확인했다. 표 내부 스크롤은 허용한다. 원본 모바일 라이트·태블릿 다크 캡처를 열어 입력/설명/오류/하단 버튼 가독성을 확인했다. VM 메뉴 자체 스타일을 변경한 것은 아니며 해당 화면을 비교 기준으로 사용했다.

실제 페이지 스타일 메뉴로 양쪽 라이트↔다크를 즉시 전환했다. 다크 전환 전/후 `performance.timeOrigin` 동일로 새로고침 없음을 확인했다. 캡처 **89장 모두 native JPEG·live viewport·디코딩 치수·해시 일치**다. 시험용 XHR 대체/viewport override는 제거했고,31 리뷰 업데이트 창(미제출60)·32 운영 탭을 남겼다.

## 빌드·배포·자원 보존

- WSL rocky ext4 `/home/ablecloud/work/dhslove/cloud-epic-1554/ui`에서 로컬 lint·**6 suites/174 tests(새19개)**·production UI 빌드 성공. 전체 Cloud/Maven/수동 Actions 실행 없음.
- 활성 `/usr/share/cloudstack-management/webapp`에 정적664파일 반영. 양쪽 해시 불일치0·WEB-INF/META-INF·관리 JAR/PID·서버 설정·대형 템플릿 보존·HTTP200. 마지막 SSH 확인에서도 활성 bundle 표식/index 해시가 일치한다.
- 백업 `/var/tmp/gn1608-ui-20261110-002451`, WSL `/home/ablecloud/work/gn1608-ui/backups/20261110-002451/{31,32}/static-backup.tar.gz`. [배포31](evidence/31-deployment.json) · [배포32](evidence/32-deployment.json) · [manifest](evidence/manifest.json).
- **자원 생성·삭제0**. 기존31 망115/VM157·32 망98/VM85의 ID·상태·NIC·호스트, 기존 AS 그룹(대상 이름만 의도적 변경), LB8개 설정/연결 대상·NIC 보존. 통계 샘플 시각/CPU 등의 자연 변동은 구성 변경 비교에서 제외한다. 각 대상 멤버는 호스트 libvirt Running/domain UUID까지 대조했다.
- 리뷰 그룹은 DISABLED·최소1/최대1/주기60, 각 기존 멤버1은 Running/LB연결 상태로 보관한다. 다른 #1607 저장 데이터 그룹과 기존 네트워크/VNF/VPC/Shared 시험 자원도 유지한다. LB 백엔드 부하분산 측정은 제외했다.

## 다음 순서

1. #1606·#1607·#1608 구현/해당 범위 검증 완료. #1608을 완료로 닫는다.
2. **#1569 조건부 통합**: 실제 VPN 클라이언트/VPC S2S, 제공자가 준비된 Health Monitor부터 검증한다.
3. 외부/VPC/Internal LB·네트워크 오퍼링 조합·잔여 역할/환경 조건을 검증한다. LB 분산 성능 측정은 제외한다.
4. 63행 UI/API/실제 통신/역할 증적을 최종 통합한다. C06/P08의 이번 결함은 해결했으나 미완료 조건이 있어 **실패→부분**으로만 갱신한다. 양쪽 부분54·환경차단6·적용제외3, 전체 완료 행0. #1554/#1569 및 Draft PR은 유지한다.
