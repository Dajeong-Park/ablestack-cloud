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
import java.util.*;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.*;

/** Copy changed ASN methods into the test runtime while preserving unrelated bytecode and metadata. */
public class OverlayASNIntegration extends OverlayASNDeletion {
    static boolean chosen(String mode, String name) {
        if (mode.equals("service")) return Set.of("releaseASNumber", "performReleaseASNumberChecks", "lockedASNumberReleaseReason", "getASNumberReleaseReasons", "asnPageReferences").contains(name) || name.startsWith("lambda$releaseASNumber$");
        if (mode.equals("command")) return name.equals("execute");
        if (mode.equals("helper")) return name.equals("createASNumberResponse");
        if (mode.equals("dao") || mode.equals("dao-interface")) return name.equals("listByZoneAndAsNumber");
        if (mode.equals("bgp-interface")) return name.equals("getASNumberReleaseReasons");
        return mode.equals("response") && Set.of("getReleasable", "setReleasable", "getReleaseReason", "setReleaseReason").contains(name);
    }
    public static void main(String[] args) throws Exception {
        String mode=args[0]; ClassNode old=read(args[1]), baseline=read(args[2]), built=read(args[3]);
        same(old.name.equals(built.name) && old.version == built.version, "class identity/version");
        Set<String> selected=new HashSet<>();
        for (MethodNode m:old.methods) if(chosen(mode,m.name)) {
            selected.add(m.name);
            same(instructions(m).equals(instructions(method(baseline,m.name))), "owning runtime baseline differs: "+m.name);
        }
        for (MethodNode m:built.methods) if(chosen(mode,m.name)) selected.add(m.name);
        same(!selected.isEmpty(), "no selected methods");
        Map<String,String> preserved=otherMethods(old,selected), originalFields=fields(old,"");
        if(mode.equals("response")) {
            for(String name:List.of("releasable","releaseReason")) {
                same(old.fields.stream().noneMatch(f->f.name.equals(name)), "new field exists already");
                old.fields.add(built.fields.stream().filter(f->f.name.equals(name)).findFirst().orElseThrow());
            }
        }
        old.methods.removeIf(m->selected.contains(m.name));
        for(MethodNode m:built.methods) if(selected.contains(m.name)) old.methods.add(m);
        ClassWriter writer=new ClassWriter(0);old.accept(writer);Path output=Path.of(args[4]);Files.createDirectories(output.getParent());Files.write(output,writer.toByteArray());
        ClassNode result=read(args[4]);same(otherMethods(result,selected).equals(preserved),"unrelated method preservation");
        Map<String,String> actualFields=fields(result,"");if(mode.equals("response")){actualFields.remove("releasable");actualFields.remove("releaseReason");}
        same(actualFields.equals(originalFields),"original field preservation");
        for(MethodNode m:built.methods) if(selected.contains(m.name)) same(text(m).equals(text(method(result,m.name))),"built ASN method preservation");
        System.out.println("PASS "+old.name+": preserved "+preserved.size()+" other methods/all original fields; selected "+selected);
    }
}
