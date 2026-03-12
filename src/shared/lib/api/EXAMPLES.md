# API Client Usage Examples

## Basic Usage

### Simple GET Request

```typescript
import { apiClient } from '@/shared/lib/api'

// Fetch users
const users = await apiClient.get<User[]>('/users')

// Fetch user by ID
const user = await apiClient.get<User>(`/users/${userId}`)

// Fetch with query parameters
const filteredUsers = await apiClient.get<User[]>('/users', {
  role: 'admin',
  status: 'active',
  page: 1,
  pageSize: 20
})
```

### POST Request

```typescript
import { apiClient } from '@/shared/lib/api'

// Create new user
const newUser = await apiClient.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
})

// Submit form data
const result = await apiClient.post('/indicators/distribute', {
  indicatorId: '123',
  targetOrgIds: ['org1', 'org2'],
  deadline: '2026-12-31'
})
```

### PUT Request

```typescript
import { apiClient } from '@/shared/lib/api'

// Update user
const updatedUser = await apiClient.put<User>(`/users/${userId}`, {
  name: 'Jane Doe',
  email: 'jane@example.com'
})
```

### DELETE Request

```typescript
import { apiClient } from '@/shared/lib/api'

// Delete user
await apiClient.delete(`/users/${userId}`)

// Delete with confirmation
try {
  await apiClient.delete(`/indicators/${indicatorId}`)
  ElMessage.success('指标删除成功')
} catch (error) {
  ElMessage.error('删除失败')
}
```

## Advanced Usage

### File Upload

```typescript
import { apiClient } from '@/shared/lib/api'

// Upload single file
const handleFileUpload = async (file: File) => {
  try {
    const result = await apiClient.upload('/attachments/upload', file, {
      category: 'indicator',
      relatedId: indicatorId
    })
    
    ElMessage.success('文件上传成功')
    return result
  } catch (error) {
    ElMessage.error('文件上传失败')
    throw error
  }
}

// Usage in component
<input type="file" @change="handleFileChange" />

const handleFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    await handleFileUpload(file)
  }
}
```

### File Download

```typescript
import { apiClient } from '@/shared/lib/api'

// Download file
const downloadReport = async (reportId: string) => {
  try {
    await apiClient.download(
      `/reports/${reportId}/download`,
      `report-${reportId}.pdf`
    )
    ElMessage.success('文件下载成功')
  } catch (error) {
    ElMessage.error('文件下载失败')
  }
}

// Download with loading state
const downloading = ref(false)

const downloadFile = async () => {
  downloading.value = true
  try {
    await apiClient.download('/export/indicators', 'indicators.xlsx')
  } finally {
    downloading.value = false
  }
}
```

### Request Cancellation

```typescript
import { apiClient } from '@/shared/lib/api'
import { onUnmounted } from 'vue'

// Create cancel token
const cancelToken = apiClient.createCancelToken('fetchIndicators')

// Make cancellable request
const fetchIndicators = async () => {
  try {
    const data = await apiClient.get('/indicators', {}, { cancelToken })
    return data
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log('Request cancelled')
    } else {
      throw error
    }
  }
}

// Cancel on component unmount
onUnmounted(() => {
  apiClient.cancelRequest('fetchIndicators')
})

// Cancel on user action
const handleCancel = () => {
  apiClient.cancelRequest('fetchIndicators')
  ElMessage.info('请求已取消')
}
```

### Custom Retry Configuration

```typescript
import { apiClient, withRetry, withoutRetry } from '@/shared/lib/api'

// Increase retry attempts for critical operation
const criticalData = await apiClient.get('/critical-data', {}, {
  ...withRetry({
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000
  })
})

// Disable retry for non-idempotent operation
const result = await apiClient.post('/orders', orderData, {
  ...withoutRetry()
})

// Custom retry condition
const data = await apiClient.get('/data', {}, {
  ...withRetry({
    maxRetries: 3,
    retryCondition: (error) => {
      // Only retry on specific errors
      return error.response?.status === 503
    }
  })
})
```

## Vue Component Examples

### Basic Data Fetching

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiClient } from '@/shared/lib/api'
import type { Indicator } from '@/types'

const indicators = ref<Indicator[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const fetchIndicators = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await apiClient.get<Indicator[]>('/indicators')
    indicators.value = data
  } catch (err) {
    error.value = '加载指标失败'
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchIndicators()
})
</script>

<template>
  <div>
    <el-button @click="fetchIndicators" :loading="loading">
      刷新
    </el-button>
    
    <el-alert v-if="error" type="error" :title="error" />
    
    <el-table v-else :data="indicators" :loading="loading">
      <!-- table columns -->
    </el-table>
  </div>
</template>
```

### Form Submission

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '@/shared/lib/api'
import { ElMessage } from 'element-plus'
import type { IndicatorForm } from '@/types'

const form = ref<IndicatorForm>({
  name: '',
  code: '',
  unit: '',
  targetValue: ''
})

const submitting = ref(false)

const handleSubmit = async () => {
  submitting.value = true
  
  try {
    const result = await apiClient.post('/indicators', form.value)
    ElMessage.success('指标创建成功')
    
    // Reset form
    form.value = {
      name: '',
      code: '',
      unit: '',
      targetValue: ''
    }
    
    return result
  } catch (error) {
    ElMessage.error('创建失败，请重试')
    throw error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-form :model="form" @submit.prevent="handleSubmit">
    <el-form-item label="指标名称">
      <el-input v-model="form.name" />
    </el-form-item>
    
    <el-form-item label="指标代码">
      <el-input v-model="form.code" />
    </el-form-item>
    
    <el-form-item>
      <el-button type="primary" native-type="submit" :loading="submitting">
        提交
      </el-button>
    </el-form-item>
  </el-form>
</template>
```

### Pagination

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { apiClient } from '@/shared/lib/api'
import type { Indicator, PaginatedResponse } from '@/types'

const indicators = ref<Indicator[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const fetchIndicators = async () => {
  loading.value = true
  
  try {
    const response = await apiClient.get<PaginatedResponse<Indicator>>('/indicators', {
      page: currentPage.value,
      pageSize: pageSize.value
    })
    
    indicators.value = response.items
    total.value = response.total
  } catch (error) {
    console.error('Failed to fetch indicators:', error)
  } finally {
    loading.value = false
  }
}

// Watch for page changes
watch([currentPage, pageSize], () => {
  fetchIndicators()
})

// Initial fetch
fetchIndicators()
</script>

<template>
  <div>
    <el-table :data="indicators" :loading="loading">
      <!-- table columns -->
    </el-table>
    
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
    />
  </div>
</template>
```

### Search with Debounce

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { apiClient } from '@/shared/lib/api'
import { useDebounceFn } from '@vueuse/core'
import type { Indicator } from '@/types'

const searchQuery = ref('')
const indicators = ref<Indicator[]>([])
const loading = ref(false)

const searchIndicators = async (query: string) => {
  if (!query) {
    indicators.value = []
    return
  }
  
  loading.value = true
  
  try {
    const data = await apiClient.get<Indicator[]>('/indicators/search', {
      q: query
    })
    indicators.value = data
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    loading.value = false
  }
}

// Debounce search
const debouncedSearch = useDebounceFn(searchIndicators, 500)

watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
})
</script>

<template>
  <div>
    <el-input
      v-model="searchQuery"
      placeholder="搜索指标..."
      clearable
    />
    
    <el-table :data="indicators" :loading="loading">
      <!-- table columns -->
    </el-table>
  </div>
</template>
```

## Composable Pattern

### useApi Composable

```typescript
// composables/useApi.ts
import { ref } from 'vue'
import { apiClient, type ApiError, isApiError } from '@/shared/lib/api'
import { ElMessage } from 'element-plus'

export function useApi<T>() {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  const execute = async (
    request: () => Promise<T>,
    options?: {
      successMessage?: string
      errorMessage?: string
      showLoading?: boolean
    }
  ) => {
    const {
      successMessage,
      errorMessage = '操作失败',
      showLoading = true
    } = options || {}

    if (showLoading) {
      loading.value = true
    }
    error.value = null

    try {
      const result = await request()
      data.value = result

      if (successMessage) {
        ElMessage.success(successMessage)
      }

      return result
    } catch (err) {
      if (isApiError(err)) {
        error.value = err
        ElMessage.error(err.message || errorMessage)
      } else {
        ElMessage.error(errorMessage)
      }
      throw err
    } finally {
      if (showLoading) {
        loading.value = false
      }
    }
  }

  return {
    data,
    loading,
    error,
    execute
  }
}
```

### Usage in Component

```vue
<script setup lang="ts">
import { useApi } from '@/composables/useApi'
import { apiClient } from '@/shared/lib/api'
import type { Indicator } from '@/types'

const { data: indicators, loading, execute } = useApi<Indicator[]>()

const fetchIndicators = () => {
  execute(
    () => apiClient.get('/indicators'),
    { errorMessage: '加载指标失败' }
  )
}

const createIndicator = (form: IndicatorForm) => {
  execute(
    () => apiClient.post('/indicators', form),
    {
      successMessage: '指标创建成功',
      errorMessage: '创建失败'
    }
  )
}

// Initial fetch
fetchIndicators()
</script>
```

## Error Handling Patterns

### Global Error Handler

```typescript
// utils/errorHandler.ts
import { isApiError, type ApiError } from '@/shared/lib/api'
import { ElMessage, ElNotification } from 'element-plus'

export function handleApiError(error: unknown, context?: string) {
  if (isApiError(error)) {
    const message = context
      ? `${context}: ${error.message}`
      : error.message

    // Show notification for high severity errors
    if (error.severity === 'high') {
      ElNotification.error({
        title: '错误',
        message,
        duration: 5000
      })
    } else {
      ElMessage.error(message)
    }

    // Log error for debugging
    console.error('[API Error]', {
      message: error.message,
      status: error.status,
      code: error.code,
      severity: error.severity,
      requestId: error.requestId
    })
  } else {
    ElMessage.error('未知错误')
    console.error('[Unknown Error]', error)
  }
}
```

### Usage

```typescript
import { handleApiError } from '@/utils/errorHandler'

try {
  await apiClient.post('/indicators', data)
} catch (error) {
  handleApiError(error, '创建指标')
}
```

## Best Practices

1. **Always use type parameters** for type safety
2. **Handle errors appropriately** with try-catch
3. **Show loading states** for better UX
4. **Cancel requests** on component unmount
5. **Use composables** for reusable logic
6. **Debounce search** to reduce API calls
7. **Show success/error messages** for user feedback
8. **Log errors** for debugging
