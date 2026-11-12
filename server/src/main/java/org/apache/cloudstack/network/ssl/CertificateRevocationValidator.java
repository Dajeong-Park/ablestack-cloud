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
package org.apache.cloudstack.network.ssl;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.cert.CertPathValidator;
import java.security.cert.CertPathValidatorException;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.PKIXCertPathBuilderResult;
import java.security.cert.PKIXParameters;
import java.security.cert.PKIXRevocationChecker;
import java.security.cert.TrustAnchor;
import java.security.cert.X509CRL;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.EnumSet;
import java.util.List;

import org.bouncycastle.asn1.ASN1Primitive;
import org.bouncycastle.asn1.x509.AccessDescription;
import org.bouncycastle.asn1.x509.AuthorityInformationAccess;
import org.bouncycastle.asn1.x509.CRLDistPoint;
import org.bouncycastle.asn1.x509.DistributionPoint;
import org.bouncycastle.asn1.x509.DistributionPointName;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.ocsp.BasicOCSPResp;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPReqBuilder;
import org.bouncycastle.cert.ocsp.OCSPResp;
import org.bouncycastle.cert.ocsp.SingleResp;
import org.bouncycastle.cert.ocsp.UnknownStatus;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

/** Full issuer path checks with explicit, bounded fetches; an unavailable status never becomes success. */
class CertificateRevocationValidator {
    private final RevocationHttpClient http;

    CertificateRevocationValidator(RevocationHttpClient http) {
        this.http = http;
    }

    void validate(PKIXCertPathBuilderResult path) {
        List<? extends Certificate> certificates = path.getCertPath().getCertificates();
        if (certificates.isEmpty() || certificates.size() > 8) {
            throw RevocationHttpClient.failure("UNSUPPORTED_PATH");
        }
        for (int i = 0; i < certificates.size(); i++) {
            X509Certificate cert = (X509Certificate)certificates.get(i);
            X509Certificate issuer = i + 1 < certificates.size() ? (X509Certificate)certificates.get(i + 1) : path.getTrustAnchor().getTrustedCert();
            check(cert, issuer);
        }
    }

    void check(X509Certificate cert, X509Certificate issuer) {
        try {
            List<String> ocsp = ocspUris(cert);
            for (String uri : ocsp) {
                try {
                    checkOcsp(cert, issuer, uri);
                    return;
                } catch (IOException unavailable) {
                    // Only retrieval failure may fall back to an authenticated, current full CRL.
                }
            }
            List<String> crls = crlUris(cert);
            for (String uri : crls) {
                try {
                    checkCrl(cert, issuer, http.fetch(uri, null));
                    return;
                } catch (IOException unavailable) {
                    // Try the next explicitly advertised and guarded distribution point.
                }
            }
            throw RevocationHttpClient.failure("UNAVAILABLE");
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            // Never include certificate bodies, private keys or URI query strings in a public error.
            throw RevocationHttpClient.failure("INVALID_RESPONSE");
        }
    }

    private ASN1Primitive extension(X509Certificate cert, org.bouncycastle.asn1.ASN1ObjectIdentifier oid) throws IOException {
        byte[] value = cert.getExtensionValue(oid.getId());
        return value == null ? null : ASN1Primitive.fromByteArray(org.bouncycastle.asn1.ASN1OctetString.getInstance(value).getOctets());
    }

    List<String> ocspUris(X509Certificate cert) throws IOException {
        ASN1Primitive value = extension(cert, Extension.authorityInfoAccess);
        List<String> result = new ArrayList<>();
        if (value != null) {
            for (AccessDescription access : AuthorityInformationAccess.getInstance(value).getAccessDescriptions()) {
                if (AccessDescription.id_ad_ocsp.equals(access.getAccessMethod())) {
                    addUri(result, access.getAccessLocation());
                }
            }
        }
        return result;
    }

    List<String> crlUris(X509Certificate cert) throws IOException {
        ASN1Primitive value = extension(cert, Extension.cRLDistributionPoints);
        List<String> result = new ArrayList<>();
        if (value != null) {
            for (DistributionPoint point : CRLDistPoint.getInstance(value).getDistributionPoints()) {
                if (point.getReasons() != null || point.getCRLIssuer() != null) {
                    throw RevocationHttpClient.failure("UNSUPPORTED_CRL_SCOPE");
                }
                DistributionPointName name = point.getDistributionPoint();
                if (name == null || name.getType() != DistributionPointName.FULL_NAME) {
                    throw RevocationHttpClient.failure("UNSUPPORTED_CRL_SCOPE");
                }
                for (GeneralName uri : GeneralNames.getInstance(name.getName()).getNames()) {
                    addUri(result, uri);
                }
            }
        }
        return result;
    }

    private void addUri(List<String> result, GeneralName name) {
        if (name.getTagNo() != GeneralName.uniformResourceIdentifier || result.size() >= 3) {
            throw RevocationHttpClient.failure("UNSUPPORTED_ENDPOINT");
        }
        String address = name.getName().toString();
        RevocationHttpClient.uri(address);
        result.add(address);
    }

    private void freshness(Date issued, Date expires, Date now) {
        if (issued == null || expires == null || issued.after(new Date(now.getTime() + 300000)) || expires.before(now) || !expires.after(issued)) {
            throw RevocationHttpClient.failure("STALE_RESPONSE");
        }
    }

    void checkCrl(X509Certificate cert, X509Certificate issuer, byte[] data) throws GeneralSecurityException {
        X509CRL crl = (X509CRL)CertificateFactory.getInstance("X.509").generateCRL(new ByteArrayInputStream(data));
        if (!issuer.getSubjectX500Principal().equals(crl.getIssuerX500Principal())
                || crl.getExtensionValue(Extension.deltaCRLIndicator.getId()) != null
                || crl.getExtensionValue(Extension.issuingDistributionPoint.getId()) != null || crl.hasUnsupportedCriticalExtension()) {
            throw RevocationHttpClient.failure("INVALID_CRL_SCOPE");
        }
        boolean[] usage = issuer.getKeyUsage();
        if (usage != null && (usage.length <= 6 || !usage[6])) {
            throw RevocationHttpClient.failure("INVALID_CRL_SIGNER");
        }
        crl.verify(issuer.getPublicKey());
        freshness(crl.getThisUpdate(), crl.getNextUpdate(), new Date());
        if (crl.isRevoked(cert)) {
            throw RevocationHttpClient.failure("REVOKED");
        }
    }

    void checkOcsp(X509Certificate cert, X509Certificate issuer, String uri) throws Exception {
        CertificateID id = new CertificateID(new JcaDigestCalculatorProviderBuilder().build().get(CertificateID.HASH_SHA1),
                new JcaX509CertificateHolder(issuer), cert.getSerialNumber());
        OCSPReq request = new OCSPReqBuilder().addRequest(id).build();
        byte[] bytes = http.fetch(uri, request.getEncoded());
        try {
            validateOcsp(cert, issuer, id, bytes);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw RevocationHttpClient.failure("INVALID_OCSP_RESPONSE");
        }
    }

    void validateOcsp(X509Certificate cert, X509Certificate issuer, CertificateID id, byte[] bytes) throws Exception {
        OCSPResp response = new OCSPResp(bytes);
        if (response.getStatus() != 0 || !(response.getResponseObject() instanceof BasicOCSPResp)) {
            throw RevocationHttpClient.failure("INVALID_OCSP_RESPONSE");
        }
        BasicOCSPResp basic = (BasicOCSPResp)response.getResponseObject();
        SingleResp match = null;
        for (SingleResp single : basic.getResponses()) {
            if (id.equals(single.getCertID())) {
                if (match != null) {
                    throw RevocationHttpClient.failure("INVALID_OCSP_RESPONSE");
                }
                match = single;
            }
        }
        if (match == null) {
            throw RevocationHttpClient.failure("INVALID_OCSP_CERT_ID");
        }
        freshness(match.getThisUpdate(), match.getNextUpdate(), new Date());
        if (basic.getProducedAt() == null || basic.getProducedAt().after(new Date(System.currentTimeMillis() + 300000))) {
            throw RevocationHttpClient.failure("STALE_RESPONSE");
        }
        // The standard PKIX checker authenticates signatures, issuer/delegated responder authorization and status.
        // Supply the exact response and NO_FALLBACK so the provider never performs another URL lookup.
        CertPathValidator validator = CertPathValidator.getInstance("PKIX");
        PKIXRevocationChecker checker = (PKIXRevocationChecker)validator.getRevocationChecker();
        checker.setOcspResponses(Collections.singletonMap(cert, bytes));
        checker.setOptions(EnumSet.of(PKIXRevocationChecker.Option.NO_FALLBACK));
        PKIXParameters parameters = new PKIXParameters(Collections.singleton(new TrustAnchor(issuer, null)));
        parameters.setRevocationEnabled(false);
        parameters.addCertPathChecker(checker);
        try {
            validator.validate(CertificateFactory.getInstance("X.509").generateCertPath(Collections.singletonList(cert)), parameters);
        } catch (GeneralSecurityException e) {
            if (e instanceof CertPathValidatorException && ((CertPathValidatorException)e).getReason() == CertPathValidatorException.BasicReason.REVOKED) {
                throw RevocationHttpClient.failure("REVOKED");
            }
            if (e instanceof CertPathValidatorException
                    && ((CertPathValidatorException)e).getReason() == CertPathValidatorException.BasicReason.UNDETERMINED_REVOCATION_STATUS
                    && match.getCertStatus() instanceof UnknownStatus) {
                throw RevocationHttpClient.failure("UNKNOWN");
            }
            throw RevocationHttpClient.failure("INVALID_OCSP_RESPONSE");
        }
    }
}
