// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See NOTICE. Apache License, Version 2.0.
package org.apache.cloudstack.storage.dataservice;

import com.cloud.exception.InvalidParameterValueException;
import com.google.gson.JsonObject;

/** Explicit public reasons only; arbitrary exception text or request values never enter the journal. */
final class StorageServiceConfigurationValidationException extends InvalidParameterValueException {
    enum Reason {
        ISCSI_LISTENER_INVALID_ADDRESS, ISCSI_LISTENER_INVALID_PORT, ISCSI_LISTENER_NOT_FOUND,
        ISCSI_LISTENER_IDENTITY_AMBIGUOUS, ISCSI_LISTENER_IN_USE
    }
    private final Reason reason;
    StorageServiceConfigurationValidationException(Reason reason) { super(reason.name()); this.reason = reason; }
    JsonObject diagnostic() {
        JsonObject value=new JsonObject();
        value.addProperty("code",reason.name()); value.addProperty("phase","VALIDATING");
        value.addProperty("type",getClass().getSimpleName());
        value.addProperty("protocol","ISCSI"); value.addProperty("stage","ISCSI_LISTENER_REMOVE");
        return value;
    }
}
