# Skudonet 확인용 자원

신규 VNF2대·루트 볼륨2개·비공개 프로젝트 템플릿2개 및 기존 시험 자원을 삭제하지 않고 보관한다. 새 네트워크는 없다.

| 클러스터 | VNF / 호스트 | 템플릿 | NIC |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-vnf-ui](http://10.10.31.10:8080/client/#/vnfapp/adb32350-7764-489c-a70d-12323eabc24d?tab=nics) / ablecube31-3 | [qa-gn1569-31-vnf-ui-template](http://10.10.31.10:8080/client/#/template/717ac819-2715-4ef1-ab9d-485dd18aac63?tab=vnf.settings) | Isolated 기본 + L2 + Shared, 3개 |
| 32 | [qa-gn1569-32-vnf-ui](http://10.10.32.10:8080/client/#/vnfapp/d4b7e358-98c8-475d-b8aa-893479539a36?tab=nics) / ablecube32-2 | [qa-gn1569-32-vnf-ui-template](http://10.10.32.10:8080/client/#/template/70e17a67-263d-4993-86f4-22904df772da?tab=vnf.settings) | Isolated 기본 + L2 + Shared, 3개 |

| 클러스터 | 연결 네트워크 | IP / MAC | 기본 NIC |
| --- | --- | --- | --- |
| 31 | [qa-gn1594-31-project-nat](http://10.10.31.10:8080/client/#/guestnetwork/e7b218a3-3df0-41d6-abfd-5afc667bfcdf?tab=vnf.appliances) | 10.251.31.98 / `02:1f:02:50:00:01` | True |
| 31 | [qa-gn1594-31-project-l2](http://10.10.31.10:8080/client/#/guestnetwork/3292f7fb-9e94-4a90-95cd-501f653e9d8f?tab=vnf.appliances) | Cloud IP 미관리 / `02:1f:02:51:00:01` | False |
| 31 | [qa-gn1594-31-project-shared](http://10.10.31.10:8080/client/#/guestnetwork/11243734-0f21-4a5a-a771-1770d8ce2d21?tab=vnf.appliances) | 10.246.31.50 / `02:1f:02:52:00:01` | False |
| 32 | [qa-gn1594-32-project-nat](http://10.10.32.10:8080/client/#/guestnetwork/c50abf1a-d037-498a-b29f-bcc5ad4e2d68?tab=vnf.appliances) | 10.251.32.38 / `02:01:01:de:00:01` | True |
| 32 | [qa-gn1594-32-project-l2](http://10.10.32.10:8080/client/#/guestnetwork/dfc7f6c6-0906-48d7-abe6-4a1fe4fe11f3?tab=vnf.appliances) | Cloud IP 미관리 / `02:01:01:df:00:01` | False |
| 32 | [qa-gn1594-32-project-shared](http://10.10.32.10:8080/client/#/guestnetwork/15a7e449-7333-401a-a7f1-448283423553?tab=vnf.appliances) | 10.246.32.58 / `02:01:01:e0:00:01` | False |

각 QA 프로젝트의 primary_storage 한도는200→500GiB이며 나머지 한도/멤버십은 보존했다. 기존 VM3대의16 NIC와 이전 시험 자원도 유지한다. 양쪽 VNF의 API MAC3개가 libvirt와 게스트 QGA 인터페이스에 존재한다.

[31 보존](evidence/31-preservation.json)·[32 보존](evidence/32-preservation.json)·[이전 #1594 자원](../guest-network-1594-20261108/resources.ko.md).
