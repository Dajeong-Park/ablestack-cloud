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
public class OverlayASLookup {
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
    public static void main(String[] args) throws Exception {
        ClassNode old = read(args[1]), built = read(args[2]); String mode=args[0];
        same(old.name.equals(built.name) && old.version==built.version, "class identity/version");
        Set<String> selected = new HashSet<>();
        if (mode.equals("command")) {
            selected.addAll(Arrays.asList("getAsNumber", "execute", "validateSpecificParameters"));
            same(fields(old,"asNumber").equals(fields(built,"asNumber")), "unrelated command fields/annotations");
            for (MethodNode m : old.methods) if (!selected.contains(m.name)) same(instructions(m).equals(instructions(method(built,m.name))), "unrelated command method "+m.name);
            System.out.println("PASS command: unrelated methods/fields preserved by module source; LONG field/getter and validation changed.");
            return;
        }
        String target=mode.equals("service")?"listASNumbers":"searchAndCountByZoneOrRangeOrAllocated";
        selected.add(target); Map<String,String> preserved=otherMethods(old, selected); Map<String,String> originalFields=fields(old, "");
        MethodNode prior=method(old,target), replacement=method(built,target);
        if (mode.equals("service")) {
            int changed=0;
            for (AbstractInsnNode n : prior.instructions) if (n instanceof MethodInsnNode) {
                MethodInsnNode x=(MethodInsnNode)n;
                if (x.owner.endsWith("/ListASNumbersCmd") && x.name.equals("getAsNumber")) { same(x.desc.equals("()Ljava/lang/Integer;"),"old getter contract");x.desc="()Ljava/lang/Long;";changed++; }
                if (x.owner.endsWith("/ASNumberDao") && x.name.equals("searchAndCountByZoneOrRangeOrAllocated")) { same(x.desc.contains("Ljava/lang/Integer;"),"old DAO contract");x.desc=x.desc.replace("Ljava/lang/Integer;","Ljava/lang/Long;");changed++; }
            }
            same(changed==2,"two type contract calls");
            same(instructions(prior).equals(instructions(replacement)), "service has unrelated runtime logic changes");
        } else if (mode.equals("dao")) {
            List<String> code=instructions(replacement);
            same(code.get(0).equals(Opcodes.ALOAD+"var3") && code.get(1).contains("ASNumberQueryValidatorvalidate(Ljava/lang/Long;)V"),"query validation prefix");
            MethodNode withoutPrefix = new MethodNode(); replacement.accept(withoutPrefix);
            int removed = 0;
            for (Iterator<AbstractInsnNode> i=withoutPrefix.instructions.iterator(); i.hasNext() && removed<2;) {
                if (i.next().getOpcode()>=0) { i.remove(); removed++; }
            }
            same(instructions(prior).equals(instructions(withoutPrefix)), "DAO has unrelated runtime logic changes");
        } else same(mode.equals("interface"), "known mode");
        old.methods.removeIf(m -> selected.contains(m.name)); old.methods.add(replacement);
        ClassWriter writer=new ClassWriter(0);old.accept(writer);Path dest=Path.of(args[3]);Files.createDirectories(dest.getParent());Files.write(dest,writer.toByteArray());
        ClassNode output=read(args[3]);
        same(otherMethods(output,selected).equals(preserved), "unrelated method preservation");
        same(fields(output,"").equals(originalFields), "field preservation");
        same(text(method(output,target)).equals(text(replacement)), "module-built target method equality");
        System.out.println("PASS "+mode+": "+preserved.size()+" other methods preserved; selected method matches module build.");
    }
}
