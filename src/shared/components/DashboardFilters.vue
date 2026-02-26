<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStrategicStore } from '@/stores/strategic'
import { useOrgStore } from '@/stores/org'
import type { FilterState } from '@/types'
import { isSecondaryCollege } from '@/utils/colors'

// Props
interface Props {
  modelValue: FilterState
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: FilterState]
  'apply': []
}>()

const authStore = useAuthStore()
const strategicStore = useStrategicStore()
const orgStore = useOrgStore()

// 本地筛选状态
const localFilters = ref<FilterState>({ ...props.modelValue })

// 同步props变化
watch(() => props.modelValue, (newValue) => {
  localFilters.value = { ...newValue }
}, { deep: true })

// 职能部门选项 - 使用完整配置列表
const functionalDepts = computed(() => {
  // 使用完整的职能部门配置
  let allDepts = orgStore.getAllFunctionalDepartmentNames()

  // 战略发展部可以看所有职能部门
  if (authStore.user?.role === 'strategic_dept') {
    return allDepts
  }

  // 职能部门用户只能看自己
  if (authStore.user?.role === 'functional_dept') {
    const userDept = authStore.user?.department
    return allDepts.filter(dept => dept === userDept)
  }

  return allDepts
})

// 二级学院选项 - 使用完整配置列表，根据数据筛选
const collegeOptions = computed(() => {
  const indicators = strategicStore.indicators

  // 使用完整的学院配置
  let allColleges = orgStore.getAllCollegeNames()

  // 如果选中了职能部门，只显示该部门下发的学院（基于实际数据）
  if (localFilters.value.department) {
    const relatedColleges = new Set<string>()
    indicators
      .filter(i => i.ownerDept === localFilters.value.department && isSecondaryCollege(i.responsibleDept))
      .forEach(i => {
        if (i.responsibleDept) {
          relatedColleges.add(i.responsibleDept)
        }
      })

    // 如果该部门有下发任务，只显示相关学院；否则显示所有学院
    if (relatedColleges.size > 0) {
      return allColleges.filter(college => relatedColleges.has(college))
    }
  }

  // 如果是职能部门用户，显示本部门下发的学院
  if (authStore.user?.role === 'functional_dept') {
    const dept = authStore.user?.department
    const relatedColleges = new Set<string>()
    indicators
      .filter(i => i.ownerDept === dept && isSecondaryCollege(i.responsibleDept))
      .forEach(i => {
        if (i.responsibleDept) {
          relatedColleges.add(i.responsibleDept)
        }
      })

    // 如果有下发任务，显示相关学院；否则显示所有学院
    if (relatedColleges.size > 0) {
      return allColleges.filter(college => relatedColleges.has(college))
    }
  }

  // 默认显示所有学院
  return allColleges
})

// 监听职能部门变化，清空学院选择
watch(() => localFilters.value.department, () => {
  localFilters.value.collegeFilter = undefined
})

// 应用筛选
const handleApply = () => {
  emit('update:modelValue', localFilters.value)
  emit('apply')
}

// 重置筛选
const handleReset = () => {
  localFilters.value = {}
  emit('update:modelValue', {})
  emit('apply')
}

// 判断是否有筛选条件
const hasFilters = computed(() => {
  return Object.values(localFilters.value).some(v => v !== undefined && v !== '')
})
</script>

<template>
  <div class="dashboard-filters">
    <el-form :model="localFilters" inline size="default">
      <!-- 战略处显示职能部门下拉 -->
      <el-form-item v-if="authStore.user?.role === 'strategic_dept'" label="职能部门">
        <el-select
          v-model="localFilters.department"
          placeholder="全部职能部门"
          clearable
          filterable
          style="width: 200px"
        >
          <el-option
            v-for="dept in functionalDepts"
            :key="dept"
            :label="dept"
            :value="dept"
          />
        </el-select>
      </el-form-item>

      <!-- 战略处和职能部门显示学院下拉 -->
      <el-form-item
        v-if="authStore.user?.role !== 'secondary_college'"
        label="二级学院"
      >
        <el-select
          v-model="localFilters.collegeFilter"
          placeholder="全部学院"
          clearable
          filterable
          style="width: 200px"
          :disabled="authStore.user?.role === 'strategic_dept' && !localFilters.department && collegeOptions.length === 0"
        >
          <el-option
            v-for="college in collegeOptions"
            :key="college"
            :label="college"
            :value="college"
          />
        </el-select>
      </el-form-item>

      <!-- 指标类型筛选 -->
      <el-form-item label="指标类型">
        <el-select
          v-model="localFilters.indicatorType"
          placeholder="全部"
          clearable
          style="width: 130px"
        >
          <el-option label="定性" value="定性" />
          <el-option label="定量" value="定量" />
        </el-select>
      </el-form-item>

      <!-- 预警级别筛选 -->
      <el-form-item label="预警级别">
        <el-select
          v-model="localFilters.alertLevel"
          placeholder="全部"
          clearable
          style="width: 130px"
        >
          <el-option label="严重 (<30%)" value="severe">
            <span style="color: #F56C6C">● 严重</span>
          </el-option>
          <el-option label="中度 (30%-60%)" value="moderate">
            <span style="color: #E6A23C">● 中度</span>
          </el-option>
          <el-option label="正常 (≥60%)" value="normal">
            <span style="color: #67C23A">● 正常</span>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 操作按钮 -->
      <el-form-item>
        <el-button type="primary" @click="handleApply" :icon="hasFilters ? 'Search' : undefined">
          {{ hasFilters ? '应用筛选' : '查询' }}
        </el-button>
        <el-button @click="handleReset" :disabled="!hasFilters">
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 当前筛选条件提示 -->
    <div v-if="hasFilters" class="filter-tags">
      <el-tag
        v-if="localFilters.department"
        closable
        @close="localFilters.department = undefined; handleApply()"
        type="info"
        size="small"
      >
        职能部门: {{ localFilters.department }}
      </el-tag>
      <el-tag
        v-if="localFilters.collegeFilter"
        closable
        @close="localFilters.collegeFilter = undefined; handleApply()"
        type="info"
        size="small"
      >
        学院: {{ localFilters.collegeFilter }}
      </el-tag>
      <el-tag
        v-if="localFilters.indicatorType"
        closable
        @close="localFilters.indicatorType = undefined; handleApply()"
        type="info"
        size="small"
      >
        类型: {{ localFilters.indicatorType }}
      </el-tag>
      <el-tag
        v-if="localFilters.alertLevel"
        closable
        @close="localFilters.alertLevel = undefined; handleApply()"
        :type="localFilters.alertLevel === 'severe' ? 'danger' : localFilters.alertLevel === 'moderate' ? 'warning' : 'success'"
        size="small"
      >
        预警: {{ localFilters.alertLevel === 'severe' ? '严重' : localFilters.alertLevel === 'moderate' ? '中度' : '正常' }}
      </el-tag>
    </div>
  </div>
</template>

<style scoped>
.dashboard-filters {
  padding: 16px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 16px;
}

.dashboard-filters :deep(.el-form) {
  margin-bottom: 0;
}

.dashboard-filters :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 16px;
}

.dashboard-filters :deep(.el-form-item:last-child) {
  margin-right: 0;
}

.filter-tags {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.filter-tags .el-tag {
  cursor: pointer;
}
</style>
