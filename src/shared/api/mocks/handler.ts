/**
 * Mock API 处理器 - 与后端完全对齐
 * 拦截 API 请求并返回模拟数据
 */

import type { InternalAxiosRequestConfig } from 'axios'
import { logger } from '@/utils/logger'
import {
  mockUsers,
  mockAnnouncements,
  mockIndicators,
  mockStrategicTasks,
  mockMilestones,
  mockAssessmentCycles,
  mockDashboardData,
  createMockResponse,
  createMockPageResponse,
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
  static async handleRequest(config: InternalAxiosRequestConfig): Promise<unknown> {
    const { method, url, data } = config
    const { path, query } = parsePath(url || '')

    logger.debug('🎭 [Mock API] 请求拦截:', {
      method: method?.toUpperCase(),
      path,
      query,
      hasData: !!data
    })

    // 模拟网络延迟
    await delay(MOCK_DELAY)

    try {
      let response: unknown

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
      // 评估周期 API
      // ============================================
      else if (path === '/api/assessment-cycles' && method === 'GET') {
        response = await this.handleGetAssessmentCycles(query)
      } else if (path.startsWith('/api/assessment-cycles/') && method === 'GET') {
        const id = path.split('/').pop()
        response = await this.handleGetAssessmentCycle(id!)
      }
      // ============================================
      // 战略任务 API
      // ============================================
      else if (path === '/api/strategic-tasks' && method === 'GET') {
        response = await this.handleGetStrategicTasks(query)
      } else if (path.startsWith('/api/strategic-tasks/') && method === 'GET') {
        const id = path.split('/').pop()
        response = await this.handleGetStrategicTask(id!)
      } else if (path === '/api/strategic-tasks' && method === 'POST') {
        response = await this.handleCreateStrategicTask(data)
      } else if (path.startsWith('/api/strategic-tasks/') && method === 'PUT') {
        const id = path.split('/').pop()
        response = await this.handleUpdateStrategicTask(id!, data)
      } else if (path.startsWith('/api/strategic-tasks/') && method === 'DELETE') {
        const id = path.split('/').pop()
        response = await this.handleDeleteStrategicTask(id!)
      }
      // ============================================
      // 指标 API（与后端对齐）
      // ============================================
      else if (path === '/api/indicators' && method === 'GET') {
        response = await this.handleGetIndicators(query)
      } else if (path.startsWith('/api/indicators/') && method === 'GET') {
        const id = path.split('/').pop()
        response = await this.handleGetIndicator(id!)
      } else if (path === '/api/indicators' && method === 'POST') {
        response = await this.handleCreateIndicator(data)
      } else if (path.startsWith('/api/indicators/') && method === 'PUT') {
        const id = path.split('/').pop()
        response = await this.handleUpdateIndicator(id!, data)
      } else if (path.startsWith('/api/indicators/') && method === 'DELETE') {
        const id = path.split('/').pop()
        response = await this.handleDeleteIndicator(id!)
      }
      // ============================================
      // 里程碑 API
      // ============================================
      else if (path === '/api/milestones' && method === 'GET') {
        response = await this.handleGetMilestones(query)
      } else if (path.startsWith('/api/milestones/') && method === 'GET') {
        const id = path.split('/').pop()
        response = await this.handleGetMilestone(id!)
      } else if (path === '/api/milestones' && method === 'POST') {
        response = await this.handleCreateMilestone(data)
      } else if (path.startsWith('/api/milestones/') && method === 'PUT') {
        const id = path.split('/').pop()
        response = await this.handleUpdateMilestone(id!, data)
      } else if (path.startsWith('/api/milestones/') && method === 'DELETE') {
        const id = path.split('/').pop()
        response = await this.handleDeleteMilestone(id!)
      }
      // ============================================
      // 组织架构 API
      // ============================================
      else if (path === '/api/orgs' && method === 'GET') {
        response = await this.handleGetOrgs()
      }
      // ============================================
      // 系统公告 API
      // ============================================
      else if (path === '/api/system/announcement' && method === 'GET') {
        response = await this.handleGetAnnouncements()
      }
      // ============================================
      // 仪表板 API
      // ============================================
      else if (path === '/api/dashboard' && method === 'GET') {
        response = await this.handleGetDashboard()
      } else if (path === '/api/dashboard/overview' && method === 'GET') {
        response = await this.handleGetDashboard()
      } else if (path === '/api/dashboard/department-progress' && method === 'GET') {
        response = await this.handleGetDepartmentProgress()
      } else if (path === '/api/dashboard/recent-activities' && method === 'GET') {
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

  private static async handleLogin(data: Record<string, unknown>) {
    const { username, password: _password } = data as { username: string; password: string }

    // Mock 登录：任意用户名密码都可以登录
    let user = mockUsers[0] // 默认返回第一个用户
    if (username === 'admin') {user = mockUsers[0]}
    else if (username === 'kychu') {user = mockUsers[1]}
    else if (username === 'jsxy') {user = mockUsers[2]}
    else if (username === 'jiaowuchu') {user = mockUsers[3]}
    else if (username === 'xueshengchu') {user = mockUsers[4]}

    logger.info('🎭 [Mock Login] 用户登录:', user.name)

    return createMockResponse({
      token: 'mock_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      user,
      expiresIn: 7200
    }, '登录成功')
  }

  private static async handleAuthInfo() {
    return createMockResponse(mockUsers[0], '获取用户信息成功')
  }

  private static async handleLogout() {
    return createMockResponse(null, '退出登录成功')
  }

  // ============================================
  // 评估周期处理器
  // ============================================

  private static async handleGetAssessmentCycles(query: Record<string, string>) {
    let cycles = [...mockAssessmentCycles]

    // 支持按状态过滤
    if (query.status) {
      cycles = cycles.filter(cycle => cycle.status === query.status)
    }

    logger.debug('🎭 [Mock API] 获取评估周期列表:', {
      query,
      count: cycles.length
    })

    return createMockPageResponse(cycles, Number(query.page) || 1, Number(query.pageSize) || 10)
  }

  private static async handleGetAssessmentCycle(id: string) {
    const cycleId = Number(id)
    const cycle = mockAssessmentCycles.find(item => item.cycleId === cycleId)

    if (!cycle) {
      return createMockError('NOT_FOUND', `评估周期 ${id} 不存在`)
    }

    return createMockResponse(cycle, '获取评估周期成功')
  }

  // ============================================
  // 战略任务处理器
  // ============================================

  private static async handleGetStrategicTasks(query: Record<string, string>) {
    let tasks = [...mockStrategicTasks]

    // 支持按评估周期过滤
    if (query.cycleId) {
      const taskId = Number(query.cycleId)
      tasks = tasks.filter(task => task.cycleId === taskId)
    }

    // 支持按部门过滤
    if (query.responsibleDept) {
      tasks = tasks.filter(task =>
        task.responsibleDept.includes(query.responsibleDept)
      )
    }

    logger.debug('🎭 [Mock API] 获取战略任务列表:', {
      query,
      count: tasks.length
    })

    return createMockPageResponse(tasks, Number(query.page) || 1, Number(query.pageSize) || 10)
  }

  private static async handleGetStrategicTask(id: string) {
    const taskId = Number(id)
    const task = mockStrategicTasks.find(item => item.taskId === taskId)

    if (!task) {
      return createMockError('NOT_FOUND', `战略任务 ${id} 不存在`)
    }

    return createMockResponse(task, '获取战略任务成功')
  }

  private static async handleCreateStrategicTask(data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 创建战略任务:', data)

    const newTask = {
      taskId: Date.now(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return createMockResponse(newTask, '创建战略任务成功')
  }

  private static async handleUpdateStrategicTask(id: string, data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 更新战略任务:', id, data)

    return createMockResponse({
      taskId: Number(id),
      ...data,
      updatedAt: new Date().toISOString()
    }, '更新战略任务成功')
  }

  private static async handleDeleteStrategicTask(id: string) {
    logger.info('🎭 [Mock API] 删除战略任务:', id)

    return createMockResponse({ taskId: Number(id) }, '删除战略任务成功')
  }

  // ============================================
  // 指标处理器
  // ============================================

  private static async handleGetIndicators(query: Record<string, string>) {
    let indicators = [...mockIndicators]

    // 支持按任务过滤
    if (query.taskId) {
      const taskId = Number(query.taskId)
      indicators = indicators.filter(indicator => indicator.taskId === taskId)
    }

    // 支持按状态过滤
    if (query.status) {
      indicators = indicators.filter(indicator => indicator.status === query.status)
    }

    // 支持按部门过滤
    if (query.responsibleDept) {
      indicators = indicators.filter(indicator =>
        indicator.responsibleDept.includes(query.responsibleDept)
      )
    }

    logger.debug('🎭 [Mock API] 获取指标列表:', {
      query,
      count: indicators.length
    })

    return createMockPageResponse(indicators, Number(query.page) || 1, Number(query.pageSize) || 10)
  }

  private static async handleGetIndicator(id: string) {
    const indicatorId = Number(id)
    const indicator = mockIndicators.find(item => item.indicatorId === indicatorId)

    if (!indicator) {
      return createMockError('NOT_FOUND', `指标 ${id} 不存在`)
    }

    // 关联里程碑数据
    const associatedMilestones = mockMilestones.filter(m => m.indicatorId === indicatorId)

    return createMockResponse({
      ...indicator,
      milestones: associatedMilestones
    }, '获取指标成功')
  }

  private static async handleCreateIndicator(data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 创建指标:', data)

    const newIndicator = {
      indicatorId: Date.now(),
      ...data,
      status: 'DRAFT',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusAudit: [],
      milestones: []
    }

    return createMockResponse(newIndicator, '创建指标成功')
  }

  private static async handleUpdateIndicator(id: string, data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 更新指标:', id, data)

    return createMockResponse({
      indicatorId: Number(id),
      ...data,
      updatedAt: new Date().toISOString()
    }, '更新指标成功')
  }

  private static async handleDeleteIndicator(id: string) {
    logger.info('🎭 [Mock API] 删除指标:', id)

    return createMockResponse({ indicatorId: Number(id) }, '删除指标成功')
  }

  // ============================================
  // 里程碑处理器
  // ============================================

  private static async handleGetMilestones(query: Record<string, string>) {
    let milestones = [...mockMilestones]

    // 支持按指标过滤
    if (query.indicatorId) {
      const indicatorId = Number(query.indicatorId)
      milestones = milestones.filter(milestone => milestone.indicatorId === indicatorId)
    }

    // 支持按状态过滤
    if (query.status) {
      milestones = milestones.filter(milestone => milestone.status === query.status)
    }

    logger.debug('🎭 [Mock API] 获取里程碑列表:', {
      query,
      count: milestones.length
    })

    return createMockPageResponse(milestones, Number(query.page) || 1, Number(query.pageSize) || 10)
  }

  private static async handleGetMilestone(id: string) {
    const milestoneId = Number(id)
    const milestone = mockMilestones.find(item => item.milestoneId === milestoneId)

    if (!milestone) {
      return createMockError('NOT_FOUND', `里程碑 ${id} 不存在`)
    }

    return createMockResponse(milestone, '获取里程碑成功')
  }

  private static async handleCreateMilestone(data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 创建里程碑:', data)

    const newMilestone = {
      milestoneId: Date.now(),
      ...data,
      status: 'PENDING',
      isPaired: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return createMockResponse(newMilestone, '创建里程碑成功')
  }

  private static async handleUpdateMilestone(id: string, data: Record<string, unknown>) {
    logger.info('🎭 [Mock API] 更新里程碑:', id, data)

    return createMockResponse({
      milestoneId: Number(id),
      ...data,
      updatedAt: new Date().toISOString()
    }, '更新里程碑成功')
  }

  private static async handleDeleteMilestone(id: string) {
    logger.info('🎭 [Mock API] 删除里程碑:', id)

    return createMockResponse({ milestoneId: Number(id) }, '删除里程碑成功')
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
      { id: 5, name: '财务处', code: 'FINANCE', parentId: null },
      { id: 6, name: '学生处', code: 'STUDENT', parentId: null },
      { id: 7, name: '计算机学院', code: 'COMPUTER', parentId: null },
      { id: 8, name: '电子工程学院', code: 'ELECTRONIC', parentId: null }
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
  // 仪表板处理器
  // ============================================

  /**
   * 处理获取仪表板数据
   */
  private static async handleGetDashboard() {
    return createMockResponse(mockDashboardData.overview, '获取仪表板数据成功')
  }

  /**
   * 处理获取部门进度数据
   */
  private static async handleGetDepartmentProgress() {
    return createMockResponse(mockDashboardData.departmentProgress, '获取部门进度成功')
  }

  /**
   * 处理获取最近活动数据
   */
  private static async handleGetRecentActivities() {
    return createMockResponse(mockDashboardData.recentActivities, '获取最近活动成功')
  }
}
