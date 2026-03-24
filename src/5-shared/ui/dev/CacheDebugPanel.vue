<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cacheManager } from '@/shared/lib/utils/cache'

const visible = ref(false)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

const snapshot = computed(() => cacheManager.getStats())

const counters = computed(() => snapshot.value.counters)
const entries = computed(() =>
  [...snapshot.value.entries].sort((left, right) => left.expiresIn - right.expiresIn)
)

function refresh(): void {
  now.value = Date.now()
}

function formatExpires(expiresIn: number): string {
  if (expiresIn <= 0) {
    return 'expired'
  }

  if (expiresIn < 1000) {
    return `${expiresIn}ms`
  }

  return `${(expiresIn / 1000).toFixed(1)}s`
}

function resetStats(): void {
  cacheManager.resetStats()
  refresh()
}

onMounted(() => {
  timer = setInterval(refresh, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div class="cache-debug-panel">
    <el-button class="cache-debug-trigger" size="small" plain @click="visible = !visible">
      Cache {{ snapshot.size }}
    </el-button>

    <el-card v-if="visible" class="cache-debug-card" shadow="always">
      <template #header>
        <div class="cache-debug-header">
          <span>Cache Debug</span>
          <div class="cache-debug-actions">
            <el-button size="small" text @click="refresh">刷新</el-button>
            <el-button size="small" text @click="resetStats">重置统计</el-button>
            <el-button size="small" text @click="visible = false">关闭</el-button>
          </div>
        </div>
      </template>

      <div class="cache-debug-metrics">
        <span>size: {{ snapshot.size }}</span>
        <span>hits: {{ counters.hits }}</span>
        <span>misses: {{ counters.misses }}</span>
        <span>stale: {{ counters.staleHits }}</span>
        <span>writes: {{ counters.writes }}</span>
        <span>invalidations: {{ counters.invalidations }}</span>
        <span>deduped: {{ counters.dedupedRequests }}</span>
      </div>

      <div class="cache-debug-list">
        <div v-for="entry in entries" :key="entry.key" class="cache-debug-entry">
          <div class="cache-debug-row">
            <span class="cache-debug-key">{{ entry.key }}</span>
            <el-tag size="small" effect="plain">{{ entry.scope }}</el-tag>
          </div>
          <div class="cache-debug-row secondary">
            <span>expires: {{ formatExpires(entry.expiresIn) }}</span>
            <span>etag: {{ entry.hasEtag ? 'yes' : 'no' }}</span>
          </div>
          <div class="cache-debug-tags">
            <el-tag v-for="tag in entry.tags" :key="tag" size="small" type="info" effect="plain">
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.cache-debug-panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2200;
}

.cache-debug-trigger {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}

.cache-debug-card {
  width: min(420px, calc(100vw - 32px));
  max-height: min(70vh, 640px);
  overflow: hidden;
  margin-top: 8px;
}

.cache-debug-header,
.cache-debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cache-debug-actions,
.cache-debug-metrics,
.cache-debug-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cache-debug-metrics {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.cache-debug-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(70vh - 120px);
  overflow: auto;
}

.cache-debug-entry {
  padding: 10px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-page, #fff);
}

.cache-debug-key {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}

.secondary {
  margin: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
