/**
 * Property-Based Tests for Logger Utility
 * 
 * **Feature: sism-enterprise-optimization**
 * 
 * These tests verify the correctness properties P3 and P4 defined in the design document
 * for the unified logging utility.
 * 
 * **Validates: Requirements 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  logger,
  filterSensitiveData,
  isSensitiveField,
  shouldLog,
  REDACTED_VALUE,
  type LogLevel,
  type ExtendedLogger,
} from '@/utils/logger'

// 所有日志级别
const ALL_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

// 日志级别优先级 (数值越大优先级越高)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * **Property P3: 日志敏感数据过滤**
 * **Validates: Requirements 1.3.4**
 * 
 * 属性: 对于任意包含敏感字段的对象，日志输出不应包含原始敏感值。
 * 
 * ∀ obj with sensitiveFields, ∀ logLevel:
 *   log(logLevel, obj) → output ∩ sensitiveValues(obj) = ∅
 */
describe('Property P3: 日志敏感数据过滤', () => {
  // 敏感字段名生成器
  const sensitiveFieldArb = fc.constantFrom(
    'token',
    'Token',
    'TOKEN',
    'accessToken',
    'access_token',
    'refreshToken',
    'password',
    'Password',
    'PASSWORD',
    'userPassword',
    'secret',
    'Secret',
    'SECRET',
    'apiSecret',
    'key',
    'Key',
    'KEY',
    'apiKey',
    'api_key',
    'privateKey',
    'authorization',
    'Authorization',
    'credential',
    'credentials'
  )

  // 非敏感字段名生成器
  const nonSensitiveFieldArb = fc.constantFrom(
    'name',
    'email',
    'id',
    'username',
    'status',
    'data',
    'message',
    'count',
    'value',
    'type'
  )

  // 敏感值生成器 (生成随机字符串作为敏感值)
  const sensitiveValueArb = fc.string({ minLength: 1, maxLength: 100 })

  it('should redact sensitive field values in objects', () => {
    fc.assert(
      fc.property(
        sensitiveFieldArb,
        sensitiveValueArb,
        (fieldName, sensitiveValue) => {
          const obj = { [fieldName]: sensitiveValue }
          const filtered = filterSensitiveData(obj) as Record<string, unknown>
          
          // 敏感字段的值应该被替换为 REDACTED
          return filtered[fieldName] === REDACTED_VALUE
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve non-sensitive field values', () => {
    fc.assert(
      fc.property(
        nonSensitiveFieldArb,
        fc.string(),
        (fieldName, value) => {
          const obj = { [fieldName]: value }
          const filtered = filterSensitiveData(obj) as Record<string, unknown>
          
          // 非敏感字段的值应该保持不变
          return filtered[fieldName] === value
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should redact sensitive fields in nested objects', () => {
    fc.assert(
      fc.property(
        sensitiveFieldArb,
        sensitiveValueArb,
        nonSensitiveFieldArb,
        fc.string(),
        (sensitiveField, sensitiveValue, normalField, normalValue) => {
          const obj = {
            [normalField]: normalValue,
            nested: {
              [sensitiveField]: sensitiveValue,
              other: 'visible',
            },
          }
          const filtered = filterSensitiveData(obj) as Record<string, unknown>
          const nestedFiltered = filtered.nested as Record<string, unknown>
          
          // 嵌套对象中的敏感字段也应该被过滤
          return (
            nestedFiltered[sensitiveField] === REDACTED_VALUE &&
            nestedFiltered.other === 'visible' &&
            filtered[normalField] === normalValue
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should redact sensitive fields in arrays of objects', () => {
    fc.assert(
      fc.property(
        sensitiveFieldArb,
        fc.array(sensitiveValueArb, { minLength: 1, maxLength: 5 }),
        (fieldName, values) => {
          const arr = values.map(v => ({ [fieldName]: v }))
          const filtered = filterSensitiveData(arr) as Array<Record<string, unknown>>
          
          // 数组中每个对象的敏感字段都应该被过滤
          return filtered.every(item => item[fieldName] === REDACTED_VALUE)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle mixed sensitive and non-sensitive fields', () => {
    fc.assert(
      fc.property(
        sensitiveFieldArb,
        sensitiveValueArb,
        nonSensitiveFieldArb,
        fc.string(),
        (sensitiveField, sensitiveValue, normalField, normalValue) => {
          // 确保字段名不同
          if (sensitiveField === normalField) return true
          
          const obj = {
            [sensitiveField]: sensitiveValue,
            [normalField]: normalValue,
          }
          const filtered = filterSensitiveData(obj) as Record<string, unknown>
          
          // 敏感字段被过滤，非敏感字段保持不变
          return (
            filtered[sensitiveField] === REDACTED_VALUE &&
            filtered[normalField] === normalValue
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly identify sensitive field names', () => {
    fc.assert(
      fc.property(
        sensitiveFieldArb,
        (fieldName) => {
          return isSensitiveField(fieldName) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly identify non-sensitive field names', () => {
    fc.assert(
      fc.property(
        nonSensitiveFieldArb,
        (fieldName) => {
          return isSensitiveField(fieldName) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle null and undefined values', () => {
    expect(filterSensitiveData(null)).toBe(null)
    expect(filterSensitiveData(undefined)).toBe(undefined)
  })

  it('should handle primitive values', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        (value) => {
          return filterSensitiveData(value) === value
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle circular references gracefully', () => {
    const obj: Record<string, unknown> = { name: 'test' }
    obj.self = obj
    
    // 不应该抛出错误
    const filtered = filterSensitiveData(obj) as Record<string, unknown>
    expect(filtered.name).toBe('test')
    expect(filtered.self).toBe('[Circular Reference]')
  })
})

/**
 * **Property P4: 日志级别控制**
 * **Validates: Requirements 1.3.1, 1.3.2, 1.3.3**
 * 
 * 属性: 当日志级别设置为 L 时，只有级别 ≥ L 的日志才会输出。
 * 
 * ∀ configLevel ∈ LogLevels, ∀ logLevel ∈ LogLevels:
 *   setLevel(configLevel) → log(logLevel, msg) outputs iff logLevel ≥ configLevel
 */
describe('Property P4: 日志级别控制', () => {
  // 日志级别生成器
  const logLevelArb = fc.constantFrom<LogLevel>('debug', 'info', 'warn', 'error')

  beforeEach(() => {
    // 重置日志级别
    logger.setLevel('debug')
  })

  afterEach(() => {
    // 清理输出捕获
    logger._setOutputCapture(null)
  })

  it('should output logs when log level >= config level', () => {
    fc.assert(
      fc.property(
        logLevelArb,
        logLevelArb,
        fc.string({ minLength: 1 }),
        (configLevel, logLevel, message) => {
          logger.setLevel(configLevel)
          
          const expectedOutput = LOG_LEVEL_PRIORITY[logLevel] >= LOG_LEVEL_PRIORITY[configLevel]
          const actualOutput = shouldLog(logLevel, configLevel)
          
          return actualOutput === expectedOutput
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not output debug logs when level is info or higher', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>('info', 'warn', 'error'),
        (configLevel) => {
          return shouldLog('debug', configLevel) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not output info logs when level is warn or higher', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>('warn', 'error'),
        (configLevel) => {
          return shouldLog('info', configLevel) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always output error logs regardless of config level', () => {
    fc.assert(
      fc.property(
        logLevelArb,
        (configLevel) => {
          return shouldLog('error', configLevel) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should always output warn logs when level is warn or lower', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<LogLevel>('debug', 'info', 'warn'),
        (configLevel) => {
          return shouldLog('warn', configLevel) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly track current log level', () => {
    fc.assert(
      fc.property(
        logLevelArb,
        (level) => {
          logger.setLevel(level)
          return logger.getLevel() === level
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should verify log level hierarchy is correct', () => {
    // debug < info < warn < error
    expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info)
    expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn)
    expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error)
  })

  it('should output logs at exact config level', () => {
    fc.assert(
      fc.property(
        logLevelArb,
        (level) => {
          // 当配置级别和日志级别相同时，应该输出
          return shouldLog(level, level) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should capture actual log output based on level', () => {
    fc.assert(
      fc.property(
        logLevelArb,
        logLevelArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (configLevel, logLevel, message) => {
          logger.setLevel(configLevel)
          
          let outputCaptured = false
          let capturedLevel: LogLevel | null = null
          
          // 设置输出捕获
          logger._setOutputCapture((level: LogLevel) => {
            outputCaptured = true
            capturedLevel = level
          })
          
          // 调用对应的日志方法
          switch (logLevel) {
            case 'debug':
              logger.debug(message)
              break
            case 'info':
              logger.info(message)
              break
            case 'warn':
              logger.warn(message)
              break
            case 'error':
              logger.error(message)
              break
          }
          
          // 清理捕获
          logger._setOutputCapture(null)
          
          const shouldOutput = LOG_LEVEL_PRIORITY[logLevel] >= LOG_LEVEL_PRIORITY[configLevel]
          
          if (shouldOutput) {
            return outputCaptured && capturedLevel === logLevel
          } else {
            return !outputCaptured
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * 边界测试和集成测试
 */
describe('Logger Integration Tests', () => {
  beforeEach(() => {
    logger.setLevel('debug')
  })

  afterEach(() => {
    logger._setOutputCapture(null)
  })

  it('should filter sensitive data in log arguments', () => {
    let capturedArgs: unknown[] = []
    
    logger._setOutputCapture((_level: LogLevel, _message: string, args: unknown[]) => {
      capturedArgs = args
    })
    
    logger.info('User login', { username: 'test', password: 'secret123', token: 'abc123' })
    
    const loggedData = capturedArgs[0] as Record<string, unknown>
    expect(loggedData.username).toBe('test')
    expect(loggedData.password).toBe(REDACTED_VALUE)
    expect(loggedData.token).toBe(REDACTED_VALUE)
  })

  it('should handle multiple arguments with sensitive data', () => {
    let capturedArgs: unknown[] = []
    
    logger._setOutputCapture((_level: LogLevel, _message: string, args: unknown[]) => {
      capturedArgs = args
    })
    
    logger.debug(
      'API call',
      { url: '/api/login' },
      { authorization: 'Bearer xyz' },
      { data: { apiKey: 'key123' } }
    )
    
    expect((capturedArgs[0] as Record<string, unknown>).url).toBe('/api/login')
    expect((capturedArgs[1] as Record<string, unknown>).authorization).toBe(REDACTED_VALUE)
    expect(((capturedArgs[2] as Record<string, unknown>).data as Record<string, unknown>).apiKey).toBe(REDACTED_VALUE)
  })

  it('should handle empty objects and arrays', () => {
    expect(filterSensitiveData({})).toEqual({})
    expect(filterSensitiveData([])).toEqual([])
  })

  it('should handle Date objects', () => {
    const date = new Date()
    const obj = { createdAt: date, token: 'secret' }
    const filtered = filterSensitiveData(obj) as Record<string, unknown>
    
    expect(filtered.createdAt).toBe(date)
    expect(filtered.token).toBe(REDACTED_VALUE)
  })
})
