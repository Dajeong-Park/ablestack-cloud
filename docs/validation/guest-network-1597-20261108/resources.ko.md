# 확인용 시험 자원

Mold 관리자 로그인 후 아래 새 프로젝트를 선택한다. 기존 `qa-gn1569-*` 프로젝트500GB 한도와 VM5대/21 NIC를 유지했으며 새 프로젝트별150GB 한도에서 VNF1대/루트 볼륨100GB/기본 NIC1을 보관한다.

| 클러스터 | 프로젝트 | VNF | 상태/호스트 | IP/MAC |
| --- | --- | --- | --- | --- |
| 31 | [qa-gn1597-31-project](http://10.10.31.10:8080/client/#/project/ded3436a-00a8-4043-990d-69200d9a321b) | [qa-gn1597-31-project-vnf](http://10.10.31.10:8080/client/#/vnfapp/b1a6c573-8c82-4fe8-9537-07e2cd96c1fc?tab=nics) | Running / ablecube31-1 | 10.253.31.220 / 02:19:97:31:00:01 |
| 32 | [qa-gn1597-32-project](http://10.10.32.10:8080/client/#/project/97f62088-fc46-4d21-acfa-fa47a2d137b1) | [qa-gn1597-32-project-vnf](http://10.10.32.10:8080/client/#/vnfapp/812c5dcc-a538-4a58-be86-6e3dcbbc773a?tab=nics) | Running / ablecube32-1 | 10.253.32.220 / 02:19:97:32:00:01 |

각 새 프로젝트에는 `qa-gn1597-{c}-project-nat` 망1개와 `qa-gn1597-{c}-project-template` 비공개 Skudonet 템플릿1개를 보관한다. 기존 공유 권한은 원상 복원했다. 전용 `qa-gn1597-{c}-ip-read-only` 역할은 IP 조회 API 하나만 허용하며 member/nonmember/outside 시험 계정3개씩을 보관한다. member만 기존 QA 프로젝트의 Regular 멤버로 추가했다. 원래 역할 permission은 변경하지 않았다.

[31 보존/작업 대조](evidence/31-preservation.json) · [32 보존/작업 대조](evidence/32-preservation.json) · [31 전용 읽기 역할/계정](evidence/31-security-fixtures.json) · [32 전용 읽기 역할/계정](evidence/32-security-fixtures.json). 삭제는 별도 지시 후 수행한다.
