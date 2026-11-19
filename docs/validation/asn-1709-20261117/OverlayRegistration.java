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
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.Map;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.util.Textifier;
import org.objectweb.asm.util.TraceMethodVisitor;

/** Test-cluster payload only: preserve unrelated deployed methods verbatim at ASM instruction level. */
public class OverlayRegistration {
    static ClassNode read(Path path) throws Exception {
        ClassNode node = new ClassNode();
        new ClassReader(Files.readAllBytes(path)).accept(node, 0);
        return node;
    }
    static boolean selected(MethodNode method) {
        return method.name.equals("createASNumberRange") || method.name.startsWith("lambda$createASNumberRange$");
    }
    static Map<String, String> methods(ClassNode node, boolean registration) {
        Map<String, String> result = new HashMap<>();
        for (MethodNode method : node.methods) {
            if (selected(method) != registration) continue;
            Textifier text = new Textifier();
            method.accept(new TraceMethodVisitor(text));
            StringWriter out = new StringWriter();
            text.print(new PrintWriter(out));
            result.put(method.name + method.desc, out.toString());
        }
        return result;
    }
    public static void main(String[] args) throws Exception {
        ClassNode old = read(Path.of(args[0])), built = read(Path.of(args[1]));
        if (!old.name.equals(built.name) || old.version != built.version) throw new AssertionError("class identity/version");
        Map<String, String> preserved = methods(old, false), replacement = methods(built, true);
        if (replacement.size() != 2) throw new AssertionError("expected registration and one lambda");
        old.methods.removeIf(OverlayRegistration::selected);
        built.methods.stream().filter(OverlayRegistration::selected).forEach(old.methods::add);
        ClassWriter writer = new ClassWriter(0);
        old.accept(writer);
        Path output = Path.of(args[2]);
        Files.createDirectories(output.getParent());
        Files.write(output, writer.toByteArray());
        ClassNode verified = read(output);
        if (!methods(verified, false).equals(preserved) || !methods(verified, true).equals(replacement)) {
            throw new AssertionError("method preservation/replacement check failed");
        }
        System.out.println("PASS: " + preserved.size() + " deployed methods preserved; " + replacement.size() + " registration methods match module build.");
    }
}
