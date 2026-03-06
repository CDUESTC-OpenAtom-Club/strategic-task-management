# 浏览器控制台调试指南

## 🎯 问题说明

在浏览器控制台中直接使用 `import('@/stores/auth')` 会报错：

```
Uncaught (in promise) TypeError: Failed to resolve module specifier '@/stores/auth'
```

**原因：** `@/` 是 Vite 的路径别名，只在构建时有效，浏览器运行时无法识别。

---

## ✅ 解决方案

### 方案 1：使用全局调试工具（推荐）⭐

我已经在 `main.ts` 中添加了全局调试工具，在开发环境下自动加载。

#### 使用方法

```javascript
// 1. 查看调试工具
window.__DEBUG__

// 2. 访问 auth store
window.__DEBUG__.authStore

// 3. 查看当前用户
window.__DEBUG__.authStore.user

// 4. 查看 token
window.__DEBUG__.authStore.token

// 5. 访问 tokenManager
window.__DEBUG__.tokenManager

// 6. 获取 Access Token
window.__DEBUG__.tokenManager.getAccessToken()

// 7. 检查 Token 是否过期
window.__DEBUG__.tokenManager.isTokenExpiring()

// 8. 手动刷新 Token
await window.__DEBUG__.tokenManager.refreshAccessToken()

// 9. 手动登出
window.__DEBUG__.authStore.logout()
```

---

### 方案 2：使用完整路径

如果需要动态导入模块，使用完整的相对路径：

```javascript
// ❌ 错误：浏览器不认识 @/ 别名
const { useAuthStore } = await import('@/stores/auth')

// ✅ 正确：使用完整路径
const { useAuthStore } = await import('/src/stores/auth.ts')
const authStore = useAuthStore()
```

---

### 方案 3：使用 Vue DevTools

1. **安装 Vue DevTools**
   - Chrome: https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/

2. **使用 Pinia 面板**
   - 打开 DevTools
   - 切换到 "Pinia" 标签
   - 查看所有 store 的状态
   - 可以直接修改状态进行测试

3. **使用 Components 面板**
   - 选择使用 auth store 的组件
   - 在右侧面板查看组件的 store 状态

---

## 🧪 常用调试命令

### 查看认证状态

```javascript
// 查看是否已登录
window.__DEBUG__.authStore.isAuthenticated

// 查看当前用户信息
console.table(window.__DEBUG__.authStore.user)

// 查看用户角色
window.__DEBUG__.authStore.userRole

// 查看用户部门
window.__DEBUG__.authStore.userDepartment
```

### Token 管理

```javascript
// 获取当前 Token
const token = window.__DEBUG__.tokenManager.getAccessToken()
console.log('当前 Token:', token?.substring(0, 20) + '...')

// 检查 Token 是否有效
const isValid = window.__DEBUG__.tokenManager.hasValidToken()
console.log('Token 是否有效:', isValid)

// 检查 Token 是否即将过期（5分钟内）
const isExpiring = window.__DEBUG__.tokenManager.isTokenExpiring(5 * 60 * 1000)
console.log('Token 是否即将过期:', isExpiring)

// 获取 Token 过期时间
const expiration = window.__DEBUG__.tokenManager.getTokenExpiration()
if (expiration) {
  const expirationDate = new Date(expiration)
  console.log('Token 过期时间:', expirationDate.toLocaleString())
  console.log('距离过期还有:', Math.floor((expiration - Date.now()) / 1000 / 60), '分钟')
}
```

### 手动测试 Token 刷新

```javascript
// 1. 清空当前 Token（模拟过期）
window.__DEBUG__.tokenManager.clearAccessToken()
localStorage.removeItem('token')
console.log('✅ Token 已清空')

// 2. 尝试刷新 Token
try {
  const newToken = await window.__DEBUG__.tokenManager.refreshAccessToken()
  console.log('✅ Token 刷新成功:', newToken.substring(0, 20) + '...')
} catch (error) {
  console.error('❌ Token 刷新失败:', error.message)
}

// 3. 验证新 Token
const token = window.__DEBUG__.tokenManager.getAccessToken()
console.log('新 Token:', token?.substring(0, 20) + '...')
```

### 模拟登出

```javascript
// 清除所有认证信息
window.__DEBUG__.authStore.logout()
console.log('✅ 已登出')

// 验证登出状态
console.log('是否已登录:', window.__DEBUG__.authStore.isAuthenticated)
console.log('用户信息:', window.__DEBUG__.authStore.user)
```

---

## 🔍 监控 Token 变化

### 实时监控 Token

```javascript
// 监控 Token 变化
let lastToken = window.__DEBUG__.tokenManager.getAccessToken()
const tokenMonitor = setInterval(() => {
  const currentToken = window.__DEBUG__.tokenManager.getAccessToken()
  if (currentToken !== lastToken) {
    console.log('🔄 Token 已更新!')
    console.log('旧 Token:', lastToken?.substring(0, 20) + '...')
    console.log('新 Token:', currentToken?.substring(0, 20) + '...')
    lastToken = currentToken
  }
}, 1000)

// 停止监控
// clearInterval(tokenMonitor)
```

### 监控 Store 状态变化

```javascript
// 使用 Pinia 的 $subscribe 监听状态变化
const unsubscribe = window.__DEBUG__.authStore.$subscribe((mutation, state) => {
  console.log('🔄 Auth Store 状态变化:', mutation.type)
  console.log('新状态:', state)
})

// 停止监听
// unsubscribe()
```

---

## 🧪 测试 401 自动刷新

### 完整测试流程

```javascript
// 1. 确认当前已登录
console.log('当前登录状态:', window.__DEBUG__.authStore.isAuthenticated)

// 2. 保存当前 Token
const oldToken = window.__DEBUG__.tokenManager.getAccessToken()
console.log('当前 Token:', oldToken?.substring(0, 20) + '...')

// 3. 清空 Token（模拟过期）
window.__DEBUG__.tokenManager.clearAccessToken()
localStorage.removeItem('token')
console.log('✅ Token 已清空，模拟过期状态')

// 4. 发起一个 API 请求（会触发 401）
const axios = (await import('axios')).default
try {
  const response = await axios.get('/api/indicators', {
    headers: {
      'Authorization': `Bearer ${oldToken}`
    }
  })
  console.log('✅ 请求成功（Token 已自动刷新）:', response.data)
} catch (error) {
  console.error('❌ 请求失败:', error.message)
}

// 5. 验证 Token 是否已刷新
const newToken = window.__DEBUG__.tokenManager.getAccessToken()
console.log('新 Token:', newToken?.substring(0, 20) + '...')
console.log('Token 是否已更新:', newToken !== oldToken)
```

---

## 📊 查看网络请求

### 使用 Network 面板

1. 打开 DevTools → Network 标签
2. 筛选 XHR/Fetch 请求
3. 查找关键请求：
   - 原始请求（返回 401）
   - `/api/auth/refresh`（刷新 Token）
   - 重试的原始请求（使用新 Token）

### 查看请求详情

```javascript
// 在 Network 面板中点击请求，查看：
// - Headers: Authorization 头是否正确
// - Response: 响应状态码和内容
// - Timing: 请求耗时
```

---

## 🎓 高级调试技巧

### 1. 拦截所有 API 请求

```javascript
// 保存原始的 fetch
const originalFetch = window.fetch
window.fetch = async (...args) => {
  console.log('📤 API 请求:', args[0])
  const response = await originalFetch(...args)
  console.log('📥 API 响应:', response.status, args[0])
  return response
}

// 恢复原始 fetch
// window.fetch = originalFetch
```

### 2. 查看所有 localStorage 数据

```javascript
// 查看所有存储的数据
console.table(Object.entries(localStorage))

// 查看特定的 key
console.log('Token:', localStorage.getItem('token'))
console.log('User:', JSON.parse(localStorage.getItem('currentUser') || '{}'))
```

### 3. 查看所有 Cookie

```javascript
// 查看所有 Cookie
console.table(
  document.cookie.split(';').map(c => {
    const [key, value] = c.trim().split('=')
    return { key, value }
  })
)

// 注意：HttpOnly Cookie 无法通过 JavaScript 访问
// 需要在 Application → Cookies 面板查看
```

---

## 🚨 注意事项

1. **生产环境不可用**
   - `window.__DEBUG__` 只在开发环境（`npm run dev`）中可用
   - 生产环境不会暴露这些调试工具

2. **HttpOnly Cookie**
   - Refresh Token 存储在 HttpOnly Cookie 中
   - 无法通过 JavaScript 访问
   - 需要在 DevTools → Application → Cookies 中查看

3. **安全性**
   - 不要在生产环境暴露调试工具
   - 不要在控制台输出完整的 Token
   - 不要将 Token 复制到不安全的地方

---

## 📚 相关文档

- **测试指南：** `TOKEN_REFRESH_TEST_GUIDE.md`
- **快速参考：** `TOKEN_REFRESH_QUICK_REFERENCE.md`
- **实施总结：** `Token无感刷新实施总结.md`

---

**最后更新：** 2026-03-06
