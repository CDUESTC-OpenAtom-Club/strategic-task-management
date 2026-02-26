/**
 * Property-Based Tests for Token Manager
 * 
 * **Feature: sism-enterprise-optimization**
 * 
 * These tests verify the correctness property P2 defined in the design document
 * for the Token Manager utility.
 * 
 * **Validates: Requirements 1.2.1, 1.2.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  tokenManager,
  parseJwtPayload,
  getTokenExpirationTime,
  isTokenExpired,
  DEFAULT_REFRESH_THRESHOLD_MS,
  type ExtendedTokenManager,
} from '@/utils/tokenManager'

/**
 * 生成有效的 JWT Token (用于测试)
 * 
 * @param payload JWT Payload
 * @returns 模拟的 JWT Token 字符串
 */
function generateMockJwt(payload: Record<string, unknown>): string {
  // JWT Header (固定)
  const header = { alg: 'HS256', typ: 'JWT' }
  
  // Base64Url 编码
  const base64UrlEncode = (obj: Record<string, unknown>): string => {
    const json = JSON.stringify(obj)
    const base64 = btoa(json)
    // 转换为 Base64Url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  
  const headerEncoded = base64UrlEncode(header)
  const payloadEncoded = base64UrlEncode(payload)
  // 模拟签名 (测试用，不需要真实签名)
  const signature = 'mock_signature_for_testing'
  
  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

/**
 * 生成带有过期时间的 JWT Token
 * 
 * @param expiresInMs 过期时间 (毫秒，相对于当前时间)
 * @param additionalPayload 额外的 Payload 字段
 * @returns 模拟的 JWT Token 字符串
 */
function generateJwtWithExpiration(
  expiresInMs: number,
  additionalPayload: Record<string, unknown> = {}
): string {
  const now = Math.floor(Date.now() / 1000) // 秒级时间戳
  const exp = now + Math.floor(expiresInMs / 1000)
  
  return generateMockJwt({
    exp,
    iat: now,
    sub: 'test-user',
    ...additionalPayload,
  })
}

/**
 * 模拟的操作类型
 */
type TokenOperation = 
  | { type: 'login'; token: string }
  | { type: 'logout' }
  | { type: 'refresh'; newToken: string }
  | { type: 'navigate' }
  | { type: 'setToken'; token: string }
  | { type: 'clearToken' }

/**
 * 执行操作序列
 */
function executeOperations(
  manager: ExtendedTokenManager,
  operations: TokenOperation[]
): void {
  for (const op of operations) {
    switch (op.type) {
      case 'login':
      case 'setToken':
        manager.setAccessToken(op.token)
        break
      case 'logout':
      case 'clearToken':
        manager.clearAccessToken()
        break
      case 'refresh':
        manager.setAccessToken(op.newToken)
        break
      case 'navigate':
        // 模拟页面导航，不做任何操作
        break
    }
  }
}

/**
 * **Property P2: Token 内存存储不泄露**
 * **Validates: Requirements 1.2.1, 1.2.5**
 * 
 * 属性: 在任何操作序列后，localStorage 中不应存在 access_token 键。
 * 
 * ∀ operations ∈ [login, logout, refresh, navigate]*:
 *   execute(operations) → localStorage.getItem('access_token') === null
 */
describe('Property P2: Token 内存存储不泄露', () => {
  // 模拟 localStorage
  let localStorageData: Record<string, string> = {}
  const originalLocalStorage = global.localStorage

  beforeEach(() => {
    // 重置 Token 管理器状态
    tokenManager._reset()
    
    // 重置模拟的 localStorage
    localStorageData = {}
    
    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageData[key] ?? null,
        setItem: (key: string, value: string) => {
          localStorageData[key] = value
        },
        removeItem: (key: string) => {
          delete localStorageData[key]
        },
        clear: () => {
          localStorageData = {}
        },
        get length() {
          return Object.keys(localStorageData).length
        },
        key: (index: number) => Object.keys(localStorageData)[index] ?? null,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // 恢复原始 localStorage
    if (originalLocalStorage) {
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      })
    }
    
    // 清理 Token 管理器
    tokenManager._reset()
  })

  // Token 生成器
  const tokenArb = fc.integer({ min: 1, max: 3600000 }).map(expiresInMs => 
    generateJwtWithExpiration(expiresInMs)
  )

  // 操作生成器
  const operationArb: fc.Arbitrary<TokenOperation> = fc.oneof(
    tokenArb.map(token => ({ type: 'login' as const, token })),
    fc.constant({ type: 'logout' as const }),
    tokenArb.map(newToken => ({ type: 'refresh' as const, newToken })),
    fc.constant({ type: 'navigate' as const }),
    tokenArb.map(token => ({ type: 'setToken' as const, token })),
    fc.constant({ type: 'clearToken' as const })
  )

  // 操作序列生成器
  const operationsArb = fc.array(operationArb, { minLength: 1, maxLength: 20 })

  it('should never store access_token in localStorage after any operation sequence', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        // 重置状态
        tokenManager._reset()
        localStorageData = {}
        
        // 执行操作序列
        executeOperations(tokenManager, operations)
        
        // 验证 localStorage 中不存在 access_token
        const hasAccessToken = localStorage.getItem('access_token') !== null
        const hasAccessTokenCamel = localStorage.getItem('accessToken') !== null
        
        return !hasAccessToken && !hasAccessTokenCamel
      }),
      { numRuns: 100 }
    )
  })

  it('should store token only in memory after setAccessToken', () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        // 重置状态
        tokenManager._reset()
        localStorageData = {}
        
        // 设置 Token
        tokenManager.setAccessToken(token)
        
        // 验证 Token 在内存中
        const memoryToken = tokenManager._getStoredToken()
        
        // 验证 localStorage 中没有 Token
        const localStorageToken = localStorage.getItem('access_token')
        const localStorageTokenCamel = localStorage.getItem('accessToken')
        
        return (
          memoryToken === token &&
          localStorageToken === null &&
          localStorageTokenCamel === null
        )
      }),
      { numRuns: 100 }
    )
  })

  it('should clear token from memory after clearAccessToken', () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        // 重置状态
        tokenManager._reset()
        localStorageData = {}
        
        // 设置然后清除 Token
        tokenManager.setAccessToken(token)
        tokenManager.clearAccessToken()
        
        // 验证内存中没有 Token
        const memoryToken = tokenManager._getStoredToken()
        
        // 验证 localStorage 中也没有 Token
        const localStorageToken = localStorage.getItem('access_token')
        const localStorageTokenCamel = localStorage.getItem('accessToken')
        
        return (
          memoryToken === null &&
          localStorageToken === null &&
          localStorageTokenCamel === null
        )
      }),
      { numRuns: 100 }
    )
  })

  it('should remove any pre-existing localStorage tokens when setting new token', () => {
    fc.assert(
      fc.property(tokenArb, tokenArb, (oldToken, newToken) => {
        // 重置状态
        tokenManager._reset()
        
        // 模拟旧系统遗留的 localStorage Token
        localStorageData = {
          'access_token': oldToken,
          'accessToken': oldToken,
        }
        
        // 设置新 Token (应该清除 localStorage 中的旧 Token)
        tokenManager.setAccessToken(newToken)
        
        // 验证 localStorage 中的旧 Token 被清除
        const localStorageToken = localStorage.getItem('access_token')
        const localStorageTokenCamel = localStorage.getItem('accessToken')
        
        return localStorageToken === null && localStorageTokenCamel === null
      }),
      { numRuns: 100 }
    )
  })

  it('should handle login -> logout -> login sequence without localStorage leakage', () => {
    fc.assert(
      fc.property(tokenArb, tokenArb, (token1, token2) => {
        // 重置状态
        tokenManager._reset()
        localStorageData = {}
        
        // 登录
        tokenManager.setAccessToken(token1)
        const afterLogin1 = localStorage.getItem('access_token')
        
        // 登出
        tokenManager.clearAccessToken()
        const afterLogout = localStorage.getItem('access_token')
        
        // 再次登录
        tokenManager.setAccessToken(token2)
        const afterLogin2 = localStorage.getItem('access_token')
        
        return (
          afterLogin1 === null &&
          afterLogout === null &&
          afterLogin2 === null
        )
      }),
      { numRuns: 100 }
    )
  })

  it('should handle rapid token updates without localStorage leakage', () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb, { minLength: 5, maxLength: 50 }),
        (tokens) => {
          // 重置状态
          tokenManager._reset()
          localStorageData = {}
          
          // 快速连续设置多个 Token
          for (const token of tokens) {
            tokenManager.setAccessToken(token)
          }
          
          // 验证 localStorage 中没有 Token
          const localStorageToken = localStorage.getItem('access_token')
          const localStorageTokenCamel = localStorage.getItem('accessToken')
          
          // 验证最后一个 Token 在内存中
          const memoryToken = tokenManager._getStoredToken()
          const lastToken = tokens[tokens.length - 1]
          
          return (
            localStorageToken === null &&
            localStorageTokenCamel === null &&
            memoryToken === lastToken
          )
        }
      ),
      { numRuns: 50 }
    )
  })
})

/**
 * JWT 解析测试
 */
describe('JWT Parsing', () => {
  it('should correctly parse valid JWT payload', () => {
    fc.assert(
      fc.property(
        fc.record({
          sub: fc.string({ minLength: 1, maxLength: 50 }),
          exp: fc.integer({ min: 1, max: 2147483647 }),
          iat: fc.integer({ min: 1, max: 2147483647 }),
          name: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        (payload) => {
          const token = generateMockJwt(payload)
          const parsed = parseJwtPayload(token)
          
          return (
            parsed !== null &&
            parsed.sub === payload.sub &&
            parsed.exp === payload.exp &&
            parsed.iat === payload.iat &&
            parsed.name === payload.name
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return null for invalid JWT format', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('invalid'),
          fc.constant('only.two'),
          fc.constant(''),
          fc.string().filter(s => s.split('.').length !== 3)
        ),
        (invalidToken) => {
          const parsed = parseJwtPayload(invalidToken)
          return parsed === null
        }
      ),
      { numRuns: 50 }
    )
  })
})

/**
 * Token 过期检测测试
 */
describe('Token Expiration Detection', () => {
  beforeEach(() => {
    tokenManager._reset()
  })

  afterEach(() => {
    tokenManager._reset()
  })

  it('should correctly detect expired tokens', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -3600000, max: -1 }), // 过去的时间
        (expiresInMs) => {
          const token = generateJwtWithExpiration(expiresInMs)
          return isTokenExpired(token) === true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should correctly detect non-expired tokens', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60000, max: 3600000 }), // 未来的时间 (至少 1 分钟)
        (expiresInMs) => {
          const token = generateJwtWithExpiration(expiresInMs)
          return isTokenExpired(token) === false
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should correctly detect tokens expiring within threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: DEFAULT_REFRESH_THRESHOLD_MS - 1000 }),
        (expiresInMs) => {
          tokenManager._reset()
          const token = generateJwtWithExpiration(expiresInMs)
          tokenManager.setAccessToken(token)
          
          // Token 在默认阈值内过期，应该返回 true
          return tokenManager.isTokenExpiring(DEFAULT_REFRESH_THRESHOLD_MS) === true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should correctly detect tokens not expiring within threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: DEFAULT_REFRESH_THRESHOLD_MS + 60000, max: 3600000 }),
        (expiresInMs) => {
          tokenManager._reset()
          const token = generateJwtWithExpiration(expiresInMs)
          tokenManager.setAccessToken(token)
          
          // Token 不在默认阈值内过期，应该返回 false
          return tokenManager.isTokenExpiring(DEFAULT_REFRESH_THRESHOLD_MS) === false
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should return true for isTokenExpiring when no token is set', () => {
    tokenManager._reset()
    expect(tokenManager.isTokenExpiring()).toBe(true)
  })

  it('should correctly report hasValidToken', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60000, max: 3600000 }),
        (expiresInMs) => {
          tokenManager._reset()
          
          // 没有 Token 时应该返回 false
          const beforeSet = tokenManager.hasValidToken()
          
          // 设置有效 Token 后应该返回 true
          const token = generateJwtWithExpiration(expiresInMs)
          tokenManager.setAccessToken(token)
          const afterSet = tokenManager.hasValidToken()
          
          // 清除 Token 后应该返回 false
          tokenManager.clearAccessToken()
          const afterClear = tokenManager.hasValidToken()
          
          return !beforeSet && afterSet && !afterClear
        }
      ),
      { numRuns: 50 }
    )
  })
})

/**
 * Token 过期时间获取测试
 */
describe('Token Expiration Time', () => {
  beforeEach(() => {
    tokenManager._reset()
  })

  it('should correctly extract expiration time from token', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 3600000 }),
        (expiresInMs) => {
          const now = Date.now()
          const token = generateJwtWithExpiration(expiresInMs)
          const expiration = getTokenExpirationTime(token)
          
          if (expiration === null) return false
          
          // 允许 2 秒的误差 (因为时间戳是秒级的，且测试执行有延迟)
          const expectedExpiration = now + expiresInMs
          const diff = Math.abs(expiration - expectedExpiration)
          
          // 秒级时间戳转换会有最多 999ms 的舍入误差，加上执行延迟
          return diff < 2000
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should return null for getTokenExpiration when no token is set', () => {
    tokenManager._reset()
    expect(tokenManager.getTokenExpiration()).toBe(null)
  })

  it('should return correct expiration from tokenManager', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 60000, max: 3600000 }),
        (expiresInMs) => {
          tokenManager._reset()
          const token = generateJwtWithExpiration(expiresInMs)
          tokenManager.setAccessToken(token)
          
          const expiration = tokenManager.getTokenExpiration()
          const directExpiration = getTokenExpirationTime(token)
          
          return expiration === directExpiration
        }
      ),
      { numRuns: 50 }
    )
  })
})

/**
 * 边界测试
 */
describe('Edge Cases', () => {
  beforeEach(() => {
    tokenManager._reset()
  })

  afterEach(() => {
    tokenManager._reset()
  })

  it('should handle empty string token gracefully', () => {
    tokenManager.setAccessToken('')
    expect(tokenManager.getAccessToken()).toBe('')
    expect(tokenManager.hasValidToken()).toBe(false)
  })

  it('should handle getAccessToken when no token is set', () => {
    tokenManager._reset()
    expect(tokenManager.getAccessToken()).toBe(null)
  })

  it('should handle multiple clearAccessToken calls', () => {
    const token = generateJwtWithExpiration(3600000)
    tokenManager.setAccessToken(token)
    
    tokenManager.clearAccessToken()
    tokenManager.clearAccessToken()
    tokenManager.clearAccessToken()
    
    expect(tokenManager.getAccessToken()).toBe(null)
  })

  it('should handle setting same token multiple times', () => {
    const token = generateJwtWithExpiration(3600000)
    
    tokenManager.setAccessToken(token)
    tokenManager.setAccessToken(token)
    tokenManager.setAccessToken(token)
    
    expect(tokenManager.getAccessToken()).toBe(token)
  })
})
