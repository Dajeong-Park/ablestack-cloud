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
package com.cloud.bgp;

import com.cloud.dc.ASNumberRangeVO;
import com.cloud.dc.ASNumberVO;
import com.cloud.dc.DataCenterVO;
import com.cloud.dc.dao.ASNumberDao;
import com.cloud.dc.dao.ASNumberRangeDao;
import com.cloud.dc.dao.DataCenterDao;
import com.cloud.domain.Domain;
import com.cloud.domain.dao.DomainDao;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.exception.PermissionDeniedException;
import com.cloud.exception.ResourceUnavailableException;
import com.cloud.network.Network;
import com.cloud.network.NetworkModel;
import com.cloud.network.dao.NetworkDao;
import com.cloud.network.dao.NetworkServiceMapDao;
import com.cloud.network.dao.NetworkVO;
import com.cloud.network.element.BgpServiceProvider;
import com.cloud.network.element.NetworkElement;
import com.cloud.network.vpc.Vpc;
import com.cloud.network.vpc.VpcOfferingVO;
import com.cloud.network.vpc.VpcVO;
import com.cloud.network.vpc.dao.VpcDao;
import com.cloud.network.vpc.dao.VpcOfferingDao;
import com.cloud.network.vpc.dao.VpcServiceMapDao;
import com.cloud.offering.NetworkOffering;
import com.cloud.offerings.NetworkOfferingVO;
import com.cloud.offerings.dao.NetworkOfferingDao;
import com.cloud.event.ActionEvent;
import com.cloud.event.EventTypes;
import com.cloud.user.Account;
import com.cloud.user.AccountManager;
import com.cloud.user.dao.AccountDao;
import com.cloud.utils.Pair;
import com.cloud.utils.db.DB;
import com.cloud.utils.db.GenericDao;
import com.cloud.utils.db.SearchCriteria;
import com.cloud.utils.db.Transaction;
import com.cloud.utils.db.TransactionCallback;
import com.cloud.utils.exception.CloudRuntimeException;
import org.apache.cloudstack.api.command.user.bgp.ListASNumbersCmd;
import org.apache.cloudstack.context.CallContext;
import org.apache.cloudstack.network.BgpPeer;
import org.apache.cloudstack.network.BgpPeerVO;
import org.apache.cloudstack.network.RoutedIpv4Manager;
import org.apache.cloudstack.network.dao.BgpPeerDao;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.BooleanUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.Date;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

public class BGPServiceImpl implements BGPService {

    public static final Logger LOGGER = LogManager.getLogger(BGPServiceImpl.class);

    @Inject
    private DataCenterDao dataCenterDao;
    @Inject
    private ASNumberRangeDao asNumberRangeDao;
    @Inject
    private ASNumberDao asNumberDao;
    @Inject
    private NetworkDao networkDao;
    @Inject
    private VpcDao vpcDao;
    @Inject
    private VpcOfferingDao vpcOfferingDao;
    @Inject
    private NetworkOfferingDao networkOfferingDao;
    @Inject
    private AccountManager asnAccountManager;

    @Inject
    private AccountDao accountDao;
    @Inject
    private DomainDao domainDao;
    @Inject
    NetworkServiceMapDao ntwkSrvcDao;
    @Inject
    NetworkModel networkModel;
    @Inject
    BgpPeerDao bgpPeerDao;
    @Inject
    RoutedIpv4Manager routedIpv4Manager;
    @Inject
    VpcServiceMapDao vpcServiceMapDao;

    public BGPServiceImpl() {
    }

    @Override
    @DB
    @ActionEvent(eventType = EventTypes.EVENT_AS_RANGE_CREATE, eventDescription = "AS Range creation")
    public ASNumberRange createASNumberRange(long zoneId, long startASNumber, long endASNumber) {
        ASNumberRangeValidator.validate(startASNumber, endASNumber);
        DataCenterVO zone = dataCenterDao.findById(zoneId);
        if (zone == null) {
            String msg = String.format("Cannot find a zone with ID %s", zoneId);
            LOGGER.error(msg);
            throw new InvalidParameterValueException(msg);
        }
        if (!routedIpv4Manager.isRoutedNetworkVpcEnabled(zoneId)) {
            throw new InvalidParameterValueException("Cannot create ASN range as Routed networks and VPCs are not enabled for the zone.");
        }
        try {
            return Transaction.execute((TransactionCallback<ASNumberRange>) status -> {
                // Lock a row that exists even before the first range. All management servers use this DB lock.
                if (dataCenterDao.lockRow(zoneId, true) == null) {
                    throw new InvalidParameterValueException("The selected Zone no longer exists.");
                }
                if (!routedIpv4Manager.isRoutedNetworkVpcEnabled(zoneId)) {
                    throw new InvalidParameterValueException("Routed networks and VPCs are not enabled for the Zone.");
                }
                for (ASNumberRangeVO range : asNumberRangeDao.listByZoneId(zoneId)) {
                    if (isASNumbersOverlap(range.getStartASNumber(), range.getEndASNumber(), startASNumber, endASNumber)) {
                        throw new InvalidParameterValueException(String.format("ASN range %s-%s overlaps the existing range %s-%s.",
                                startASNumber, endASNumber, range.getStartASNumber(), range.getEndASNumber()));
                    }
                }
                LOGGER.debug("Persisting AS Number Range {}-{} for the zone {}", startASNumber, endASNumber, zone);
                ASNumberRangeVO asNumberRangeVO = new ASNumberRangeVO(zoneId, startASNumber, endASNumber);
                if (asNumberRangeDao.persist(asNumberRangeVO) == null) {
                    throw new CloudRuntimeException("Could not persist ASN range");
                }

                for (long asn = startASNumber; asn <= endASNumber; asn++) {
                    LOGGER.debug("Persisting AS Number {} for zone {}", asn, zone);
                    ASNumberVO asNumber = new ASNumberVO(asn, asNumberRangeVO.getId(), zoneId);
                    if (asNumberDao.persist(asNumber) == null) {
                        throw new CloudRuntimeException("Could not persist ASN range member");
                    }
                }
                return asNumberRangeVO;
            });
        } catch (InvalidParameterValueException e) {
            throw e;
        } catch (Exception e) {
            String err = String.format("Error creating AS Number range %s-%s for zone %s: %s", startASNumber, endASNumber, zone, e.getMessage());
            LOGGER.error(err, e);
            throw new CloudRuntimeException(err);
        }
    }

    protected boolean isASNumbersOverlap(long startNumber1, long endNumber1, long startNumber2, long endNumber2) {
        if (startNumber1 > endNumber2 || startNumber2 > endNumber1) {
            return false;
        }
        return true;
    }

    @Override
    public List<ASNumberRange> listASNumberRanges(Long zoneId) {
        List<ASNumberRangeVO> rangeVOList = zoneId != null ? asNumberRangeDao.listByZoneId(zoneId) : asNumberRangeDao.listAll();
        return new ArrayList<>(rangeVOList);
    }

    @Override
    public Pair<List<ASNumber>, Integer> listASNumbers(ListASNumbersCmd cmd) {
        Long zoneId = cmd.getZoneId();
        Long asNumberRangeId = cmd.getAsNumberRangeId();
        Long asNumber = cmd.getAsNumber();
        Boolean allocated = cmd.getAllocated();
        Long networkId = cmd.getNetworkId();
        Long vpcId = cmd.getVpcId();
        String accountName = cmd.getAccount();
        Long domainId = cmd.getDomainId();
        Long startIndex = cmd.getStartIndex();
        Long pageSizeVal = cmd.getPageSizeVal();
        String keyword = cmd.getKeyword();

        final Account caller = CallContext.current().getCallingAccount();
        Domain domain = null;
        Account userAccount = null;
        if (domainId != null || accountName != null) {
            domain = domainDao.findById(domainId != null ? domainId : caller.getDomainId());
            if (domain == null) {
                throw new InvalidParameterValueException("The selected domain no longer exists.");
            }
            asnAccountManager.checkAccess(caller, domain);
            if (accountName != null) {
                userAccount = accountDao.findActiveAccount(accountName, domain.getId());
                if (userAccount == null) {
                    throw new InvalidParameterValueException("The account does not exist in the selected domain.");
                }
            }
        }
        if (asNumberRangeId != null) {
            ASNumberRangeVO range = asNumberRangeDao.findById(asNumberRangeId);
            if (range == null || zoneId != null && range.getDataCenterId() != zoneId) {
                throw new InvalidParameterValueException("The ASN range does not belong to the selected Zone.");
            }
        }
        Long networkSearchId = networkId;
        Long vpcSearchId = vpcId;
        if (networkId != null) {
            NetworkVO network = networkDao.findById(networkId);
            if (network == null || zoneId != null && network.getDataCenterId() != zoneId) {
                throw new InvalidParameterValueException("The network does not belong to the selected Zone.");
            }
            asnAccountManager.checkAccess(caller, null, false, network);
            if (vpcId != null && !vpcId.equals(network.getVpcId())) {
                throw new InvalidParameterValueException("The network does not belong to the selected VPC.");
            }
            if (network.getVpcId() != null) {
                networkSearchId = null;
                vpcSearchId = network.getVpcId();
            }
        }
        if (vpcSearchId != null) {
            VpcVO vpc = vpcDao.findById(vpcSearchId);
            if (vpc == null || zoneId != null && vpc.getZoneId() != zoneId) {
                throw new InvalidParameterValueException("The VPC does not belong to the selected Zone.");
            }
            asnAccountManager.checkAccess(caller, null, false, vpc);
        }
        Pair<List<ASNumberVO>, Integer> pair = asNumberDao.searchAndCountByZoneOrRangeOrAllocated(zoneId, asNumberRangeId,
                asNumber, networkSearchId, vpcSearchId, allocated, Objects.nonNull(userAccount) ? userAccount.getId() : null,
                Objects.nonNull(domain) ? domain.getId() : null, keyword, caller, startIndex, pageSizeVal);
        return new Pair<>(new ArrayList<>(pair.first()), pair.second());
    }

    @Override
    public boolean allocateASNumber(long zoneId, Long asNumber, Long networkId, Long vpcId) {
        // Use the same lock order as range creation/deletion across all management servers.
        return Transaction.execute((TransactionCallback<Boolean>) status -> {
            if (dataCenterDao.lockRow(zoneId, true) == null) {
                throw new InvalidParameterValueException("The selected Zone no longer exists.");
            }
            if (!allocateASNumberInTransaction(zoneId, asNumber, networkId, vpcId)) {
                // Existing network/VPC callers clean up on CloudRuntimeException, but ignore false.
                throw new CloudRuntimeException("The requested AS number is no longer available in the selected Zone.");
            }
            return true;
        });
    }

    private boolean allocateASNumberInTransaction(long zoneId, Long asNumber, Long networkId, Long vpcId) {
        long accountId, domainId;
        String netName;
        VpcVO vpc = null;
        NetworkVO network = null;
        if (Objects.nonNull(vpcId)) {
            vpc = vpcDao.findById(vpcId);
            if (vpc == null) {
                LOGGER.error(String.format("Cannot find VPC with ID %s", vpcId));
                return false;
            }
            accountId = vpc.getAccountId();
            domainId = vpc.getDomainId();
            netName = vpc.getName();
        } else {
            network = networkDao.findById(networkId);
            if (network == null) {
                LOGGER.error(String.format("Cannot find network with ID %s", networkId));
                return false;
            }
            accountId = network.getAccountId();
            domainId = network.getDomainId();
            netName = network.getName();
        }

        ASNumberVO candidate = isOfferingSpecifyAsNumber(networkId, vpcId)
                ? asNumberDao.findByAsNumber(asNumber) : asNumberDao.findOneByAllocationStateAndZone(zoneId, false);
        if (candidate == null || candidate.getDataCenterId() != zoneId) {
            if (asNumber != null) {
                return false;
            }
            throw new CloudRuntimeException("Cannot allocate AS number in zone with ID " + zoneId);
        }
        ASNumberRangeVO range = asNumberRangeDao.lockRow(candidate.getAsNumberRangeId(), true);
        if (range == null || range.getRemoved() != null || range.getDataCenterId() != zoneId) {
            return false;
        }
        ASNumberVO asNumberVO = asNumberDao.lockRow(candidate.getId(), true);
        if (asNumberVO == null || asNumberVO.getRemoved() != null || asNumberVO.isAllocated()
                || asNumberVO.getDataCenterId() != zoneId || asNumberVO.getAsNumberRangeId() != range.getId()) {
            return false;
        }
        LOGGER.debug("Allocating AS number {} to network {} / VPC {} in Zone {}", asNumberVO.getAsNumber(), networkId, vpcId, zoneId);
        asNumberVO.setAllocated(true);
        asNumberVO.setAllocatedTime(new Date());
        if (Objects.nonNull(vpcId)) {
            asNumberVO.setVpcId(vpcId);
        } else {
            asNumberVO.setNetworkId(networkId);
        }
        asNumberVO.setAccountId(accountId);
        asNumberVO.setDomainId(domainId);
        if (!asNumberDao.update(asNumberVO.getId(), asNumberVO)) {
            throw new CloudRuntimeException("Could not persist AS number allocation");
        }
        return true;
    }

    private boolean isOfferingSpecifyAsNumber(Long networkId, Long vpcId) {
        if (Objects.nonNull(vpcId)) {
            VpcVO vpc = vpcDao.findById(vpcId);
            if (vpc == null) {
                throw new CloudRuntimeException(String.format("Cannot find VPC with ID %s", vpcId));
            }
            VpcOfferingVO vpcOffering = vpcOfferingDao.findById(vpc.getVpcOfferingId());
            return NetworkOffering.RoutingMode.Dynamic == vpcOffering.getRoutingMode() && BooleanUtils.toBoolean(vpcOffering.isSpecifyAsNumber());
        } else {
            NetworkVO network = networkDao.findById(networkId);
            NetworkOfferingVO networkOffering = networkOfferingDao.findById(network.getNetworkOfferingId());
            return NetworkOffering.RoutingMode.Dynamic == networkOffering.getRoutingMode() && BooleanUtils.toBoolean(networkOffering.isSpecifyAsNumber());
        }
    }

    private Pair<Boolean, String> logAndReturnErrorMessage(String msg) {
        LOGGER.error(msg);
        return new Pair<>(false, msg);
    }

    @Override
    @DB
    @ActionEvent(eventType = EventTypes.EVENT_AS_NUMBER_RELEASE, eventDescription = "Releasing AS Number")
    public Pair<Boolean, String> releaseASNumber(long zoneId, long asNumber, boolean isDestroyNetworkOperation) {
        ASNumberQueryValidator.validate(asNumber);
        Account caller = CallContext.current().getCallingAccount();
        if (!isDestroyNetworkOperation && (caller == null || caller.getType() != Account.Type.ADMIN)) {
            throw new PermissionDeniedException("ASN release requires root administrator permission.");
        }
        return Transaction.execute((TransactionCallback<Pair<Boolean, String>>) status -> {
            if (dataCenterDao.lockRow(zoneId, true) == null) {
                throw new InvalidParameterValueException("The selected Zone no longer exists.");
            }
            List<ASNumberVO> candidates = asNumberDao.listByZoneAndAsNumber(zoneId, asNumber);
            if (candidates == null || candidates.size() != 1) {
                throw new InvalidParameterValueException("The ASN is absent or ambiguous in the selected Zone.");
            }
            ASNumberVO snapshot = candidates.get(0);
            ASNumberRangeVO range = asNumberRangeDao.lockRow(snapshot.getAsNumberRangeId(), true);
            if (range == null || range.getRemoved() != null || range.getDataCenterId() != zoneId) {
                throw new InvalidParameterValueException("The ASN range no longer exists in the selected Zone.");
            }
            ASNumberVO number = asNumberDao.lockRow(snapshot.getId(), true);
            if (number == null || number.getRemoved() != null || number.getDataCenterId() != zoneId
                    || number.getAsNumber() != asNumber || number.getAsNumberRangeId() != range.getId()) {
                throw new InvalidParameterValueException("The selected ASN changed. Read its state again.");
            }
            if (!number.isAllocated()) {
                return new Pair<>(true, "");
            }
            if (!isDestroyNetworkOperation) {
                String reason = lockedASNumberReleaseReason(number);
                if (!ASNumberReleasePolicy.ELIGIBLE.equals(reason)) {
                    throw new InvalidParameterValueException("ASN release is not permitted: " + reason);
                }
            }
            number.setAllocated(false);
            number.setAllocatedTime(null);
            number.setAccountId(null);
            number.setDomainId(null);
            number.setNetworkId(null);
            number.setVpcId(null);
            if (!asNumberDao.update(number.getId(), number)) {
                throw new CloudRuntimeException("Could not persist ASN release");
            }
            return new Pair<>(true, "OK");
        });
    }

    private String lockedASNumberReleaseReason(ASNumber number) {
        if (number.getNetworkId() != null && number.getVpcId() != null) {
            return ASNumberReleasePolicy.UNKNOWN;
        }
        if (number.getVpcId() != null) {
            VpcVO vpc = vpcDao.lockRow(number.getVpcId(), true);
            VpcOfferingVO offering = vpc == null ? null : vpcOfferingDao.lockRow(vpc.getVpcOfferingId(), true);
            return ASNumberReleasePolicy.reason(number, vpc != null && vpc.getRemoved() == null
                    && vpc.getZoneId() == number.getDataCenterId() && offering != null && offering.getRemoved() == null,
                    offering == null ? null : offering.isSpecifyAsNumber());
        }
        if (number.getNetworkId() != null) {
            NetworkVO network = networkDao.lockRow(number.getNetworkId(), true);
            NetworkOfferingVO offering = network == null ? null : networkOfferingDao.lockRow(network.getNetworkOfferingId(), true);
            return ASNumberReleasePolicy.reason(number, network != null && network.getRemoved() == null
                    && network.getDataCenterId() == number.getDataCenterId() && offering != null && offering.getRemoved() == null,
                    offering == null ? null : offering.isSpecifyAsNumber());
        }
        return ASNumberReleasePolicy.MISSING;
    }

    @Override
    public Map<Long, String> getASNumberReleaseReasons(List<ASNumber> numbers) {
        Map<Long, String> reasons = new HashMap<>();
        Set<Long> networkIds = new HashSet<>();
        Set<Long> vpcIds = new HashSet<>();
        for (ASNumber number : numbers) {
            reasons.put(number.getId(), number.isAllocated() ? ASNumberReleasePolicy.UNKNOWN : ASNumberReleasePolicy.NOT_ALLOCATED);
            if (!number.isAllocated()) {
                continue;
            }
            if (number.getNetworkId() != null) {
                networkIds.add(number.getNetworkId());
            }
            if (number.getVpcId() != null) {
                vpcIds.add(number.getVpcId());
            }
        }
        try {
            Map<Long, NetworkVO> networks = new HashMap<>();
            Set<Long> networkOfferingIds = new HashSet<>();
            for (NetworkVO network : asnPageReferences(networkDao, networkIds)) {
                networks.put(network.getId(), network);
                networkOfferingIds.add(network.getNetworkOfferingId());
            }
            Map<Long, VpcVO> vpcs = new HashMap<>();
            Set<Long> vpcOfferingIds = new HashSet<>();
            for (VpcVO vpc : asnPageReferences(vpcDao, vpcIds)) {
                vpcs.put(vpc.getId(), vpc);
                vpcOfferingIds.add(vpc.getVpcOfferingId());
            }
            Map<Long, NetworkOfferingVO> offerings = new HashMap<>();
            for (NetworkOfferingVO offering : asnPageReferences(networkOfferingDao, networkOfferingIds)) {
                offerings.put(offering.getId(), offering);
            }
            Map<Long, VpcOfferingVO> vpcOfferings = new HashMap<>();
            for (VpcOfferingVO offering : asnPageReferences(vpcOfferingDao, vpcOfferingIds)) {
                vpcOfferings.put(offering.getId(), offering);
            }
            for (ASNumber number : numbers) {
                NetworkVO network = networks.get(number.getNetworkId());
                VpcVO vpc = vpcs.get(number.getVpcId());
                NetworkOfferingVO offering = network == null ? null : offerings.get(network.getNetworkOfferingId());
                VpcOfferingVO vpcOffering = vpc == null ? null : vpcOfferings.get(vpc.getVpcOfferingId());
                boolean valid = number.getVpcId() != null
                        ? vpc != null && vpc.getRemoved() == null && vpc.getZoneId() == number.getDataCenterId()
                            && vpcOffering != null && vpcOffering.getRemoved() == null
                        : network != null && network.getRemoved() == null && network.getDataCenterId() == number.getDataCenterId()
                            && offering != null && offering.getRemoved() == null;
                Boolean required = number.getVpcId() != null ? vpcOffering == null ? null : vpcOffering.isSpecifyAsNumber()
                        : offering == null ? null : offering.isSpecifyAsNumber();
                reasons.put(number.getId(), ASNumberReleasePolicy.reason(number, valid, required));
            }
        } catch (RuntimeException unavailable) {
            // Reading eligibility must not emit errors/events or accidentally make a resource releasable.
            return reasons;
        }
        return reasons;
    }

    private <T> List<T> asnPageReferences(GenericDao<T, Long> dao, Set<Long> ids) {
        if (ids.isEmpty()) {
            return Collections.emptyList();
        }
        SearchCriteria<T> criteria = dao.createSearchCriteria();
        criteria.addAnd("id", SearchCriteria.Op.IN, ids.toArray());
        List<T> rows = dao.search(criteria, null);
        if (rows == null) {
            throw new CloudRuntimeException("ASN references could not be verified");
        }
        return rows;
    }

    @Override
    @DB
    @ActionEvent(eventType = EventTypes.EVENT_AS_RANGE_DELETE, eventDescription = "Deleting AS Range")
    public boolean deleteASRange(long id) {
        ASNumberRangeVO snapshot = asNumberRangeDao.findById(id);
        if (snapshot == null) {
            throw new InvalidParameterValueException("The ASN range no longer exists.");
        }
        long zoneId = snapshot.getDataCenterId();
        return Transaction.execute((TransactionCallback<Boolean>) status -> {
            if (dataCenterDao.lockRow(zoneId, true) == null) {
                throw new InvalidParameterValueException("The selected Zone no longer exists.");
            }
            ASNumberRangeVO range = asNumberRangeDao.lockRow(id, true);
            if (range == null || range.getRemoved() != null || range.getDataCenterId() != zoneId) {
                throw new InvalidParameterValueException("The ASN range no longer exists in the selected Zone.");
            }
            // Allocation holds the Zone and range locks until commit, so this is the final authoritative guard.
            List<ASNumberVO> allocated = asNumberDao.listAllocatedByASRange(id);
            if (allocated == null) {
                throw new CloudRuntimeException("Could not verify allocated AS numbers");
            }
            if (!allocated.isEmpty()) {
                throw new InvalidParameterValueException("The ASN range contains allocated AS numbers and cannot be deleted.");
            }
            int removed = asNumberDao.removeASRangeNumbers(id);
            if (!asNumberRangeDao.remove(id)) {
                throw new CloudRuntimeException("Could not remove ASN range");
            }
            LOGGER.debug("Removed ASN range {} and {} members in Zone {}", id, removed, zoneId);
            return true;
        });
    }

    @Override
    public boolean applyBgpPeers(Network network, boolean continueOnError) throws ResourceUnavailableException {
        if (!routedIpv4Manager.isDynamicRoutedNetwork(network)) {
            return true;
        }
        final String gatewayProviderStr = ntwkSrvcDao.getProviderForServiceInNetwork(network.getId(), Network.Service.Gateway);
        if (gatewayProviderStr != null) {
            NetworkElement provider = networkModel.getElementImplementingProvider(gatewayProviderStr);
            if (provider != null && provider instanceof BgpServiceProvider) {
                List<? extends BgpPeer> bgpPeers = getBgpPeersForNetwork(network);
                LOGGER.debug(String.format("Applying BPG Peers for network [%s]: [%s]", network, bgpPeers));
                return ((BgpServiceProvider) provider).applyBgpPeers(null, network, bgpPeers);
            }
        }
        return true;
    }

    @Override
    public boolean applyBgpPeers(Vpc vpc, boolean continueOnError) throws ResourceUnavailableException {
        if (!routedIpv4Manager.isDynamicRoutedVpc(vpc)) {
            return true;
        }
        final String gatewayProviderStr = vpcServiceMapDao.getProviderForServiceInVpc(vpc.getId(), Network.Service.Gateway);
        if (gatewayProviderStr != null) {
            NetworkElement provider = networkModel.getElementImplementingProvider(gatewayProviderStr);
            if (provider != null && provider instanceof BgpServiceProvider) {
                List<? extends BgpPeer> bgpPeers = getBgpPeersForVpc(vpc);
                LOGGER.debug(String.format("Applying BPG Peers for VPC [%s]: [%s]", vpc, bgpPeers));
                return ((BgpServiceProvider) provider).applyBgpPeers(vpc, null, bgpPeers);

            }
        }
        return true;
    }

    @Override
    public List<? extends BgpPeer> getBgpPeersForNetwork(Network network) {
        List<BgpPeerVO> bgpPeers;
        if (network.getVpcId() != null) {
            bgpPeers = bgpPeerDao.listNonRevokeByVpcId(network.getVpcId());
        } else {
            bgpPeers = bgpPeerDao.listNonRevokeByNetworkId(network.getId());
        }
        if (CollectionUtils.isEmpty(bgpPeers)) {
            Account owner = accountDao.findByIdIncludingRemoved(network.getAccountId());
            List<Long> bgpPeerIds = routedIpv4Manager.getBgpPeerIdsForAccount(owner, network.getDataCenterId());
            bgpPeers = bgpPeerIds.stream()
                    .map(bgpPeerId -> bgpPeerDao.findById(bgpPeerId))
                    .collect(Collectors.toList());
        }
        return bgpPeers;
    }

    @Override
    public List<? extends BgpPeer> getBgpPeersForVpc(Vpc vpc) {
        List<BgpPeerVO> bgpPeers = bgpPeerDao.listNonRevokeByVpcId(vpc.getId());
        if (CollectionUtils.isEmpty(bgpPeers)) {
            Account owner = accountDao.findByIdIncludingRemoved(vpc.getAccountId());
            List<Long> bgpPeerIds = routedIpv4Manager.getBgpPeerIdsForAccount(owner, vpc.getZoneId());
            bgpPeers = bgpPeerIds.stream()
                    .map(bgpPeerId -> bgpPeerDao.findById(bgpPeerId))
                    .collect(Collectors.toList());
        }
        return bgpPeers;
    }
}
