// Licensed under the Apache License, Version 2.0. See NOTICE.
const actionKeys = new Set(['action', 'actions', 'details', 'detail', 'view'])
export const sharedfsPageSizeOptions = ['10', '20', '50', '100', '200']

export function sharedfsTableColumns (columns) {
  return columns.map((column, index) => {
    const leading = index === 0
    const action = index === columns.length - 1 && actionKeys.has(column.key || column.dataIndex)
    const classes = [column.className, leading && 'sharedfs-table-leading-cell'].filter(Boolean).join(' ')
    return {
      ...column,
      fixed: leading ? 'left' : action ? 'right' : undefined,
      width: leading ? Math.min(Number(column.width) || 200, 260) : column.width || (action ? 180 : 160),
      ...(leading ? { ellipsis: true } : {}),
      className: classes
    }
  })
}

export function sharedfsTableScroll (columns, scroll = {}) {
  const width = columns.reduce((total, column) => total + (Number(column.width) || 160), 0)
  return { ...scroll, x: Math.max(Number(scroll.x) || 0, width) }
}

export function sharedfsPaginationProps (translate) {
  return {
    size: 'small',
    hideOnSinglePage: false,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: sharedfsPageSizeOptions,
    showTotal: (total, range) => translate('message.detail.tab.total', [total, range[0], range[1]]),
    buildOptionText: ({ value }) => value + ' / ' + translate('label.page')
  }
}

export function sharedfsTablePagination (pagination, translate) {
  if (pagination === false) return false
  const { pageSize, ...options } = pagination || {}
  return {
    ...options,
    defaultPageSize: pageSize || 10,
    ...sharedfsPaginationProps(translate),
    // Keep explicitly controlled/server pagination possible; callers with an
    // external server pager pass false and are never paged a second time.
    ...(options.current !== undefined && pageSize ? { pageSize } : {})
  }
}
