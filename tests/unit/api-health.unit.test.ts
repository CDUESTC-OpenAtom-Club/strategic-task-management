import { beforeEach, describe, expect, it, vi } from 'vitest'

const healthApiGetMock = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: healthApiGetMock
    })),
    isAxiosError: vi.fn((error: unknown) => {
      return Boolean(error && typeof error === 'object' && 'isAxiosError' in error)
    })
  }
}))

vi.mock('element-plus', () => ({
  ElNotification: vi.fn()
}))

vi.mock('@/shared/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/config/api', () => ({
  API_BASE_URL: 'http://localhost:3500/api/v1',
  API_TARGET: 'http://localhost:3500/api/v1',
  USE_MOCK: false
}))

describe('apiHealth', () => {
  beforeEach(() => {
    healthApiGetMock.mockReset()
  })

  it('treats 403 from public health endpoint as backend reachable', async () => {
    healthApiGetMock
      .mockResolvedValueOnce({
        status: 403,
        data: { message: 'Forbidden' }
      })
      .mockResolvedValueOnce({
        status: 403,
        data: { message: 'Forbidden' }
      })

    const { checkBackendHealth, quickBackendCheck } = await import('@/shared/lib/utils/apiHealth')

    await expect(checkBackendHealth()).resolves.toMatchObject({
      service: 'Backend API',
      status: 'success',
      message: '后端服务运行正常',
      details: { message: 'Forbidden' }
    })

    await expect(quickBackendCheck()).resolves.toBe(true)
    expect(healthApiGetMock).toHaveBeenNthCalledWith(
      1,
      '/auth/health',
      expect.objectContaining({
        timeout: 5000,
        validateStatus: expect.any(Function)
      })
    )
    expect(healthApiGetMock).toHaveBeenNthCalledWith(
      2,
      '/auth/health',
      expect.objectContaining({
        timeout: 3000,
        validateStatus: expect.any(Function)
      })
    )
  })
})
