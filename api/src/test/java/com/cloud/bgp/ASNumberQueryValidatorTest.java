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
import org.junit.Assert;
import org.junit.Test;

public class ASNumberQueryValidatorTest {
    @Test
    public void queryPolicyIncludesSpecialNumbersAndLeadingZeros() {
        ASNumberQueryValidator.validate(null);
        ASNumberQueryValidator.validateRaw(null);
        for (long number : new long[] {0, 23456, 65535, 2147483647L, 2147483648L, 4200000000L, 4294967295L}) {
            ASNumberQueryValidator.validate(number);
            ASNumberQueryValidator.validateRaw("00" + number);
        }
    }

    @Test
    public void lookupDoesNotInheritPoolRegistrationRestrictions() {
        for (long number : new long[] {0, 23456, 65535, 4294967295L}) {
            ASNumberQueryValidator.validate(number);
            Assert.assertThrows(InvalidParameterValueException.class, () -> ASNumberRangeValidator.validate(number, number));
        }
    }

    @Test
    public void queryRejectsOutOfDomainAndMalformedRawValues() {
        for (long number : new long[] {-1, 4294967296L, Long.MAX_VALUE}) {
            Assert.assertThrows(InvalidParameterValueException.class, () -> ASNumberQueryValidator.validate(number));
        }
        for (String raw : new String[] {"-0", "+1", " 1", "1 ", "1.5", "1e3", "1.10", "\uff11", "4294967296", "9223372036854775808"}) {
            Assert.assertThrows(InvalidParameterValueException.class, () -> ASNumberQueryValidator.validateRaw(raw));
        }
    }
}
