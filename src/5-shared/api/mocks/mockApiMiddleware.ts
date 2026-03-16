import { IncomingMessage, ServerResponse } from 'http'

// 简单的模拟数据
const mockAssessmentCycles = [
  { cycleId: 1, name: '2024-2025 学年评估周期', year: 2024, status: 'IN_PROGRESS', description: '2024-2025学年的战略评估周期' },
  { cycleId: 2, name: '2023-2024 学年评估周期', year: 2023, status: 'COMPLETED', description: '2023-2024学年的战略评估周期' },
]

const mockStrategicTasks = [
  { taskId: 1, name: '战略规划制定', description: '制定2024-2025学年的战略规划', status: 'IN_PROGRESS', responsibleDept: '战略发展部' },
  { taskId: 2, name: '指标体系优化', description: '优化2024-2025学年的指标体系', status: 'PENDING', responsibleDept: '教务处' },
]

const mockIndicators = [
  { indicatorId: 1, indicatorName: '教学质量指标', indicatorType1: '定性', status: 'IN_PROGRESS', progress: 75, responsibleDept: '教务处' },
  { indicatorId: 2, indicatorName: '科研成果指标', indicatorType1: '定量', status: 'COMPLETED', progress: 100, responsibleDept: '科研处' },
]

const mockAnnouncements = [
  { id: '1', title: '2024-2025 年度战略指标填报工作已启动', content: '请各部门于12月15日前完成数据提交', type: 'info', publishTime: '2025-12-01 10:00:00', publisher: '战略发展部' },
  { id: '2', title: '系统维护通知', content: '系统维护时间：每周日 02:00-06:00', type: 'warning', publishTime: '2025-12-01 09:00:00', publisher: '信息化建设办公室' },
]

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
      // 解析查询参数
      const query = new URLSearchParams(normalizedUrl.split('?')[1])
      
      // 简单的路由处理
      if (normalizedUrl === '/api/assessment-cycles' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockAssessmentCycles,
          message: '获取评估周期成功'
        })
      } else if (normalizedUrl === '/api/strategic-tasks' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockStrategicTasks,
          message: '获取战略任务成功'
        })
      } else if (normalizedUrl === '/api/indicators' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockIndicators,
          message: '获取指标成功'
        })
      } else if (normalizedUrl === '/api/system/announcement' && method === 'GET') {
        sendJson(res, 200, {
          success: true,
          data: mockAnnouncements,
          message: '获取公告成功'
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
