# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See NOTICE. Apache License, Version 2.0.
# http://www.apache.org/licenses/LICENSE-2.0
"""Owned AD DNS/SPN deltas. No hostname, account, SMB renderer or DATA changes."""
import base64
import ctypes as ct
import ctypes.util
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import time
import uuid

VERSION = 1
OPERATION = "smb service names apply"


class NameError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def require(ok, code):
    if not ok:
        raise NameError(code)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def fqdn(value, zone):
    require(isinstance(value, str), "SMB_NAME_INVALID")
    value = value.rstrip(".").lower()
    labels = value.split(".")
    require(len(value) <= 253 and len(labels) > len(zone.split(".")) and value.endswith("." + zone)
            and all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", x) for x in labels),
            "SMB_NAME_INVALID")
    return value


def escaped(value):
    return "".join("\\%02x" % ord(c) if c in "*()\\\0" else c for c in value)


def command(args):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=15)
        require(result.returncode == 0 and len(result.stdout) < 262144, "SMB_NAME_AD_UNAVAILABLE")
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        raise NameError("SMB_NAME_AD_UNAVAILABLE") from None


def identity_settings():
    info = dict(line.split(": ", 1) for line in command(["net", "ads", "info"]).splitlines() if ": " in line)
    realm = command(["testparm", "-s", "--parameter-name=realm"]).upper()
    machine = command(["testparm", "-s", "--parameter-name=netbios name"]).upper()
    dc = info.get("LDAP server name", "").lower()
    require(re.fullmatch(r"[A-Z0-9.-]+", realm) and re.fullmatch(r"[A-Z0-9-]{1,15}", machine)
            and dc.endswith("." + realm.lower()), "SMB_NAME_AD_IDENTITY_UNCONFIRMED")
    command(["net", "ads", "testjoin"])
    return {"realm": realm, "zone": realm.lower(), "machine": machine, "dc": dc,
            "base": ",".join("DC=" + p for p in realm.split("."))}


class Ldap:
    """The installed OpenLDAP ABI; sealed GSSAPI only, no referrals or simple bind."""
    def __init__(self, dc):
        self.lib = ct.CDLL(ctypes.util.find_library("ldap-2.5") or "libldap-2.5.so.0")
        self.ld = ct.c_void_p()
        P, C, I = ct.c_void_p, ct.c_char_p, ct.c_int
        class Berval(ct.Structure):
            _fields_ = [("length", ct.c_size_t), ("value", P)]
        class Mod(ct.Structure):
            _fields_ = [("op", I), ("type", C), ("values", ct.POINTER(C))]
        class Interact(ct.Structure):
            _fields_ = [("id", ct.c_ulong), ("challenge", C), ("prompt", C),
                        ("default", C), ("result", P), ("length", ct.c_uint)]
        self.Berval, self.Mod = Berval, Mod
        signatures = {
            "ldap_initialize": ([ct.POINTER(P), C], I),
            "ldap_set_option": ([P, I, P], I), "ldap_get_option": ([P, I, P], I),
            "ldap_sasl_interactive_bind_s": ([P, C, C, P, P, ct.c_uint, P, P], I),
            "ldap_search_ext_s": ([P, C, I, C, ct.POINTER(C), I, P, P, P, I, ct.POINTER(P)], I),
            "ldap_first_entry": ([P, P], P), "ldap_next_entry": ([P, P], P),
            "ldap_count_entries": ([P, P], I),
            "ldap_get_values_len": ([P, P, C], ct.POINTER(ct.POINTER(Berval))),
            "ldap_value_free_len": ([ct.POINTER(ct.POINTER(Berval))], None),
            "ldap_msgfree": ([P], I), "ldap_unbind_ext_s": ([P, P, P], I),
            "ldap_modify_ext_s": ([P, C, ct.POINTER(ct.POINTER(Mod)), P, P], I)}
        for name, (args, result) in signatures.items():
            fn = getattr(self.lib, name); fn.argtypes, fn.restype = args, result
        self.refs = []
        @ct.CFUNCTYPE(I, P, ct.c_uint, P, P)
        def callback(ld, flags, defaults, items):
            arr = ct.cast(items, ct.POINTER(Interact)); index = 0
            while arr[index].id:
                # GSSAPI authorization identity is the ticket owner, never an impersonated user.
                if arr[index].id != 0x4001:
                    return -1
                value = ct.create_string_buffer(b""); self.refs.append(value)
                arr[index].result = ct.cast(value, P); arr[index].length = 0; index += 1
            return 0
        self.callback = callback
        try:
            require(self.lib.ldap_initialize(ct.byref(self.ld), ("ldap://" + dc).encode()) == 0, "SMB_NAME_LDAP_UNAVAILABLE")
            # Protocol v3; disable referrals; use locator FQDN without reverse-DNS substitution.
            for option, value in ((0x11, 3), (0x610b, 1), (0x5002, 15), (0x5005, 15)):
                if option in (0x5002, 0x5005):
                    continue
                require(self.lib.ldap_set_option(self.ld, option, ct.byref(I(value))) == 0, "SMB_NAME_LDAP_OPTION_FAILED")
            require(self.lib.ldap_set_option(self.ld, 0x0008, None) == 0, "SMB_NAME_LDAP_OPTION_FAILED")
            class Timeval(ct.Structure):
                _fields_ = [("seconds", ct.c_long), ("micros", ct.c_long)]
            timeout = Timeval(10, 0)
            for option in (0x5002, 0x5005):
                require(self.lib.ldap_set_option(self.ld, option, ct.byref(timeout)) == 0, "SMB_NAME_LDAP_OPTION_FAILED")
            require(self.lib.ldap_set_option(self.ld, 0x6106, ct.cast(C(b"minssf=128"), P)) == 0, "SMB_NAME_LDAP_OPTION_FAILED")
            code = self.lib.ldap_sasl_interactive_bind_s(self.ld, None, b"GSSAPI", None, None, 2, ct.cast(callback, P), None)
            ssf = ct.c_uint()
            self.lib.ldap_get_option(self.ld, 0x6104, ct.byref(ssf))
            require(code == 0 and ssf.value >= 128, "SMB_NAME_AD_AUTHENTICATION_FAILED")
        except BaseException:
            self.close()
            raise

    def close(self):
        if self.ld:
            self.lib.ldap_unbind_ext_s(self.ld, None, None)
            self.ld = ct.c_void_p()

    def search(self, base, scope, query, attributes):
        C, P = ct.c_char_p, ct.c_void_p
        result = P()
        names = (C * (len(attributes) + 1))(*(x.encode() for x in attributes), None)
        code = self.lib.ldap_search_ext_s(self.ld, base.encode(), scope, query.encode(), names,
                                         0, None, None, None, 100, ct.byref(result))
        try:
            if code == 32:
                return []
            require(code == 0, "SMB_NAME_LDAP_QUERY_UNCONFIRMED")
            require(0 <= self.lib.ldap_count_entries(self.ld, result) <= 100, "SMB_NAME_LDAP_QUERY_LIMIT")
            rows = []; entry = self.lib.ldap_first_entry(self.ld, result)
            while entry:
                row = {}
                for name in attributes:
                    values = self.lib.ldap_get_values_len(self.ld, entry, name.encode()); items = []
                    if values:
                        try:
                            i = 0
                            while values[i]:
                                value = values[i].contents
                                require(value.length <= 65536 and i < 256, "SMB_NAME_LDAP_QUERY_LIMIT")
                                items.append(ct.string_at(value.value, value.length)); i += 1
                        finally:
                            self.lib.ldap_value_free_len(values)
                    row[name] = items
                rows.append(row); entry = self.lib.ldap_next_entry(self.ld, entry)
            return rows
        finally:
            if result:
                self.lib.ldap_msgfree(result)

    def modify(self, guid, add, value):
        require(re.fullmatch(r"[0-9a-f-]{36}", guid) and re.fullmatch(r"cifs/[a-z0-9.-]+", value), "SMB_NAME_SPN_INVALID")
        values = (ct.c_char_p * 2)(value.encode(), None)
        mod = self.Mod(0 if add else 1, b"servicePrincipalName", values)
        mods = (ct.POINTER(self.Mod) * 2)(ct.pointer(mod), None)
        code = self.lib.ldap_modify_ext_s(self.ld, ("<GUID=" + guid + ">").encode(), mods, None, None)
        require(code == 0, "SMB_NAME_SPN_ACCESS_DENIED" if code in (19, 50) else "SMB_NAME_SPN_CHANGE_UNCONFIRMED")


class NativeDirectory:
    def __init__(self, credentials=None):
        self.settings = identity_settings()
        self.credentials = credentials or {}
        self.ldap = None
        self.key = None

    def __enter__(self):
        self.keys = ct.CDLL(ctypes.util.find_library("keyutils"))
        self.keys.keyctl_join_session_keyring.argtypes = [ct.c_char_p]
        self.keys.keyctl_join_session_keyring.restype = ct.c_long
        self.key = self.keys.keyctl_join_session_keyring(("smb-names-" + str(uuid.uuid4())).encode())
        require(self.key > 0, "SMB_NAME_CREDENTIAL_ISOLATION_UNAVAILABLE")
        self.cache = "KEYRING:session:smb-ad-names"
        self.previous_cache = os.environ.get("KRB5CCNAME")
        os.environ["KRB5CCNAME"] = self.cache
        try:
            user = self.credentials.get("username")
            if user:
                require(isinstance(user, str) and len(user) <= 255 and "\n" not in user, "SMB_NAME_AD_AUTHENTICATION_FAILED")
                user = user.split("\\")[-1].split("@")[0]
                result = subprocess.run(["kinit", "-c", self.cache, user + "@" + self.settings["realm"]],
                    input=self.credentials.get("password", "") + "\n", capture_output=True, text=True, timeout=15)
            else:
                user = self.settings["machine"] + "$"
                result = subprocess.run(["kinit", "-c", self.cache, "-k", "-t", "/etc/krb5.keytab",
                                         user + "@" + self.settings["realm"]], capture_output=True, text=True, timeout=15)
            require(result.returncode == 0, "SMB_NAME_AD_AUTHENTICATION_FAILED")
            self.user = user
            self.ldap = Ldap(self.settings["dc"])
            from samba.credentials import Credentials, MUST_USE_KERBEROS
            from samba.param import LoadParm
            from samba import gensec
            from samba.dcerpc import dnsserver
            lp = LoadParm(); lp.load("/etc/samba/smb.conf")
            creds = Credentials(); creds.guess(lp); creds.set_username(user)
            creds.set_realm(self.settings["realm"]); creds.set_domain(command(["testparm", "-s", "--parameter-name=workgroup"]))
            creds.set_kerberos_state(MUST_USE_KERBEROS); creds.set_named_ccache(self.cache)
            creds.set_gensec_features(creds.get_gensec_features() | gensec.FEATURE_SEAL)
            self.dns = dnsserver.dnsserver("ncacn_ip_tcp:" + self.settings["dc"] + "[seal]", lp, creds)
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *args):
        if self.ldap:
            self.ldap.close()
        if self.key is not None:
            self.keys.keyctl_clear(ct.c_long(self.key))
        if self.previous_cache is None:
            os.environ.pop("KRB5CCNAME", None)
        else:
            os.environ["KRB5CCNAME"] = self.previous_cache

    def computer(self, expected=None):
        attrs = ["objectGUID", "objectSid", "dNSHostName", "servicePrincipalName"]
        base = "<GUID=" + expected + ">" if expected else self.settings["base"]
        query = "(objectClass=computer)" if expected else "(sAMAccountName=" + escaped(self.settings["machine"] + "$") + ")"
        rows = self.ldap.search(base, 0 if expected else 2, query, attrs)
        require(len(rows) == 1, "SMB_NAME_COMPUTER_IDENTITY_UNCONFIRMED")
        row = rows[0]
        if expected:
            current = self.ldap.search(self.settings["base"], 2,
                "(sAMAccountName=" + escaped(self.settings["machine"] + "$") + ")", ["objectGUID"])
            require(len(current)==1 and current[0]["objectGUID"]==row["objectGUID"],
                    "SMB_NAME_COMPUTER_IDENTITY_CHANGED")
        require(len(row["objectGUID"]) == len(row["objectSid"]) == 1, "SMB_NAME_COMPUTER_IDENTITY_UNCONFIRMED")
        return {"guid": str(uuid.UUID(bytes_le=row["objectGUID"][0])), "sid": row["objectSid"][0].hex(),
                "fqdn": row["dNSHostName"][0].decode().lower(), "account": self.settings["machine"]+"$",
                "spns": sorted(x.decode().lower() for x in row["servicePrincipalName"]),
                **{k: self.settings[k] for k in ("zone", "dc", "realm")}}

    def owners(self, name):
        terms = ["(servicePrincipalName=" + escaped(p + "/" + name) + ")" for p in ("cifs", "host", "restrictedkrbhost")]
        terms += ["(dNSHostName=" + escaped(name) + ")", "(msDS-AdditionalDnsHostName=" + escaped(name) + ")"]
        return sorted(str(uuid.UUID(bytes_le=r["objectGUID"][0])) for r in self.ldap.search(
            self.settings["base"], 2, "(|" + "".join(terms) + ")", ["objectGUID"]))

    def records(self, name):
        from samba.dcerpc import dnsserver
        from samba import WERRORError, werror
        try:
            _, rows = self.dns.DnssrvEnumRecords2(dnsserver.DNS_CLIENT_VERSION_LONGHORN, 0, self.settings["dc"],
                self.settings["zone"], name[:-(len(self.settings["zone"]) + 1)], None, 255,
                dnsserver.DNS_RPC_VIEW_AUTHORITY_DATA, None, None)
            return list(rows.rec[0].records) if rows and rows.count else []
        except WERRORError as error:
            if error.args[0] == werror.WERR_DNS_ERROR_NAME_DOES_NOT_EXIST:
                # Confirm the zone exists independently; do not treat a missing zone as empty.
                require(self.ldap.search("DC=" + self.settings["zone"] + ",CN=MicrosoftDNS,DC=DomainDnsZones," +
                    self.settings["base"], 0, "(objectClass=dnsZone)", ["objectGUID"]), "SMB_NAME_DNS_ZONE_UNCONFIRMED")
                return []
            raise NameError("SMB_NAME_DNS_QUERY_UNCONFIRMED") from None

    def node(self, name):
        label = name[:-(len(self.settings["zone"]) + 1)]
        rows = self.ldap.search("DC=" + label + ",DC=" + self.settings["zone"] +
            ",CN=MicrosoftDNS,DC=DomainDnsZones," + self.settings["base"], 0, "(objectClass=dnsNode)", ["objectGUID"])
        require(len(rows) <= 1, "SMB_NAME_DNS_OWNER_UNCONFIRMED")
        return str(uuid.UUID(bytes_le=rows[0]["objectGUID"][0])) if rows else None

    def change_dns(self, name, add, address, image=None):
        from samba.dcerpc import dnsserver
        from samba.netcmd import dns
        from samba.ndr import ndr_unpack
        from samba import WERRORError, werror
        rec = dns.data_to_dns_record(1, address)
        rec.dwTtlSeconds = 300
        if add and image:
            require(isinstance(image, str) and len(image) <= 65536, "SMB_NAME_DNS_IMAGE_INVALID")
            rec = ndr_unpack(dnsserver.DNS_RPC_RECORD, base64.b64decode(image, validate=True))
            require(rec.wType == 1 and str(rec.data) == address, "SMB_NAME_DNS_IMAGE_INVALID")
        if not add:
            rec = next((r for r in self.records(name) if r.wType == 1 and str(r.data) == address), None)
            require(rec is not None, "SMB_NAME_DNS_RECORD_CHANGED")
        buf = dnsserver.DNS_RPC_RECORD_BUF(); buf.rec = rec
        try:
            self.dns.DnssrvUpdateRecord2(dnsserver.DNS_CLIENT_VERSION_LONGHORN, 0, self.settings["dc"],
                self.settings["zone"], name[:-(len(self.settings["zone"]) + 1)], buf if add else None, None if add else buf)
        except WERRORError as error:
            raise NameError("SMB_NAME_DNS_ACCESS_DENIED" if error.args[0] == werror.WERR_ACCESS_DENIED
                            else "SMB_NAME_DNS_CHANGE_UNCONFIRMED") from None

    def change_spn(self, guid, add, name):
        self.ldap.modify(guid, add, "cifs/" + name)


def binding(entry, instance):
    from configuration_transaction import SmbListenerProfiles, load
    endpoint = entry.get("endpointUuid")
    profiles = SmbListenerProfiles()
    address = str(ipaddress.IPv4Address(entry["ip"]))
    require(address != "0.0.0.0" and not ipaddress.IPv4Address(address).is_multicast, "SMB_NAME_ENDPOINT_INVALID")
    if endpoint:
        rows = [r for r in profiles.show()["listeners"] if r["id"] == endpoint and r["listenIp"] == address
                and r["port"] == entry["port"] and r["state"] in ("READY", "COVERED")]
        require(len(rows) == 1, "SMB_NAME_ENDPOINT_NOT_READY")
        return {k: rows[0][k] for k in ("id", "listenIp", "port", "state")}
    proof = profiles.implicit_legacy(load(profiles.desired, {}), instance)
    require(proof is not None and proof["port"] == entry["port"], "SMB_NAME_ENDPOINT_NOT_READY")
    profiles.verify_implicit_legacy(proof)
    require(any(row.get("local") == address for nic in json.loads(command(["ip", "-j", "addr", "show"]))
                for row in nic.get("addr_info", [])), "SMB_NAME_ENDPOINT_NOT_READY")
    return {"id": None, "listenIp": address, "port": entry["port"], "state": "READY"}


def record_image(record):
    from samba.ndr import ndr_pack
    return base64.b64encode(ndr_pack(record)).decode()


class ServiceNames:
    def __init__(self, private, directory_factory=NativeDirectory, binding_check=binding, credentials=None):
        self.private = Path(private)
        self.directory_factory, self.binding_check = directory_factory, binding_check
        self.credentials = credentials
        self.journal = self.private / "smb-ad-names.json"

    def inspect(self, directory, entry, instance, deleting=False):
        observed = directory.computer(entry.get("computerGuid"))
        if entry.get("computerGuid"):
            require(observed["guid"] == entry["computerGuid"] and observed["sid"] == entry["computerSid"]
                    and observed["realm"] == entry["realm"], "SMB_NAME_COMPUTER_IDENTITY_CHANGED")
        name = fqdn(entry.get("fqdn"), observed["zone"])
        require(entry.get("kind", "ALIAS") != "BASE" or name == observed["fqdn"], "SMB_NAME_BASE_IMMUTABLE")
        owners = directory.owners(name)
        require(all(g == observed["guid"] for g in owners), "SMB_NAME_SPN_CONFLICT")
        records = directory.records(name)
        addresses = sorted(str(r.data) for r in records if r.wType == 1)
        permitted = {entry["ip"]}
        prior = entry.get("ownership", {})
        if prior.get("dns") == "CREATED":
            permitted.add(prior.get("ip"))
        if not deleting:
            require(not any(r.wType != 1 for r in records) and set(addresses).issubset(permitted),
                    "SMB_NAME_DNS_CONFLICT")
            self.binding_check(entry, instance)
        node = directory.node(name)
        if prior.get("dns") == "CREATED" and prior.get("nodeGuid") and entry["ip"] in addresses:
            require(node == prior["nodeGuid"], "SMB_NAME_DNS_OWNER_CHANGED")
        values = {"fqdn": name, "ip": entry["ip"], "port": entry["port"], "endpointUuid": entry.get("endpointUuid"),
                  "kind": entry.get("kind", "ALIAS"), "computerGuid": observed["guid"],
                  "computerSid": observed["sid"], "realm": observed["realm"], "dc": observed["dc"], "zone": observed["zone"]}
        spn = "cifs/" + name
        dns_ownership = prior.get("dns") if (deleting or entry["ip"] in addresses) and prior.get("ip") == entry["ip"] else None
        ownership = {"dns": dns_ownership or ("REUSED" if entry["ip"] in addresses else "CREATED"),
                     "spn": prior.get("spn") or ("REUSED" if spn in observed["spns"] else "CREATED"),
                     "ip": entry["ip"], "nodeGuid": prior.get("nodeGuid", node) if deleting else node, "computerGuid": observed["guid"]}
        return {"entry": values, "ownership": ownership, "addresses": addresses, "spnPresent": spn in observed["spns"],
                "nodeGuid": node, "computer": observed, "dnsImages": {str(r.data): record_image(r)
                    for r in records if r.wType == 1}}

    def preview(self, request):
        require(request.get("action") in ("CREATE", "UPDATE", "DELETE"), "SMB_NAME_ACTION_INVALID")
        with self.directory_factory() as directory:
            entry = self.inspect(directory, request["entry"], request["instanceUuid"], request["action"] == "DELETE")
            old = request.get("previous")
            before = self.inspect(directory, old, request["instanceUuid"], True) if old else None
            proof = {"action": request["action"], "entry": entry, "previous": before}
            return {**proof, "fingerprint": digest(proof)}

    def observe(self, request):
        require(isinstance(request.get("entries", []), list) and len(request.get("entries", []))<=32,
                "SMB_NAME_LIMIT")
        rows=[]
        with self.directory_factory() as directory:
            context={**directory.computer(), "status":"OBSERVED"}
            for entry in request.get("entries", []):
                try:
                    observed=self.inspect(directory,entry,request["instanceUuid"])
                    row={"uuid":entry["uuid"],"status":"MATCH" if observed["spnPresent"] and entry["ip"] in observed["addresses"] else "DRIFT",
                         "dns":observed["addresses"],"spnPresent":observed["spnPresent"],
                         "nodeGuid":observed["nodeGuid"],"observedAt":time.time()}
                except NameError as error:
                    row={"uuid":entry["uuid"],"status":"BLOCKED","code":error.code,"observedAt":time.time()}
                rows.append(row)
        return {"context":context,"entries":rows}

    def prepare(self, payload):
        request = payload["candidate"][OPERATION]
        require(set(payload["candidate"]) == {OPERATION} and not payload.get("restorePlanDigest"),
                "SMB_NAME_COMMAND_SCOPE_INVALID")
        require(request.get("instanceUuid")==payload.get("instanceUuid")
                and request.get("operationid")==payload.get("operationid"), "SMB_NAME_COMMAND_SCOPE_INVALID")
        approved = payload.get("preflight", {}).get("smbadnames")
        def public(value):
            value = json.loads(json.dumps(value or {}))
            value.pop("operationid", None)
            value.get("entry", {}).pop("uuid", None)
            return value
        require(public(approved) == public(request), "SMB_NAME_APPROVAL_CHANGED")
        preview = self.preview(request)
        require(preview["fingerprint"] == payload["preflight"].get("expectedFingerprint"),
                "SMB_NAME_OBSERVATION_CHANGED")
        self.payload = payload

    def save(self, value):
        from configuration_transaction import atomic_json
        atomic_json(self.journal, value)

    def read(self):
        from configuration_transaction import load
        return load(self.journal, {})

    def mutate(self, directory, journal, kind, add, entry, image=None):
        # Own just one value. Never replace an entire attribute/RRset.
        step = {"kind": kind, "add": add, "entry": entry, "image": image, "state": "INTENT"}
        journal["steps"].append(step); self.save(journal)
        try:
            if kind == "SPN":
                directory.change_spn(entry["computerGuid"], add, entry["fqdn"])
            else:
                directory.change_dns(entry["fqdn"], add, entry["ip"], image)
            step["state"] = "DONE"
            if kind == "DNS" and add:
                step["nodeGuid"] = directory.node(entry["fqdn"])
            self.save(journal)
        except NameError as error:
            step["state"] = "NOT_APPLIED" if error.code.endswith("ACCESS_DENIED") else "UNKNOWN"
            self.save(journal)
            raise

    def remove_owned(self, directory, journal, entry):
        current = self.inspect(directory, entry, journal["instanceUuid"], True)
        ownership = entry.get("ownership", {})
        if ownership.get("dns") == "CREATED" and entry["ip"] in current["addresses"]:
            self.mutate(directory, journal, "DNS", False, entry, current["dnsImages"][entry["ip"]])
        if ownership.get("spn") == "CREATED" and current["spnPresent"]:
            self.mutate(directory, journal, "SPN", False, entry)

    def apply(self, request):
        require(self.credentials and self.credentials.get("username") and self.credentials.get("password"),
                "SMB_NAME_CREDENTIALS_REQUIRED")
        preview = self.preview(request)
        journal = {"version": VERSION, "instanceUuid": request["instanceUuid"],
                   "operationid": request["operationid"], "requestHash": digest(request),
                   "steps": [], "state": "APPLYING", "request": json.loads(json.dumps(request)), "before": json.loads(json.dumps(preview))}
        self.save(journal)
        with self.directory_factory(self.credentials) as directory:
            target = {**preview["entry"]["entry"], "uuid": request["entry"]["uuid"],
                      "ownership": preview["entry"]["ownership"]}
            # Authentication scope cannot redirect the observed member account.
            self.inspect(directory, target, request["instanceUuid"], request["action"] == "DELETE")
            if request["action"] == "DELETE":
                self.remove_owned(directory, journal, request["entry"])
                journal["result"] = {**target, "deleted": True}
            else:
                old = request.get("previous")
                if not preview["entry"]["spnPresent"]:
                    self.mutate(directory, journal, "SPN", True, target)
                if target["ip"] not in preview["entry"]["addresses"]:
                    self.mutate(directory, journal, "DNS", True, target)
                # Both values are usable before removing the old name/address.
                require(target["ip"] in [str(r.data) for r in directory.records(target["fqdn"]) if r.wType == 1]
                        and "cifs/" + target["fqdn"] in directory.computer(target["computerGuid"])["spns"],
                        "SMB_NAME_VERIFICATION_FAILED")
                target["ownership"]["nodeGuid"] = directory.node(target["fqdn"])
                if old and (old["fqdn"], old["ip"]) != (target["fqdn"], target["ip"]):
                    retained = json.loads(json.dumps(old))
                    if old["fqdn"] == target["fqdn"]:
                        retained.setdefault("ownership", {})["spn"] = "REUSED"
                    self.remove_owned(directory, journal, retained)
                journal["result"] = target
            journal["state"] = "APPLIED"; self.save(journal)
        return self.verify(request)

    def verify(self, request=None):
        journal = self.read()
        require(journal.get("state") in ("APPLIED", "VERIFIED"), "SMB_NAME_APPLY_UNCONFIRMED")
        if request is not None:
            require(digest(request)==journal["requestHash"], "SMB_NAME_APPROVAL_CHANGED")
        result = journal["result"]
        with self.directory_factory() as directory:
            current = self.inspect(directory, result, journal["instanceUuid"], result.get("deleted", False))
            if result.get("deleted"):
                ownership = result["ownership"]
                require((ownership["spn"] != "CREATED" or not current["spnPresent"])
                        and (ownership["dns"] != "CREATED" or result["ip"] not in current["addresses"]),
                        "SMB_NAME_DELETE_UNCONFIRMED")
            else:
                require(current["spnPresent"] and result["ip"] in current["addresses"],
                        "SMB_NAME_VERIFICATION_FAILED")
        journal["state"] = "VERIFIED"; journal["observedAt"] = time.time(); self.save(journal)
        return {"version": VERSION, "state": "VERIFIED", "instanceUuid": journal["instanceUuid"],
                "operationid": journal["operationid"], "requestHash": journal["requestHash"],
                "entry": result, "observedAt": journal["observedAt"]}

    def restore(self):
        journal = self.read()
        require(journal, "SMB_NAME_BEFORE_IMAGE_UNAVAILABLE")
        require(not any(s["state"] in ("INTENT", "UNKNOWN", "UNDO_INTENT") for s in journal["steps"]),
                "SMB_NAME_CHANGE_UNCONFIRMED")
        if any(s["state"] == "DONE" for s in journal["steps"]):
            require(self.credentials and self.credentials.get("password"), "SMB_NAME_CREDENTIALS_REQUIRED")
            with self.directory_factory(self.credentials) as directory:
                for step in reversed(journal["steps"]):
                    if step["state"] in ("UNDONE", "NOT_APPLIED"):
                        continue
                    require(step["state"] == "DONE", "SMB_NAME_CHANGE_UNCONFIRMED")
                    entry = step["entry"]
                    current = self.inspect(directory, entry, journal["instanceUuid"], True)
                    if step["kind"] == "DNS":
                        if step["add"]:
                            require(current["nodeGuid"] == step["nodeGuid"], "SMB_NAME_DNS_OWNER_CHANGED")
                        else:
                            require(current["nodeGuid"] in (None, entry["ownership"]["nodeGuid"]),
                                    "SMB_NAME_DNS_OWNER_CHANGED")
                    # A process/response loss in this interval never permits blind replay.
                    step["state"] = "UNDO_INTENT"; self.save(journal)
                    if step["kind"] == "SPN":
                        directory.change_spn(entry["computerGuid"], not step["add"], entry["fqdn"])
                    else:
                        directory.change_dns(entry["fqdn"], not step["add"], entry["ip"], step.get("image"))
                        if not step["add"]:
                            step["undoNodeGuid"] = directory.node(entry["fqdn"])
                            require(step["undoNodeGuid"], "SMB_NAME_DNS_OWNER_UNCONFIRMED")
                    step["state"] = "UNDONE"; self.save(journal)
        journal["state"] = "RESTORED"; self.save(journal)
        return self.verify_restored()

    def verify_restored(self):
        journal = self.read()
        require(journal and journal.get("before") and journal.get("request")
                and all(s["state"] in ("UNDONE", "NOT_APPLIED") for s in journal["steps"]),
                "SMB_NAME_ROLLBACK_UNCONFIRMED")
        snapshots = [journal["before"]["entry"]]
        if journal["before"].get("previous"):
            snapshots.append(journal["before"]["previous"])
        renewals = []
        original = journal["request"].get("previous")
        if original is None and journal["request"]["action"] == "DELETE":
            original = journal["request"]["entry"]
        with self.directory_factory() as directory:
            for snapshot in snapshots:
                before = snapshot["entry"]
                observed = directory.computer(before["computerGuid"])
                require(observed["guid"] == before["computerGuid"] and observed["sid"] == before["computerSid"]
                        and observed["realm"] == before["realm"], "SMB_NAME_COMPUTER_IDENTITY_CHANGED")
                require(all(g == before["computerGuid"] for g in directory.owners(before["fqdn"])),
                        "SMB_NAME_SPN_CONFLICT")
                spn_present = "cifs/" + before["fqdn"] in observed["spns"]
                require(spn_present == snapshot["spnPresent"], "SMB_NAME_ROLLBACK_SPN_MISMATCH")
                # Unrelated SPN additions are preserved; loss of a before-image SPN is not ignored.
                require(set(snapshot["computer"]["spns"]).issubset(observed["spns"]),
                        "SMB_NAME_ROLLBACK_SPN_MISMATCH")
                addresses = {str(r.data) for r in directory.records(before["fqdn"]) if r.wType == 1}
                expected = set(snapshot["addresses"])
                require(expected.issubset(addresses) and
                        (before["ip"] in addresses) == (before["ip"] in expected),
                        "SMB_NAME_ROLLBACK_DNS_MISMATCH")
                node = directory.node(before["fqdn"])
                if expected and node != snapshot["nodeGuid"]:
                    # Only this operation's confirmed inverse of its own DNS deletion
                    # can attest a replacement node. External churn never passes here.
                    matching = [step for step in journal["steps"]
                        if step["kind"] == "DNS" and not step["add"] and step["state"] == "UNDONE"
                        and step["entry"]["fqdn"] == before["fqdn"]
                        and step["entry"]["ip"] in expected
                        and step["entry"]["computerGuid"] == before["computerGuid"]
                        and step["entry"]["computerSid"] == before["computerSid"]
                        and step["entry"]["ownership"].get("nodeGuid") == snapshot["nodeGuid"]
                        and step.get("undoNodeGuid") == node
                        and step.get("image") == snapshot["dnsImages"].get(step["entry"]["ip"])]
                    require(node and matching, "SMB_NAME_DNS_OWNER_CHANGED")
                if original and before["fqdn"] == original["fqdn"] and original["ip"] in expected:
                    old = original.get("ownership", {})
                    require(old.get("computerGuid") == before["computerGuid"], "SMB_NAME_COMPUTER_IDENTITY_CHANGED")
                    if old.get("dns") == "CREATED" and old.get("nodeGuid") != node:
                        renewed = {**old, "nodeGuid": node}
                        renewals.append({"uuid": original["uuid"], "fqdn": original["fqdn"],
                            "computerGuid": before["computerGuid"], "computerSid": before["computerSid"],
                            "expectedOwnership": old, "ownership": renewed,
                            "reason": "VERIFIED_OWN_ROLLBACK", "ip": original["ip"]})
        receipt = {"version": VERSION, "state": "VERIFIED", "operationid": journal["operationid"],
                   "instanceUuid": journal["instanceUuid"], "requestHash": journal["requestHash"],
                   "renewals": renewals, "observedAt": time.time()}
        journal["rollbackReceipt"] = receipt; journal["state"] = "ROLLED_BACK"; self.save(journal)
        return receipt
