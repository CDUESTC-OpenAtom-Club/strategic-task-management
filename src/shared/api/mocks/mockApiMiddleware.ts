import { IncomingMessage, ServerResponse } from 'http'

// Mock数据
const mockOrgs = [
  {
    id: 1,
    name: '总部',
    code: 'HQ',
    description: '公司总部',
    parentId: null,
    level: 1,
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: '技术部',
    code: 'TECH',
    description: '技术开发部门',
    parentId: 1,
    level: 2,
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }
]

const mockIndicators = [
  {
    id: 1,
    name: '收入增长率',
    code: 'REVENUE_GROWTH',
    description: '月度收入同比增长率',
    unit: '%',
    target: 15,
    current: 12.5,
    status: 'warning',
    orgId: 1,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: '客户满意度',
    code: 'CUSTOMER_SATISFACTION',
    description: '客户满意度评分',
    unit: '分',
    target: 90,
    current: 92,
    status: 'success',
    orgId: 1,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }
]

const mockTasks = [
  {
    id: 1,
    title: '完成Q3战略规划',
    description: '制定并完成第三季度的战略规划',
    status: 'in_progress',
    priority: 'high',
    assignee: '张三',
    dueDate: '2023-09-30T00:00:00Z',
    createdAt: '2023-07-01T00:00:00Z',
    updatedAt: '2023-07-15T00:00:00Z'
  },
  {
    id: 2,
    title: '市场调研报告',
    description: '完成竞争对手分析和市场调研',
    status: 'completed',
    priority: 'medium',
    assignee: '李四',
    dueDate: '2023-08-15T00:00:00Z',
    createdAt: '2023-07-01T00:00:00Z',
    updatedAt: '2023-08-10T00:00:00Z'
  }
]

// 辅助函数：发送 JSON 响应
function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = statusCode
  res.end(JSON.stringify(data))
}

// Mock API处理器
export function mockApiMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) {
  const { method, url } = req

  // 只处理API请求
  if (!url || !url.startsWith('/api/')) {
    return next()
  }

  // 支持 /api/ 和 /api/v1/ 前缀
  const normalizedUrl = url.replace('/api/v1', '/api')

  // eslint-disable-next-line no-console
  console.log('[Mock API]', method, url, '→', normalizedUrl)

  // 模拟网络延迟
  setTimeout(() => {
    try {
      // 组织API
      if (normalizedUrl === '/api/orgs' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockOrgs,
          message: '获取组织列表成功'
        })
        return
      }

      // 指标API
      if (normalizedUrl === '/api/indicators' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockIndicators,
          message: '获取指标列表成功'
        })
        return
      }

      // 任务API
      if (normalizedUrl === '/api/tasks' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockTasks,
          message: '获取任务列表成功'
        })
        return
      }

      // 如果没有匹配的API，返回404
      sendJson(res, 404, {
        success: false,
        message: `API endpoint not found: ${method} ${url}`
      })
    } catch (error) {
      console.error('[Mock API] Error:', error)
      sendJson(res, 500, {
        success: false,
        message: 'Internal server error'
      })
    }
  }, Math.random() * 500 + 200) // 模拟200-700ms的延迟
}
