# Token 无感刷新功能测试指南

## 🎯 测试目标

验证 401 错误后自动刷新 Token 并重试原请求的功能是否正常工作。

---

## 🧪 测试场景

### 场景 1：Access Token 过期，Refresh Token 有效 ✅

**目标：** 验证 Token 过期后能自动刷新并继续操作，用户无感知

**步骤：**

1. **登录系统**
   ```
   - 访问 http://localhost:5173/login
   - 使用有效账号登录（如：admin / admin123）
   ```

2. **模拟 Token 过期**
   
   方法 A：等待 Token 自然过期（如果配置为 15 分钟）
   
   方法 B：手动修改 Token（推荐，快速测试）
   ```javascript
   // 在浏览器控制台执行
   // 1. 查看当前 token
   console.log('当前 Token:', localStorage.getItem('token'))
   
   // 2. 生成一个过期的 token（修改过期时间）
   // 注意：这只是模拟，实际需要后端返回 401
   
   // 3. 或者直接清空内存中的 token，保留 refresh token cookie
   // 刷新页面，系统会尝试用 refresh token 恢复
   ```

3. **执行操作**
   ```
   - 点击"战略任务管理"
   - 尝试创建或编辑指标
   - 点击"保存"按钮
   ```

4. **预期结果**
   ```
   ✅ 操作成功完成
   ✅ 没有跳转到登录页
   ✅ 没有显示"登录已过期"提示
   ✅ 控制台显示：
      - 🔒 [API Auth] 401 未授权
      - 🔄 [API Auth] 尝试刷新 Token...
      - ✅ [API Auth] Token 刷新成功，重试原请求
   ```

---

### 场景 2：Access Token 和 Refresh Token 都过期 ❌

**目标：** 验证 Refresh Token 过期后正确跳转登录页

**步骤：**

1. **清除所有认证信息**
   ```javascript
   // 在浏览器控制台执行
   localStorage.clear()
   // 手动删除所有 Cookie（或使用开发者工具）
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "")
       .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```

2. **刷新页面**
   ```
   - 按 F5 或点击刷新按钮
   ```

3. **尝试访问受保护页面**
   ```
   - 直接访问 http://localhost:5173/strategic-tasks
   ```

4. **预期结果**
   ```
   ✅ 显示"登录已过期，请重新登录"提示
   ✅ 自动跳转到登录页 (/login)
   ✅ 控制台显示：
      - 🔒 [API Auth] 401 未授权
      - 🔄 [API Auth] 尝试刷新 Token...
      - ❌ [API Auth] Token 刷新失败
   ```

---

### 场景 3：并发请求处理 🔄

**目标：** 验证多个请求同时返回 401 时，只刷新一次 Token

**步骤：**

1. **登录系统**

2. **模拟 Token 过期**

3. **同时发起多个请求**
   ```javascript
   // 在浏览器控制台执行
   const api = axios.create({ baseURL: '/api' })
   
   // 同时发起 3 个请求
   Promise.all([
     api.get('/indicators'),
     api.get('/tasks'),
     api.get('/milestones')
   ]).then(results => {
     console.log('所有请求成功:', results)
   }).catch(error => {
     console.error('请求失败:', error)
   })
   ```

4. **预期结果**
   ```
   ✅ 所有请求都成功返回数据
   ✅ 只刷新了一次 Token（通过 tokenManager 的并发锁）
   ✅ 控制台显示：
      - 🔄 [API Auth] 尝试刷新 Token...（只出现一次）
      - ✅ [API Auth] Token 刷新成功，重试原请求（出现 3 次）
   ```

---

### 场景 4：登录请求失败不触发刷新 🚫

**目标：** 验证登录请求返回 401 时不会触发 Token 刷新

**步骤：**

1. **访问登录页**

2. **使用错误的密码登录**
   ```
   - 用户名：admin
   - 密码：wrongpassword
   ```

3. **预期结果**
   ```
   ✅ 显示"用户名或密码错误"提示
   ✅ 不会尝试刷新 Token
   ✅ 不会跳转到其他页面
   ✅ 控制台显示：
      - 🔒 [API Auth] 登录/刷新请求失败，不尝试刷新
   ```

---

## 🔍 调试技巧

### 1. 查看网络请求

打开浏览器开发者工具 → Network 标签页

**关键请求：**
- 原始请求（返回 401）
- `/api/auth/refresh` 请求（刷新 Token）
- 重试的原始请求（使用新 Token）

### 2. 查看控制台日志

关键日志标识：
```
🔒 [API Auth] 401 未授权
🔄 [API Auth] 尝试刷新 Token...
✅ [API Auth] Token 刷新成功，重试原请求
❌ [API Auth] Token 刷新失败
```

### 3. 查看 Token 变化

```javascript
// 在控制台监听 token 变化
let oldToken = localStorage.getItem('token')
setInterval(() => {
  const newToken = localStorage.getItem('token')
  if (newToken !== oldToken) {
    console.log('Token 已更新!')
    console.log('旧 Token:', oldToken?.substring(0, 20) + '...')
    console.log('新 Token:', newToken?.substring(0, 20) + '...')
    oldToken = newToken
  }
}, 1000)
```

### 4. 查看 Cookie

开发者工具 → Application → Cookies → http://localhost:5173

查找：`refresh_token` Cookie（HttpOnly）

---

## 📊 测试结果记录

### 测试环境
- 浏览器：_____________
- 前端版本：_____________
- 后端版本：_____________
- 测试日期：_____________

### 测试结果

| 场景 | 状态 | 备注 |
|------|------|------|
| 场景 1：Token 过期自动刷新 | ⬜ 通过 / ⬜ 失败 | |
| 场景 2：Refresh Token 过期 | ⬜ 通过 / ⬜ 失败 | |
| 场景 3：并发请求处理 | ⬜ 通过 / ⬜ 失败 | |
| 场景 4：登录失败不刷新 | ⬜ 通过 / ⬜ 失败 | |

---

## 🐛 常见问题

### Q1: 刷新 Token 失败，提示 "Refresh token not found"

**原因：** Refresh Token Cookie 未设置或已过期

**解决：**
1. 检查后端是否正确设置了 HttpOnly Cookie
2. 检查 Cookie 的 Domain 和 Path 设置
3. 重新登录获取新的 Refresh Token

### Q2: 无限刷新循环

**原因：** `_retry` 标记未正确设置

**解决：**
1. 检查 `originalRequest._retry = true` 是否执行
2. 检查是否有其他拦截器干扰

### Q3: 刷新成功但原请求仍然失败

**原因：** Authorization 头未正确更新

**解决：**
1. 检查 `originalRequest.headers.Authorization` 是否正确设置
2. 检查是否使用了正确的 axios 实例

---

## 🎓 学习要点

### 1. Token 刷新流程

```
401 错误 → 检查是否已重试 → 调用刷新接口 → 更新 Token → 重试原请求
```

### 2. 防止无限循环

使用 `_retry` 标记确保每个请求最多只刷新一次

### 3. 并发刷新控制

tokenManager 内部使用 `refreshPromise` 确保多个请求共享同一个刷新过程

### 4. 安全考虑

- Access Token 存储在内存中（防止 XSS）
- Refresh Token 存储在 HttpOnly Cookie（防止 XSS）
- Token 轮换机制（防止重放攻击）

---

## 📝 测试完成后

- [ ] 所有测试场景通过
- [ ] 记录测试结果
- [ ] 更新相关文档
- [ ] 通知团队成员新功能已上线
