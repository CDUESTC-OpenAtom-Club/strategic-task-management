<script setup lang="ts">
/**
 * 部门导航树组件
 * 用于战略任务管理页面左侧导航
 * 支持职能部门和二级学院的树形展示
 */
import { ref, computed, watch } from 'vue'
import { OfficeBuilding, School, FolderOpened, Folder, Promotion } from '@element-plus/icons-vue'
import { useOrgStore } from '@/stores/org'

const orgStore = useOrgStore()

// Props
const props = defineProps<{
  modelValue: string
  showAllOption?: boolean
  showIndicatorCount?: boolean
  indicatorCounts?: Record<string, number>
  pendingApprovalCounts?: Record<string, number>
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', dept: string, type: 'all' | 'functional' | 'college'): void
}>()

// 获取部门数据（从数据库动态获取）
const functionalDepartments = computed(() => orgStore.getAllFunctionalDepartmentNames())
const colleges = computed(() => orgStore.getAllCollegeNames())

// 展开状态
const expandedFunctional = ref(true)
const expandedColleges = ref(false)

// 当前选中的部门
const selectedDept = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 树形数据结构
interface TreeNode {
  id: string
  label: string
  type: 'category' | 'functional' | 'college' | 'all'
  icon: any
  children?: TreeNode[]
  count?: number
  pendingCount?: number
}

const treeData = computed<TreeNode[]>(() => {
  const nodes: TreeNode[] = []

  // 全部选项
  if (props.showAllOption) {
    const totalIndicators = Object.values(props.indicatorCounts || {}).reduce((a, b) => a + b, 0)
    const totalPending = Object.values(props.pendingApprovalCounts || {}).reduce((a, b) => a + b, 0)
    nodes.push({
      id: 'all',
      label: '全部部门',
      type: 'all',
      icon: FolderOpened,
      count: totalIndicators,
      pendingCount: totalPending
    })
  }

  // 职能部门分组
  const functionalChildren: TreeNode[] = functionalDepartments.value.map(dept => ({
    id: dept,
    label: dept,
    type: 'functional' as const,
    icon: OfficeBuilding,
    count: props.indicatorCounts?.[dept] || 0,
    pendingCount: props.pendingApprovalCounts?.[dept] || 0
  }))

  nodes.push({
    id: 'functional-group',
    label: '职能部门',
    type: 'category',
    icon: expandedFunctional.value ? FolderOpened : Folder,
    children: functionalChildren
  })

  // 二级学院分组
  const collegeChildren: TreeNode[] = colleges.value.map(college => ({
    id: college,
    label: college,
    type: 'college' as const,
    icon: School,
    count: props.indicatorCounts?.[college] || 0,
    pendingCount: props.pendingApprovalCounts?.[college] || 0
  }))

  nodes.push({
    id: 'college-group',
    label: '二级学院',
    type: 'category',
    icon: expandedColleges.value ? FolderOpened : Folder,
    children: collegeChildren
  })

  return nodes
})

// 处理节点点击
const handleNodeClick = (node: TreeNode) => {
  if (node.type === 'category') {
    // 分类节点：切换展开状态
    if (node.id === 'functional-group') {
      expandedFunctional.value = !expandedFunctional.value
    } else if (node.id === 'college-group') {
      expandedColleges.value = !expandedColleges.value
    }
  } else {
    // 具体部门节点：选中并触发事件
    selectedDept.value = node.id === 'all' ? '' : node.id
    emit('select', node.id, node.type as 'all' | 'functional' | 'college')
  }
}

// 判断节点是否选中
const isNodeSelected = (node: TreeNode) => {
  if (node.type === 'category') return false
  if (node.id === 'all') return !selectedDept.value
  return selectedDept.value === node.id
}

// 判断分类是否有选中的子节点
const hasSelectedChild = (node: TreeNode) => {
  if (!node.children) return false
  return node.children.some(child => child.id === selectedDept.value)
}
</script>

<template>
  <div class="department-nav-tree">
    <div class="tree-header">
      <el-icon><OfficeBuilding /></el-icon>
      <span>部门导航</span>
    </div>

    <div class="tree-content">
      <template v-for="node in treeData" :key="node.id">
        <!-- 顶层节点 -->
        <div
          :class="[
            'tree-node',
            'tree-node-top',
            { 'is-selected': isNodeSelected(node) },
            { 'has-selected-child': hasSelectedChild(node) },
            { 'is-category': node.type === 'category' }
          ]"
          @click="handleNodeClick(node)"
        >
          <div class="node-content">
            <el-icon class="node-icon"><component :is="node.icon" /></el-icon>
            <span class="node-label">{{ node.label }}</span>
            <template v-if="node.type !== 'category'">
              <el-badge
                v-if="node.pendingCount && node.pendingCount > 0"
                :value="node.pendingCount"
                type="danger"
                class="pending-badge"
              />
              <span v-else-if="showIndicatorCount && node.count" class="node-count">
                {{ node.count }}
              </span>
            </template>
            <el-icon v-if="node.type === 'category'" class="expand-icon">
              <component :is="node.id === 'functional-group' ? (expandedFunctional ? 'ArrowDown' : 'ArrowRight') : (expandedColleges ? 'ArrowDown' : 'ArrowRight')" />
            </el-icon>
          </div>
        </div>

        <!-- 子节点 -->
        <transition name="expand">
          <div
            v-if="node.children && ((node.id === 'functional-group' && expandedFunctional) || (node.id === 'college-group' && expandedColleges))"
            class="tree-children"
          >
            <div
              v-for="child in node.children"
              :key="child.id"
              :class="['tree-node', 'tree-node-child', { 'is-selected': isNodeSelected(child) }]"
              @click="handleNodeClick(child)"
            >
              <div class="node-content">
                <el-icon class="node-icon"><component :is="child.icon" /></el-icon>
                <span class="node-label">{{ child.label }}</span>
                <el-badge
                  v-if="child.pendingCount && child.pendingCount > 0"
                  :value="child.pendingCount"
                  type="danger"
                  class="pending-badge"
                />
                <span v-else-if="showIndicatorCount && child.count" class="node-count">
                  {{ child.count }}
                </span>
              </div>
            </div>
          </div>
        </transition>
      </template>
    </div>
  </div>
</template>

<style scoped>
.department-nav-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-white, #fff);
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--border-color, #e2e8f0);
  overflow: hidden;
}

.tree-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-main, #1e293b);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.tree-header .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 18px;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-node {
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 2px;
}

.tree-node-top {
  margin-bottom: 4px;
}

.tree-node-child {
  margin-left: 16px;
}

.tree-node:hover {
  background: var(--bg-page, #f1f5f9);
}

.tree-node.is-selected {
  background: var(--color-primary, #2c5282);
  color: #fff;
}

.tree-node.is-selected .node-icon,
.tree-node.is-selected .node-count {
  color: rgba(255, 255, 255, 0.9);
}

.tree-node.is-category {
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.tree-node.is-category:hover {
  color: var(--color-primary, #2c5282);
}

.tree-node.has-selected-child {
  background: rgba(44, 82, 130, 0.08);
}

.node-content {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 8px;
}

.node-icon {
  font-size: 16px;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
}

.tree-node.is-category .node-icon {
  color: var(--color-primary, #2c5282);
}

.node-label {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
  background: var(--bg-page, #f1f5f9);
  padding: 2px 8px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
}

.tree-node.is-selected .node-count {
  background: rgba(255, 255, 255, 0.2);
}

.pending-badge {
  margin-left: auto;
}

.pending-badge :deep(.el-badge__content) {
  font-size: 10px;
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
}

.expand-icon {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
  transition: transform 0.2s ease;
}

.tree-children {
  overflow: hidden;
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 800px;
}

/* 滚动条样式 */
.tree-content::-webkit-scrollbar {
  width: 6px;
}

.tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.tree-content::-webkit-scrollbar-thumb {
  background: var(--border-light, #e2e8f0);
  border-radius: 3px;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-color, #cbd5e1);
}
</style>
