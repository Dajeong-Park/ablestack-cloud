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

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Path;
import java.util.Map;

/**
 * Checks the deployed JAR rather than the module classes used to build it.
 * Run with java tools/build/SharedFSComputeArtifactSmoke.java management.jar.
 */
public final class SharedFSComputeArtifactSmoke {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            throw new IllegalArgumentException("Expected the assembled management JAR path");
        }
        URL artifact = Path.of(args[0]).toRealPath().toUri().toURL();
        try (URLClassLoader loader = new URLClassLoader(new URL[]{artifact}, ClassLoader.getPlatformClassLoader())) {
            check(loader, "org.apache.cloudstack.storage.sharedfs.SharedFSService",
                    "org.apache.cloudstack.storage.sharedfs.SharedFSServiceImpl", "getComputeStatus",
                    loader.loadClass("com.google.gson.JsonObject"), Long.class, Long.class, Map.class, String.class);
            Class<?> offering = loader.loadClass("com.cloud.offering.ServiceOffering");
            check(loader, "com.cloud.user.ResourceLimitService", "com.cloud.resourcelimit.ResourceLimitManagerImpl",
                    "reserveSharedFSCompute", void.class, loader.loadClass("com.cloud.user.Account"),
                    String.class, long.class, long.class, offering, offering, loader.loadClass("com.cloud.template.VirtualMachineTemplate"));
            check(loader, "org.apache.cloudstack.reservation.dao.ReservationDao",
                    "org.apache.cloudstack.reservation.dao.ReservationDaoImpl", "removeForSharedFSCompute", int.class, String.class);
        }
    }

    private static void check(URLClassLoader loader, String contractName, String implementationName, String methodName,
            Class<?> returns, Class<?>... parameters) throws Exception {
        Class<?> contract = loader.loadClass(contractName);
        Method method = contract.getDeclaredMethod(methodName, parameters);
        Class<?> implementation = loader.loadClass(implementationName);
        Method implementationMethod = implementation.getMethod(methodName, parameters);
        if (!contract.isInterface() || !Modifier.isAbstract(method.getModifiers()) || !Modifier.isPublic(method.getModifiers())
                || method.getReturnType() != returns || !contract.isAssignableFrom(implementation)
                || Modifier.isAbstract(implementationMethod.getModifiers()) || implementationMethod.getReturnType() != returns) {
            throw new IllegalStateException("Invalid SharedFS compute contract: " + method);
        }
        System.out.println("Verified " + method);
    }
}
