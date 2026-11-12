// Licensed under the Apache License, Version 2.0. See NOTICE.
import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { Pagination } from 'ant-design-vue'
import NicsTable from '@/views/network/NicsTable.vue'
import SharedFSTable from '@/components/storage/SharedFSTable.vue'
import SharedFSTablePagination from '@/components/storage/SharedFSTablePagination.vue'
import { sharedfsTableColumns, sharedfsTablePagination } from '@/utils/sharedfsTable'

const translate = (key, args) => args ? args.join(' / ') : key
let wrapper
afterEach(() => wrapper?.unmount())
const globals = { mocks: { $t: translate } }
const columns = [
  { key: 'name', dataIndex: 'name', title: 'Name', width: 200 },
  { key: 'path', dataIndex: 'path', title: 'Path', width: 400, fixed: 'left' },
  { key: 'actions', title: 'Actions', width: 180 }
]
const rows = Array.from({ length: 23 }, (_, i) => ({ id: 'row-' + i, name: 'share-' + i, path: '/export/' + i }))

test('normalization is immutable and pins only the leading identity and terminal actions', () => {
  const input = JSON.parse(JSON.stringify(columns))
  const result = sharedfsTableColumns(input)
  expect(input).toEqual(columns)
  expect(result.map(c => c.fixed)).toEqual(['left', undefined, 'right'])
  expect(result[0]).toMatchObject({ ellipsis: true, width: 200, className: 'sharedfs-table-leading-cell' })
  expect(sharedfsTableColumns([{ key: 'state' }, { key: 'observed' }])[1].fixed).toBeUndefined()
})

test('VM pager text, size, options and jumper are shared without forcing a controlled client page size', () => {
  const pagination = sharedfsTablePagination({ pageSize: 20 }, translate)
  expect(pagination).toMatchObject({ defaultPageSize: 20, size: 'small', showQuickJumper: true, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] })
  expect(pagination.pageSize).toBeUndefined()
  expect(pagination.showTotal(23, [11, 20])).toBe('23 / 11 / 20')
  expect(pagination.buildOptionText({ value: 20 })).toBe('20 / label.page')
  expect(sharedfsTablePagination(false, translate)).toBe(false)
})

test('actual AntD table preserves custom links/action handlers, fallback cells, stable rows, paging and fixed edge classes', async () => {
  const action = jest.fn()
  wrapper = mount(SharedFSTable, {
    props: { columns, dataSource: rows, rowKey: 'id', scroll: { x: 900 } },
    attrs: { 'data-testid': 'real-table' },
    slots: {
      bodyCell: ({ column, record }) => column.key === 'name'
        ? h('a', { href: '#/share/' + record.id }, record.name)
        : column.key === 'actions' ? h('button', { onClick: () => action(record.id) }, 'Edit') : undefined
    },
    global: globals
  })
  await flushPromises()
  expect(wrapper.vm.tableColumns.map(c => c.fixed)).toEqual(['left', undefined, 'right'])
  expect(wrapper.find('td.ant-table-cell-fix-left').find('a').attributes('href')).toBe('#/share/row-0')
  expect(wrapper.find('td.ant-table-cell-fix-right').exists()).toBe(true)
  expect(wrapper.text()).toContain('/export/0')
  expect(wrapper.findAll('tbody tr[data-row-key]')).toHaveLength(10)
  expect(wrapper.find('.ant-pagination.mini').exists()).toBe(true)
  expect(wrapper.find('.ant-pagination-total-text').text()).toContain('23 / 1 / 10')
  expect(wrapper.find('.ant-pagination-options-quick-jumper').exists()).toBe(true)
  await wrapper.find('.ant-pagination-item-2').trigger('click')
  await flushPromises()
  expect(wrapper.find('tbody tr[data-row-key] a').text()).toBe('share-10')
  await wrapper.find('tbody tr[data-row-key] button').trigger('click')
  expect(action).toHaveBeenCalledWith('row-10')
  const firstRow = wrapper.find('tbody tr[data-row-key]').element
  await wrapper.setProps({ loading: false, dataSource: rows.map(row => ({ ...row })) })
  expect(wrapper.find('tbody tr[data-row-key]').element).toBe(firstRow)
})

test('server pager preserves total/current, emits one existing page request and disables duplicate client paging', async () => {
  const change = jest.fn()
  wrapper = mount(SharedFSTablePagination, {
    attrs: { current: 1, pageSize: 20, total: 45, showSizeChanger: false, onChange: change },
    global: globals
  })
  const pager = wrapper.findComponent(Pagination)
  expect(pager.props()).toMatchObject({ current: 1, pageSize: 20, total: 45, size: 'small', showSizeChanger: false })
  expect(wrapper.classes()).toContain('detail-tab-pagination')
  await wrapper.find('.ant-pagination-item-2').trigger('click')
  expect(change).toHaveBeenCalledTimes(1)
  expect(change).toHaveBeenCalledWith(2, 20)
})

test.each([false, true])('NIC table opts into SharedFS presentation only under the SharedFS provider: %s', async (sharedfs) => {
  wrapper = mount(NicsTable, {
    props: { resource: { id: 'vm', nic: [] }, standard: true },
    global: { ...globals, provide: { parentFetchData: jest.fn(), ...(sharedfs ? { sharedfsTableLayout: true } : {}) } }
  })
  await flushPromises()
  expect(wrapper.findComponent(SharedFSTable).exists()).toBe(sharedfs)
})

test.each([
  'views/storage/SharedFSTab', 'views/storage/SharedFSCapacityTab',
  'views/storage/SharedFSBootRecoveryTab', 'views/storage/SharedFSNetworkStatus',
  'views/storage/SharedFSDeletion', 'views/storage/SharedFSDeletionHistory',
  'components/storage/StorageConfigBackupTab', 'components/storage/StorageDirectoryPolicyPanel',
  'components/storage/StorageSmbServiceNamesTab', 'components/storage/StorageNfsListenerTable',
  'components/storage/StorageConfigurationOperationPanel', 'components/storage/StorageConfigurationPreflightPanel',
  'components/storage/StoragePosixAclFields', 'components/storage/NfsLocalProbeNotice',
  'components/view/StorageNfsIdentityPanel', 'views/tools/RuntimeCatalogRecords'
])('actual screen %s registers the shared table at its exported component boundary', module => {
  const component = require('@/' + module).default
  expect(component.components.ATable).toBe(SharedFSTable)
})
