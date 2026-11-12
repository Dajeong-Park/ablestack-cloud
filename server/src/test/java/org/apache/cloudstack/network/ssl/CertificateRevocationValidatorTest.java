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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.StringWriter;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.AccessDescription;
import org.bouncycastle.asn1.x509.AuthorityInformationAccess;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.CRLDistPoint;
import org.bouncycastle.asn1.x509.DistributionPoint;
import org.bouncycastle.asn1.x509.DistributionPointName;
import org.bouncycastle.asn1.x509.ExtendedKeyUsage;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.asn1.x509.KeyPurposeId;
import org.bouncycastle.asn1.x509.KeyUsage;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509v2CRLBuilder;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPRespBuilder;
import org.bouncycastle.cert.ocsp.RevokedStatus;
import org.bouncycastle.cert.ocsp.UnknownStatus;
import org.bouncycastle.cert.ocsp.jcajce.JcaBasicOCSPRespBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

public class CertificateRevocationValidatorTest {
    private static KeyPair rootKey;
    private static KeyPair interKey;
    private static KeyPair leafKey;
    private static X509Certificate root;
    private X509Certificate inter;
    private X509Certificate leaf;
    private final Map<BigInteger, byte[]> ocsp = new HashMap<>();
    private final Map<String, byte[]> crls = new HashMap<>();
    private CertServiceImpl service;
    private CertificateRevocationValidator validator;
    private int requests;

    private static Date offset(long millis) { return new Date(System.currentTimeMillis() + millis); }

    @BeforeClass public static void keys() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        rootKey = generator.generateKeyPair();
        interKey = generator.generateKeyPair();
        leafKey = generator.generateKeyPair();
        root = certificate(null, rootKey, rootKey, 1, true, false, false);
    }

    private static X509Certificate certificate(X509Certificate issuer, KeyPair signing, KeyPair key, long serial, boolean ca, boolean withOcsp, boolean withCrl) throws Exception {
        X500Name subject = new X500Name("CN=Revocation Test " + serial);
        X500Name issuerName = issuer == null ? subject : new X500Name(issuer.getSubjectX500Principal().getName());
        JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(issuerName, BigInteger.valueOf(serial), offset(-3600000), offset(86400000), subject, key.getPublic());
        builder.addExtension(Extension.basicConstraints, true, new BasicConstraints(ca));
        builder.addExtension(Extension.keyUsage, true, new KeyUsage(ca ? KeyUsage.keyCertSign | KeyUsage.cRLSign : KeyUsage.digitalSignature | KeyUsage.keyEncipherment));
        if (!ca) { builder.addExtension(Extension.extendedKeyUsage, false, new ExtendedKeyUsage(KeyPurposeId.id_kp_serverAuth)); }
        if (withOcsp) {
            builder.addExtension(Extension.authorityInfoAccess, false, new AuthorityInformationAccess(new AccessDescription(AccessDescription.id_ad_ocsp,
                    new GeneralName(GeneralName.uniformResourceIdentifier, "http://ca.example/ocsp"))));
        }
        if (withCrl) {
            GeneralName uri = new GeneralName(GeneralName.uniformResourceIdentifier, "http://ca.example/" + (ca ? "root" : "inter") + ".crl");
            builder.addExtension(Extension.cRLDistributionPoints, false, new CRLDistPoint(new DistributionPoint[] {
                    new DistributionPoint(new DistributionPointName(new GeneralNames(uri)), null, null)}));
        }
        return new JcaX509CertificateConverter().setProvider("BC").getCertificate(builder.build(new JcaContentSignerBuilder("SHA256withRSA").build(signing.getPrivate())));
    }

    @Before public void setup() throws Exception {
        inter = certificate(root, rootKey, interKey, 2, true, true, true);
        leaf = certificate(inter, interKey, leafKey, 3, false, true, true);
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, interKey, null, -60000, 3600000));
        ocsp.put(inter.getSerialNumber(), response(inter, root, rootKey, null, -60000, 3600000));
        crls.put("http://ca.example/inter.crl", crl(inter, interKey, null, -60000, 3600000));
        crls.put("http://ca.example/root.crl", crl(root, rootKey, null, -60000, 3600000));
        RevocationHttpClient http = mock(RevocationHttpClient.class);
        when(http.fetch(anyString(), nullable(byte[].class))).thenAnswer(call -> {
            requests++;
            byte[] request = call.getArgument(1);
            byte[] result = request == null ? crls.get(call.getArgument(0))
                    : ocsp.get(new OCSPReq(request).getRequestList()[0].getCertID().getSerialNumber());
            if (result == null) { throw new IOException("offline"); }
            return result;
        });
        validator = new CertificateRevocationValidator(http);
        service = spy(new CertServiceImpl());
        doReturn(validator).when(service).createRevocationValidator();
    }

    private byte[] response(X509Certificate cert, X509Certificate issuer, KeyPair signing, CertificateStatus status, long issued, long expires) throws Exception {
        CertificateID id = new CertificateID(new JcaDigestCalculatorProviderBuilder().build().get(CertificateID.HASH_SHA1),
                new JcaX509CertificateHolder(issuer), cert.getSerialNumber());
        JcaBasicOCSPRespBuilder builder = new JcaBasicOCSPRespBuilder(issuer.getPublicKey(),
                new JcaDigestCalculatorProviderBuilder().build().get(CertificateID.HASH_SHA1));
        builder.addResponse(id, status, offset(issued), offset(expires), null);
        return new OCSPRespBuilder().build(0, builder.build(new JcaContentSignerBuilder("SHA256withRSA").build(signing.getPrivate()),
                new X509CertificateHolder[] {new JcaX509CertificateHolder(issuer)}, new Date())).getEncoded();
    }

    private byte[] crl(X509Certificate issuer, KeyPair signing, BigInteger revoked, long issued, long expires) throws Exception {
        JcaX509v2CRLBuilder builder = new JcaX509v2CRLBuilder(issuer, offset(issued));
        builder.setNextUpdate(offset(expires));
        if (revoked != null) { builder.addCRLEntry(revoked, offset(-120000), 1); }
        return builder.build(new JcaContentSignerBuilder("SHA256withRSA").build(signing.getPrivate())).getEncoded();
    }

    private String pem(Object value) throws IOException {
        StringWriter text = new StringWriter();
        try (JcaPEMWriter writer = new JcaPEMWriter(text)) { writer.writeObject(value); }
        return text.toString();
    }
    private void validate(boolean enabled) throws Exception {
        service.validate(pem(leaf), pem(leafKey.getPrivate()), null, pem(inter) + pem(root), enabled);
    }
    private void failure(String category) {
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> validate(true));
        assertEquals("Invalid certificate chain: revocation " + category, error.getMessage());
    }

    @Test public void defaultGoodOcspChecksLeafAndIntermediate() throws Exception { validate(true); assertEquals(2, requests); }
    @Test public void fullCrlPathSucceedsWhenOcspUnavailable() throws Exception { ocsp.clear(); validate(true); assertEquals(4, requests); }
    @Test public void crlOnlyPathSucceeds() throws Exception {
        inter = certificate(root, rootKey, interKey, 2, true, false, true);
        leaf = certificate(inter, interKey, leafKey, 3, false, false, true);
        validate(true); assertEquals(2, requests);
    }
    @Test public void revokedOcspIsRejectedWithoutCrlFallback() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, interKey, new RevokedStatus(offset(-120000), 1), -60000, 3600000));
        failure("REVOKED"); assertEquals(1, requests);
    }
    @Test public void revokedIntermediateOcspIsRejected() throws Exception {
        ocsp.put(inter.getSerialNumber(), response(inter, root, rootKey, new RevokedStatus(offset(-120000), 1), -60000, 3600000));
        failure("REVOKED"); assertEquals(2, requests);
    }
    @Test public void signedUnknownDoesNotBecomeGoodViaCrl() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, interKey, new UnknownStatus(), -60000, 3600000));
        failure("UNKNOWN"); assertEquals(1, requests);
    }
    @Test public void unavailableAllSourcesFailsClosed() { ocsp.clear(); crls.clear(); failure("UNAVAILABLE"); }
    @Test public void restoredResponderAllowsRetry() throws Exception {
        byte[] good = ocsp.remove(leaf.getSerialNumber()); byte[] list = crls.remove("http://ca.example/inter.crl"); failure("UNAVAILABLE");
        ocsp.put(leaf.getSerialNumber(), good); crls.put("http://ca.example/inter.crl", list); validate(true);
    }
    @Test public void staleOcspIsRejected() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, interKey, null, -7200000, -3600000)); failure("STALE_RESPONSE");
    }
    @Test public void futureOcspIsRejected() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, interKey, null, 3600000, 7200000)); failure("STALE_RESPONSE");
    }
    @Test public void foreignOcspCertIdIsRejected() { ocsp.put(leaf.getSerialNumber(), ocsp.get(inter.getSerialNumber())); failure("INVALID_OCSP_CERT_ID"); }
    @Test public void invalidOcspSignatureIsRejected() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, rootKey, null, -60000, 3600000)); failure("INVALID_OCSP_RESPONSE");
    }
    @Test public void forgedRevokedStatusIsNotAuthenticatedRevocation() throws Exception {
        ocsp.put(leaf.getSerialNumber(), response(leaf, inter, rootKey, new RevokedStatus(offset(-120000), 1), -60000, 3600000)); failure("INVALID_OCSP_RESPONSE");
    }
    @Test public void malformedOcspDoesNotTriggerCrlFallback() { ocsp.put(leaf.getSerialNumber(), new byte[] {1, 2, 3}); failure("INVALID_OCSP_RESPONSE"); assertEquals(1, requests); }
    @Test public void revokedCrlFailsClosed() throws Exception {
        ocsp.clear(); crls.put("http://ca.example/inter.crl", crl(inter, interKey, leaf.getSerialNumber(), -60000, 3600000)); failure("REVOKED");
    }
    @Test public void revokedIntermediateCrlFailsClosed() throws Exception {
        ocsp.clear(); crls.put("http://ca.example/root.crl", crl(root, rootKey, inter.getSerialNumber(), -60000, 3600000)); failure("REVOKED");
    }
    @Test public void staleCrlFailsClosed() throws Exception {
        ocsp.clear(); crls.put("http://ca.example/inter.crl", crl(inter, interKey, null, -7200000, -3600000)); failure("STALE_RESPONSE");
    }
    @Test public void futureCrlFailsClosed() throws Exception {
        ocsp.clear(); crls.put("http://ca.example/inter.crl", crl(inter, interKey, null, 3600000, 7200000)); failure("STALE_RESPONSE");
    }
    @Test public void wrongCrlSignerFailsClosed() throws Exception {
        ocsp.clear(); crls.put("http://ca.example/inter.crl", crl(inter, rootKey, null, -60000, 3600000)); failure("INVALID_RESPONSE");
    }
    @Test public void foreignCrlIssuerFailsClosed() {
        ocsp.clear(); crls.put("http://ca.example/inter.crl", crls.get("http://ca.example/root.crl")); failure("INVALID_CRL_SCOPE");
    }
    @Test public void malformedCrlFailsClosed() { ocsp.clear(); crls.put("http://ca.example/inter.crl", new byte[] {1, 2}); failure("INVALID_RESPONSE"); }
    @Test public void noAdvertisedStatusFailsClosed() throws Exception {
        leaf = certificate(inter, interKey, leafKey, 3, false, false, false); failure("UNAVAILABLE");
    }
    @Test public void explicitFalseDoesNotStartAnyFetch() throws Exception {
        ocsp.clear(); crls.clear(); validate(false); assertEquals(0, requests);
    }
    @Test public void suppliedLeafCannotReplaceIssuerRoot() throws Exception {
        assertThrows(IllegalStateException.class, () -> service.validate(pem(leaf), pem(leafKey.getPrivate()), null, pem(inter) + pem(leaf), true));
        assertEquals(0, requests);
    }
}
