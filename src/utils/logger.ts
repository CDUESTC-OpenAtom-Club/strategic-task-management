/**
 * 统一日志工具
 * 
 * 功能:
 * - 支持日志级别控制 (debug, info, warn, error)
 * - 生产环境自动禁用 debug 和 info 级别日志
 * - 敏感数据过滤 (token, password, secret, key)
 * - 日志级别可通过环境变量动态配置
 * 
 * **Validates: Requirements 1.3.1, 1.3.2, 1.3.3, 1.3.4, 1.3.5**
 */

// 日志级别类型
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志级别优先级映射 (数值越大优先级越高)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// 敏感数据字段模式
const SENSITIVE_PATTERNS: RegExp[] = [
  /token/i,
  /password/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /credential/i,
]

// 敏感数据替换标记
const REDACTED_VALUE = '[REDACTED]'

/**
 * Logger 接口定义
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  
  // 配置方法
  setLevel(level: LogLevel): void
  getLevel(): LogLevel
}

/**
 * 检查字段名是否为敏感字段
 * @param fieldName 字段名
 * @returns 是否为敏感字段
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName))
}

/**
 * 过滤对象中的敏感数据
 * @param obj 要过滤的对象
 * @param visited 已访问对象集合 (用于处理循环引用)
 * @returns 过滤后的对象
 */
export function filterSensitiveData(obj: unknown, visited: WeakSet<object> = new WeakSet()): unknown {
  // 处理 null 和 undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // 处理基本类型
  if (typeof obj !== 'object') {
    return obj
  }

  // 处理循环引用
  if (visited.has(obj as object)) {
    return '[Circular Reference]'
  }
  visited.add(obj as object)

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => filterSensitiveData(item, visited))
  }

  // 处理 Date 对象
  if (obj instanceof Date) {
    return obj
  }

  // 处理普通对象
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      // 敏感字段替换为 REDACTED
      filtered[key] = REDACTED_VALUE
    } else if (typeof value === 'object' && value !== null) {
      // 递归处理嵌套对象
      filtered[key] = filterSensitiveData(value, visited)
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

/**
 * 过滤日志参数中的敏感数据
 * @param args 日志参数
 * @returns 过滤后的参数
 */
function filterLogArgs(args: unknown[]): unknown[] {
  return args.map(arg => filterSensitiveData(arg))
}

/**
 * 获取默认日志级别
 * - 生产环境: warn (只输出 warn 和 error)
 * - 开发环境: debug (输出所有级别)
 * - 可通过 VITE_LOG_LEVEL 环境变量覆盖
 */
function getDefaultLogLevel(): LogLevel {
  // 检查环境变量配置
  const envLogLevel = import.meta.env?.VITE_LOG_LEVEL as string | undefined
  if (envLogLevel && isValidLogLevel(envLogLevel)) {
    return envLogLevel as LogLevel
  }

  // 根据 NODE_ENV 设置默认级别
  const isProduction = import.meta.env?.PROD === true || 
                       import.meta.env?.MODE === 'production'
  
  return isProduction ? 'warn' : 'debug'
}

/**
 * 检查是否为有效的日志级别
 */
function isValidLogLevel(level: string): level is LogLevel {
  return ['debug', 'info', 'warn', 'error'].includes(level)
}

/**
 * 检查给定日志级别是否应该输出
 * @param logLevel 要输出的日志级别
 * @param configLevel 配置的最低日志级别
 * @returns 是否应该输出
 */
export function shouldLog(logLevel: LogLevel, configLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[logLevel] >= LOG_LEVEL_PRIORITY[configLevel]
}

/**
 * 扩展的 Logger 接口 (包含测试辅助方法)
 */
export interface ExtendedLogger extends Logger {
  /** 内部方法: 用于测试时捕获输出 */
  _setOutputCapture: (capture: ((level: LogLevel, message: string, args: unknown[]) => void) | null) => void
  /** 内部方法: 重置日志级别为默认值 */
  _resetLevel: () => void
}

/**
 * 创建 Logger 实例
 */
function createLogger(): ExtendedLogger {
  let currentLevel: LogLevel = getDefaultLogLevel()

  // 用于测试的输出捕获
  let outputCapture: ((level: LogLevel, message: string, args: unknown[]) => void) | null = null

  const log = (level: LogLevel, message: string, args: unknown[]): void => {
    // 检查日志级别
    if (!shouldLog(level, currentLevel)) {
      return
    }

    // 过滤敏感数据
    const filteredArgs = filterLogArgs(args)

    // 如果有输出捕获器，使用它 (用于测试)
    if (outputCapture) {
      outputCapture(level, message, filteredArgs)
      return
    }

    // 格式化时间戳
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    // 根据级别调用对应的 console 方法
    switch (level) {
      case 'debug':
        console.debug(prefix, message, ...filteredArgs)
        break
      case 'info':
        console.info(prefix, message, ...filteredArgs)
        break
      case 'warn':
        console.warn(prefix, message, ...filteredArgs)
        break
      case 'error':
        console.error(prefix, message, ...filteredArgs)
        break
    }
  }

  return {
    debug(message: string, ...args: unknown[]): void {
      log('debug', message, args)
    },

    info(message: string, ...args: unknown[]): void {
      log('info', message, args)
    },

    warn(message: string, ...args: unknown[]): void {
      log('warn', message, args)
    },

    error(message: string, ...args: unknown[]): void {
      log('error', message, args)
    },

    setLevel(level: LogLevel): void {
      currentLevel = level
    },

    getLevel(): LogLevel {
      return currentLevel
    },

    // 内部方法: 用于测试时捕获输出
    _setOutputCapture(capture: ((level: LogLevel, message: string, args: unknown[]) => void) | null): void {
      outputCapture = capture
    },

    // 内部方法: 重置日志级别为默认值
    _resetLevel(): void {
      currentLevel = getDefaultLogLevel()
    },
  }
}

// 导出单例 Logger 实例
export const logger: ExtendedLogger = createLogger()

// 导出类型和常量供测试使用
export { LOG_LEVEL_PRIORITY, SENSITIVE_PATTERNS, REDACTED_VALUE }
