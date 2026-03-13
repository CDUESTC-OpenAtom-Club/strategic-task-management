/**
 * useNavigation - 导航管理 Composable
 *
 * 职责:
 * - 管理标签页配置
 * - 处理标签页导航
 * - 计算当前激活标签
 *
 * @module composables/layout
 */

import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { UserRole } from '@/types'
import type { Component } from 'vue'
import { DataAnalysis, Document as _Document, Edit, List, Promotion } from '@element-plus/icons-vue'

/** 标签页配置接口 */
export interface TabConfig {
  id: string
  label: string
  icon: Component
  path: string
}

/** 基于角色的页面配置 */
const ROLE_BASED_TABS: Record<UserRole, TabConfig[]> = {
  strategic_dept: [
    { id: 'dashboard', label: '数据看板', icon: DataAnalysis, path: '/dashboard' },
    { id: 'strategic', label: '战略任务管理', icon: List, path: '/strategic-tasks' }
  ],
  functional_dept: [
    { id: 'dashboard', label: '数据看板', icon: DataAnalysis, path: '/dashboard' },
    { id: 'indicators', label: '指标填报', icon: Edit, path: '/indicators' },
    { id: 'distribution', label: '指标下发与审批', icon: Promotion, path: '/distribution' }
  ],
  secondary_college: [
    { id: 'dashboard', label: '数据看板', icon: DataAnalysis, path: '/dashboard' },
    { id: 'indicators', label: '指标填报', icon: Edit, path: '/indicators' }
  ]
}

export function useNavigation(viewingRole: computed<UserRole | null>) {
  const router = useRouter()
  const route = useRoute()

  // 根据当前视角角色获取对应的标签页
  const tabs = computed<TabConfig[]>(() => {
    const role = viewingRole.value
    if (!role) {
      return []
    }
    return ROLE_BASED_TABS[role] || []
  })

  // 当前激活的tab基于路由
  const activeTab = computed(() => {
    const currentPath = route.path
    const tab = tabs.value.find(t => t.path === currentPath)
    return tab?.id || 'dashboard'
  })

  // 处理tab点击
  const handleTabClick = (tabPath: string) => {
    if (tabPath !== route.path) {
      router.push(tabPath)
    }
  }

  return {
    tabs,
    activeTab,
    handleTabClick
  }
}
