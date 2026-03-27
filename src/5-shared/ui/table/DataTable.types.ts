import type { TableColumnCtx } from 'element-plus'

export interface TableColumn {
  prop: string
  label: string
  width?: number | string
  minWidth?: number | string
  fixed?: boolean | 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  formatter?: (
    row: Record<string, unknown>,
    column: TableColumnCtx<Record<string, unknown>>,
    cellValue: unknown,
    index: number
  ) => string
  slot?: string
  children?: TableColumn[]
}

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
  pageSizes?: number[]
}

export interface DataTableProps<T extends Record<string, unknown>> {
  data: T[]
  columns: TableColumn[]
  height?: string | number
  maxHeight?: string | number
  border?: boolean
  stripe?: boolean
  rowKey?: string
  loading?: boolean
  empty?: boolean
  emptyText?: string
  pagination?: PaginationConfig | false
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  selectedRows?: T[]
  selectable?: boolean
  rowClassName?: string | ((data: { row: T; rowIndex: number }) => string)
}
