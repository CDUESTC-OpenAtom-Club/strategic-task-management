import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildQueryKey,
  cacheManager,
  CacheManager,
  fetchWithCache,
  invalidateQueries,
  serializeQueryKey
} from '@/5-shared/lib/utils/cache'

describe('query cache core', () => {
  beforeEach(() => {
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cacheManager.clear()
    cacheManager.resetStats()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('serializes query keys deterministically', () => {
    const keyA = buildQueryKey('plan', 'detail', { b: 2, a: 1 })
    const keyB = buildQueryKey('plan', 'detail', { a: 1, b: 2 })

    expect(serializeQueryKey(keyA)).toBe(serializeQueryKey(keyB))
  })

  it('deduplicates concurrent requests by query key', async () => {
    const fetcher = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
      return { ok: true }
    })

    const key = buildQueryKey('task', 'list', { year: 2026 })
    const policy = {
      ttlMs: 1000,
      scope: 'memory' as const,
      dedupeWindowMs: 500,
      tags: ['task.list']
    }

    const [left, right] = await Promise.all([
      fetchWithCache({ key, policy, fetcher }),
      fetchWithCache({ key, policy, fetcher })
    ])

    expect(left).toEqual({ ok: true })
    expect(right).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cacheManager.getStats().counters.dedupedRequests).toBe(1)
  })

  it('invalidates entries by tag without touching unrelated entries', async () => {
    await fetchWithCache({
      key: buildQueryKey('plan', 'list'),
      policy: { ttlMs: 1000, scope: 'memory', dedupeWindowMs: 100, tags: ['plan.list'] },
      fetcher: async () => ['plan-a']
    })

    await fetchWithCache({
      key: buildQueryKey('task', 'list', { year: 2026 }),
      policy: { ttlMs: 1000, scope: 'memory', dedupeWindowMs: 100, tags: ['task.list'] },
      fetcher: async () => ['task-a']
    })

    expect(cacheManager.get(buildQueryKey('plan', 'list'))?.data).toEqual(['plan-a'])
    expect(cacheManager.get(buildQueryKey('task', 'list', { year: 2026 }))?.data).toEqual(['task-a'])

    invalidateQueries(['plan.list'])

    expect(cacheManager.get(buildQueryKey('plan', 'list'))).toBeUndefined()
    expect(cacheManager.get(buildQueryKey('task', 'list', { year: 2026 }))?.data).toEqual(['task-a'])
  })

  it('persists session-scoped entries and restores them from storage', async () => {
    const key = buildQueryKey('auth', 'user')
    const policy = {
      ttlMs: 60_000,
      scope: 'session' as const,
      persist: true,
      dedupeWindowMs: 100,
      tags: ['auth.user']
    }

    await fetchWithCache({
      key,
      policy,
      fetcher: async () => ({ id: 1, name: 'tester' })
    })

    const serialized = serializeQueryKey(key)
    expect(sessionStorage.getItem(`query_cache:${serialized}`)).not.toBeNull()

    const freshManager = new CacheManager()
    freshManager.registerPolicy(key, policy)

    expect(freshManager.get<{ id: number; name: string }>(key)?.data).toEqual({
      id: 1,
      name: 'tester'
    })
    freshManager.stopCleanup()
  })
})
