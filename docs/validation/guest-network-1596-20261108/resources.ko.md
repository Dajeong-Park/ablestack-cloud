# 확인용 시험 자원

각 `qa-gn1569-31-project` / `qa-gn1569-32-project`를 선택한다. 새 VM·망은 만들지 않았다. #1595 프로젝트 VNF에 기존 소유자 공유 L2를 UI로 하나씩 연결했으며 두 연결 NIC를 남겼다. 원래 기본 NIC와 IP·MAC·호스트·상태는 그대로다. 공유는 원래의 프로젝트+peer 계정 2개 항목으로 복원했다.

| 클러스터 | VNF 상세 | 보관 상태 |
| --- | --- | --- |
| 31 | [qa-gn1569-31-vnf-ui](http://10.10.31.10:8080/client/#/vnfapp/adb32350-7764-489c-a70d-12323eabc24d?tab=nics) | 기존 Isolated/L2/Shared 3 NIC, 변경 없음 |
| 31 | [qa-gn1595-31-project-vnf](http://10.10.31.10:8080/client/#/vnfapp/700bca14-4b49-4728-b915-345f87b3a153?tab=nics) | Running / ablecube31-3 / 기존 NAT + 공유 L2 = 2 NIC |
| 32 | [qa-gn1569-32-vnf-ui](http://10.10.32.10:8080/client/#/vnfapp/d4b7e358-98c8-475d-b8aa-893479539a36?tab=nics) | 기존 Isolated/L2/Shared 3 NIC, 변경 없음 |
| 32 | [qa-gn1595-32-project-vnf](http://10.10.32.10:8080/client/#/vnfapp/fc92af85-adce-4690-a746-9fee3cb3af0e?tab=nics) | Running / ablecube32-2 / 기존 NAT + 공유 L2 = 2 NIC |

양쪽 QA 프로젝트는 VM5대·NIC21개이고 보이는 망은31=45개,32=46개다. 기존 3 NIC VNF·이전 개인 VNF·VM·볼륨·템플릿·시험망은 보존했다. 연결 작업 UUID와 전체 기존 자원/권한/한도 대조는 [31 감사](evidence/31-preservation.json)와 [32 감사](evidence/32-preservation.json)에 있다. 삭제는 별도 지시 때 수행한다.
