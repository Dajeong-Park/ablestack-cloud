# 확인용 시험 자원

VNF4대·루트 볼륨4개·개인 비공개 VNF 템플릿2개·개인 Isolated 망2개·프로젝트 User Data2개를 보관한다. 개인 자원은 기본 보기/admin, 프로젝트 자원은 `qa-gn1569-31-project` 또는 `qa-gn1569-32-project`를 선택해 확인한다. 기존 #1569의 각3 NIC VNF와 이전 VM·망도 유지했다.

| 클러스터/소유 | VNF | 상태/호스트 | IP/NIC |
| --- | --- | --- | --- |
| 31 프로젝트 | [qa-gn1595-31-project-vnf](http://10.10.31.10:8080/client/#/vnfapp/700bca14-4b49-4728-b915-345f87b3a153?tab=nics) | Running / ablecube31-3 | 10.251.31.119 / 기본 NIC1 |
| 31 개인(admin) | [qa-gn1595-31-personal-vnf](http://10.10.31.10:8080/client/#/vnfapp/90544e97-4478-4459-8505-3a91529b741d?tab=nics) | Running / ablecube31-1 | 10.253.31.242 / 기본 NIC1 |
| 32 프로젝트 | [qa-gn1595-32-project-vnf](http://10.10.32.10:8080/client/#/vnfapp/fc92af85-adce-4690-a746-9fee3cb3af0e?tab=nics) | Running / ablecube32-2 | 10.251.32.245 / 기본 NIC1 |
| 32 개인(admin) | [qa-gn1595-32-personal-vnf](http://10.10.32.10:8080/client/#/vnfapp/55bd5dec-d12f-4d0a-b206-5ee064548252?tab=nics) | Running / ablecube32-2 | 10.253.32.34 / 기본 NIC1 |

새 개인 템플릿은 제공된 Skudonet URL로 등록한 비공개 KVM/QCOW2/VNF이며 Management/device0/required 설정이다. 기존 프로젝트 템플릿은 재사용했다. 신규 망은 `qa-gn1595-{31,32}-personal-nat`, User Data는 `qa-gn1595-{31,32}-userdata`다. 등록 데이터는 시험용 빈 cloud-config 주석이며 외부 인증 정보가 없다. 프로젝트 한도500GiB·망50은 변경하지 않았다.
