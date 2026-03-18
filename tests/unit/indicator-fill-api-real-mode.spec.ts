import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  apiGet,
  apiPost,
  apiPut,
  getIndicatorById,
  loadDepartments
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  getIndicatorById: vi.fn(),
  loadDepartments: vi.fn()
}))

vi.mock('@/5-shared/config/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/5-shared/config/api')>()
  return {
    ...actual,
    USE_MOCK: false
  }
})

vi.mock('@/5-shared/lib/api', () => ({
  apiClient: {
    get: apiGet,
    post: apiPost,
    put: apiPut
  }
}))

vi.mock('@/3-features/indicator/api', () => ({
  indicatorApi: {
    getIndicatorById
  }
}))

vi.mock('@/3-features/auth/model/store', () => ({
  useAuthStore: () => ({
    user: { id: 124 },
    effectiveRole: 'strategic_dept',
    effectiveDepartment: '战略发展部',
    userDepartment: '战略发展部'
  })
}))

vi.mock('@/3-features/organization/model/store', () => ({
  useOrgStore: () => ({
    loaded: true,
    departments: [{ id: 39, name: '战略发展部', type: 'functional_dept' }],
    getDepartmentByName: (name: string) =>
      name === '战略发展部' ? { id: 39, name: '战略发展部', type: 'functional_dept' } : undefined,
    loadDepartments
  })
}))

vi.mock('@/3-features/approval/api/approval', () => ({
  approvalApi: {}
}))

import { indicatorFillApi } from '@/3-features/plan/api/planApi'

const currentReportMonth = new Date().toISOString().slice(0, 7).replace('-', '')

describe('indicatorFillApi real report flow', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiPut.mockReset()
    getIndicatorById.mockReset()
    loadDepartments.mockReset()

    getIndicatorById.mockResolvedValue({
      success: true,
      data: {
        id: 30022,
        taskId: 93011,
        indicatorName: '年度预算执行率',
        targetOrgId: 39,
        targetOrgName: '战略发展部'
      }
    })

    apiGet.mockImplementation((url: string) => {
      if (url === '/tasks/93011') {
        return Promise.resolve({
          success: true,
          data: {
            planId: 111
          }
        })
      }

      return Promise.resolve({
        success: true,
        data: []
      })
    })
  })

  it('blocks saving when the current month report is already in review', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/tasks/93011') {
        return Promise.resolve({
          success: true,
          data: {
            planId: 111
          }
        })
      }

      if (url === '/reports/plan/111') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 6,
              planId: 111,
              reportMonth: currentReportMonth,
              reportOrgId: 39,
              status: 'IN_REVIEW',
              updatedAt: '2026-03-18T10:00:00.000Z'
            }
          ]
        })
      }

      return Promise.resolve({
        success: true,
        data: []
      })
    })

    await expect(
      indicatorFillApi.saveFill({
        indicator_id: 30022,
        progress: 80,
        content: '本月已提交后的二次保存尝试'
      })
    ).rejects.toThrow('本月填报已提交审核')

    expect(apiPost).not.toHaveBeenCalled()
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('updates an editable existing current month report instead of creating a duplicate', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/tasks/93011') {
        return Promise.resolve({
          success: true,
          data: {
            planId: 111
          }
        })
      }

      if (url === '/reports/plan/111') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 9,
              planId: 111,
              reportMonth: currentReportMonth,
              reportOrgId: 39,
              status: 'REJECTED',
              updatedAt: '2026-03-18T10:00:00.000Z'
            }
          ]
        })
      }

      return Promise.resolve({
        success: true,
        data: []
      })
    })

    apiPut.mockResolvedValue({
      success: true,
      data: {
        id: 9,
        planId: 111,
        reportMonth: currentReportMonth,
        reportOrgId: 39,
        status: 'REJECTED',
        progress: 66,
        content: '驳回后修改并重新保存',
        updatedAt: '2026-03-18T11:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z'
      }
    })

    const response = await indicatorFillApi.saveFill({
      indicator_id: 30022,
      progress: 66,
      content: '驳回后修改并重新保存'
    })

    expect(apiPost).not.toHaveBeenCalled()
    expect(apiPut).toHaveBeenCalledWith('/reports/9', {
      title: '年度预算执行率',
      content: '驳回后修改并重新保存',
      summary: '驳回后修改并重新保存',
      progress: 66,
      issues: '驳回后修改并重新保存',
      nextPlan: '驳回后修改并重新保存'
    })
    expect(response.data.id).toBe(9)
    expect(response.data.content).toBe('驳回后修改并重新保存')
  })
})
