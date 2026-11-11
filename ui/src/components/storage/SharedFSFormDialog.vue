<!-- Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See NOTICE. Licensed under the Apache License,
Version 2.0: http://www.apache.org/licenses/LICENSE-2.0 -->
<template>
  <a-modal v-bind="$attrs" class="sharedfs-create-shell" :footer="undefined">
    <template #title><slot name="title" /></template>
    <slot />
    <template #footer><div ref="footerTarget" class="sharedfs-create-footer" /></template>
  </a-modal>
</template>
<script>
import { provide, shallowRef } from 'vue'
export default {
  name: 'SharedFSFormDialog',
  inheritAttrs: false,
  setup () {
    // Each live modal owns one target. Form handlers/refs remain in the original component.
    const footerTarget = shallowRef(null)
    provide('moldDialogFooterTarget', footerTarget)
    return { footerTarget }
  }
}
</script>
<style>
/* Keep the original width, two-column body, gaps and per-pane scroll areas.
   Only the available body height shrinks to reserve the fixed action footer. */
.sharedfs-create-shell .ant-modal-body,
.sharedfs-create-shell .ant-modal-body > .ant-spin-nested-loading,
.sharedfs-create-shell .ant-modal-body > .ant-spin-nested-loading > .ant-spin-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.sharedfs-create-shell .sharedfs-create-dialog { flex: 1 1 auto; }
.sharedfs-create-footer .mold-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.sharedfs-create-footer .ant-btn { margin: 0; }
</style>
