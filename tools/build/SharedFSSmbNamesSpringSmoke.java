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

import java.util.jar.JarFile;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.beans.factory.xml.XmlBeanDefinitionReader;
import org.springframework.core.io.ClassPathResource;

/**
 * Runs only against the assembled management JAR and its deployment classpath.
 * --references resolves every bean class in every XML changed by this overlay.
 * --spring loads the real DAO XML and imports, refreshes Spring and creates the
 * real #1466 DAO. Existing beans remain lazy: this offline gate performs no DB
 * access, lifecycle hooks or live management server operations.
 */
public final class SharedFSSmbNamesSpringSmoke {
    private static final String XML = "META-INF/cloudstack/core/spring-engine-schema-core-daos-context.xml";
    private static final String DAO = "StorageSmbServiceNameDaoImpl";
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("management.jar --references|--spring");
        try (JarFile artifact = new JarFile(args[0])) {
            var entry = artifact.getJarEntry(XML);
            if (entry == null) throw new IllegalStateException("Missing final DAO XML");
            String loaded = SharedFSSmbNamesSpringSmoke.class.getClassLoader().getResource(XML).toString();
            if (!loaded.equals("jar:" + java.nio.file.Path.of(args[0]).toRealPath().toUri().toURL() + "!/" + XML))
                throw new IllegalStateException("Classpath shadowing: " + loaded);
            if ("--references".equals(args[1])) {
                var factory = DocumentBuilderFactory.newInstance();
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                factory.setExpandEntityReferences(false);
                var document = factory.newDocumentBuilder().parse(artifact.getInputStream(entry));
                var beans = document.getElementsByTagName("bean");
                int count = 0;
                for (int i = 0; i < beans.getLength(); i++) {
                    String name = ((Element) beans.item(i)).getAttribute("class");
                    if (!name.isEmpty()) {
                        Class.forName(name, false, SharedFSSmbNamesSpringSmoke.class.getClassLoader());
                        count++;
                    }
                }
                System.out.println("REFERENCE_CLASSES_OK count=" + count);
            } else if ("--spring".equals(args[1])) {
                try (var context = new GenericApplicationContext()) {
                    new XmlBeanDefinitionReader(context).loadBeanDefinitions(new ClassPathResource(XML));
                    for (String name : context.getBeanDefinitionNames())
                        context.getBeanFactory().getBeanDefinition(name).setLazyInit(true);
                    // Management autowire discovery resolves even lazy bean types.
                    // Exercise that real Spring path before creating the feature DAO.
                    context.addBeanFactoryPostProcessor(factory -> {
                        for (String name : factory.getBeanDefinitionNames()) factory.getType(name);
                    });
                    context.refresh();
                    Object dao = context.getBean(DAO);
                    String expected = "org.apache.cloudstack.storage.dataservice.dao.StorageSmbServiceNameDaoImpl";
                    if (!dao.getClass().getName().equals(expected))
                        throw new IllegalStateException("Wrong DAO: " + dao.getClass());
                    dao.getClass().getMethod("listByInstanceId", long.class);
                    System.out.println("SPRING_CONTEXT_OK beans=" + context.getBeanDefinitionCount() + " dao=" + dao.getClass().getName());
                }
            } else throw new IllegalArgumentException(args[1]);
        }
    }
}
