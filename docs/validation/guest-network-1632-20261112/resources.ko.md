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

# 확인용 자원·응답자·정리 범위

아래 시험 자원은 남겨 두었다. VM/네트워크/VR/VPN 사용자·LB·인증서는 사용자 확인 후 별도 삭제 지시를 기다린다. 최종21 VM/63 NIC는 시작 전과 동일하며 계정/프로젝트 권한을 변경하지 않았다. 새 UI 인증서 등록과 전용 LB 인증서 연결만 추가/갱신했다.

| 사이트 | 프로젝트 | TLS endpoint | VR / host | 현재 인증서 ID | UI 작업 ID |
| --- | --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg | 10.10.31.149:19111 | r-1024-VM / ablecube31-3 | `f62b72ac-6991-4aa4-8b78-4734c7b5ac66` | `368a1aca-d0a9-4738-be5b-579e37be14b4` |
| 32 | qa-gn1569-32-shared-reg | 10.10.32.177:19111 | r-499-VM / ablecube32-2 | `44a59880-7190-4dda-99b6-b5ab18270fe0` | `1582cd8f-b89e-4d0b-b1f9-f6462e902235` |

양쪽 현재 이름은 `qa-gn1632-31-ui-recovery` / `qa-gn1632-32-ui-recovery`다. 프로젝트 인증서 탭2쪽에서 확인할 수 있고 관리자 브라우저 탭을 열어 두었다. 기존 원래 인증서는 미할당 상태로 보존했다. API 기본 true의 정상 대조 인증서들과 false 대조도 미할당으로 유지했다. false는 정상 기본 검사의 대체 수단이 아니다.

초기 역할 탐침 이름 `qa-gn1632-*-readOnly-denied`, `qa-gn1632-*-deny-rejected`는 실제 기존 역할에 해당 upload 거부 규칙이 없어 허용된 자원이다. 이름을 거부 결과로 해석하지 않는다. API/실제 역할 표를 함께 제공했다.

## 공개 CRL/OCSP 시험 helper의 한정 수명

31 관리서버 `http://10.10.31.10:20683`, unit `qa-gn1632-revocation-public`, 디렉터리 `/var/tmp/qa-gn1632-revocation-public`를 보존했다. 최종 mode=normal, active/running이다. 공개 응답/인증서 파일만 있으며 CA/leaf 개인 키는 없다. 방화벽은31/32 관리서버와 시험 client 주소로 한정했고 양쪽 설정은 정확한 origin 하나다. [최종 상태/파일 hash](evidence/responder-final-state.json).

helper는 **2026-11-12 15:30:16 KST 재시작부터24시간 자동 종료** 설정이다. CRL/OCSP nextUpdate도 한정된 시험 값이다. 확인용 자원 자체를 자동 삭제하지 않으며 등록된 LB 인증서의 수명과도 별개다. 재등록 시험을 나중에 반복하려면 WSL 비공개 CA로 응답을 갱신한 뒤 공개 파일만 배치하고 같은 제한 unit을 재개해야 한다. 전역 검사 false나 시계 변경으로 우회하지 않는다. 이번 공개 보고에 개인 키/CA/인증서 원문을 넣지 않았다.

## 승인된 용량 정리

32의 기존 `/root`·`/home/ablecloud`·`/var/tmp`에서 식별한 시험 배포/백업228개 direct-child 경로만 삭제했다. realpath·symlink·활성 JAR inode·WEB-INF 전후 검사를 수행했다. 삭제 전 여유20KiB에서 27.48GiB로 회복했고 27.48GiB를 확보했다. [정확한 제거 목록과 전후](evidence/32-test-deployment-backup-cleanup.json).

이 영수증의 current1632HelperPreserved=false는32의 미존재 helper 경로 검사 값이다. 현 helper는 이후31에 생성했으며 삭제 대상 패턴에 포함되지 않았다. 활성 webapp/JAR/DB/SSH·VM/네트워크를 삭제한 뜻이 아니다.

이번 배포 원본 JAR과 정적 rollback은 WSL ext4 비공개 stage에 검증 보관했다. 양쪽 관리서버의 임시 이전 JAR hardlink만 최종 해제했다.32 최종 여유 27.14GiB다. 새로운 대용량 영구 백업을 관리서버 root에 쌓지 않았다. 최종 외부 WSL VPN 시험 daemon/터널은 시작 전 비활성 상태로 되돌렸으며 서버 VPN 서비스/사용자는 보존했다.
