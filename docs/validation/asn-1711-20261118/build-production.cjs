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

const path = require('path')
process.env.NODE_ENV = 'production'
const Service = require(path.join(process.cwd(), 'node_modules/@vue/cli-service/lib/Service'))
const service = new Service(process.cwd())
service.init('production')
service.projectOptions.productionSourceMap = false
service.webpackRawConfigFns.push(config => {
  config.devtool = false
  for (const plugin of config.optimization.minimizer || []) {
    if (plugin.options && Object.prototype.hasOwnProperty.call(plugin.options, 'sourceMap')) plugin.options.sourceMap = false
  }
})
service.run('build', { mode: 'production' }).catch(error => { console.error(error); process.exitCode = 1 })
