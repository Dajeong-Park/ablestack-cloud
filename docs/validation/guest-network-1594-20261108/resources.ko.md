# #1594 확인용 시험 자원

별도 삭제 지시 전까지 아래 새 네트워크 18개와 VM 2개를 유지한다. 이전 시험 자원도 보존했다.

| 클러스터 | QA 프로젝트 | 새 VM / 호스트 | NIC |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-project](http://10.10.31.10:8080/client/#/project/4dff5213-ca2c-4ee7-8b2b-16c6a0baa6fe) | [qa-gn1594-31-owner-vm](http://10.10.31.10:8080/client/#/vm/c655dfeb-fc4e-4bbc-8f61-2e038160089f?tab=nics) / ablecube31-3 | 기본 Shared + 새 Isolated/L2/Shared, 4 NIC |
| 32 | [qa-gn1569-32-project](http://10.10.32.10:8080/client/#/project/0db180fc-4a19-4f9a-b387-00599ffa86c0) | [qa-gn1594-32-owner-vm](http://10.10.32.10:8080/client/#/vm/5aa20e59-56c9-45cb-a144-54bfe5957a1d?tab=nics) / ablecube32-2 | 기본 Shared + 새 Isolated/L2/Shared, 4 NIC |

| 클러스터 | 생성 문맥 | 네트워크 | 유형 | 실제 계정 / 프로젝트 |
| --- | --- | --- | --- | --- |
| 31 | project | [qa-gn1594-31-project-nat](http://10.10.31.10:8080/client/#/guestnetwork/e7b218a3-3df0-41d6-abfd-5afc667bfcdf) | Isolated | qa-gn1569-31-project |
| 31 | project | [qa-gn1594-31-project-l2](http://10.10.31.10:8080/client/#/guestnetwork/3292f7fb-9e94-4a90-95cd-501f653e9d8f) | L2 | qa-gn1569-31-project |
| 31 | project | [qa-gn1594-31-project-shared](http://10.10.31.10:8080/client/#/guestnetwork/11243734-0f21-4a5a-a771-1770d8ce2d21) | Shared | qa-gn1569-31-project |
| 31 | personal | [qa-gn1594-31-personal-nat](http://10.10.31.10:8080/client/#/guestnetwork/39b8498b-8e86-4c94-a9f6-7e9ec95b6e23) | Isolated | qa-gn1569-31-owner |
| 31 | personal | [qa-gn1594-31-personal-l2](http://10.10.31.10:8080/client/#/guestnetwork/82f8f50c-63f5-482a-871c-bc1fb2157031) | L2 | qa-gn1569-31-owner |
| 31 | personal | [qa-gn1594-31-personal-shared](http://10.10.31.10:8080/client/#/guestnetwork/5afa6953-f5e6-4647-b7df-64db3ed10863) | Shared | qa-gn1569-31-owner |
| 31 | vm | [qa-gn1594-31-vm-nat](http://10.10.31.10:8080/client/#/guestnetwork/d8ac9ffd-3295-4c8b-a8a0-1450b9063743) | Isolated | qa-gn1569-31-project |
| 31 | vm | [qa-gn1594-31-vm-l2](http://10.10.31.10:8080/client/#/guestnetwork/ab761ff0-5a40-47cc-911a-6180b1470b98) | L2 | qa-gn1569-31-project |
| 31 | vm | [qa-gn1594-31-vm-shared](http://10.10.31.10:8080/client/#/guestnetwork/746ecad7-83e8-4ccb-84cf-2088cad0082d) | Shared | qa-gn1569-31-project |
| 32 | project | [qa-gn1594-32-project-nat](http://10.10.32.10:8080/client/#/guestnetwork/c50abf1a-d037-498a-b29f-bcc5ad4e2d68) | Isolated | qa-gn1569-32-project |
| 32 | project | [qa-gn1594-32-project-l2](http://10.10.32.10:8080/client/#/guestnetwork/dfc7f6c6-0906-48d7-abe6-4a1fe4fe11f3) | L2 | qa-gn1569-32-project |
| 32 | project | [qa-gn1594-32-project-shared](http://10.10.32.10:8080/client/#/guestnetwork/15a7e449-7333-401a-a7f1-448283423553) | Shared | qa-gn1569-32-project |
| 32 | personal | [qa-gn1594-32-personal-nat](http://10.10.32.10:8080/client/#/guestnetwork/79680906-8028-4e2d-81b0-ebe59ad0e88b) | Isolated | qa-gn1569-32-owner |
| 32 | personal | [qa-gn1594-32-personal-l2](http://10.10.32.10:8080/client/#/guestnetwork/ef224b7a-068a-4769-a134-affc926ecaca) | L2 | qa-gn1569-32-owner |
| 32 | personal | [qa-gn1594-32-personal-shared](http://10.10.32.10:8080/client/#/guestnetwork/f50fec93-0b1a-443d-9007-b5d9ee4aa6c4) | Shared | qa-gn1569-32-owner |
| 32 | vm | [qa-gn1594-32-vm-nat](http://10.10.32.10:8080/client/#/guestnetwork/9b172331-4eb7-4eab-9586-664ad5fe3eff) | Isolated | qa-gn1569-32-project |
| 32 | vm | [qa-gn1594-32-vm-l2](http://10.10.32.10:8080/client/#/guestnetwork/395d6dad-c006-4b42-97cd-f061215148e6) | L2 | qa-gn1569-32-project |
| 32 | vm | [qa-gn1594-32-vm-shared](http://10.10.32.10:8080/client/#/guestnetwork/832dd4b1-33b2-4ada-b2e1-2b77a7d73230) | Shared | qa-gn1569-32-project |

개인 3개·프로젝트 3개·VM 생성 3개가 클러스터별로 존재한다. VM 생성 망 3개에만 새 VM 보조 NIC를 연결했다. 나머지 생성 망은 소유 문맥 검증용이다. Shared는 각 문맥의 새 L2와 associatednetwork로 연결된다.

기존 시험망/VM 목록은 [직전 역할 회귀](../guest-network-1569-roles-20261108/resources.ko.md)에 있으며 보존 결과는 [31](evidence/31-preservation.json)·[32](evidence/32-preservation.json), 새 VM 호스트 MAC 일치는 [31](evidence/31-host-nics.json)·[32](evidence/32-host-nics.json)에 있다.
