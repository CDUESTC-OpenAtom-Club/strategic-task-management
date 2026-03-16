# 单元测试与集成测试方案

## 概述

架构重构过程中需要建立完整的测试策略，确保：
1. 现有功能不被破坏
2. 代码质量得到保障
3. 重构过程可追踪
4. 测试覆盖率达标

---

## 测试架构设计

### 目标测试目录结构

```
tests/
├── setup.ts                    # 测试环境配置
├── unit/                       # 单元测试
│   ├── 1-app/                  # 应用入口测试
│   │   ├── main.test.ts
│   │   ├── providers/
│   │   │   ├── with-router.test.ts
│   │   │   ├── with-pinia.test.ts
│   │   │   └── with-error-handler.test.ts
│   │   └── layouts/
│   │       └── MainLayout.test.ts
│   ├── 2-pages/                # 页面组件测试
│   │   ├── dashboard/
│   │   │   └── ui/
│   │   │       └── DashboardPage.test.ts
│   │   ├── auth/
│   │   │   └── ui/
│   │   │       └── LoginPage.test.ts
│   │   ├── strategy/
│   │   │   ├── plans/
│   │   │   ├── indicators/
│   │   │   └── tasks/
│   │   ├── admin/
│   │   ├── approval/
│   │   ├── messages/
│   │   ├── profile/
│   │   └── error/
│   ├── 3-features/             # 功能模块测试
│   │   ├── auth/
│   │   │   ├── ui/
│   │   │   │   ├── LoginForm.test.ts
│   │   │   │   └── UserProfile.test.ts
│   │   │   ├── model/
│   │   │   │   └── store.test.ts
│   │   │   ├── api/
│   │   │   │   ├── auth.test.ts
│   │   │   │   └── user.test.ts
│   │   │   └── lib/
│   │   │       └── permissions.test.ts
│   │   ├── indicator/
│   │   ├── plan/
│   │   ├── milestone/
│   │   ├── task/
│   │   ├── approval/
│   │   ├── messages/
│   │   ├── dashboard/
│   │   ├── user/
│   │   ├── admin/
│   │   ├── organization/
│   │   └── profile/
│   ├── 4-entities/             # 实体层测试
│   │   ├── user/
│   │   │   └── model/
│   │   │       ├── user.types.test.ts
│   │   │       └── user.constants.test.ts
│   │   ├── indicator/
│   │   ├── organization/
│   │   └── ...
│   ├── 5-shared/               # 共享资源测试
│   │   ├── ui/
│   │   │   ├── form/
│   │   │   ├── layout/
│   │   │   ├── charts/
│   │   │   ├── message/
│   │   │   ├── feedback/
│   │   │   ├── table/
│   │   │   ├── display/
│   │   │   └── error/
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── client.test.ts
│   │   │   │   ├── retry.test.ts
│   │   │   │   └── error-handler.test.ts
│   │   │   ├── auth/
│   │   │   │   └── token.test.ts
│   │   │   ├── utils/
│   │   │   │   ├── date.test.ts
│   │   │   │   └── validation.test.ts
│   │   │   └── hooks/
│   │   │       ├── usePermission.test.ts
│   │   │       └── useECharts.test.ts
│   │   ├── config/
│   │   ├── constants/
│   │   └── types/
│   └── 6-processes/            # 流程测试
│       ├── approval/
│       │   └── ui/
│       │       └── ApprovalWorkflow.test.ts
│       ├── messaging/
│       ├── directives/
│       └── mock/
├── integration/                # 集成测试
│   ├── api/
│   │   ├── auth.integration.test.ts
│   │   ├── indicator.integration.test.ts
│   │   ├── plan.integration.test.ts
│   │   └── ...
│   ├── routes/
│   │   ├── router-integration.test.ts
│   │   └── ...
│   ├── features/
│   │   ├── auth-flow.integration.test.ts
│   │   ├── indicator-management.integration.test.ts
│   │   └── ...
│   └── state/
│       └── state-integration.test.ts
├── property/                   # 基于属性的测试（已存在）
│   ├── api-path-consistency.property.test.ts
│   ├── milestone-date-judgment.property.test.ts
│   └── ...
├── e2e/                        # E2E 测试（待实现）
│   ├── auth-flow.spec.ts
│   ├── dashboard.spec.ts
│   └── ...
└── helpers/                    # 测试辅助工具
    ├── mocks/
    │   ├── api.mock.ts
    │   └── store.mock.ts
    ├── factories/
    │   ├── indicator.factory.ts
    │   └── user.factory.ts
    ├── fixtures/
    │   ├── indicator.fixture.ts
    │   └── user.fixture.ts
    └── testCredentials.ts
```

---

## 测试策略

### 1. 单元测试策略

#### 范围
- 纯函数测试
- 工具函数测试
- 组件渲染测试（不包含业务逻辑）
- Store 逻辑测试
- API 模块单元测试

#### 覆盖率目标
- 单元测试整体覆盖率：≥ 70%
- 业务逻辑覆盖率：≥ 85%
- 工具函数覆盖率：≥ 90%

#### 测试用例示例

```typescript
// tests/unit/5-shared/lib/utils/date.test.ts
import { formatDate, isDateExpired } from '@/5-shared/lib/utils/date'

describe('date utils', () => {
  describe('formatDate', () => {
    it('should format date correctly with default format', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date)).toBe('2024-01-15')
    })

    it('should format date with custom format', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024')
    })
  })

  describe('isDateExpired', () => {
    it('should return true when date is in past', () => {
      const pastDate = new Date(Date.now() - 86400000) // yesterday
      expect(isDateExpired(pastDate)).toBe(true)
    })

    it('should return false when date is in future', () => {
      const futureDate = new Date(Date.now() + 86400000) // tomorrow
      expect(isDateExpired(futureDate)).toBe(false)
    })
  })
})

// tests/unit/3-features/indicator/model/store.test.ts
import { setActivePinia, createPinia } from 'pinia'
import { useIndicatorStore } from '@/3-features/indicator/model/store'
import { createTestingPinia } from '@pinia/testing'

describe('Indicator Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty indicators', () => {
    const store = useIndicatorStore()
    expect(store.indicators).toHaveLength(0)
    expect(store.isLoading).toBe(false)
  })

  it('should set indicators correctly', () => {
    const store = useIndicatorStore()
    const mockIndicators = [{ id: 1, name: 'Test Indicator' }]
    store.setIndicators(mockIndicators)
    expect(store.indicators).toEqual(mockIndicators)
  })
})

// tests/unit/3-features/auth/lib/permissions.test.ts
import { hasPermission, canEditIndicator } from '@/3-features/auth/lib/permissions'

describe('permissions', () => {
  describe('hasPermission', () => {
    it('should return true when user has required permission', () => {
      const user = { roles: ['admin'], permissions: ['indicator:edit'] }
      expect(hasPermission(user, 'indicator:edit')).toBe(true)
    })

    it('should return false when user does not have required permission', () => {
      const user = { roles: ['viewer'], permissions: ['indicator:read'] }
      expect(hasPermission(user, 'indicator:edit')).toBe(false)
    })
  })
})
```

### 2. 集成测试策略

#### 范围
- API 调用与状态管理集成
- 路由跳转与页面渲染集成
- 多功能模块协作
- 跨组件数据流

#### 覆盖率目标
- 集成测试整体覆盖率：≥ 30%
- 核心流程覆盖率：≥ 50%

#### 测试用例示例

```typescript
// tests/integration/api/auth.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/3-features/auth/model/store'
import { login } from '@/3-features/auth/api/auth'
import { apiClient } from '@/5-shared/lib/api/client'

vi.mock('@/5-shared/lib/api/client')

describe('Auth Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('should complete login flow successfully', async () => {
    const store = useAuthStore()
    const mockResponse = {
      data: {
        token: 'mock-token',
        user: { id: 1, name: 'Test User' }
      }
    }

    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse)

    // 执行登录
    await store.login({ username: 'test', password: 'test123' })

    // 验证状态更新
    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toEqual(mockResponse.data.user)
    expect(store.token).toEqual(mockResponse.data.token)
  })
})

// tests/integration/routes/router-integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '@/1-app/providers/with-router'
import { setActivePinia, createPinia } from 'pinia'

describe('Router Integration', () => {
  let router: any

  beforeEach(() => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createWebHistory(),
      routes: routes
    })
  })

  it('should navigate to dashboard when user is authenticated', async () => {
    router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/login')

    // 模拟登录
    // ... 认证逻辑

    // 验证路由跳转
    router.push('/dashboard')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })
})
```

### 3. 组件测试策略

使用 Vue Test Utils 进行组件测试：

```typescript
// tests/unit/3-features/auth/ui/LoginForm.test.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import LoginForm from '@/3-features/auth/ui/LoginForm.vue'
import { ElementPlus } from 'element-plus'

describe('LoginForm', () => {
  it('renders login form correctly', () => {
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [ElementPlus]
      }
    })
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('input[name="username"]').exists()).toBe(true)
    expect(wrapper.find('input[name="password"]').exists()).toBe(true)
  })

  it('emits login event with form data', async () => {
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [ElementPlus]
      }
    })

    await wrapper.find('input[name="username"]').setValue('testuser')
    await wrapper.find('input[name="password"]').setValue('testpass')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('login')).toBeTruthy()
    expect(wrapper.emitted('login')![0]).toEqual([{
      username: 'testuser',
      password: 'testpass'
    }])
  })
})
```

---

## 测试配置更新

### 1. vitest.config.ts 更新

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec,property.test}.{js,ts}',
      'src/**/*.{test,spec,property.test}.{js,ts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/1-app/**',
        'src/2-pages/**',
        'src/3-features/**',
        'src/4-entities/**',
        'src/5-shared/**',
        'src/6-processes/**'
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.property.test.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/*.d.ts',
        '**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/1-app': fileURLToPath(new URL('./src/1-app', import.meta.url)),
      '@/2-pages': fileURLToPath(new URL('./src/2-pages', import.meta.url)),
      '@/3-features': fileURLToPath(new URL('./src/3-features', import.meta.url)),
      '@/4-entities': fileURLToPath(new URL('./src/4-entities', import.meta.url)),
      '@/5-shared': fileURLToPath(new URL('./src/5-shared', import.meta.url)),
      '@/6-processes': fileURLToPath(new URL('./src/6-processes', import.meta.url))
    }
  }
})
```

### 2. package.json 更新

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:property": "vitest run tests/property/",
    "test:coverage": "vitest run --coverage",
    "test:coverage:report": "vitest run --coverage && open coverage/index.html",
    "test:update-snapshots": "vitest run --update"
  }
}
```

---

## 测试迁移与重写计划

### 第一阶段：测试基础设施

1. 创建新的测试目录结构
2. 更新 vitest.config.ts 配置
3. 创建测试辅助工具
4. 建立测试数据工厂

### 第二阶段：现有测试迁移

1. 迁移 unit 测试到对应目录
2. 更新导入路径
3. 修复测试用例问题
4. 确保现有测试通过

### 第三阶段：新增测试

1. 补充缺失的单元测试
2. 增加集成测试
3. 添加组件测试
4. 实现 E2E 测试框架

---

## 测试工具与辅助库

### 推荐工具

| 工具 | 用途 | 安装命令 |
|------|------|----------|
| Vue Test Utils | Vue 组件测试 | `npm install -D @vue/test-utils` |
| Pinia Testing | Pinia Store 测试 | `npm install -D @pinia/testing` |
| Playwright | E2E 测试 | `npm install -D @playwright/test` |
| fast-check | 基于属性的测试 | `已安装` |

### 测试辅助函数

```typescript
// tests/helpers/mocks/api.mock.ts
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

// tests/helpers/factories/indicator.factory.ts
import { Indicator } from '@/4-entities/indicator/model/indicator.types'

export function createIndicator(overrides: Partial<Indicator> = {}): Indicator {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: 'Test Indicator',
    code: 'TEST-001',
    type: 'quantitative',
    status: 'draft',
    ...overrides
  }
}

// tests/helpers/fixtures/indicator.fixture.ts
export const indicatorFixture = {
  indicators: [
    { id: '1', name: 'Indicator 1', status: 'active' },
    { id: '2', name: 'Indicator 2', status: 'draft' }
  ]
}
```

---

## 测试执行与报告

### 1. 本地执行

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npx vitest run tests/unit/3-features/auth/

# 运行并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 2. CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test:coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## 测试质量标准

### 通过率

- 所有测试通过：✅
- 测试通过率 ≥ 99%

### 覆盖率

- 单元测试覆盖率 ≥ 70%
- 集成测试覆盖率 ≥ 30%
- 总体覆盖率 ≥ 80%

### 性能

- 测试套件执行时间 ≤ 5 分钟
- 单个测试 ≤ 5 秒（超时时间可配置）

### 可维护性

- 测试代码清晰、有描述性
- 避免重复代码（使用辅助函数）
- 测试数据统一管理（使用工厂模式）

---

## 测试策略总结

| 测试类型 | 目录 | 覆盖率目标 | 重点 |
|---------|------|-----------|------|
| 单元测试 | tests/unit/ | 70%+ | 纯函数、工具函数、组件渲染、Store |
| 集成测试 | tests/integration/ | 30%+ | API、路由、多模块协作 |
| 基于属性的测试 | tests/property/ | 现有保持 | 数据一致性、边界条件 |
| E2E 测试 | tests/e2e/ | 待实现 | 完整用户流程 |