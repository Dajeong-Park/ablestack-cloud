<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with this work
for additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->
<template>
  <KeyboardTooltip :title="truncated ? text : ''" placement="topLeft">
    <component :is="location ? 'router-link' : 'span'" ref="cell" :to="location || undefined" class="table-overflow-text" :tabindex="truncated && !location ? 0 : undefined">
      <slot>{{ text }}</slot>
    </component>
  </KeyboardTooltip>
</template>

<script>
import KeyboardTooltip from '@/components/widgets/KeyboardTooltip'

const listeners = new WeakMap()
let observer

export default {
  name: 'TableOverflowText',
  components: { KeyboardTooltip },
  props: { text: { type: [String, Number], default: '' }, location: { type: Object, default: null } },
  data () { return { truncated: false } },
  mounted () { this.observe() },
  updated () { this.observe() },
  beforeUnmount () { this.unobserve() },
  methods: {
    element () { return this.$refs.cell?.$el || this.$refs.cell },
    observe () {
      const cell = this.element()
      if (cell && cell !== this.observedCell && typeof ResizeObserver !== 'undefined') {
        this.unobserve()
        if (!observer) observer = new ResizeObserver(entries => entries.forEach(({ target }) => listeners.get(target)?.()))
        this.observedCell = cell
        listeners.set(cell, this.measure)
        observer.observe(cell)
      }
      this.measure()
    },
    unobserve () {
      if (!this.observedCell) return
      observer.unobserve(this.observedCell)
      listeners.delete(this.observedCell)
      this.observedCell = null
    },
    measure () {
      const cell = this.element()
      if (!cell) return
      this.truncated = cell.scrollWidth > cell.clientWidth
    }
  }
}
</script>

<style scoped>
.table-overflow-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.table-overflow-text:focus-visible,
.table-overflow-text:focus-within {
  outline: 2px solid var(--ui-focus);
  outline-offset: -2px;
}
</style>
