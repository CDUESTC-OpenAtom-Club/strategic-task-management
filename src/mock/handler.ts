/**
 * Mock API 处理器
 * 拦截 API 请求并返回模拟数据
 */

import { logger } from '@/utils/logger'
import {
  mockUsers,
  mockAnnouncements,
  mockIndicators,
  mockTasks,
  mockMilestones,
  mockDashboardData,
  createMockResponse,
  createMockError
} from './data'

// 模拟延迟（ms）
const MOCK_DELAY = 300

/**
 * 模拟网络延迟
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 解析 URL 路径
 */
function parsePath(url: string): { path: string; query: Record<string, string> } {
  const [path, queryString] = url.split('?')
  const query: Record<string, string> = {}

  if (queryString) {
    queryString.split('&').forEach(param => {
      const [key, value] = param.split('=')
      query[key] = decodeURIComponent(value)
    })
  }

  return { path, query }
}

/**
 * Mock API 路由处理器
 */
export class MockApiHandler {
  /**
   * 处理 API 请求
   */
  static async handleRequest(config: any): Promise<any> {
    const { method, url, data } = config
    const { path, query } = parsePath(url)

    logger.debug('🎭 [Mock API] 请求拦截:', {
      method: method?.toUpperCase(),
      path,
      query,
      hasData: !!data
    })

    // 模拟网络延迟
    await delay(MOCK_DELAY)

    try {
      let response: any

      // ============================================
      // 认证相关 API
      // ============================================
      if (path === '/auth/login' && method === 'post') {
        response = await this.handleLogin(data)
      } else if (path === '/auth/info' && method === 'get') {
        response = await this.handleAuthInfo()
      } else if (path === '/auth/logout' && method === 'post') {
        response = await this.handleLogout()
      }
      // ============================================
      // 组织架构 API
      // ============================================
      else if (path === '/orgs' && method === 'get') {
        response = await this.handleGetOrgs()
      }
      // ============================================
      // 系统公告 API
      // ============================================
      else if (path === '/system/announcement' && method === 'get') {
        response = await this.handleGetAnnouncements()
      }
      // ============================================
      // 战略指标 API
      // ============================================
      else if (path === '/indicators' && method === 'get') {
        response = await this.handleGetIndicators(query)
      } else if (path.startsWith('/indicators/') && method === 'get') {
        const id = path.split('/').pop()
        response = await this.handleGetIndicator(id!)
      } else if (path === '/indicators' && method === 'post') {
        response = await this.handleCreateIndicator(data)
      } else if (path.startsWith('/indicators/') && method === 'put') {
        const id = path.split('/').pop()
        response = await this.handleUpdateIndicator(id!, data)
      } else if (path.startsWith('/indicators/') && method === 'delete') {
        const id = path.split('/').pop()
        response = await this.handleDeleteIndicator(id!)
      }
      // ============================================
      // 任务 API
      // ============================================
      else if (path === '/tasks' && method === 'get') {
        response = await this.handleGetTasks(query)
      } else if (path.startsWith('/tasks/') && method === 'get') {
        const id = path.split('/').pop()
        response = await this.handleGetTask(id!)
      } else if (path === '/tasks' && method === 'post') {
        response = await this.handleCreateTask(data)
      }
      // ============================================
      // 里程碑 API
      // ============================================
      else if (path === '/milestones' && method === 'get') {
        response = await this.handleGetMilestones(query)
      }
      // ============================================
      // 仪表板 API
      // ============================================
      else if (path === '/dashboard' && method === 'get') {
        response = await this.handleGetDashboard()
      } else if (path === '/dashboard/overview' && method === 'get') {
        response = await this.handleGetDashboard()
      } else if (path === '/dashboard/department-progress' && method === 'get') {
        response = await this.handleGetDepartmentProgress()
      } else if (path === '/dashboard/recent-activities' && method === 'get') {
        response = await this.handleGetRecentActivities()
      }
      // ============================================
      // 未匹配的路由
      // ============================================
      else {
        logger.warn(`🎭 [Mock API] 未实现的路由: ${method?.toUpperCase()} ${path}`)
        response = createMockError('NOT_IMPLEMENTED', `Mock API 未实现: ${path}`)
      }

      logger.debug('🎭 [Mock API] 响应:', response)
      return response
    } catch (error) {
      logger.error('🎭 [Mock API] 错误:', error)
      throw error
    }
  }

  // ============================================
  // 认证处理器
  // ============================================

  private static async handleLogin(data: any) {
    const { username, password } = data

    // Mock 登录：任意用户名密码都可以登录
    let user = mockUsers.admin
    if (username === 'functional') {user = mockUsers.functional}
    else if (username === 'college') {user = mockUsers.college}

    logger.info('🎭 [Mock Login] 用户登录:', user.realName)

    return createMockResponse({
      token: 'mock_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      user,
      expiresIn: 7200
    }, '登录成功')
  }

  private static async handleAuthInfo() {
    return createMockResponse(mockUsers.admin, '获取用户信息成功')
  }

  private static async handleLogout() {
    return createMockResponse(null, '退出登录成功')
  }

  // ============================================
  // 组织架构处理器
  // ============================================

  private static async handleGetOrgs() {
    const mockOrgs = [
      { id: 1, name: '战略发展部', code: 'STRATEGY', parentId: null },
      { id: 2, name: '科研处', code: 'RESEARCH', parentId: null },
      { id: 3, name: '教务处', code: 'EDUCATION', parentId: null },
      { id: 4, name: '人事处', code: 'HR', parentId: null },
      { id: 5, name: '财务处', code: 'FINANCE', parentId: null }
    ]
    return createMockResponse(mockOrgs, '获取组织架构成功')
  }

  // ============================================
  // 系统公告处理器
  // ============================================

  private static async handleGetAnnouncements() {
    return createMockResponse(mockAnnouncements, '获取公告成功')
  }

  // ============================================
  // 战略指标处理器
  // ============================================

  private static async handleGetIndicators(query: any) {
    const { year = '2025' } = query
    logger.debug(`🎭 [Mock API] 获取 ${year} 年度指标列表`)

    return createMockResponse({
      list: mockIndicators,
      total: mockIndicators.length,
      year
    }, '获取指标列表成功')
  }

  private static async handleGetIndicator(id: string) {
    const indicator = mockIndicators.find(item => item.id === id)

    if (!indicator) {
      return createMockError('NOT_FOUND', `指标 ${id} 不存在`)
    }

    return createMockResponse(indicator, '获取指标成功')
  }

  private static async handleCreateIndicator(data: any) {
    logger.info('🎭 [Mock API] 创建指标:', data)

    const newIndicator = {
      id: 'IND' + Date.now(),
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return createMockResponse(newIndicator, '创建指标成功')
  }

  private static async handleUpdateIndicator(id: string, data: any) {
    logger.info('🎭 [Mock API] 更新指标:', id, data)

    return createMockResponse({
      id,
      ...data,
      updatedAt: new Date().toISOString()
    }, '更新指标成功')
  }

  private static async handleDeleteIndicator(id: string) {
    logger.info('🎭 [Mock API] 删除指标:', id)

    return createMockResponse({ id }, '删除指标成功')
  }

  // ============================================
  // 任务处理器
  // ============================================

  private static async handleGetTasks(query: any) {
    const { indicatorId } = query

    let tasks = mockTasks
    if (indicatorId) {
      tasks = tasks.filter(t => t.indicatorId === indicatorId)
    }

    return createMockResponse({
      list: tasks,
      total: tasks.length
    }, '获取任务列表成功')
  }

  private static async handleGetTask(id: string) {
    const task = mockTasks.find(item => item.id === id)

    if (!task) {
      return createMockError('NOT_FOUND', `任务 ${id} 不存在`)
    }

    return createMockResponse(task, '获取任务成功')
  }

  private static async handleCreateTask(data: any) {
    logger.info('🎭 [Mock API] 创建任务:', data)

    const newTask = {
      id: 'TASK' + Date.now(),
      ...data,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return createMockResponse(newTask, '创建任务成功')
  }

  // ============================================
  // 里程碑处理器
  // ============================================

  private static async handleGetMilestones(query: any) {
    const { indicatorId } = query

    let milestones = mockMilestones
    if (indicatorId) {
      milestones = milestones.filter(m => m.indicatorId === indicatorId)
    }

    return createMockResponse({
      list: milestones,
      total: milestones.length
    }, '获取里程碑列表成功')
  }

  // ============================================
  // 仪表板处理器
  // ============================================

  /**
   * 处理获取仪表板数据
   */
  private async handleGetDashboard() {
    return createMockResponse(mockDashboardData, '获取仪表板数据成功')
  }

  /**
   * 处理获取部门进度数据
   */
  private async handleGetDepartmentProgress() {
    const departmentProgress = [
      { name: '战略发展部', progress: 85.2, indicators: 5 },
      { name: '科研处', progress: 78.6, indicators: 8 },
      { name: '教务处', progress: 92.3, indicators: 6 },
      { name: '人事处', progress: 67.8, indicators: 4 },
      { name: '财务处', progress: 88.9, indicators: 3 }
    ]
    return createMockResponse(departmentProgress, '获取部门进度成功')
  }

  /**
   * 处理获取最近活动数据
   */
  private async handleGetRecentActivities() {
    const recentActivities = [
      {
        id: 'ACT001',
        type: 'indicator_update',
        title: '更新了"年度科研项目立项数"指标',
        user: '张三',
        time: '2025-12-05 14:30:00',
        department: '战略发展部'
      },
      {
        id: 'ACT002',
        type: 'task_complete',
        title: '完成了"科研经费统计"任务',
        user: '赵六',
        time: '2025-12-04 16:00:00',
        department: '财务处'
      },
      {
        id: 'ACT003',
        type: 'milestone_reached',
        title: '达到了"第一季度项目申报"里程碑',
        user: '李四',
        time: '2025-12-03 10:00:00',
        department: '科研处'
      }
    ]
    return createMockResponse(recentActivities, '获取最近活动成功')
  }
}