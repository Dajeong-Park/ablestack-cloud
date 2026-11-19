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
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.util.*;

/** Test-cluster overlay with strict method-logic and preservation checks; never a substitute for the Maven module build. */
public class OverlayASNDeletion {
    static ClassNode read(String path) throws Exception {
        ClassNode node = new ClassNode(); new ClassReader(Files.readAllBytes(Path.of(path))).accept(node, 0); return node;
    }
    static String text(MethodNode node) {
        Textifier text = new Textifier(); node.accept(new TraceMethodVisitor(text));
        StringWriter out = new StringWriter(); text.print(new PrintWriter(out)); return out.toString();
    }
    static String field(FieldNode node) {
        Textifier text = new Textifier(); node.accept(new TraceClassVisitor(null, text, null));
        StringWriter out = new StringWriter(); text.print(new PrintWriter(out)); return out.toString();
    }
    static Map<String, String> otherMethods(ClassNode node, Set<String> selected) {
        Map<String, String> result = new TreeMap<>();
        for (MethodNode m : node.methods) if (!selected.contains(m.name)) result.put(m.name + m.desc, text(m));
        return result;
    }
    static Map<String, String> fields(ClassNode node, String excluded) {
        Map<String, String> result = new TreeMap<>();
        for (FieldNode f : node.fields) if (!f.name.equals(excluded)) result.put(f.name, field(f));
        return result;
    }
    static List<String> instructions(MethodNode method) {
        Map<LabelNode, Integer> positions = new IdentityHashMap<>(); int pc = 0;
        for (AbstractInsnNode n : method.instructions) { if (n instanceof LabelNode) positions.put((LabelNode)n, pc); if (n.getOpcode() >= 0) pc++; }
        List<String> result = new ArrayList<>();
        for (AbstractInsnNode n : method.instructions) {
            if (n.getOpcode() < 0) continue;
            String value = Integer.toString(n.getOpcode());
            if (n instanceof MethodInsnNode) { MethodInsnNode x=(MethodInsnNode)n; value += x.owner+x.name+x.desc+x.itf; }
            else if (n instanceof FieldInsnNode) { FieldInsnNode x=(FieldInsnNode)n; value += x.owner+x.name+x.desc; }
            else if (n instanceof InvokeDynamicInsnNode) { InvokeDynamicInsnNode x=(InvokeDynamicInsnNode)n; value += x.name+x.desc+x.bsm+Arrays.deepToString(x.bsmArgs); }
            else if (n instanceof JumpInsnNode) value += "target"+positions.get(((JumpInsnNode)n).label);
            else if (n instanceof VarInsnNode) value += "var"+((VarInsnNode)n).var;
            else if (n instanceof IntInsnNode) value += "int"+((IntInsnNode)n).operand;
            else if (n instanceof LdcInsnNode) value += String.valueOf(((LdcInsnNode)n).cst);
            else if (n instanceof TypeInsnNode) value += ((TypeInsnNode)n).desc;
            else if (n instanceof IincInsnNode) { IincInsnNode x=(IincInsnNode)n; value += x.var+":"+x.incr; }
            else if (!(n instanceof InsnNode)) throw new AssertionError("Uncompared opcode: "+n.getClass());
            result.add(value);
        }
        return result;
    }
    static MethodNode method(ClassNode node, String name) {
        return node.methods.stream().filter(m -> m.name.equals(name)).findFirst().orElseThrow();
    }
    static void same(boolean value, String reason) { if (!value) throw new AssertionError(reason); }
    static boolean selected(String mode, String name) {
        if (mode.equals("command")) return name.equals("execute");
        if (mode.equals("dao")) return name.equals("listAllocatedByASRange");
        return mode.equals("service") ? name.equals("allocateASNumber") || name.equals("allocateASNumberInTransaction")
                || name.equals("deleteASRange") || name.startsWith("lambda$allocateASNumber$") || name.startsWith("lambda$deleteASRange$")
                : name.equals("toJSONSerializedString") || name.equals("toXMLSerializedString") || name.equals("includeListCount");
    }
    public static void main(String[] args) throws Exception {
        String mode = args[0]; ClassNode old = read(args[1]), baseline = read(args[2]), built = read(args[3]);
        same(old.name.equals(built.name) && old.version == built.version, "class identity/version");
        Set<String> names = new HashSet<>();
        for (MethodNode m : old.methods) if (selected(mode, m.name)) {
            names.add(m.name);
            same(instructions(m).equals(instructions(method(baseline, m.name))), "runtime baseline differs in " + m.name);
        }
        for (MethodNode m : built.methods) if (selected(mode, m.name)) names.add(m.name);
        Map<String,String> preserved = otherMethods(old, names), originalFields = fields(old, "");
        old.methods.removeIf(m -> names.contains(m.name));
        for (MethodNode m : built.methods) if (names.contains(m.name)) old.methods.add(m);
        ClassWriter writer = new ClassWriter(0); old.accept(writer); Path dest = Path.of(args[4]); Files.createDirectories(dest.getParent()); Files.write(dest, writer.toByteArray());
        ClassNode output = read(args[4]);
        same(otherMethods(output, names).equals(preserved), "unrelated method preservation");
        same(fields(output, "").equals(originalFields), "field preservation");
        for (MethodNode m : built.methods) if (names.contains(m.name)) same(text(m).equals(text(method(output, m.name))), "built method preservation");
        System.out.println("PASS " + mode + ": baseline owning methods match; preserved " + preserved.size() + " unrelated methods and all fields; replaced " + names);
    }
}
