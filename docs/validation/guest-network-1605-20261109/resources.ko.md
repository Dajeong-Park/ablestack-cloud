# 유지한 확인용 시험 자원

| 클러스터 | 프로젝트 | Shared 네트워크 | 확인용 VM |
|---|---|---|---|
| 31 (GFS2) | qa-gn1569-31-shared-reg | 87601b32-f211-4609-819f-6d0f4810b788 | qa-gn1569-31-shared-reg-vm24 / 4d8dc91e-db04-4d4a-b53b-0275fe680e67 |
| 32 (RBD) | qa-gn1569-32-shared-reg | a57a394e-71a6-4748-9fc3-9bcdc40ed3bd | qa-gn1569-32-shared-reg-vm24 / dc8437d4-834a-4120-8958-d501fb96895a |

VM24의 제어 L2 기본 NIC는 172.26.31.24 / 172.26.32.24, Shared 보조 NIC는 10.247.31.54 / 10.247.32.54다. VM21·22·23과 Shared 라우터·ConfigDrive 시험 VM·VPC/Tier/실패 보존 태그도 이전 #1569 확인 상태로 유지한다. 이번 UI 작업에서 시험 자원 삭제나 네트워크 변경은 수행하지 않는다.

- [31번 Shared 상세](http://10.10.31.10:8080/client/#/guestnetwork/87601b32-f211-4609-819f-6d0f4810b788)
- [32번 Shared 상세](http://10.10.32.10:8080/client/#/guestnetwork/a57a394e-71a6-4748-9fc3-9bcdc40ed3bd)
- [31번 VM24 NIC](http://10.10.31.10:8080/client/#/vm/4d8dc91e-db04-4d4a-b53b-0275fe680e67?tab=nics)
- [32번 VM24 NIC](http://10.10.32.10:8080/client/#/vm/dc8437d4-834a-4120-8958-d501fb96895a?tab=nics)
