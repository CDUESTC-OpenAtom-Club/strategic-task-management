import { IncomingMessage, ServerResponse } from 'http'
import {
  mockUsers,
  mockAssessmentCycles,
  mockStrategicTasks,
  mockIndicators,
  mockMilestones
} from './fixtures'
import { mockDashboardData } from './fixtures/mockDashboardData'

const mockAnnouncements = [
  {
    id: '1',
    title: '2024-2025 年度战略指标填报工作已启动',
    content: '请各部门于12月15日前完成数据提交',
    type: 'info',
    publishTime: '2025-12-01 10:00:00',
    publisher: '战略发展部'
  },
  {
    id: '2',
    title: '系统维护通知',
    content: '系统维护时间：每周日 02:00-06:00',
    type: 'warning',
    publishTime: '2025-12-01 09:00:00',
    publisher: '信息化建设办公室'
  }
]

const mockOrgs = [
  {
    orgId: 1,
    orgName: '战略发展部',
    orgType: 'STRATEGY_DEPT',
    parentOrgId: null,
    isActive: true,
    sortOrder: 1
  },
  {
    orgId: 2,
    orgName: '科研处',
    orgType: 'FUNCTIONAL_DEPT',
    parentOrgId: null,
    isActive: true,
    sortOrder: 2
  },
  {
    orgId: 3,
    orgName: '教务处',
    orgType: 'FUNCTIONAL_DEPT',
    parentOrgId: null,
    isActive: true,
    sortOrder: 3
  },
  {
    orgId: 4,
    orgName: '学生处',
    orgType: 'FUNCTIONAL_DEPT',
    parentOrgId: null,
    isActive: true,
    sortOrder: 4
  },
  {
    orgId: 5,
    orgName: '计算机学院',
    orgType: 'SECONDARY_COLLEGE',
    parentOrgId: null,
    isActive: true,
    sortOrder: 5
  },
  {
    orgId: 6,
    orgName: '电子工程学院',
    orgType: 'SECONDARY_COLLEGE',
    parentOrgId: null,
    isActive: true,
    sortOrder: 6
  }
]

const mockAlertStats = {
  totalOpen: 3,
  countBySeverity: {
    CRITICAL: 1,
    MAJOR: 1,
    MINOR: 1
  }
}

const mockUnclosedAlerts = [
  {
    id: 1,
    ruleId: 101,
    ruleName: '进度严重滞后',
    entityType: 'indicator',
    entityId: 1001,
    entityName: '教学质量指标',
    severity: 'CRITICAL',
    message: '指标进度低于预期，需立即处理',
    status: 'OPEN',
    triggeredAt: '2026-03-10T09:00:00Z'
  },
  {
    id: 2,
    ruleId: 102,
    ruleName: '填报超期',
    entityType: 'indicator',
    entityId: 1002,
    entityName: '科研成果指标',
    severity: 'MAJOR',
    message: '填报已超过截止日期',
    status: 'IN_PROGRESS',
    triggeredAt: '2026-03-11T10:30:00Z'
  }
]

const mockPendingApprovals = [
  {
    instanceId: 9001,
    planName: '2026 年重点任务计划',
    year: 2026,
    submitterName: '张三',
    createdAt: '2026-03-15T10:00:00Z',
    currentStepName: '战略发展部审批'
  },
  {
    instanceId: 9002,
    planName: '2026 年学院发展计划',
    year: 2026,
    submitterName: '李四',
    createdAt: '2026-03-14T15:30:00Z',
    currentStepName: '战略发展部审批'
  }
]

const mockAdminUsers = mockUsers.map((user, index) => ({
  id: user.userId,
  username: user.username,
  realName: user.name,
  email: user.email || '',
  phone: user.phone || '',
  orgId: index + 1,
  orgName: user.department || '',
  roles: [{ roleCode: user.role }],
  status: user.isActive ? 'active' : 'disabled',
  lastLoginAt: '2026-03-15T10:00:00Z',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
}))

// 发送响应的辅助函数
function sendJson(res: ServerResponse, status: number, data: any) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = status
  res.end(JSON.stringify(data))
}

// 解析请求体
function parseBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => {
      resolve(body ? JSON.parse(body) : {})
    })
  })
}

function extractNumericId(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const digits = value.replace(/\D/g, '')
    if (digits) {
      const parsed = Number(digits)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return fallback
}

function toBackendIndicatorShape(raw: Record<string, any> | undefined, requestedId: number) {
  const now = new Date().toISOString()

  if (!raw) {
    return {
      indicatorId: requestedId,
      taskId: 1,
      indicatorName: `模拟指标-${requestedId}`,
      indicatorDesc: `模拟指标 ${requestedId}`,
      indicatorType1: '定量',
      indicatorType2: '发展性',
      isStrategic: false,
      responsibleDept: '计算机学院',
      responsiblePerson: '系统',
      weight: 10,
      progress: 0,
      targetValue: 100,
      actualValue: null,
      unit: '%',
      year: 2026,
      ownerDept: '战略发展部',
      parentIndicatorId: null,
      progressApprovalStatus: 'DRAFT',
      pendingProgress: null,
      pendingRemark: null,
      statusAudit: [],
      status: 'DRAFT',
      remark: '自动补齐的 Mock 指标',
      createdAt: now,
      updatedAt: now
    }
  }

  const derivedId = extractNumericId(raw.indicatorId ?? raw.id, requestedId)

  return {
    indicatorId: derivedId,
    taskId: Number(raw.taskId ?? 1),
    indicatorName: String(raw.indicatorName ?? raw.name ?? `模拟指标-${derivedId}`),
    indicatorDesc: String(raw.indicatorDesc ?? raw.name ?? `模拟指标 ${derivedId}`),
    indicatorType1: raw.indicatorType1 ?? raw.type1 ?? '定量',
    indicatorType2: raw.indicatorType2 ?? raw.type2 ?? '发展性',
    isStrategic: Boolean(raw.isStrategic ?? false),
    responsibleDept: String(raw.responsibleDept ?? '计算机学院'),
    responsiblePerson: raw.responsiblePerson ?? null,
    weight: Number(raw.weight ?? 10),
    progress: Number(raw.progress ?? 0),
    targetValue: raw.targetValue ?? 100,
    actualValue: raw.actualValue ?? null,
    unit: raw.unit ?? '%',
    year: Number(raw.year ?? 2026),
    ownerDept: raw.ownerDept ?? null,
    parentIndicatorId:
      raw.parentIndicatorId != null
        ? extractNumericId(raw.parentIndicatorId, 0)
        : null,
    progressApprovalStatus: raw.progressApprovalStatus ?? 'DRAFT',
    pendingProgress: raw.pendingProgress ?? null,
    pendingRemark: raw.pendingRemark ?? null,
    statusAudit: Array.isArray(raw.statusAudit) ? raw.statusAudit : [],
    status: raw.status ?? 'DRAFT',
    remark: raw.remark ?? null,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now
  }
}

// 简单的 Mock API 中间件
export function mockApiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const { method, url } = req
  
  // 只处理 API 请求
  if (!url || !url.startsWith('/api/')) {
    return next()
  }

  // 标准化路径
  const normalizedUrl = url.replace('/api/v1', '/api')

  console.log('[Mock API]', method, url, '→', normalizedUrl)

  // 模拟网络延迟
  setTimeout(async () => {
    try {
      const [normalizedPath, queryString = ''] = normalizedUrl.split('?')
      const query = new URLSearchParams(queryString)
      
      if (normalizedPath === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req)
        const username = String(body.username || 'admin')
        const user = mockUsers.find(item => item.username === username) || mockUsers[0]

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: {
            token: `mock_token_${Date.now()}`,
            refreshToken: `mock_refresh_token_${Date.now()}`,
            user,
            expiresIn: 7200
          },
          message: '登录成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/auth/info' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockUsers[0],
          message: '获取用户信息成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/auth/logout' && method === 'POST') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: null,
          message: '退出登录成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/orgs' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockOrgs,
          message: '获取组织架构成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/assessment-cycles' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockAssessmentCycles,
          message: '获取评估周期成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/strategic-tasks' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockStrategicTasks,
          message: '获取战略任务成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/indicators' && method === 'GET') {
        const year = query.get('year') || query.get('params[year]')
        const filteredIndicators =
          year && mockIndicators.some(indicator => 'year' in indicator)
            ? mockIndicators.filter(
                indicator => String((indicator as { year?: number }).year || '') === year
              )
            : mockIndicators

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: filteredIndicators,
          message: '获取指标成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/indicators\/[^/]+$/.test(normalizedPath) && method === 'GET') {
        const rawId = normalizedPath.split('/').pop() || ''
        const requestedId = extractNumericId(rawId, 1001)
        const matched = mockIndicators.find((indicator: any) => {
          const indicatorId = indicator.indicatorId
          const id = indicator.id
          return String(indicatorId ?? '') === rawId || String(id ?? '') === rawId
        }) as Record<string, any> | undefined

        const normalizedIndicator = toBackendIndicatorShape(matched, requestedId)
        const milestones = mockMilestones.filter(
          milestone => milestone.indicatorId === normalizedIndicator.indicatorId
        )

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: {
            ...normalizedIndicator,
            milestones
          },
          message: '获取指标详情成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/system/announcement' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockAnnouncements,
          message: '获取公告成功',
          timestamp: Date.now()
        })
      } else if (
        (normalizedPath === '/api/dashboard' || normalizedPath === '/api/dashboard/overview') &&
        method === 'GET'
      ) {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockDashboardData,
          message: '获取仪表盘数据成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/dashboard/department-progress' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockDashboardData.departmentProgress,
          message: '获取部门进度成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/dashboard/recent-activities' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockDashboardData.recentActivities,
          message: '获取最近活动成功',
          timestamp: Date.now()
        })
      } else if (
        normalizedPath === '/api/analytics/dashboard/overview' &&
        method === 'GET'
      ) {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockDashboardData,
          message: '获取分析看板成功',
          timestamp: Date.now()
        })
      } else if (
        normalizedPath === '/api/analytics/dashboard/charts' &&
        method === 'GET'
      ) {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockDashboardData.departmentProgress,
          message: '获取分析图表成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/alerts/stats' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockAlertStats,
          message: '获取告警统计成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/alerts/events/unclosed' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockUnclosedAlerts,
          message: '获取未关闭告警成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/plans/approval/pending' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockPendingApprovals,
          message: '获取待审批计划成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/plans/approval/pending/count' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: mockPendingApprovals.length,
          message: '获取待审批数量成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/plans\/approval\/instances\/\d+\/approve$/.test(normalizedPath) && method === 'POST') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: '审批通过',
          message: '审批通过成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/plans\/approval\/instances\/\d+\/reject$/.test(normalizedPath) && method === 'POST') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: '审批驳回',
          message: '审批驳回成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/admin/users' && method === 'GET') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: {
            content: mockAdminUsers,
            pageNumber: 0,
            pageSize: mockAdminUsers.length,
            totalElements: mockAdminUsers.length,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false
          },
          message: '获取用户列表成功',
          timestamp: Date.now()
        })
      } else if (normalizedPath === '/api/admin/users' && method === 'POST') {
        const body = await parseBody(req)
        const orgId = Number(body.orgId || 1)
        const newUser = {
          id: Date.now(),
          username: String(body.username || `user_${Date.now()}`),
          realName: String(body.realName || '新用户'),
          email: String(body.email || ''),
          phone: String(body.phone || ''),
          orgId,
          orgName: mockOrgs.find(org => org.orgId === orgId)?.orgName || '战略发展部',
          roles: Array.isArray(body.roleIds)
            ? body.roleIds.map((roleCode: string) => ({ roleCode }))
            : [{ roleCode: 'secondary_college' }],
          status: body.status === 'disabled' ? 'disabled' : 'active',
          lastLoginAt: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        mockAdminUsers.unshift(newUser)

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: newUser,
          message: '创建用户成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/admin\/users\/\d+$/.test(normalizedPath) && method === 'PUT') {
        const body = await parseBody(req)
        const userId = Number(normalizedPath.split('/').pop())
        const userIndex = mockAdminUsers.findIndex(user => user.id === userId)

        if (userIndex === -1) {
          sendJson(res, 404, {
            code: 404,
            success: false,
            data: null,
            message: '用户不存在',
            timestamp: Date.now()
          })
          return
        }

        const existingUser = mockAdminUsers[userIndex]
        const orgId = Number(body.orgId || existingUser.orgId)
        const updatedUser = {
          ...existingUser,
          username: String(body.username || existingUser.username),
          realName: String(body.realName || existingUser.realName),
          email: String(body.email || existingUser.email),
          phone: String(body.phone || existingUser.phone),
          orgId,
          orgName: mockOrgs.find(org => org.orgId === orgId)?.orgName || existingUser.orgName,
          roles: Array.isArray(body.roleIds)
            ? body.roleIds.map((roleCode: string) => ({ roleCode }))
            : existingUser.roles,
          status: body.status === 'disabled' ? 'disabled' : existingUser.status,
          updatedAt: new Date().toISOString()
        }

        mockAdminUsers[userIndex] = updatedUser

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: updatedUser,
          message: '更新用户成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/admin\/users\/\d+\/status$/.test(normalizedPath) && method === 'PATCH') {
        const userId = Number(normalizedPath.split('/')[4])
        const user = mockAdminUsers.find(item => item.id === userId)

        if (!user) {
          sendJson(res, 404, {
            code: 404,
            success: false,
            data: null,
            message: '用户不存在',
            timestamp: Date.now()
          })
          return
        }

        user.status = query.get('isActive') === 'true' ? 'active' : 'disabled'
        user.updatedAt = new Date().toISOString()

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: user,
          message: '更新用户状态成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/admin\/users\/\d+\/password$/.test(normalizedPath) && method === 'PUT') {
        sendJson(res, 200, {
          code: 200,
          success: true,
          data: { updated: true },
          message: '重置密码成功',
          timestamp: Date.now()
        })
      } else if (/^\/api\/admin\/users\/\d+$/.test(normalizedPath) && method === 'DELETE') {
        const userId = Number(normalizedPath.split('/').pop())
        const userIndex = mockAdminUsers.findIndex(user => user.id === userId)

        if (userIndex !== -1) {
          mockAdminUsers.splice(userIndex, 1)
        }

        sendJson(res, 200, {
          code: 200,
          success: true,
          data: { deleted: true },
          message: '删除用户成功',
          timestamp: Date.now()
        })
      } else {
        // 未匹配的路由
        sendJson(res, 404, {
          success: false,
          data: null,
          message: `API endpoint not found: ${method} ${normalizedUrl}`
        })
      }
    } catch (error) {
      console.error('[Mock API] Error:', error)
      sendJson(res, 500, {
        success: false,
        data: null,
        message: 'Internal server error'
      })
    }
  }, 300) // 300ms 延迟
}
