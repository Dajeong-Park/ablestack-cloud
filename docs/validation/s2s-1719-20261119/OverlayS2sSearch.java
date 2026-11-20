/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AnnotationNode;
import org.objectweb.asm.tree.ClassNode;

/** Deploy only the module-built owning method and API description, preserving the deployed class. */
public class OverlayS2sSearch extends OverlayASNDeletion {
    public static void main(String[] args) throws Exception {
        ClassNode old = read(args[1]), baseline = read(args[2]), built = read(args[3]);
        same(old.name.equals(built.name) && old.version == built.version, "class identity/version");
        boolean service = args[0].equals("service");
        Set<String> selected = service ? Set.of("searchForVpnGateways") : Set.of();
        Map<String,String> preserved = otherMethods(old, selected), originalFields = fields(old, "");
        if (service) {
            String name = "searchForVpnGateways";
            same(instructions(method(old, name)).equals(instructions(method(baseline, name))), "owning runtime method differs from source baseline");
            old.methods.removeIf(method -> method.name.equals(name)); old.methods.add(method(built, name));
        } else {
            AnnotationNode deployed = old.visibleAnnotations.stream().filter(a -> a.desc.endsWith("/APICommand;")).findFirst().orElseThrow();
            AnnotationNode updated = built.visibleAnnotations.stream().filter(a -> a.desc.endsWith("/APICommand;")).findFirst().orElseThrow();
            int slot = deployed.values.indexOf("description") + 1;
            same(slot > 0, "description annotation");
            deployed.values.set(slot, updated.values.get(updated.values.indexOf("description") + 1));
            same(deployed.values.equals(updated.values), "all other API annotation values unchanged");
        }
        ClassWriter writer = new ClassWriter(0); old.accept(writer);
        Path dest = Path.of(args[4]); Files.createDirectories(dest.getParent()); Files.write(dest, writer.toByteArray());
        ClassNode output = read(args[4]);
        same(otherMethods(output, selected).equals(preserved), "unrelated methods preserved");
        same(fields(output, "").equals(originalFields), "all fields preserved");
        if (service) same(text(method(output, "searchForVpnGateways")).equals(text(method(built, "searchForVpnGateways"))), "module-built method preserved");
        System.out.println("PASS " + args[0] + ": preserved " + preserved.size() + " other methods/all fields; module-built search or description only");
    }
}
