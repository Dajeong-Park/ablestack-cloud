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

# 실제 브라우저 캡처

CSS viewport와 JPEG 원본 크기를 별도 대조했다. native 브라우저가 반환한 비례 축소 이미지는 재가공하지 않았다. 최종 배치 캡처는 final, 실제 오류/복구 흐름은 policy-failure/ retry-success를 사용한다.

| 캡처 | CSS viewport | JPEG 원본 | 테마 | 서버 |
|---|---|---|---|---|
| [31-ui-create-ready-dark.jpg](31-ui-create-ready-dark.jpg) | 1680×841 | 1680×841 | dark-mode ant-scrolling-effect | http://10.10.31.10:8080 |
| [31-ui-final-1280-dark.jpg](31-ui-final-1280-dark.jpg) | 1280×900 | 1266×890 | dark | http://10.10.31.10:8080 |
| [31-ui-final-1280-light.jpg](31-ui-final-1280-light.jpg) | 1280×900 | 1266×890 | light | http://10.10.31.10:8080 |
| [31-ui-final-390-dark.jpg](31-ui-final-390-dark.jpg) | 390×844 | 390×844 | dark | http://10.10.31.10:8080 |
| [31-ui-final-390-light.jpg](31-ui-final-390-light.jpg) | 390×844 | 390×844 | light | http://10.10.31.10:8080 |
| [31-ui-final-768-dark.jpg](31-ui-final-768-dark.jpg) | 768×1024 | 758×1011 | dark | http://10.10.31.10:8080 |
| [31-ui-final-768-light.jpg](31-ui-final-768-light.jpg) | 768×1024 | 758×1011 | light | http://10.10.31.10:8080 |
| [31-ui-final-mobile-dialog-dark.jpg](31-ui-final-mobile-dialog-dark.jpg) | 390×844 | 390×844 | dark | http://10.10.31.10:8080 |
| [31-ui-native-unsupported.jpg](31-ui-native-unsupported.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.31.10:8080 |
| [31-ui-policy-failure-rollback.jpg](31-ui-policy-failure-rollback.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.31.10:8080 |
| [31-ui-policy-retry-success.jpg](31-ui-policy-retry-success.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.31.10:8080 |
| [31-ui-readonly-masked-network.jpg](31-ui-readonly-masked-network.jpg) | 1680×841 | 1680×841 | dark | http://10.10.31.10:8080 |
| [31-ui-readonly-nics.jpg](31-ui-readonly-nics.jpg) | 1680×841 | 1680×841 | dark | http://10.10.31.10:8080 |
| [31-ui-shared-native-blocked.jpg](31-ui-shared-native-blocked.jpg) | 1680×841 | 1680×841 | dark | http://10.10.31.10:8080 |
| [31-ui-vm-standard-list.jpg](31-ui-vm-standard-list.jpg) | 1280×900 | 1280×900 | dark | http://10.10.31.10:8080 |
| [31-ui-vm-standard-nics.jpg](31-ui-vm-standard-nics.jpg) | 1280×900 | 1280×900 | dark | http://10.10.31.10:8080 |
| [32-ui-attach-ready-light.jpg](32-ui-attach-ready-light.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.32.10:8080 |
| [32-ui-create-ready-light.jpg](32-ui-create-ready-light.jpg) | 1680×841 | 1680×841 | light | http://10.10.32.10:8080 |
| [32-ui-final-1280-dark.jpg](32-ui-final-1280-dark.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
| [32-ui-final-1280-light.jpg](32-ui-final-1280-light.jpg) | 1280×900 | 1266×890 | light | http://10.10.32.10:8080 |
| [32-ui-final-390-dark.jpg](32-ui-final-390-dark.jpg) | 390×844 | 380×822 | dark | http://10.10.32.10:8080 |
| [32-ui-final-390-light.jpg](32-ui-final-390-light.jpg) | 390×844 | 390×844 | light | http://10.10.32.10:8080 |
| [32-ui-final-768-dark.jpg](32-ui-final-768-dark.jpg) | 768×1024 | 768×1024 | dark | http://10.10.32.10:8080 |
| [32-ui-final-768-light.jpg](32-ui-final-768-light.jpg) | 768×1024 | 768×1024 | light | http://10.10.32.10:8080 |
| [32-ui-final-mobile-dialog-dark.jpg](32-ui-final-mobile-dialog-dark.jpg) | 390×844 | 390×844 | dark | http://10.10.32.10:8080 |
| [32-ui-policy-failure-rollback.jpg](32-ui-policy-failure-rollback.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.32.10:8080 |
| [32-ui-policy-retry-success.jpg](32-ui-policy-retry-success.jpg) | 1680×841 | 1680×841 | ant-scrolling-effect | http://10.10.32.10:8080 |
| [32-ui-project-default-dark.jpg](32-ui-project-default-dark.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
| [32-ui-readonly-masked-network.jpg](32-ui-readonly-masked-network.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
| [32-ui-readonly-nics.jpg](32-ui-readonly-nics.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
| [32-ui-shared-native-blocked.jpg](32-ui-shared-native-blocked.jpg) | 1680×841 | 1680×841 | light | http://10.10.32.10:8080 |
| [32-ui-vm-standard-list.jpg](32-ui-vm-standard-list.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
| [32-ui-vm-standard-nics.jpg](32-ui-vm-standard-nics.jpg) | 1280×900 | 1280×900 | dark | http://10.10.32.10:8080 |
