# 확인용 시험 자원

기존 자원을 그대로 보관했다. 별도 삭제 지시 전까지 삭제하지 않는다. 각 r2 VM은 기본 Shared + Isolated/L2/Shared 보조 NIC, 총 4개다.

| 클러스터 | 프로젝트 | r2 VM / 호스트 | 기존 VM |
| --- | --- | --- | --- |
| 31 | [qa-gn1569-31-project](http://10.10.31.10:8080/client/#/project/4dff5213-ca2c-4ee7-8b2b-16c6a0baa6fe) | [qa-gn1569-31-r2-vm](http://10.10.31.10:8080/client/#/vm/3a46124e-fc10-472a-90af-1739982832e3?tab=nics) / ablecube31-3 | [qa-gn1569-31-prj-vm](http://10.10.31.10:8080/client/#/vm/625141be-7145-4557-9d8f-731500c61cb0?tab=nics), 8 NIC |
| 32 | [qa-gn1569-32-project](http://10.10.32.10:8080/client/#/project/0db180fc-4a19-4f9a-b387-00599ffa86c0) | [qa-gn1569-32-r2-vm](http://10.10.32.10:8080/client/#/vm/b594bcaf-bcbf-4145-83b0-0af06586ab04?tab=nics) / ablecube32-2 | [qa-gn1569-32-prj-vm](http://10.10.32.10:8080/client/#/vm/da7f69ed-1948-4927-b377-55beb9c4620d?tab=nics), 8 NIC |

새 망 24개의 목록과 링크는 [직전 회귀의 자원 목록](../guest-network-1569-roles-20261108/resources.ko.md)에 있다. 이번 검증 전후 자원 지문은 완전히 일치한다.

[31 보존](evidence/31-preservation-after.json) · [32 보존](evidence/32-preservation-after.json) · [31 호스트 NIC](evidence/31-host-nics-after.json) · [32 호스트 NIC](evidence/32-host-nics-after.json).
