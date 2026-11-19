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

import com.cloud.exception.InvalidParameterValueException;

/** Admission policy for a pool registration, not for ASN lookup or BGP advertisements. */
public final class ASNumberRangeValidator {
    public static final long MAX_AS_NUMBER = 4294967294L;
    public static final int MAX_RANGE_SIZE = 1000;

    private ASNumberRangeValidator() {
    }

    public static long parse(String value, String parameter) {
        if (value == null || !value.trim().matches("[0-9]+")) {
            throw new InvalidParameterValueException(parameter + " must be a decimal integer without a sign or separators.");
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new InvalidParameterValueException(parameter + " is outside the supported ASN range.");
        }
    }

    public static void validate(long start, long end) {
        if (start < 1 || end < 1 || start > MAX_AS_NUMBER || end > MAX_AS_NUMBER) {
            throw new InvalidParameterValueException("ASN range endpoints must be between 1 and 4294967294.");
        }
        if (start > end) {
            throw new InvalidParameterValueException("The start ASN must not exceed the end ASN.");
        }
        if ((start <= 23456 && end >= 23456) || (start <= 65535 && end >= 65535)) {
            throw new InvalidParameterValueException("An ASN range must not include the special AS numbers 23456 or 65535.");
        }
        if (end - start + 1 > MAX_RANGE_SIZE) {
            throw new InvalidParameterValueException("An ASN range may contain at most " + MAX_RANGE_SIZE + " numbers.");
        }
    }
}
