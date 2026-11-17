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

package com.cloud.hypervisor.kvm.resource.wrapper;

import org.apache.cloudstack.ca.PostCertificateRenewalCommand;
import org.apache.cloudstack.ca.SetupCertificateAnswer;
import org.libvirt.Connect;
import org.libvirt.Domain;
import org.libvirt.LibvirtException;

import com.cloud.agent.api.Answer;
import com.cloud.hypervisor.kvm.resource.LibvirtComputingResource;
import com.cloud.resource.CommandWrapper;
import com.cloud.resource.ResourceWrapper;
import com.cloud.utils.script.Script;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

@ResourceWrapper(handles = PostCertificateRenewalCommand.class)
public final class LibvirtPostCertificateRenewalCommandWrapper extends CommandWrapper<PostCertificateRenewalCommand, Answer, LibvirtComputingResource> {

    private static final String QEMU_MONITOR_DISPLAY_RELOAD_VNC_TLS_CERTS_COMMAND =
            "{\"execute\":\"display-reload\",\"arguments\":{\"type\":\"vnc\",\"tls-certs\":true}}";
    private static final long MIN_QEMU_VERSION_FOR_VNC_TLS_CERT_RELOAD = 6000000L;
    private static final String QEMU_MONITOR_QUERY_VNC_COMMAND = "{\"execute\":\"query-vnc\"}";

    @Override
    public Answer execute(final PostCertificateRenewalCommand command, final LibvirtComputingResource serverResource) {
        if (command != null) {
            pushRenewedVncCertificateToRunningVms(serverResource);
            restartLibvirtd();
            return new SetupCertificateAnswer(true);
        }
        return new SetupCertificateAnswer(false);
    }

    private void restartLibvirtd() {
        logger.info("Restarting libvirt after certificate provisioning/renewal");
        final int timeout = 30000;
        Script script = new Script(true, "service", timeout, logger);
        script.add("libvirtd");
        script.add("restart");
        script.execute();
    }

    // Restarting libvirtd alone does not refresh certificates already loaded by running QEMU processes.
    private void pushRenewedVncCertificateToRunningVms(final LibvirtComputingResource serverResource) {
        final long qemuVersion = serverResource.getHypervisorQemuVersion();
        if (qemuVersion < MIN_QEMU_VERSION_FOR_VNC_TLS_CERT_RELOAD) {
            logger.warn("QEMU {} on this host does not support reloading the VNC TLS certificate of a running VM (QEMU >= {} required), " +
                    "running VMs will keep using the previous certificate until they are stopped/started or migrated",
                    qemuVersion, MIN_QEMU_VERSION_FOR_VNC_TLS_CERT_RELOAD);
            return;
        }

        final Connect conn;
        final int[] domainIds;
        try {
            conn = serverResource.getLibvirtUtilitiesHelper().getConnection();
            domainIds = conn.listDomains();
        } catch (final LibvirtException e) {
            logger.warn("Unable to list running VMs to reload their renewed VNC certificate", e);
            return;
        }

        for (final int domainId : domainIds) {
            Domain vm = null;
            String vmName = null;
            try {
                vm = conn.domainLookupByID(domainId);
                vmName = vm.getName();
                if (!isVncTlsEnabled(vm)) {
                    logger.debug("VNC TLS is not enabled for VM [{}], skipping certificate reload", vmName);
                    continue;
                }
                vm.qemuMonitorCommand(QEMU_MONITOR_DISPLAY_RELOAD_VNC_TLS_CERTS_COMMAND, 0);
                logger.debug("Reloaded VNC TLS certificate for VM [{}]", vmName);
            } catch (final Exception e) {
                logger.warn("Failed to reload the renewed VNC certificate for VM [{}], it will keep using the previous " +
                        "certificate until it is stopped/started or migrated", vmName, e);
            } finally {
                if (vm != null) {
                    try {
                        vm.free();
                    } catch (final LibvirtException e) {
                        logger.trace("Ignoring libvirt error.", e);
                    }
                }
            }
        }
    }

    private boolean isVncTlsEnabled(final Domain vm) {
        try {
            final String response = vm.qemuMonitorCommand(QEMU_MONITOR_QUERY_VNC_COMMAND, 0);
            if (response == null) {
                return false;
            }
            final JsonObject vnc = new JsonParser().parse(response).getAsJsonObject().getAsJsonObject("return");
            return vnc != null && vnc.has("auth") && !vnc.get("auth").isJsonNull()
                    && vnc.get("auth").getAsString().startsWith("vencrypt+x509");
        } catch (final Exception e) {
            logger.trace("Unable to query VNC status for VM, assuming TLS not enabled", e);
            return false;
        }
    }
}
