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
// specific language govening permissions and limitations
// under the License.

package com.cloud.hypervisor.kvm.resource.wrapper;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;

import com.cloud.agent.api.Answer;
import com.cloud.agent.api.SharedFSComputeAnswer;
import com.cloud.agent.api.SharedFSComputeCommand;
import com.cloud.agent.api.StorageServiceHostAnswer;
import com.cloud.agent.api.StorageServiceHostCommand;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.resource.CommandWrapper;
import com.cloud.resource.ResourceWrapper;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.utils.security.ParserUtils;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.commons.codec.digest.DigestUtils;
import org.libvirt.Domain;
import org.libvirt.DomainInfo.DomainState;
import org.libvirt.LibvirtException;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;

@ResourceWrapper(handles = SharedFSComputeCommand.class)
public class LibvirtSharedFSComputeCommandWrapper
        extends CommandWrapper<SharedFSComputeCommand, Answer, LibvirtComputingResource> {

    private static final long DIMM_KIB = 4L * 1024 * 1024;
    private static final int AFFECT_LIVE = 1;

    @Override
    public Answer execute(SharedFSComputeCommand command, LibvirtComputingResource resource) {
        Domain domain = null;
        try {
            domain = resource.getDomain(resource.getLibvirtUtilitiesHelper().getConnection(), command.getVmName());
            require(domain != null && domain.getInfo().state == DomainState.VIR_DOMAIN_RUNNING, "COMPUTE_VM_NOT_RUNNING");
            require(command.getVmUuid().equals(domain.getUUIDString()), "COMPUTE_VM_IDENTITY_CHANGED");
            JsonObject before = observe(domain);
            if (command.getBefore() != null) {
                require(before.equals(command.getBefore()), "COMPUTE_HOST_OBSERVATION_CHANGED");
                verifyGuestBoot(domain, command);
                require(before.equals(observe(domain)), "COMPUTE_HOST_OBSERVATION_CHANGED");
                allocate(domain, command, before);
            }
            return new SharedFSComputeAnswer(command, observe(domain));
        } catch (CloudRuntimeException failure) {
            return new SharedFSComputeAnswer(command, failure.getMessage());
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            return new SharedFSComputeAnswer(command, "COMPUTE_HOST_INTERRUPTED");
        } catch (Exception failure) {
            logger.warn("SharedFS live compute host result could not be confirmed", failure);
            return new SharedFSComputeAnswer(command, "COMPUTE_HOST_OBSERVATION_FAILED");
        } finally {
            if (domain != null) {
                try {
                    domain.free();
                } catch (LibvirtException failure) {
                    logger.debug("Could not free SharedFS domain reference", failure);
                }
            }
        }
    }

    private void verifyGuestBoot(Domain domain, SharedFSComputeCommand command) throws LibvirtException, InterruptedException {
        LibvirtStorageServiceHostCommandWrapper wrapper = new LibvirtStorageServiceHostCommandWrapper();
        StorageServiceHostCommand inspect = new StorageServiceHostCommand(command.getVmName(), "compute inspect", "{}", 15);
        long pid = wrapper.executeGuestCommand(domain, inspect);
        StorageServiceHostAnswer answer = (StorageServiceHostAnswer)wrapper.waitForGuestCommand(inspect, domain, pid);
        require(answer.getResult(), "COMPUTE_GUEST_INSPECTION_FAILED");
        JsonObject guest = JsonParser.parseString(answer.getResultJson()).getAsJsonObject().getAsJsonObject("observation");
        require(command.getBootId().equals(guest.get("bootId").getAsString())
                && command.getVmUuid().equals(guest.get("vmUuid").getAsString()), "COMPUTE_BOOT_OR_VM_CHANGED");
    }

    private void allocate(Domain domain, SharedFSComputeCommand command, JsonObject before) throws LibvirtException {
        int currentCpus = before.getAsJsonObject("cpus").size();
        long currentMemory = before.get("memoryKiB").getAsLong();
        int targetCpus = command.getTargetCpus();
        long targetMemory = command.getTargetMemoryKiB();
        if (targetMemory == currentMemory && targetCpus > currentCpus
                && targetCpus <= before.get("maxCpus").getAsInt()) {
            domain.setVcpusFlags(targetCpus, AFFECT_LIVE);
            return;
        }
        require(targetCpus == currentCpus && targetMemory - currentMemory == DIMM_KIB
                && targetMemory <= before.get("maxMemoryKiB").getAsLong()
                && before.getAsJsonObject("dimms").size() < before.get("slots").getAsInt(), "COMPUTE_TARGET_UNSUPPORTED");
        String alias = "ua-sharedfs-" + UUID.fromString(command.getOperationUuid());
        String memoryDevice = "<memory model='dimm'><target><size unit='KiB'>" + DIMM_KIB
                + "</size><node>0</node></target><alias name='" + alias + "'/></memory>";
        domain.attachDeviceFlags(memoryDevice, AFFECT_LIVE);
    }

    private JsonObject observe(Domain domain) throws Exception {
        Element root = ParserUtils.getSaferDocumentBuilderFactory().newDocumentBuilder()
                .parse(new InputSource(new StringReader(domain.getXMLDesc(0)))).getDocumentElement();
        Element osType = first(root, "type");
        Element topology = first(root, "topology");
        Element numa = first(root, "numa");
        require("x86_64".equals(osType.getAttribute("arch")) && "pc-i440fx-rhel7.6.0".equals(osType.getAttribute("machine"))
                && "1".equals(topology.getAttribute("sockets")) && "1".equals(topology.getAttribute("threads"))
                && numa.getElementsByTagName("cell").getLength() == 1 && "0".equals(first(numa, "cell").getAttribute("id")),
                "COMPUTE_HOST_PROFILE_UNSUPPORTED");

        JsonObject observation = new JsonObject();
        Element memory = first(root, "memory");
        Element maxMemory = first(root, "maxMemory");
        long currentMemory = Long.parseLong(memory.getTextContent());
        require("KiB".equals(memory.getAttribute("unit")) && "KiB".equals(maxMemory.getAttribute("unit"))
                && currentMemory == Long.parseLong(first(root, "currentMemory").getTextContent()),
                "COMPUTE_MEMORY_BALLOON_UNSUPPORTED");
        observation.addProperty("domainId", domain.getID());
        observation.addProperty("diskFingerprint", diskFingerprint(root));
        observation.addProperty("memoryKiB", currentMemory);
        observation.addProperty("maxMemoryKiB", Long.parseLong(maxMemory.getTextContent()));
        observation.addProperty("slots", Integer.parseInt(maxMemory.getAttribute("slots")));
        require(observation.get("slots").getAsInt() == 16, "COMPUTE_HOST_PROFILE_UNSUPPORTED");

        JsonObject cpus = new JsonObject();
        int slots = 0;
        for (JsonElement slot : monitor(domain, "query-hotpluggable-cpus").getAsJsonArray("return")) {
            JsonObject entry = slot.getAsJsonObject();
            JsonObject props = entry.getAsJsonObject("props");
            require(entry.get("vcpus-count").getAsInt() == 1 && props.get("socket-id").getAsInt() == 0
                    && props.get("thread-id").getAsInt() == 0 && props.get("node-id").getAsInt() == 0,
                    "COMPUTE_CPU_HOST_TOPOLOGY_UNVERIFIED");
            if (entry.has("qom-path")) {
                String id = props.get("core-id").getAsString();
                require(!cpus.has(id), "COMPUTE_CPU_HOST_TOPOLOGY_UNVERIFIED");
                cpus.add(id, entry);
            }
            slots++;
        }
        require(slots == Integer.parseInt(first(root, "vcpu").getTextContent()), "COMPUTE_CPU_HOST_TOPOLOGY_UNVERIFIED");
        observation.addProperty("maxCpus", slots);
        observation.add("cpus", cpus);
        JsonObject dimms = new JsonObject();
        for (JsonElement device : monitor(domain, "query-memory-devices").getAsJsonArray("return")) {
            JsonObject entry = device.getAsJsonObject();
            require("dimm".equals(entry.get("type").getAsString()), "COMPUTE_MEMORY_DEVICE_UNSUPPORTED");
            JsonObject data = entry.getAsJsonObject("data");
            String id = data.get("id").getAsString();
            require(!dimms.has(id), "COMPUTE_MEMORY_DEVICE_UNSUPPORTED");
            dimms.add(id, data);
        }
        observation.add("dimms", dimms);
        return observation;
    }

    private JsonObject monitor(Domain domain, String operation) throws LibvirtException {
        return JsonParser.parseString(domain.qemuMonitorCommand("{\"execute\":\"" + operation + "\"}", 0)).getAsJsonObject();
    }

    private static Element first(Element root, String name) {
        Element element = (Element) root.getElementsByTagName(name).item(0);
        require(element != null, "COMPUTE_HOST_PROFILE_UNSUPPORTED");
        return element;
    }

    private static String diskFingerprint(Element root) throws Exception {
        Map<String, String> disks = new TreeMap<>();
        Element devices = first(root, "devices");
        for (int i = 0; i < devices.getElementsByTagName("disk").getLength(); i++) {
            Element disk = (Element) devices.getElementsByTagName("disk").item(i);
            if (!"disk".equals(disk.getAttribute("device"))) {
                continue;
            }
            StringWriter identity = new StringWriter();
            TransformerFactory.newDefaultInstance().newTransformer()
                    .transform(new DOMSource(first(disk, "source")), new StreamResult(identity));
            disks.put(first(disk, "target").getAttribute("dev"), identity.toString());
        }
        require(!disks.isEmpty(), "COMPUTE_DISK_IDENTITY_UNVERIFIED");
        return DigestUtils.sha256Hex(disks.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void require(boolean condition, String reason) {
        if (!condition) {
            throw new CloudRuntimeException(reason);
        }
    }
}
