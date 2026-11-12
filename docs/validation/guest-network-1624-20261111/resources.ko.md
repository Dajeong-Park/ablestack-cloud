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

# 확인용 보관 자원

별도 삭제 지시까지 시험 네트워크·VM/NIC·LB·VPN·역할을 남긴다. 이번에 새 계정/역할/키는 생성하지 않았다.

| 클러스터 | 프로젝트 | 네트워크 | 새 라우터·호스트 | TLS |
| --- | --- | --- | --- | --- |
| 31 | qa-gn1569-31-shared-reg | qa-gn1569-31-vpn-lb / `43c8f6f5-8893-4a1c-bfaa-a569acaf44bb` | r-1020-VM / `44ab71eb-5d2e-4cf3-9dcf-5fa2e2fb393b` / ablecube31-3 | 10.10.31.149:19111→18443 |
| 32 | qa-gn1569-32-shared-reg | qa-gn1569-32-vpn-lb / `b7cd0439-ed95-4e7d-8b31-eb0ebacbd711` | r-490-VM / `f51cb34d-80db-4578-b2c0-8968dd5868e4` / ablecube32-2 | 10.10.32.177:19111→18443 |

관리자로 해당 프로젝트 선택 → 인프라스트럭쳐 > 가상 라우터 > 새 라우터 > 상태 체크에서 확인한다. `Health check 결과 가져오기` > 새로운 검사 수행 켜기 > 확인을 실행하면 haproxy_check.py SUCCESS/All checks pass와15개 결과를 볼 수 있다. 업데이트는 캐시된 결과 조회다.

기존 시험 VM qa-gn1569-31-vpn-lb-vm / qa-gn1569-32-vpn-lb-vm과 원래 인증서·LB/VPN 설정을 유지했다. 기존 라우터 r-1019/r-489만 전용 시험망 cleanup restart로 교체했다. 이 작업 중의 일시 단절을 무중단 배포 성공으로 합산하지 않았다.

원래 archive는 WSL ext4 `/home/ablecloud/work/gn1624-haproxy-health/backups/`에 내구 보관했다. 각 서버 `/var/tmp/gn1624-haproxy-health/`에 원본 checker/archive 백업을 두었다. UI 배포 영수증에 기존 static 백업 경로가 있다. 공개 문서/증거에는 비밀번호·PSK·키·세션·전체 HAProxy config를 포함하지 않았다.
