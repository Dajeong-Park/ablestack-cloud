<!-- Licensed under the Apache License, Version 2.0. See NOTICE. -->
<script>
import { computed, defineComponent, h } from 'vue'
import { Table } from 'ant-design-vue'
import { sharedfsTableColumns, sharedfsTableScroll, sharedfsTablePagination } from '@/utils/sharedfsTable'

export default defineComponent({
  name: 'SharedFSTable',
  inheritAttrs: false,
  props: {
    columns: { type: Array, default: () => [] },
    dataSource: { type: Array, default: () => [] },
    pagination: { type: [Object, Boolean], default: undefined },
    scroll: { type: Object, default: () => ({}) }
  },
  setup (props) {
    const tableColumns = computed(() => sharedfsTableColumns(props.columns))
    return { tableColumns }
  },
  render () {
    // Keep AntD's own client sorting/paging, empty-slot fallback and all existing
    // cell/action slots. This adapter owns presentation only, never API reads.
    return h(Table, {
      ...this.$attrs,
      class: ['sharedfs-table', this.$attrs.class],
      columns: this.tableColumns,
      dataSource: this.dataSource,
      pagination: sharedfsTablePagination(this.pagination, this.$t),
      scroll: sharedfsTableScroll(this.tableColumns, this.scroll)
    }, this.$slots)
  }
})
</script>
