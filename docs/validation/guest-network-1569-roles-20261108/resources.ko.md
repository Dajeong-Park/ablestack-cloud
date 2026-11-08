# 확인용 자원 (삭제 대기)

관리자로 로그인해 해당 QA 프로젝트를 선택한다. 새 r2 VM은 각 4 NIC이고 기존 검증 VM은 각 8 NIC를 유지한다. 이 보고 이후 별도 삭제 지시 전까지 보관한다.

| 클러스터 | 프로젝트 | 새 검증 VM | 호스트 | 기본 IP |
| --- | --- | --- | --- | --- |
| 31 | [qa-gn1569-31-project](http://10.10.31.10:8080/client/#/project/4dff5213-ca2c-4ee7-8b2b-16c6a0baa6fe) | [qa-gn1569-31-r2-vm](http://10.10.31.10:8080/client/#/vm/3a46124e-fc10-472a-90af-1739982832e3?tab=nics) | ablecube31-3 / i-428-952-VM | 10.180.31.11 |
| 32 | [qa-gn1569-32-project](http://10.10.32.10:8080/client/#/project/0db180fc-4a19-4f9a-b387-00599ffa86c0) | [qa-gn1569-32-r2-vm](http://10.10.32.10:8080/client/#/vm/b594bcaf-bcbf-4145-83b0-0af06586ab04?tab=nics) | ablecube32-2 / i-240-427-VM | 10.180.32.21 |

## 남겨둔 새 네트워크 24개

Admin/owner/member의 망도 삭제하지 않았다. 최종 VM에 연결된 세 망은 domainadmin 망이다. Shared는 기존 QA 연관 L2를 사용하며 새 VLAN 스위치 설정을 완료했다고 간주하지 않는다.

| 클러스터 | 생성 주체 | 유형 | 네트워크 | CIDR / VLAN | 최종 VM 연결 |
| --- | --- | --- | --- | --- | --- |
| 31 | admin | L2 | [qa-gn1569-31-r2-admin-l2](http://10.10.31.10:8080/client/#/guestnetwork/105a247c-0424-4a87-9e89-e9e5e7d3252e) | Cloud IP 관리 안 함 / vlan://188 | 보관 |
| 31 | admin | Isolated | [qa-gn1569-31-r2-admin-nat](http://10.10.31.10:8080/client/#/guestnetwork/6aedf76e-996c-4141-b58c-9c52d2bce1cf) | 10.230.31.0/24 / 미구현 | 보관 |
| 31 | admin | Shared | [qa-gn1569-31-r2-admin-shared](http://10.10.31.10:8080/client/#/guestnetwork/c1f8e61c-670e-4156-a0b0-d36485eff821) | 10.240.31.0/24 / vlan://180 | 보관 |
| 31 | domainadmin | L2 | [qa-gn1569-31-r2-domainadmin-l2](http://10.10.31.10:8080/client/#/guestnetwork/185fd9d7-2716-418d-9a4a-0524eec94d40) | Cloud IP 관리 안 함 / vlan://179 | 연결 |
| 31 | domainadmin | Isolated | [qa-gn1569-31-r2-domainadmin-nat](http://10.10.31.10:8080/client/#/guestnetwork/19427aa6-e7f4-46ab-bb2f-1958bf2b2ac0) | 10.233.31.0/24 / vlan://151 | 연결 |
| 31 | domainadmin | Shared | [qa-gn1569-31-r2-domainadmin-shared](http://10.10.31.10:8080/client/#/guestnetwork/e761975e-b568-497f-935b-f753004842be) | 10.243.31.0/24 / vlan://180 | 연결 |
| 31 | member | L2 | [qa-gn1569-31-r2-member-l2](http://10.10.31.10:8080/client/#/guestnetwork/58357944-9a13-4a0e-8848-fb7c887c73b1) | Cloud IP 관리 안 함 / vlan://162 | 보관 |
| 31 | member | Isolated | [qa-gn1569-31-r2-member-nat](http://10.10.31.10:8080/client/#/guestnetwork/547a372c-77c4-408d-baab-bb96bdb664db) | 10.232.31.0/24 / 미구현 | 보관 |
| 31 | member | Shared | [qa-gn1569-31-r2-member-shared](http://10.10.31.10:8080/client/#/guestnetwork/9ad0cf71-adde-469b-8c2c-824627017cdf) | 10.242.31.0/24 / vlan://180 | 보관 |
| 31 | owner | L2 | [qa-gn1569-31-r2-owner-l2](http://10.10.31.10:8080/client/#/guestnetwork/6b39d955-ee22-4a7b-9b01-deee6ea2c117) | Cloud IP 관리 안 함 / vlan://194 | 보관 |
| 31 | owner | Isolated | [qa-gn1569-31-r2-owner-nat](http://10.10.31.10:8080/client/#/guestnetwork/d15c503c-4f20-437e-95f7-9436aa0aed19) | 10.231.31.0/24 / 미구현 | 보관 |
| 31 | owner | Shared | [qa-gn1569-31-r2-owner-shared](http://10.10.31.10:8080/client/#/guestnetwork/52391350-3f9b-41c7-a300-680cc2db549a) | 10.241.31.0/24 / vlan://180 | 보관 |
| 32 | admin | L2 | [qa-gn1569-32-r2-admin-l2](http://10.10.32.10:8080/client/#/guestnetwork/1f1e0ae2-2d6d-41e4-bfee-4257d2eb4a63) | Cloud IP 관리 안 함 / vlan://186 | 보관 |
| 32 | admin | Isolated | [qa-gn1569-32-r2-admin-nat](http://10.10.32.10:8080/client/#/guestnetwork/f330b78c-8989-431f-826f-d02e5c8cf174) | 10.230.32.0/24 / 미구현 | 보관 |
| 32 | admin | Shared | [qa-gn1569-32-r2-admin-shared](http://10.10.32.10:8080/client/#/guestnetwork/5b9ba728-c05f-46b5-b725-07dc265c8538) | 10.240.32.0/24 / vlan://122 | 보관 |
| 32 | domainadmin | L2 | [qa-gn1569-32-r2-domainadmin-l2](http://10.10.32.10:8080/client/#/guestnetwork/ba14e62c-b442-4493-92e8-1c50e1b1bb10) | Cloud IP 관리 안 함 / vlan://155 | 연결 |
| 32 | domainadmin | Isolated | [qa-gn1569-32-r2-domainadmin-nat](http://10.10.32.10:8080/client/#/guestnetwork/0d972041-b686-446a-84a5-594fb25a6a39) | 10.233.32.0/24 / vlan://176 | 연결 |
| 32 | domainadmin | Shared | [qa-gn1569-32-r2-domainadmin-shared](http://10.10.32.10:8080/client/#/guestnetwork/85490640-20dc-4536-82a3-2e1813b201f6) | 10.243.32.0/24 / vlan://122 | 연결 |
| 32 | member | L2 | [qa-gn1569-32-r2-member-l2](http://10.10.32.10:8080/client/#/guestnetwork/f386e216-173c-4004-87b6-92ae91ee791a) | Cloud IP 관리 안 함 / vlan://167 | 보관 |
| 32 | member | Isolated | [qa-gn1569-32-r2-member-nat](http://10.10.32.10:8080/client/#/guestnetwork/811b1c6b-ace9-4e4c-96ce-657fcc867dbd) | 10.232.32.0/24 / 미구현 | 보관 |
| 32 | member | Shared | [qa-gn1569-32-r2-member-shared](http://10.10.32.10:8080/client/#/guestnetwork/78290382-5267-417e-ae55-e33143193064) | 10.242.32.0/24 / vlan://122 | 보관 |
| 32 | owner | L2 | [qa-gn1569-32-r2-owner-l2](http://10.10.32.10:8080/client/#/guestnetwork/654093be-83a1-494b-bbe3-cf1f74248f22) | Cloud IP 관리 안 함 / vlan://165 | 보관 |
| 32 | owner | Isolated | [qa-gn1569-32-r2-owner-nat](http://10.10.32.10:8080/client/#/guestnetwork/d61d4c4b-cf25-4f04-9e0f-fda9812b3e07) | 10.231.32.0/24 / 미구현 | 보관 |
| 32 | owner | Shared | [qa-gn1569-32-r2-owner-shared](http://10.10.32.10:8080/client/#/guestnetwork/322bc2f1-a9be-442c-9cdc-458e484fe485) | 10.241.32.0/24 / vlan://122 | 보관 |

QA 프로젝트 네트워크 한도는 검증 자원 보관을 위해 30에서 50으로 변경했다. 그 외 멤버십/역할/제한은 그대로다. 기존 프로젝트망 27/28개에 12개씩 추가돼 프로젝트 보기에는 39/40개가 표시된다. 운영 자원의 망 28/11개·사용자 VM 121/58개·오퍼링 30/21개는 기존 지문 그대로다.

## 기존 검증 VM과 자원

- 31: [qa-gn1569-31-prj-vm](http://10.10.31.10:8080/client/#/vm/625141be-7145-4557-9d8f-731500c61cb0?tab=nics), Running·원래 8 NIC·호스트 ablecube31-3 보존. LB 5개 Active·인증서·FW/PF·공유 권한 2행도 유지.
- 32: [qa-gn1569-32-prj-vm](http://10.10.32.10:8080/client/#/vm/da7f69ed-1948-4927-b377-55beb9c4620d?tab=nics), Running·원래 8 NIC·호스트 ablecube32-2 보존. LB 5개 Active·인증서·FW/PF·공유 권한 2행도 유지.

검증용 UI/API 계정과 Skudonet 템플릿은 기존 자원을 재사용했다. 로그인 비밀·API 키·사용자 데이터·개인키는 증적에서 제외/가림 처리했다. 새 VM이 아닌 기존 VM에 NIC를 추가/제거하지 않았다.
