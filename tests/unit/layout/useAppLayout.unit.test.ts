import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { APPROVAL_STATE_REFRESH_EVENT } from '../../../src/3-features/approval/lib/approvalNotifications'

const authStore = reactive({
  isAuthenticated: true,
  user: { userId: 1001, name: '审批人' },
  userRole: 'strategic_dept',
  logout: vi.fn()
})

const orgStore = reactive({
  loaded: true,
  loadDepartments: vi.fn(async () => {
    orgStore.loaded = true
  }),
  getStrategicDeptName: vi.fn(() => '战略发展部')
})

const messageStore = reactive({
  messages: [] as Array<{ id: string }>,
  refreshMessageCenter: vi.fn(async () => {
    messageStore.messages = [{ id: 'remote-1' }]
  })
})

const approvalStore = reactive({
  pendingApprovals: [] as Array<Record<string, unknown>>,
  loadPendingApprovals: vi.fn(async () => {
    approvalStore.pendingApprovals = [
      {
        instanceId: 1,
        entityType: 'PLAN',
        entityId: 10,
        status: 'PENDING'
      }
    ]
  })
})

vi.mock('@/features/auth/model/store', () => ({
  useAuthStore: () => authStore
}))

vi.mock('@/features/organization/model/store', () => ({
  useOrgStore: () => orgStore
}))

vi.mock('@/features/messages/model/message', () => ({
  useMessageStore: () => messageStore
}))

vi.mock('@/features/approval/model/store', () => ({
  useApprovalStore: () => approvalStore
}))

import { useAppLayout } from '../../../src/1-app/layouts/lib/useAppLayout'

const Harness = defineComponent({
  setup() {
    useAppLayout()
    return () => h('div')
  }
})

async function flushUi() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function resetStoreState() {
  authStore.isAuthenticated = true
  authStore.user = { userId: 1001, name: '审批人' }
  authStore.userRole = 'strategic_dept'
  authStore.logout = vi.fn()

  orgStore.loaded = true
  orgStore.loadDepartments = vi.fn(async () => {
    orgStore.loaded = true
  })
  orgStore.getStrategicDeptName = vi.fn(() => '战略发展部')

  messageStore.messages = []
  messageStore.refreshMessageCenter = vi.fn(async () => {
    messageStore.messages = [{ id: 'remote-1' }]
  })

  approvalStore.pendingApprovals = []
  approvalStore.loadPendingApprovals = vi.fn(async () => {
    approvalStore.pendingApprovals = [
      {
        instanceId: 1,
        entityType: 'PLAN',
        entityId: 10,
        status: 'PENDING'
      }
    ]
  })
}

describe('useAppLayout message center refresh', () => {
  beforeEach(() => {
    resetStoreState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads departments and refreshes unified message center on first mount', async () => {
    const wrapper = mount(Harness)

    await flushUi()

    expect(orgStore.loadDepartments).toHaveBeenCalledTimes(1)
    expect(messageStore.refreshMessageCenter).toHaveBeenCalledTimes(1)
    expect(approvalStore.loadPendingApprovals).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('refreshes unified message center again when approval state refresh event is dispatched', async () => {
    const wrapper = mount(Harness)

    await flushUi()
    vi.mocked(messageStore.refreshMessageCenter).mockClear()
    vi.mocked(approvalStore.loadPendingApprovals).mockClear()

    window.dispatchEvent(new CustomEvent(APPROVAL_STATE_REFRESH_EVENT))
    await flushUi()

    expect(messageStore.refreshMessageCenter).toHaveBeenCalledTimes(1)
    expect(approvalStore.loadPendingApprovals).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
