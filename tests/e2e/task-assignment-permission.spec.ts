/**
 * Task Assignment Permission E2E Tests
 *
 * Tests the permission control for the strategic task assignment page.
 * Verifies that users with different roles are properly routed based on their permissions.
 *
 * Test Scenarios:
 * 1. Unauthenticated user accessing /strategic-tasks -> redirect to /login
 * 2. functional_dept user accessing /strategic-tasks -> redirect to /dashboard
 * 3. secondary_college user accessing /strategic-tasks -> redirect to /dashboard
 * 4. strategic_dept user accessing /strategic-tasks -> success
 * 5. Permission denied page shows correct information
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? ''

// Test account credentials from CLAUDE.md
const TEST_ACCOUNTS = {
  strategic: {
    username: 'admin',
    password: TEST_PASSWORD,
    role: 'strategic_dept',
    displayName: '战略发展部'
  },
  functional: {
    username: 'jiaowu_report',
    password: TEST_PASSWORD,
    role: 'functional_dept',
    displayName: '职能部门'
  },
  college: {
    username: 'jisuanji_report',
    password: TEST_PASSWORD,
    role: 'secondary_college',
    displayName: '二级学院'
  }
}

/**
 * Helper function to login with given credentials
 */
async function loginAs(page: Page, account: { username: string; password: string }) {
  if (!account.password) {
    throw new Error('E2E_TEST_PASSWORD is required for task assignment permission tests')
  }

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Fill login form
  const accountInput = page.locator('#login-account, input[aria-label="账号"]')
  const passwordInput = page.locator('#login-password, input[aria-label="密码"]')

  await accountInput.fill(account.username)
  await passwordInput.fill(account.password)

  // Submit form (target the primary 登录 button specifically — avoid the 忘记密码 link button)
  const submitButton = page
    .locator('.login-form .login-btn, button.login-btn, button[type="submit"]')
    .first()
  await submitButton.click()

  // Wait for navigation to complete
  await page.waitForURL(/\/(dashboard|strategic-tasks)/, { timeout: 10000 })
}

/**
 * Helper function to clear auth state
 */
async function clearAuth(page: Page) {
  // Navigate to app origin first so localStorage/sessionStorage are accessible.
  // Calling page.evaluate on the initial about:blank page throws SecurityError.
  if (page.url() === 'about:blank' || !page.url().startsWith('http')) {
    await page.goto('/login')
  }
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {
      // ignore — storage may not be available in some contexts
    }
  })
}

test.describe('Task Assignment Permission Control', () => {
  test.describe('Unauthenticated Access', () => {
    test('should redirect to login when accessing /strategic-tasks without auth', async ({
      page
    }) => {
      // Clear any existing auth state
      await clearAuth(page)

      // Try to access the strategic tasks page
      await page.goto('/strategic-tasks')

      // Should be redirected to login
      await page.waitForURL('/login', { timeout: 5000 })
      expect(page.url()).toContain('/login')
    })

    test('should show login page with correct form elements', async ({ page }) => {
      await clearAuth(page)
      await page.goto('/login')

      // Verify login form elements exist
      await expect(page.locator('#login-account, input[aria-label="账号"]')).toBeVisible()
      await expect(page.locator('#login-password, input[aria-label="密码"]')).toBeVisible()

      // Verify page title
      await expect(page).toHaveTitle(/登录/)
    })
  })

  test.describe('Wrong Role Access', () => {
    test('should redirect functional_dept user to dashboard when accessing /strategic-tasks', async ({
      page
    }) => {
      // Login as functional department user
      await loginAs(page, TEST_ACCOUNTS.functional)

      // Verify we're on dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })

      // Try to navigate to strategic tasks
      await page.goto('/strategic-tasks')

      // Should be redirected back to dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })
      expect(page.url()).toContain('/dashboard')
    })

    test('should redirect secondary_college user to dashboard when accessing /strategic-tasks', async ({
      page
    }) => {
      // Login as secondary college user
      await loginAs(page, TEST_ACCOUNTS.college)

      // Verify we're on dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })

      // Try to navigate to strategic tasks
      await page.goto('/strategic-tasks')

      // Should be redirected back to dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })
      expect(page.url()).toContain('/dashboard')
    })

    test('should show 403 page when accessing admin console without permission', async ({
      page
    }) => {
      // Login as functional department user
      await loginAs(page, TEST_ACCOUNTS.functional)

      // Try to access admin console
      await page.goto('/admin/console')

      // Should be redirected to 403 or dashboard
      await page.waitForURL(/\/(403|dashboard)/, { timeout: 5000 })

      // If on 403 page, verify content
      if (page.url().includes('/403')) {
        await expect(page.locator('.error-code, .error-title').first()).toContainText('403')
        await expect(page.locator('.error-desc, .error-message').first()).toContainText(/权限/)
      }
    })
  })

  test.describe('Correct Role Access', () => {
    test('should allow strategic_dept user to access /strategic-tasks', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)

      // Wait for navigation to strategic tasks
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Verify we're on the strategic tasks page
      expect(page.url()).toContain('/strategic-tasks')

      // Verify page content is loaded
      await page.waitForLoadState('networkidle')

      // Check for key elements on the strategic tasks page
      const pageContent = page.locator('.strategic-task-container, .task-detail, .excel-style')
      await expect(pageContent.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display department list in sidebar for strategic_dept user', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Wait for sidebar to load
      const sidebar = page.locator('.task-sidebar, .sidebar-header')
      await expect(sidebar.first()).toBeVisible({ timeout: 10000 })

      // Verify department list exists
      const departmentList = page.locator('.task-list, .task-item')
      await expect(departmentList.first()).toBeVisible({ timeout: 5000 })
    })

    test('should display toolbar with action buttons for strategic_dept user', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Wait for toolbar to load
      const toolbar = page.locator('.excel-toolbar')
      await expect(toolbar).toBeVisible({ timeout: 10000 })

      // Verify key toolbar buttons exist
      const addButton = page.locator('button:has-text("新增行")')
      await expect(addButton).toBeVisible({ timeout: 5000 })
    })

    test('should display table with indicators for strategic_dept user', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Wait for table to load (may take time for API calls)
      const table = page.locator('.el-table, .table-container')
      await expect(table.first()).toBeVisible({ timeout: 15000 })

      // Verify table headers exist
      const headers = page.locator('.el-table__header th')
      await expect(headers.first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Permission Denied Page', () => {
    test('should show correct 403 page content', async ({ page }) => {
      await clearAuth(page)

      // Navigate directly to 403 page
      await page.goto('/403')

      // Verify 403 page elements
      await expect(page.locator('.error-code')).toContainText('403')
      await expect(page.locator('.error-title')).toContainText(/访问被拒绝|权限/)
      await expect(page.locator('.error-desc')).toContainText(/权限/)

      // Verify action buttons exist
      await expect(page.locator('button:has-text("返回上一页")')).toBeVisible()
      await expect(page.locator('button:has-text("回到首页")')).toBeVisible()
    })

    test('should have working back button on 403 page', async ({ page }) => {
      // First visit a valid page
      await clearAuth(page)
      await page.goto('/login')

      // Then navigate to 403
      await page.goto('/403')

      // Click back button
      await page.locator('button:has-text("返回上一页")').click()

      // Should navigate back to login
      await page.waitForURL('/login', { timeout: 5000 })
    })

    test('should have working home button on 403 page', async ({ page }) => {
      // Login first so we can access dashboard
      await loginAs(page, TEST_ACCOUNTS.strategic)

      // Navigate to 403
      await page.goto('/403')

      // Click home button
      await page.locator('button:has-text("回到首页")').click()

      // Should navigate to dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })
    })

    test('should show login button for unauthenticated users on 403 page', async ({ page }) => {
      await clearAuth(page)

      // Navigate to 403
      await page.goto('/403')

      // Should show login button for unauthenticated users
      const loginButton = page.locator('button:has-text("去登录")')
      await expect(loginButton).toBeVisible({ timeout: 5000 })

      // Click login button
      await loginButton.click()

      // Should navigate to login
      await page.waitForURL('/login', { timeout: 5000 })
    })

    test('should show role information on 403 page for authenticated users', async ({ page }) => {
      // Login as functional user
      await loginAs(page, TEST_ACCOUNTS.functional)

      // Navigate to 403
      await page.goto('/403')

      // Should show current role information
      const roleInfo = page.locator('.el-alert, .error-detail')
      await expect(roleInfo.first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Cross-Role Navigation', () => {
    test('functional_dept user should see indicator list but not strategic tasks', async ({
      page
    }) => {
      // Login as functional department user
      await loginAs(page, TEST_ACCOUNTS.functional)

      // Should be on dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })

      // Should be able to access indicators page
      await page.goto('/indicators')
      await page.waitForURL('/indicators', { timeout: 5000 })
      expect(page.url()).toContain('/indicators')

      // But not strategic tasks
      await page.goto('/strategic-tasks')
      await page.waitForURL('/dashboard', { timeout: 5000 })
      expect(page.url()).toContain('/dashboard')
    })

    test('secondary_college user should see dashboard but not strategic tasks', async ({
      page
    }) => {
      // Login as secondary college user
      await loginAs(page, TEST_ACCOUNTS.college)

      // Should be on dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })

      // Try to access strategic tasks
      await page.goto('/strategic-tasks')

      // Should be redirected to dashboard
      await page.waitForURL('/dashboard', { timeout: 5000 })
      expect(page.url()).toContain('/dashboard')
    })

    test('strategic_dept user should access both strategic tasks and indicators', async ({
      page
    }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)

      // Should be on strategic tasks
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Should be able to access indicators
      await page.goto('/indicators')
      await page.waitForURL('/indicators', { timeout: 5000 })
      expect(page.url()).toContain('/indicators')

      // Should be able to go back to strategic tasks
      await page.goto('/strategic-tasks')
      await page.waitForURL('/strategic-tasks', { timeout: 5000 })
      expect(page.url()).toContain('/strategic-tasks')
    })
  })

  test.describe('Session Persistence', () => {
    test('should maintain auth state after page refresh', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Refresh the page
      await page.reload()

      // Should still be on strategic tasks (not redirected to login)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })
      expect(page.url()).toContain('/strategic-tasks')
    })

    test('should clear auth state on logout', async ({ page }) => {
      // Login as strategic department user
      await loginAs(page, TEST_ACCOUNTS.strategic)
      await page.waitForURL('/strategic-tasks', { timeout: 10000 })

      // Clear auth (simulate logout)
      await clearAuth(page)

      // Try to access strategic tasks again
      await page.goto('/strategic-tasks')

      // Should be redirected to login
      await page.waitForURL('/login', { timeout: 5000 })
    })
  })
})
