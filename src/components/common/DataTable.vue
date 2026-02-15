<!--
  DataTable - 通用数据表格组件

  职责:
  - 提供统一的表格样式
  - 支持分页
  - 支持排序
  - 支持筛选
  - 支持加载状态和空状态
-->
<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch } from 'vue'
import type { TableColumnCtx } from 'element-plus'

/** 表格列配置 */
export interface TableColumn {
  /** 列键名 */
  prop: string
  /** 列标题 */
  label: string
  /** 列宽 */
  width?: number | string
  /** 最小列宽 */
  minWidth?: number | string
  /** 是否固定列 */
  fixed?: boolean | 'left' | 'right'
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right'
  /** 是否可排序 */
  sortable?: boolean
  /** 格式化函数 */
  formatter?: (row: T, column: TableColumnCtx<T>, cellValue: any, index: number) => string
  /** 自定义插槽名称 */
  slot?: string
  /** 子列 (用于分组表头) */
  children?: TableColumn[]
}

/** 分页配置 */
export interface PaginationConfig {
  /** 当前页 */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总条数 */
  total: number
  /** 每页条数选项 */
  pageSizes?: number[]
}

/** Props */
export interface DataTableProps<T> {
  /** 数据源 */
  data: T[]
  /** 列配置 */
  columns: TableColumn[]
  /** 表格高度 (固定表头) */
  height?: string | number
  /** 最大高度 */
  maxHeight?: string | number
  /** 是否显示边框 */
  border?: boolean
  /** 是否斑马纹 */
  stripe?: boolean
  /** 行键名 (用于优化渲染) */
  rowKey?: string
  /** 是否显示加载状态 */
  loading?: boolean
  /** 是否显示空状态 */
  empty?: boolean
  /** 空状态文字 */
  emptyText?: string
  /** 分页配置 */
  pagination?: PaginationConfig | false
  /** 默认排序列的 prop 和顺序 */
  defaultSort?: { prop: string; order: 'ascending' | 'descending' }
  /** 选中行 */
  selectedRows?: T[]
  /** 是否多选 */
  selectable?: boolean
  /** 行类名回调 */
  rowClassName?: string | ((data: { row: T; rowIndex: number }) => string)
}

const props = withDefaults(defineProps<DataTableProps<T>>(), {
  border: true,
  stripe: true,
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  pagination: false,
  selectable: false
})

const emit = defineEmits<{
  /** 行点击事件 */
  'row-click': [row: T, column: any, event: Event]
  /** 选择变化事件 */
  'selection-change': [selection: T[]]
  /** 排序变化事件 */
  'sort-change': [sort: { column: any; prop: string; order: string | null }]
  /** 分页变化事件 */
  'page-change': [page: number]
  /** 每页条数变化事件 */
  'size-change': [size: number]
  /** 刷新事件 */
  refresh: []
}>()

/** 内部选中行 */
const innerSelection = ref<T[]>([])

/** 当前页码 */
const currentPage = ref(props.pagination?.page || 1)

/** 每页条数 */
const pageSize = ref(props.pagination?.pageSize || 10)

/** 监听分页配置变化 */
watch(() => props.pagination, (newPagination) => {
  if (newPagination) {
    currentPage.value = newPagination.page
    pageSize.value = newPagination.pageSize
  }
}, { deep: true })

/** 处理行点击 */
const handleRowClick = (row: T, column: any, event: Event) => {
  emit('row-click', row, column, event)
}

/** 处理选择变化 */
const handleSelectionChange = (selection: T[]) => {
  innerSelection.value = selection
  emit('selection-change', selection)
}

/** 处理排序变化 */
const handleSortChange = (sort: { column: any; prop: string; order: string | null }) => {
  emit('sort-change', sort)
}

/** 处理页码变化 */
const handlePageChange = (page: number) => {
  currentPage.value = page
  emit('page-change', page)
}

/** 处理每页条数变化 */
const handleSizeChange = (size: number) => {
  pageSize.value = size
  emit('size-change', size)
}

/** 计算显示的列 (包含选择列) */
const displayColumns = computed(() => {
  if (!props.selectable) return props.columns

  return [
    {
      type: 'selection' as const,
      width: 55,
      align: 'center' as const
    },
    ...props.columns
  ]
})
</script>

<template>
  <div class="data-table">
    <!-- 工具栏 -->
    <div v-if="$slots.toolbar" class="data-table__toolbar">
      <slot name="toolbar" :selected-rows="innerSelection" />
    </div>

    <!-- 表格 -->
    <el-table
      :data="data"
      :columns="displayColumns"
      :height="height"
      :max-height="maxHeight"
      :border="border"
      :stripe="stripe"
      :row-key="rowKey"
      :default-sort="defaultSort"
      :loading="loading"
      :empty-text="emptyText"
      :row-class-name="rowClassName"
      @row-click="handleRowClick"
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
    >
      <template v-for="column in displayColumns" :key="column.prop">
        <!-- 分组表头 -->
        <el-table-column
          v-if="column.children"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        >
          <template v-for="child in column.children" :key="child.prop">
            <el-table-column
              :prop="child.prop"
              :label="child.label"
              :width="child.width"
              :min-width="child.minWidth"
              :fixed="child.fixed"
              :align="child.align"
              :sortable="child.sortable"
            >
              <template v-if="child.slot" #default="scope">
                <slot :name="child.slot" :row="scope.row" :column="scope.column" :$index="scope.$index" />
              </template>
              <template v-else-if="child.formatter" #default="scope">
                {{ child.formatter(scope.row, scope.column, scope.row[child.prop], scope.$index) }}
              </template>
            </el-table-column>
          </template>
        </el-table-column>

        <!-- 自定义插槽列 -->
        <el-table-column
          v-else-if="column.slot"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        >
          <template #default="scope">
            <slot :name="column.slot" :row="scope.row" :column="scope.column" :$index="scope.$index" />
          </template>
        </el-table-column>

        <!-- 格式化函数列 -->
        <el-table-column
          v-else-if="column.formatter"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        >
          <template #default="scope">
            {{ column.formatter(scope.row, scope.column, scope.row[column.prop], scope.$index) }}
          </template>
        </el-table-column>

        <!-- 普通列 -->
        <el-table-column
          v-else
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        />
      </template>
    </el-table>

    <!-- 分页器 -->
    <div v-if="pagination" class="data-table__pagination">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="pagination.pageSizes || [10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.data-table {
  width: 100%;
}

.data-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: 4px;
}

.data-table__toolbar:empty {
  display: none;
}

.data-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding: 12px;
}
</style>
