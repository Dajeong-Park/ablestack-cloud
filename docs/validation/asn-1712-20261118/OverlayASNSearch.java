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
import java.util.Map;
import java.util.Set;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldNode;
import org.objectweb.asm.tree.MethodNode;

/** Preserve the deployed class except its search method and one injected ACL delegate. */
public class OverlayASNSearch extends OverlayASNDeletion {
    public static void main(String[] args) throws Exception {
        String mode = args[0]; ClassNode old = read(args[1]), baseline = read(args[2]), built = read(args[3]);
        same(old.name.equals(built.name) && old.version == built.version, "class identity/version");
        String name = mode.equals("service") ? "listASNumbers" : "execute";
        Set<String> selected = Set.of(name);
        same(instructions(method(old, name)).equals(instructions(method(baseline, name))), "runtime search baseline differs");
        Map<String,String> preserved = otherMethods(old, selected), originalFields = fields(old, "");
        if (mode.equals("service")) {
            same(old.fields.stream().noneMatch(f -> f.name.equals("asnAccountManager")), "new ACL field must be absent initially");
            FieldNode acl = built.fields.stream().filter(f -> f.name.equals("asnAccountManager")).findFirst().orElseThrow();
            same(acl.visibleAnnotations != null && acl.visibleAnnotations.stream().anyMatch(a -> a.desc.equals("Ljavax/inject/Inject;")), "ACL injection annotation");
            old.fields.add(acl);
        }
        old.methods.removeIf(m -> m.name.equals(name)); old.methods.add(method(built, name));
        ClassWriter writer = new ClassWriter(0); old.accept(writer); Path dest = Path.of(args[4]); Files.createDirectories(dest.getParent()); Files.write(dest, writer.toByteArray());
        ClassNode output = read(args[4]);
        same(otherMethods(output, selected).equals(preserved), "unrelated methods preserved");
        same(fields(output, mode.equals("service") ? "asnAccountManager" : "").equals(originalFields), "all original fields preserved");
        same(text(method(output, name)).equals(text(method(built, name))), "built query method preserved");
        System.out.println("PASS " + mode + ": owning baseline matched; preserved " + preserved.size() + " other methods/all original fields; injected ACL only in service");
    }
}
