<script setup lang="ts">
/**
 * 审计日志抽屉组件
 * 显示指标详情和审批历史时间线
 */
import { computed } from "vue";
import {
  Check,
  Close,
  Upload,
  Edit,
  Refresh,
  User,
  Clock,
  ChatDotRound,
} from "@element-plus/icons-vue";
import type { StrategicIndicator, StatusAuditEntry } from "@/types";
import { useStrategicStore } from "@/stores/strategic";

const strategicStore = useStrategicStore();

const props = defineProps<{
  visible: boolean;
  indicator: StrategicIndicator | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "close"): void;
}>();

// 计算 drawer 可见性
const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

// 获取父指标（核心指标）名称
const getParentIndicatorName = () => {
  if (!props.indicator?.parentIndicatorId) return '-';
  const parentIndicator = strategicStore.indicators.find(
    i => i.id.toString() === props.indicator?.parentIndicatorId
  );
  return parentIndicator?.name || '-';
};

// 获取审计日志（按时间倒序）
const auditLogs = computed(() => {
  if (!props.indicator?.statusAudit) return [];
  return [...props.indicator.statusAudit].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
});

// 获取操作类型配置
const getActionConfig = (action: StatusAuditEntry["action"]) => {
  const configs = {
    submit: {
      icon: Upload,
      color: "#409EFF",
      label: "提交进度",
      type: "primary",
    },
    approve: {
      icon: Check,
      color: "#67C23A",
      label: "审批通过",
      type: "success",
    },
    reject: {
      icon: Close,
      color: "#F56C6C",
      label: "审批驳回",
      type: "danger",
    },
    revoke: {
      icon: Refresh,
      color: "#E6A23C",
      label: "撤回提交",
      type: "warning",
    },
    update: {
      icon: Edit,
      color: "#909399",
      label: "更新进度",
      type: "info",
    },
  };
  return configs[action] || configs.update;
};

// 格式化时间
const formatTime = (timestamp: Date | string) => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 格式化相对时间
const formatRelativeTime = (timestamp: Date | string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  return formatTime(timestamp);
};

// 关闭抽屉
const handleClose = () => {
  emit("close");
};
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="指标详情"
    direction="rtl"
    size="450px"
    :before-close="handleClose"
    class="audit-log-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-title">
          <el-icon><ChatDotRound /></el-icon>
          <span>指标详情</span>
        </div>
        <div class="header-subtitle" v-if="indicator">
          {{ indicator.name }}
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <!-- 指标基本信息 -->
      <div v-if="indicator" class="indicator-info-section">
        <h4 class="section-title">基本信息</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="战略任务">
            {{ indicator.taskContent || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="核心指标">
            {{ getParentIndicatorName() }}
          </el-descriptions-item>
          <el-descriptions-item label="指标类型">
            <el-tag size="small" :type="indicator.type1 === '定量' ? 'primary' : 'warning'">
              {{ indicator.type1 }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="权重">
            {{ indicator.weight ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ indicator.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <el-divider v-if="indicator" />

      <h4 class="section-title">审计日志</h4>
      
      <!-- 空状态 -->
      <el-empty
        v-if="auditLogs.length === 0"
        description="暂无审计日志"
        :image-size="100"
      />

      <!-- 时间线 -->
      <el-timeline v-else>
        <el-timeline-item
          v-for="(log, index) in auditLogs"
          :key="log.id"
          :timestamp="formatRelativeTime(log.timestamp)"
          :type="getActionConfig(log.action).type"
          :hollow="index !== 0"
          placement="top"
        >
          <div class="log-card">
            <!-- 操作标题 -->
            <div class="log-header">
              <el-tag
                :type="getActionConfig(log.action).type"
                size="small"
                effect="dark"
              >
                <div style="display: flex; align-items: center; gap: 4px;">
                  <el-icon
                    ><component :is="getActionConfig(log.action).icon"
                  /></el-icon>
                  {{ getActionConfig(log.action).label }}
                </div>
              </el-tag>
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            </div>

            <!-- 操作人信息 -->
            <div class="log-operator">
              <el-icon><User /></el-icon>
              <span class="operator-name">{{ log.operatorName }}</span>
              <span class="operator-dept">{{ log.operatorDept }}</span>
            </div>

            <!-- 进度变化 -->
            <div
              v-if="
                log.previousProgress !== undefined &&
                log.newProgress !== undefined
              "
              class="log-progress"
            >
              <span class="progress-label">进度变化:</span>
              <span class="progress-from">{{ log.previousProgress }}%</span>
              <el-icon class="progress-arrow"><Right /></el-icon>
              <span class="progress-to">{{ log.newProgress }}%</span>
            </div>

            <!-- 备注 -->
            <div v-if="log.comment" class="log-comment">
              <el-icon><ChatDotRound /></el-icon>
              <span>{{ log.comment }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <span class="log-count">共 {{ auditLogs.length }} 条记录</span>
        <el-button @click="handleClose">关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.audit-log-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.drawer-header {
  width: 100%;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1e293b);
}

.header-title .el-icon {
  color: var(--color-primary, #2c5282);
}

.header-subtitle {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

.drawer-content {
  padding: 20px;
  height: calc(100% - 60px);
  overflow-y: auto;
}

.log-card {
  background: var(--bg-page, #f8fafc);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 4px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.log-header .el-tag {
  width: fit-content;
}

.log-time {
  font-size: 12px;
  color: var(--text-placeholder, #94a3b8);
}

.log-operator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  margin-bottom: 8px;
}

.log-operator .el-icon {
  color: var(--text-placeholder, #94a3b8);
  font-size: 14px;
}

.operator-name {
  font-weight: 500;
}

.operator-dept {
  color: var(--text-secondary, #64748b);
}

.operator-dept::before {
  content: "·";
  margin: 0 4px;
}

.log-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: var(--bg-white, #fff);
  border-radius: 4px;
}

.progress-label {
  color: var(--text-secondary, #64748b);
}

.progress-from {
  color: var(--text-placeholder, #94a3b8);
}

.progress-arrow {
  color: var(--text-placeholder, #94a3b8);
  font-size: 12px;
}

.progress-to {
  color: var(--color-primary, #2c5282);
  font-weight: 600;
}

.log-comment {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: var(--text-regular, #475569);
  padding: 8px 10px;
  background: var(--bg-white, #fff);
  border-radius: 4px;
  border-left: 3px solid var(--color-primary-light, #93c5fd);
}

.log-comment .el-icon {
  color: var(--color-primary, #2c5282);
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 2px;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.log-count {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
}

/* 指标基本信息区域 */
.indicator-info-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 12px 0;
}

.indicator-info-section :deep(.el-descriptions__label) {
  width: 80px;
  font-weight: 500;
}

/* 滚动条样式 */
.drawer-content::-webkit-scrollbar {
  width: 6px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: var(--border-light, #e2e8f0);
  border-radius: 3px;
}

.drawer-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-color, #cbd5e1);
}
</style>