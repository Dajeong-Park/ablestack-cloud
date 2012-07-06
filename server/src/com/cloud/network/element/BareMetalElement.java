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
package com.cloud.network.element;

import java.util.List;
import java.util.Map;

import javax.ejb.Local;

import org.apache.log4j.Logger;

import com.cloud.baremetal.ExternalDhcpManager;
import com.cloud.deploy.DeployDestination;
import com.cloud.exception.ConcurrentOperationException;
import com.cloud.exception.InsufficientCapacityException;
import com.cloud.exception.ResourceUnavailableException;
import com.cloud.host.Host;
import com.cloud.hypervisor.Hypervisor.HypervisorType;
import com.cloud.network.Network;
import com.cloud.network.Network.Capability;
import com.cloud.network.Network.Provider;
import com.cloud.network.Network.Service;
import com.cloud.network.PhysicalNetworkServiceProvider;
import com.cloud.offering.NetworkOffering;
import com.cloud.utils.component.AdapterBase;
import com.cloud.utils.component.Inject;
import com.cloud.utils.db.DB;
import com.cloud.utils.db.Transaction;
import com.cloud.vm.NicProfile;
import com.cloud.vm.NicVO;
import com.cloud.vm.ReservationContext;
import com.cloud.vm.VirtualMachine;
import com.cloud.vm.VirtualMachineProfile;
import com.cloud.vm.dao.NicDao;

@Local(value=NetworkElement.class)
public class BareMetalElement extends AdapterBase implements NetworkElement {
	private static final Logger s_logger = Logger.getLogger(BareMetalElement.class);
	@Inject NicDao _nicDao;
	@Inject ExternalDhcpManager _dhcpMgr;
	
	@Override
	public Map<Service, Map<Capability, String>> getCapabilities() {
		return null;
	}

	@Override
	public Provider getProvider() {
		return null;
	}

	@Override
	public boolean implement(Network network, NetworkOffering offering, DeployDestination dest, ReservationContext context)
			throws ConcurrentOperationException, ResourceUnavailableException, InsufficientCapacityException {
		return true;
	}

	@Override @DB
	public boolean prepare(Network network, NicProfile nic, VirtualMachineProfile<? extends VirtualMachine> vm, DeployDestination dest,
			ReservationContext context) throws ConcurrentOperationException, ResourceUnavailableException, InsufficientCapacityException {
		Host host = dest.getHost();
		if (host == null || host.getHypervisorType() != HypervisorType.BareMetal) {
			return true;
		}
		
		Transaction txn = Transaction.currentTxn();
        txn.start();
		nic.setMacAddress(host.getPrivateMacAddress());
		NicVO vo = _nicDao.findById(nic.getId());
		assert vo != null : "Where ths nic " + nic.getId() + " going???";
		vo.setMacAddress(nic.getMacAddress());
		_nicDao.update(vo.getId(), vo);
		txn.commit();
		s_logger.debug("Bare Metal changes mac address of nic " + nic.getId() + " to " + nic.getMacAddress());
		
		return _dhcpMgr.addVirtualMachineIntoNetwork(network, nic, vm, dest, context);
	}

	@Override
	public boolean release(Network network, NicProfile nic, VirtualMachineProfile<? extends VirtualMachine> vm, ReservationContext context)
			throws ConcurrentOperationException, ResourceUnavailableException {
		return true;
	}

	@Override
	public boolean shutdown(Network network, ReservationContext context, boolean cleanup) throws ConcurrentOperationException, ResourceUnavailableException {
		return true;
	}

	@Override
	public boolean destroy(Network network) throws ConcurrentOperationException, ResourceUnavailableException {
		return true;
	}

    @Override
    public boolean isReady(PhysicalNetworkServiceProvider provider) {
        return true;
    }

    @Override
    public boolean shutdownProviderInstances(PhysicalNetworkServiceProvider provider, ReservationContext context) throws ConcurrentOperationException, ResourceUnavailableException {
        return true;
    }

    @Override
    public boolean canEnableIndividualServices() {
        return false;
    }
    
    @Override
    public boolean verifyServicesCombination(List<String> services) {
        return true;
    }
}
