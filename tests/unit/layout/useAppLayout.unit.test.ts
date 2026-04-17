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
  fetchMessages: vi.fn(async () => {
    messageStore.messages = [{ id: 'remote-1' }]
  }),
  syncPendingApprovals: vi.fn()
})

const approvalStore = reactive({
  pendingApprovals: [] as Array<Record<string, unknown>>,
  loadPendingApprovals: vi.fn(async () => {
    approvalStore.pendingApprovals = [
      {
        instanceId: 1,
        entityType: 'PLAN',
        entityId: 10,
        status: 'PENDING',
        currentStepName: '部门审核',
        applicant: { name: '教务处' },
        initiatedAt: '2026-04-17T08:00:00Z'
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
  messageStore.fetchMessages = vi.fn(async () => {
    messageStore.messages = [{ id: 'remote-1' }]
  })
  messageStore.syncPendingApprovals = vi.fn()

  approvalStore.pendingApprovals = []
  approvalStore.loadPendingApprovals = vi.fn(async () => {
    approvalStore.pendingApprovals = [
      {
        instanceId: 1,
        entityType: 'PLAN',
        entityId: 10,
        status: 'PENDING',
        currentStepName: '部门审核',
        applicant: { name: '教务处' },
        initiatedAt: '2026-04-17T08:00:00Z'
      }
    ]
  })
}

describe('useAppLayout approval-message sync', () => {
  beforeEach(() => {
    resetStoreState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('syncs pending approvals into the message store after the global load finishes', async () => {
    const wrapper = mount(Harness)

    await flushUi()

    expect(orgStore.loadDepartments).toHaveBeenCalledTimes(1)
    expect(messageStore.fetchMessages).toHaveBeenCalledTimes(1)
    expect(approvalStore.loadPendingApprovals).toHaveBeenCalledTimes(1)
    expect(messageStore.syncPendingApprovals).toHaveBeenLastCalledWith(
      approvalStore.pendingApprovals
    )

    wrapper.unmount()
  })

  it('re-syncs synthetic approval messages when pending approvals change later', async () => {
    const wrapper = mount(Harness)

    await flushUi()
    vi.mocked(messageStore.syncPendingApprovals).mockClear()

    approvalStore.pendingApprovals = [
      {
        instanceId: 2,
        entityType: 'INDICATOR',
        entityId: 20,
        status: 'PENDING',
        currentStepName: '指标审批',
        applicant: { name: '科研处' },
        initiatedAt: '2026-04-17T09:00:00Z'
      }
    ]

    await flushUi()

    expect(messageStore.syncPendingApprovals).toHaveBeenCalledWith(approvalStore.pendingApprovals)

    wrapper.unmount()
  })

  it('refreshes pending approvals when the approval refresh event is dispatched', async () => {
    const wrapper = mount(Harness)

    await flushUi()
    vi.mocked(approvalStore.loadPendingApprovals).mockClear()
    vi.mocked(messageStore.syncPendingApprovals).mockClear()
    vi.mocked(messageStore.fetchMessages).mockClear()

    window.dispatchEvent(new CustomEvent(APPROVAL_STATE_REFRESH_EVENT))
    await flushUi()

    expect(approvalStore.loadPendingApprovals).toHaveBeenCalledTimes(1)
    expect(messageStore.syncPendingApprovals).toHaveBeenCalledWith(approvalStore.pendingApprovals)
    expect(messageStore.fetchMessages).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
