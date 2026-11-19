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

public class ASNumberRangeValidatorTest {
    @Test
    public void decimalInputIsNormalizedWithoutLosingUnsigned32BitValues() {
        Assert.assertEquals(4294967294L, ASNumberRangeValidator.parse(" 4294967294 ", "startasn"));
        Assert.assertEquals(1L, ASNumberRangeValidator.parse("0001", "startasn"));
        for (String invalid : new String[] {"", " ", "-1", "+1", "1.5", "1e3", "1.1", "1,000", "abc", "１２", "9223372036854775808"}) {
            Assert.assertThrows(invalid, InvalidParameterValueException.class, () -> ASNumberRangeValidator.parse(invalid, "startasn"));
        }
        Assert.assertThrows(InvalidParameterValueException.class, () -> ASNumberRangeValidator.parse(null, "startasn"));
    }

    @Test
    public void validSingleAndSmallRangesIncludePublicAndPrivateNumbers() {
        for (long number : new long[] {1, 64512, 2147483647L, 2147483648L, 4200000000L, 4294967294L}) {
            ASNumberRangeValidator.validate(number, number);
        }
        ASNumberRangeValidator.validate(64512, 64535);
        ASNumberRangeValidator.validate(4200000000L, 4200000002L);
        ASNumberRangeValidator.validate(100000, 100999);
    }

    @Test
    public void invalidDomainsReservedIntersectionsAndOversizedRangesAreRejected() {
        for (long[] range : new long[][] {{-1, -1}, {0, 1}, {1, 0}, {4294967295L, 4294967295L}, {4294967296L, 4294967296L},
                {Long.MIN_VALUE, Long.MAX_VALUE}, {2, 1}, {23456, 23456}, {23455, 23457}, {65535, 65535}, {65534, 65536}, {100000, 101000}}) {
            Assert.assertThrows(InvalidParameterValueException.class, () -> ASNumberRangeValidator.validate(range[0], range[1]));
        }
    }
}
