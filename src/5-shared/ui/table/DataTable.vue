<!--
  DataTable - 通用数据表格组件

  职责:
  - 提供统一的表格样式
  - 支持分页
  - 支持排序
  - 支持筛选
  - 支持加载状态和空状态
-->
<script setup lang="ts" generic="T extends Record<string, unknown>">
import { ref, computed, watch } from 'vue'
import type { TableColumnCtx } from 'element-plus'
import type { DataTableProps, PaginationConfig, TableColumn } from './DataTable.types'

type SelectionColumn = {
  type: 'selection'
  width: number
  align: 'center'
}

type DisplayColumn = TableColumn | SelectionColumn

const props = withDefaults(defineProps<DataTableProps<T>>(), {
  height: undefined,
  maxHeight: undefined,
  border: true,
  stripe: true,
  rowKey: '',
  loading: false,
  empty: false,
  emptyText: '暂无数据',
  pagination: false,
  defaultSort: undefined,
  selectedRows: () => [],
  selectable: false,
  rowClassName: ''
})

const emit = defineEmits<{
  /** 行点击事件 */
  'row-click': [row: T, column: TableColumnCtx<T>, event: Event]
  /** 选择变化事件 */
  'selection-change': [selection: T[]]
  /** 排序变化事件 */
  'sort-change': [sort: { column: TableColumnCtx<T>; prop: string; order: string | null }]
  /** 分页变化事件 */
  'page-change': [page: number]
  /** 每页条数变化事件 */
  'size-change': [size: number]
  /** 刷新事件 */
  refresh: []
}>()

/** 内部选中行 */
const innerSelection = ref<T[]>([])

const paginationConfig = computed<PaginationConfig | null>(() =>
  props.pagination === false ? null : props.pagination
)

/** 当前页码 */
const currentPage = ref(paginationConfig.value?.page ?? 1)

/** 每页条数 */
const pageSize = ref(paginationConfig.value?.pageSize ?? 10)

/** 监听分页配置变化 */
watch(() => props.pagination, (newPagination) => {
  if (newPagination) {
    currentPage.value = newPagination.page
    pageSize.value = newPagination.pageSize
  }
}, { deep: true })

/** 处理行点击 */
const handleRowClick = (row: T, column: unknown, event: Event) => {
  emit('row-click', row, column as TableColumnCtx<T>, event)
}

/** 处理选择变化 */
const handleSelectionChange = (selection: T[]) => {
  innerSelection.value = selection
  emit('selection-change', selection)
}

/** 处理排序变化 */
const handleSortChange = (sort: { column?: unknown; prop?: string; order?: string | null }) => {
  emit('sort-change', {
    column: sort.column as TableColumnCtx<T>,
    prop: sort.prop ?? '',
    order: sort.order ?? null
  })
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
const displayColumns = computed<DisplayColumn[]>(() => {
  if (!props.selectable) {
    return props.columns
  }

  return [
    {
      type: 'selection' as const,
      width: 55,
      align: 'center' as const
    },
    ...props.columns
  ]
})

function isDataColumn(column: DisplayColumn): column is TableColumn {
  return 'prop' in column
}

function getCellValue(row: T, prop: string): unknown {
  return row[prop as keyof T]
}
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
      <template v-for="(column, index) in displayColumns" :key="isDataColumn(column) ? column.prop : `selection-${index}`">
        <!-- 分组表头 -->
        <el-table-column
          v-if="isDataColumn(column) && column.children"
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
                <slot :name="child.slot" :row="scope.row" :column="scope.column" :index="scope.$index" />
              </template>
              <template v-else-if="child.formatter" #default="scope">
                {{ child.formatter(scope.row, scope.column, scope.row[child.prop], scope.$index) }}
              </template>
            </el-table-column>
          </template>
        </el-table-column>

        <!-- 自定义插槽列 -->
        <el-table-column
          v-else-if="isDataColumn(column) && column.slot"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        >
          <template #default="scope">
            <slot :name="column.slot" :row="scope.row" :column="scope.column" :index="scope.$index" />
          </template>
        </el-table-column>

        <!-- 格式化函数列 -->
        <el-table-column
          v-else-if="isDataColumn(column) && column.formatter"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :align="column.align"
          :sortable="column.sortable"
        >
          <template #default="scope">
            {{ column.formatter(scope.row, scope.column, getCellValue(scope.row, column.prop), scope.$index) }}
          </template>
        </el-table-column>

        <!-- 选择列 -->
        <el-table-column
          v-else-if="'type' in column"
          :type="column.type"
          :width="column.width"
          :align="column.align"
        />

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
    <div v-if="paginationConfig" class="data-table__pagination">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="paginationConfig.pageSizes || [10, 20, 50, 100]"
        :total="paginationConfig.total"
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
