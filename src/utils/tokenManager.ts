/**
 * Token 管理器
 * 
 * 功能:
 * - Access Token 存储在内存中，不持久化到 localStorage (XSS 防护)
 * - Refresh Token 通过 HttpOnly Cookie 管理 (由后端设置)
 * - 自动检测 Token 过期并刷新
 * - 页面刷新后通过 Refresh Token 恢复会话
 * 
 * **Validates: Requirements 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5**
 */

import axios from 'axios'
import { logger } from './logger'

/**
 * Token 管理器接口
 */
export interface TokenManager {
  /** 获取 Access Token */
  getAccessToken(): string | null
  /** 设置 Access Token */
  setAccessToken(token: string): void
  /** 清除 Access Token */
  clearAccessToken(): void
  /** 通过 Refresh Token 刷新 Access Token */
  refreshAccessToken(): Promise<string>
  /** 检查 Token 是否即将过期 */
  isTokenExpiring(thresholdMs?: number): boolean
  /** 获取 Token 过期时间 (毫秒时间戳) */
  getTokenExpiration(): number | null
  /** 检查是否有有效的 Token */
  hasValidToken(): boolean
}

/**
 * JWT Payload 结构
 */
type JwtPayload = {
  exp?: number  // 过期时间 (Unix 时间戳，秒)
  iat?: number  // 签发时间
  sub?: string  // 主题 (通常是用户ID)
  [key: string]: unknown
}

/**
 * 刷新 Token 响应结构
 */
type RefreshTokenResponse = {
  code: number
  message: string
  data: {
    token: string
    expiresIn: number
    user: {
      userId: number
      username: string
      realName: string
      orgId: number
      orgName: string
      orgType: string
    }
  }
}

/**
 * Token 刷新失败错误
 */
export class TokenRefreshError extends Error {
  readonly statusCode: number | undefined
  readonly shouldRedirectToLogin: boolean
  
  constructor(
    message: string,
    statusCode?: number,
    shouldRedirectToLogin: boolean = true
  ) {
    super(message)
    this.name = 'TokenRefreshError'
    this.statusCode = statusCode
    this.shouldRedirectToLogin = shouldRedirectToLogin
  }
}

/**
 * 默认刷新阈值: 5 分钟 (毫秒)
 */
const DEFAULT_REFRESH_THRESHOLD_MS = 5 * 60 * 1000

/**
 * 解析 JWT Token 获取 Payload
 * 
 * @param token JWT Token 字符串
 * @returns 解析后的 Payload 或 null
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    // JWT 格式: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      logger.warn('[TokenManager] Invalid JWT format: expected 3 parts')
      return null
    }

    // Base64Url 解码 payload
    const payloadPart = parts[1]
    if (!payloadPart) {
      return null
    }
    // 处理 Base64Url 编码 (替换 - 为 +, _ 为 /)
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    // 添加 padding
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    
    const decoded = atob(padded)
    return JSON.parse(decoded) as JwtPayload
  } catch (error) {
    logger.warn('[TokenManager] Failed to parse JWT payload:', error)
    return null
  }
}

/**
 * 从 JWT Token 获取过期时间
 * 
 * @param token JWT Token 字符串
 * @returns 过期时间 (毫秒时间戳) 或 null
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') {
    return null
  }
  // exp 是秒级时间戳，转换为毫秒
  return payload.exp * 1000
}

/**
 * 检查 Token 是否已过期
 * 
 * @param token JWT Token 字符串
 * @returns 是否已过期
 */
export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpirationTime(token)
  if (expiration === null) {
    // 无法解析过期时间，视为已过期
    return true
  }
  return Date.now() >= expiration
}

/**
 * 扩展的 Token 管理器接口 (包含测试辅助方法)
 */
export interface ExtendedTokenManager extends TokenManager {
  /** 内部方法: 用于测试时模拟刷新 */
  _setRefreshHandler: (handler: (() => Promise<string>) | null) => void
  /** 内部方法: 获取当前存储的 Token (仅用于测试) */
  _getStoredToken: () => string | null
  /** 内部方法: 重置状态 */
  _reset: () => void
}

/**
 * 创建 Token 管理器实例
 * 
 * Access Token 存储在闭包变量中，不暴露到全局作用域，
 * 也不存储到 localStorage，防止 XSS 攻击窃取。
 */
function createTokenManager(): ExtendedTokenManager {
  // Access Token 存储在闭包中 (内存存储)
  // 重要: 不要将此变量暴露到全局作用域或 localStorage
  let accessToken: string | null = null
  
  // 刷新锁，防止并发刷新
  let isRefreshing = false
  let refreshPromise: Promise<string> | null = null
  
  // 用于测试的自定义刷新处理器
  let customRefreshHandler: (() => Promise<string>) | null = null

  /**
   * 获取 Access Token
   */
  const getAccessToken = (): string | null => {
    return accessToken
  }

  /**
   * 设置 Access Token
   * 
   * 注意: 此方法只将 Token 存储在内存中，
   * 不会持久化到 localStorage 或其他存储。
   * 
   * @param token Access Token 字符串
   */
  const setAccessToken = (token: string): void => {
    accessToken = token
    logger.debug('[TokenManager] Access Token 已设置 (内存存储)')
    
    // 安全检查: 确保不会意外存储到 localStorage
    // 这是一个防御性检查，正常情况下不应该触发
    if (typeof localStorage !== 'undefined') {
      // 主动清除可能存在的旧 Token
      localStorage.removeItem('access_token')
      localStorage.removeItem('accessToken')
    }
  }

  /**
   * 清除 Access Token
   */
  const clearAccessToken = (): void => {
    accessToken = null
    logger.debug('[TokenManager] Access Token 已清除')
    
    // 安全检查: 确保 localStorage 中也没有 Token
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('accessToken')
    }
  }

  /**
   * 获取 Token 过期时间
   * 
   * @returns 过期时间 (毫秒时间戳) 或 null
   */
  const getTokenExpiration = (): number | null => {
    if (!accessToken) {
      return null
    }
    return getTokenExpirationTime(accessToken)
  }

  /**
   * 检查 Token 是否即将过期
   * 
   * @param thresholdMs 过期阈值 (毫秒)，默认 5 分钟
   * @returns 是否即将过期
   */
  const isTokenExpiring = (thresholdMs: number = DEFAULT_REFRESH_THRESHOLD_MS): boolean => {
    if (!accessToken) {
      return true // 没有 Token 视为已过期
    }
    
    const expiration = getTokenExpirationTime(accessToken)
    if (expiration === null) {
      return true // 无法解析过期时间，视为已过期
    }
    
    // 检查是否在阈值时间内过期
    return Date.now() + thresholdMs >= expiration
  }

  /**
   * 检查是否有有效的 Token
   * 
   * @returns 是否有有效的 Token
   */
  const hasValidToken = (): boolean => {
    if (!accessToken) {
      return false
    }
    return !isTokenExpired(accessToken)
  }

  /**
   * 通过 Refresh Token 刷新 Access Token
   * 
   * Refresh Token 存储在 HttpOnly Cookie 中，由浏览器自动发送。
   * 此方法调用后端 /auth/refresh 端点获取新的 Access Token。
   * 
   * 实现了刷新锁机制，防止并发刷新请求。
   * 
   * @returns 新的 Access Token
   * @throws TokenRefreshError 刷新失败时抛出
   */
  const refreshAccessToken = async (): Promise<string> => {
    // 如果有自定义刷新处理器 (用于测试)，使用它
    if (customRefreshHandler) {
      const newToken = await customRefreshHandler()
      setAccessToken(newToken)
      return newToken
    }
    
    // 如果正在刷新，等待现有的刷新完成
    if (isRefreshing && refreshPromise) {
      logger.debug('[TokenManager] 等待现有刷新请求完成')
      return refreshPromise
    }
    
    // 设置刷新锁
    isRefreshing = true
    
    refreshPromise = (async () => {
      try {
        logger.debug('[TokenManager] 开始刷新 Access Token')
        
        // 调用后端刷新端点
        // 注意: withCredentials: true 确保发送 HttpOnly Cookie
        const response = await axios.post<RefreshTokenResponse>(
          '/api/auth/refresh',
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
        
        // 检查响应
        if (response.data.code !== 0 || !response.data.data?.token) {
          throw new TokenRefreshError(
            response.data.message || 'Token 刷新失败',
            response.status,
            true
          )
        }
        
        const newToken = response.data.data.token
        setAccessToken(newToken)
        
        logger.debug('[TokenManager] Access Token 刷新成功')
        return newToken
        
      } catch (error) {
        logger.error('[TokenManager] Token 刷新失败:', error)
        
        // 清除无效的 Token
        clearAccessToken()
        
        // 转换为 TokenRefreshError
        if (error instanceof TokenRefreshError) {
          throw error
        }
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status
          const message = error.response?.data?.message || error.message
          
          // 401 表示 Refresh Token 无效或过期
          if (status === 401) {
            throw new TokenRefreshError(
              'Refresh Token 已过期，请重新登录',
              status,
              true
            )
          }
          
          throw new TokenRefreshError(message, status, status === 401)
        }
        
        throw new TokenRefreshError(
          error instanceof Error ? error.message : 'Token 刷新失败',
          undefined,
          true
        )
        
      } finally {
        isRefreshing = false
        refreshPromise = null
      }
    })()
    
    return refreshPromise
  }

  // 测试辅助方法
  const _setRefreshHandler = (handler: (() => Promise<string>) | null): void => {
    customRefreshHandler = handler
  }

  const _getStoredToken = (): string | null => {
    return accessToken
  }

  const _reset = (): void => {
    accessToken = null
    isRefreshing = false
    refreshPromise = null
    customRefreshHandler = null
  }

  return {
    getAccessToken,
    setAccessToken,
    clearAccessToken,
    refreshAccessToken,
    isTokenExpiring,
    getTokenExpiration,
    hasValidToken,
    _setRefreshHandler,
    _getStoredToken,
    _reset,
  }
}

// 导出单例 Token 管理器实例
export const tokenManager: ExtendedTokenManager = createTokenManager()

// 导出常量供测试使用
export { DEFAULT_REFRESH_THRESHOLD_MS }
