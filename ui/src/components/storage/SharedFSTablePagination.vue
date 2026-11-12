<!-- Licensed under the Apache License, Version 2.0. See NOTICE. -->
<script>
import { defineComponent, h } from 'vue'
import { Pagination } from 'ant-design-vue'
import { sharedfsPaginationProps } from '@/utils/sharedfsTable'

export default defineComponent({
  name: 'SharedFSTablePagination',
  inheritAttrs: false,
  render () {
    return h(Pagination, {
      ...sharedfsPaginationProps(this.$t),
      ...this.$attrs,
      class: ['detail-tab-pagination sharedfs-table-pagination', this.$attrs.class]
    }, this.$slots)
  }
})
</script>
