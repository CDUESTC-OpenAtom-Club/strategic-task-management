# Unified API Client

Production-ready HTTP client for API requests with comprehensive features.

## Features

- ✅ **Request/Response Interceptors** - Automatic token injection, logging, and transformation
- ✅ **Authentication Handling** - JWT token management with auto-refresh on 401
- ✅ **Unified Error Handling** - Consistent error format with severity classification
- ✅ **Automatic Retry** - Exponential backoff for failed requests
- ✅ **Request Cancellation** - Cancel pending requests to prevent memory leaks
- ✅ **Loading State** - Built-in support for loading indicators
- ✅ **File Upload/Download** - Simplified file operations
- ✅ **TypeScript Support** - Full type safety

## Quick Start

```typescript
import { apiClient } from '@/shared/lib/api'

// GET request
const users = await apiClient.get<User[]>('/users')

// POST request
const newUser = await apiClient.post<User>('/users', {
  name: 'John Doe',
  email: 'john@example.com'
})

// PUT request
const updatedUser = await apiClient.put<User>(`/users/${id}`, userData)

// DELETE request
await apiClient.delete(`/users/${id}`)
```

## Advanced Usage

### Request Cancellation

```typescript
// Create cancel token
const cancelToken = apiClient.createCancelToken('fetchUsers')

// Make request with cancel token
const users = await apiClient.get('/users', {}, { cancelToken })

// Cancel the request
apiClient.cancelRequest('fetchUsers')

// Cancel all pending requests
apiClient.cancelAllRequests()
```

### File Upload

```typescript
const file = document.querySelector('input[type="file"]').files[0]

const result = await apiClient.upload('/upload', file, {
  category: 'avatar',
  userId: '123'
})
```

### File Download

```typescript
await apiClient.download('/files/report.pdf', 'monthly-report.pdf')
```

### Custom Retry Configuration

```typescript
import { withRetry, withoutRetry } from '@/shared/lib/api'

// Custom retry settings
const data = await apiClient.get('/data', {}, {
  ...withRetry({
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000
  })
})

// Disable retry for specific request
const result = await apiClient.post('/action', data, {
  ...withoutRetry()
})
```

### Error Handling

```typescript
import { isApiError, formatErrorMessage } from '@/shared/lib/api'

try {
  const data = await apiClient.get('/data')
} catch (error) {
  if (isApiError(error)) {
    console.error('API Error:', error.message)
    console.error('Status:', error.status)
    console.error('Severity:', error.severity)
    console.error('Retryable:', error.retryable)
  } else {
    console.error('Unknown error:', formatErrorMessage(error))
  }
}
```

## Configuration

### Environment Variables

```env
# API base URL
VITE_API_BASE_URL=/api/v1

# Request timeout (milliseconds)
VITE_REQUEST_TIMEOUT=30000
```

### Custom Client Instance

```typescript
import { createApiClient } from '@/shared/lib/api'

const customClient = createApiClient({
  baseURL: 'https://api.example.com',
  timeout: 60000,
  enableRetry: true,
  maxRetries: 5,
  enableLogging: true
})
```

## Authentication

The client automatically handles JWT authentication:

1. **Token Injection** - Adds `Authorization: Bearer <token>` header to all requests
2. **Auto Refresh** - On 401 error, automatically refreshes token and retries request
3. **Logout on Failure** - Redirects to login page if refresh fails

Token is stored in `localStorage` with key `token`.

## Error Handling

### Error Types

- **Network Error** - No response from server (connection failed, timeout)
- **Client Error (4xx)** - Bad request, unauthorized, forbidden, not found
- **Server Error (5xx)** - Internal server error, service unavailable

### Error Severity

- **Low** - Client errors that user can fix (400, 404, 422)
- **Medium** - Authentication errors (401, 403)
- **High** - Network errors and server errors (5xx)

### Automatic Notifications

The client shows Element Plus notifications for:

- **403 Forbidden** - "权限不足，无法执行此操作"
- **500 Server Error** - "服务器内部错误，请稍后重试或联系管理员"
- **Network Error** - "无法连接到服务器，请检查网络连接"

## Retry Logic

### Default Behavior

- **Idempotent Methods** (GET, HEAD, OPTIONS, PUT, DELETE) - Automatically retried
- **Non-Idempotent Methods** (POST, PATCH) - NOT retried by default
- **Max Retries** - 3 attempts
- **Backoff Strategy** - Exponential (1s, 2s, 4s, 8s, 10s max)

### Retry Conditions

Requests are retried when:

- Network error (no response)
- Server error (5xx status)
- Request timeout (408 status)
- Rate limit (429 status)

### Exponential Backoff

| Attempt | Delay |
|---------|-------|
| 1       | 1s    |
| 2       | 2s    |
| 3       | 4s    |
| 4       | 8s    |
| 5+      | 10s   |

## Response Format

All responses are normalized to:

```typescript
{
  success: boolean
  data: T
  message?: string
}
```

Backend formats are automatically converted:

```typescript
// Backend format 1: { code: 0, data: {...}, message: "..." }
// Backend format 2: { success: true, data: {...} }
// Backend format 3: Direct data

// All converted to: { success: true, data: {...}, message?: "..." }
```

## Request Tracking

Each request gets a unique ID for tracking:

- Added as `X-Request-ID` header
- Included in error objects
- Logged in development mode

## Performance Monitoring

Request duration is automatically tracked:

- Start time recorded in request interceptor
- Duration calculated in response interceptor
- Logged in development mode

## Best Practices

### 1. Use Type Parameters

```typescript
interface User {
  id: string
  name: string
  email: string
}

const users = await apiClient.get<User[]>('/users')
// users is typed as User[]
```

### 2. Handle Errors Properly

```typescript
try {
  const data = await apiClient.get('/data')
  // Handle success
} catch (error) {
  if (isApiError(error)) {
    // Handle API error
    ElMessage.error(error.message)
  } else {
    // Handle unknown error
    console.error(error)
  }
}
```

### 3. Cancel Requests on Component Unmount

```typescript
import { onUnmounted } from 'vue'

const cancelToken = apiClient.createCancelToken('fetchData')

onUnmounted(() => {
  apiClient.cancelRequest('fetchData')
})
```

### 4. Use Loading States

```typescript
const loading = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const data = await apiClient.get('/data')
    // Handle data
  } finally {
    loading.value = false
  }
}
```

### 5. Avoid Retrying Non-Idempotent Operations

```typescript
// POST requests are NOT retried by default (correct)
await apiClient.post('/orders', orderData)

// If you need to retry POST (use with caution!)
await apiClient.post('/orders', orderData, {
  ...forceRetry({ maxRetries: 2 })
})
```

## Migration Guide

### From Old API Client

```typescript
// Old
import { apiService } from '@/api'
const data = await apiService.get('/users')

// New
import { apiClient } from '@/shared/lib/api'
const data = await apiClient.get('/users')
```

### From Axios Directly

```typescript
// Old
import axios from 'axios'
const response = await axios.get('/api/users')
const data = response.data

// New
import { apiClient } from '@/shared/lib/api'
const data = await apiClient.get('/users')
```

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createApiClient } from '@/shared/lib/api'

describe('API Client', () => {
  it('should make GET request', async () => {
    const client = createApiClient({
      baseURL: 'http://localhost:3000'
    })
    
    const data = await client.get('/users')
    expect(data).toBeDefined()
  })
})
```

## Troubleshooting

### Token Not Being Sent

Check that token is stored in localStorage:

```typescript
localStorage.setItem('token', 'your-jwt-token')
```

### 401 Errors Not Auto-Refreshing

Ensure refresh endpoint is configured:

```typescript
// Refresh endpoint should be: /api/auth/refresh
// Should accept HttpOnly cookie with refresh token
// Should return: { data: { token: 'new-access-token' } }
```

### Requests Not Being Retried

Check that:

1. Method is idempotent (GET, PUT, DELETE)
2. Error is retryable (network error or 5xx)
3. Max retries not exceeded (default: 3)

## API Reference

See TypeScript definitions for complete API documentation.
