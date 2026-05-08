import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'

const route = reactive<{ query: Record<string, unknown> }>({
  query: {}
})

const router = {
  replace: vi.fn(async ({ query }: { query: Record<string, unknown> }) => {
    route.query = { ...query }
  })
}

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => router
}))

import { useApprovalRouteAutopen } from '@/features/approval/lib'

const openApproval = vi.fn(async () => {})
const clearFailure = vi.fn()

const state: {
  routeApprovalEntityType?: { value: 'PLAN' | 'PLAN_REPORT' | undefined }
  routeApprovalEntityId?: { value: string | undefined }
  shouldAutoOpenApprovalFromRoute?: { value: boolean }
} = {}

const Harness = defineComponent({
  setup() {
    const autopen = useApprovalRouteAutopen({
      supportedEntityTypes: ['PLAN', 'PLAN_REPORT'] as const,
      onAutoOpen: () => openApproval(),
      onClearFailure: error => clearFailure(error)
    })

    state.routeApprovalEntityType = autopen.routeApprovalEntityType
    state.routeApprovalEntityId = autopen.routeApprovalEntityId
    state.shouldAutoOpenApprovalFromRoute = autopen.shouldAutoOpenApprovalFromRoute

    return () => h('div')
  }
})

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function resetHarnessState() {
  route.query = {}
  router.replace.mockReset()
  router.replace.mockImplementation(async ({ query }: { query: Record<string, unknown> }) => {
    route.query = { ...query }
  })
  openApproval.mockReset()
  openApproval.mockImplementation(async () => {})
  clearFailure.mockReset()
  state.routeApprovalEntityType = undefined
  state.routeApprovalEntityId = undefined
  state.shouldAutoOpenApprovalFromRoute = undefined
}

describe('approval query consumer parity helper', () => {
  beforeEach(() => {
    resetHarnessState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('parses supported approval query payload without auto-opening by default', async () => {
    route.query = {
      approvalEntityType: 'PLAN_REPORT',
      approvalEntityId: '42'
    }

    const wrapper = mount(Harness)
    await flushUi()

    expect(state.routeApprovalEntityType?.value).toBe('PLAN_REPORT')
    expect(state.routeApprovalEntityId?.value).toBe('42')
    expect(state.shouldAutoOpenApprovalFromRoute?.value).toBe(false)
    expect(openApproval).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('auto-opens once and clears the approval query payload after consumption', async () => {
    route.query = {
      keep: '1',
      openApproval: 'true',
      approvalEntityType: 'PLAN',
      approvalEntityId: '18',
      approvalInstanceId: '301'
    }

    const wrapper = mount(Harness)
    await flushUi()

    expect(openApproval).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith({
      query: {
        keep: '1'
      }
    })
    expect(route.query).toEqual({
      keep: '1'
    })

    await flushUi()
    expect(openApproval).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('ignores unsupported approval entity payloads instead of auto-opening the wrong page state', async () => {
    route.query = {
      openApproval: '1',
      approvalEntityType: 'TASK',
      approvalEntityId: '99',
      approvalInstanceId: '88'
    }

    const wrapper = mount(Harness)
    await flushUi()

    expect(state.routeApprovalEntityType?.value).toBeUndefined()
    expect(state.shouldAutoOpenApprovalFromRoute?.value).toBe(false)
    expect(openApproval).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
