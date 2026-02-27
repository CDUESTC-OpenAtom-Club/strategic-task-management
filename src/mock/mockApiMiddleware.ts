import { Request, Response } from 'express'

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

// Mock API处理器
export function mockApiMiddleware(req: Request, res: Response, next: Function) {
  const { method, url } = req
  
  // 只处理API请求
  if (!url.startsWith('/api/')) {
    return next()
  }
  
  console.log('[Mock API]', method, url)
  
  // 模拟网络延迟
  setTimeout(() => {
    try {
      // 组织API
      if (url === '/api/orgs' && method === 'GET') {
        res.json({
          success: true,
          data: mockOrgs,
          message: '获取组织列表成功'
        })
        return
      }
      
      // 指标API
      if (url === '/api/indicators' && method === 'GET') {
        res.json({
          success: true,
          data: mockIndicators,
          message: '获取指标列表成功'
        })
        return
      }
      
      // 任务API
      if (url === '/api/tasks' && method === 'GET') {
        res.json({
          success: true,
          data: mockTasks,
          message: '获取任务列表成功'
        })
        return
      }
      
      // 如果没有匹配的API，返回404
      res.status(404).json({
        success: false,
        message: `API endpoint not found: ${method} ${url}`
      })
    } catch (error) {
      console.error('[Mock API] Error:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }, Math.random() * 500 + 200) // 模拟200-700ms的延迟
}