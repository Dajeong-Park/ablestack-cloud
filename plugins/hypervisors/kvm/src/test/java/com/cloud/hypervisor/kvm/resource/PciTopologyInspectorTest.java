// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.hypervisor.kvm.resource;

import org.junit.Test;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class PciTopologyInspectorTest {
    private String actualStyle(int ports) {
        StringBuilder xml = new StringBuilder("<domain><os><type machine='pc-q35-rhel9.8.0'>hvm</type></os><devices>");
        for(int i=0;i<ports;i++) {
            xml.append("<controller type='pci' model='pcie-root-port' index='").append(i+1)
                .append("'><target hotplug='on'/><address type='pci' domain='0' bus='0' slot='")
                .append(i/8+2).append("' function='").append(i%8).append("'")
                .append(i%8==0 ? " multifunction='on'" : "").append("/></controller>");
        }
        // The implicit q35 LPC function 0 does not appear in normalized XML.
        xml.append("<controller type='sata'><address type='pci' domain='0' bus='0' slot='31' function='2'/></controller>")
           .append("<controller type='pci' model='pcie-to-pci-bridge' index='33'><address type='pci' bus='1' slot='0' function='0'/></controller>")
           .append("<interface><address type='pci' bus='2' slot='0' function='0'/></interface>");
        return xml.append("</devices></domain>").toString();
    }

    @Test public void thirtyTwoPortsAreNotThirtyTwoSlotsAndFreeCapacityUsesLiveOccupancy() {
        var document = PciTopologyInspector.parse(actualStyle(32));
        PciTopologyInspector.validateAddresses(document);
        assertEquals(32, PciTopologyInspector.rootPorts(document));
        assertEquals(30, PciTopologyInspector.freeHotplugPorts(document));
        String added = actualStyle(32).replace("</devices>", "<interface><address type='pci' bus='3' slot='0' function='0'/></interface></devices>");
        assertEquals(29, PciTopologyInspector.freeHotplugPorts(PciTopologyInspector.parse(added)));
        assertEquals(30, PciTopologyInspector.freeHotplugPorts(PciTopologyInspector.parse(actualStyle(32))));
    }

    @Test public void boundsDuplicateAndMultifunctionErrorsAreDistinctFromRootPortCount() {
        String xml = actualStyle(32);
        for (String invalid : new String[]{
                xml.replace("slot='2' function='0'", "slot='32' function='0'"),
                xml.replaceFirst("function='7'", "function='8'"),
                xml.replaceFirst(" multifunction='on'", ""),
                xml.replace("</devices>", "<interface><address type='pci' bus='2' slot='0' function='0'/></interface></devices>")}) {
            assertThrows(IllegalArgumentException.class, () -> PciTopologyInspector.validateAddresses(PciTopologyInspector.parse(invalid)));
        }
    }

    @Test public void disabledHotplugPortsCannotBeCountedAsSpare() {
        String xml = actualStyle(4).replace("index='4'><target hotplug='on'", "index='4'><target hotplug='off'");
        assertEquals(1, PciTopologyInspector.freeHotplugPorts(PciTopologyInspector.parse(xml)));
    }

    @Test public void externalXmlEntitiesAreRejectedBeforeAnyResourceOperation() {
        assertThrows(IllegalArgumentException.class,
                () -> PciTopologyInspector.parse("<!DOCTYPE domain SYSTEM 'file:///not-used'><domain/>"));
    }
}
