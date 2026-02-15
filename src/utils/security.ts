/**
 * 前端安全工具函数
 * 提供请求签名、数据加密等功能
 */

/**
 * 获取 API 签名密钥
 * 从环境变量读取，不使用硬编码默认值
 * @throws Error 如果环境变量未配置
 */
function getApiSecret(): string {
  const secret = import.meta.env.VITE_API_SECRET
  if (!secret) {
    console.error('[Security] VITE_API_SECRET 环境变量未配置，请在 .env 文件中设置')
    throw new Error('VITE_API_SECRET 环境变量未配置')
  }
  return secret
}

/**
 * 获取存储加密密钥
 * 从环境变量读取，不使用硬编码默认值
 * @throws Error 如果环境变量未配置
 */
function getStorageKey(): string {
  const key = import.meta.env.VITE_STORAGE_KEY
  if (!key) {
    console.error('[Security] VITE_STORAGE_KEY 环境变量未配置，请在 .env 文件中设置')
    throw new Error('VITE_STORAGE_KEY 环境变量未配置')
  }
  return key
}

/**
 * 检查安全配置是否完整
 * 用于应用启动时验证必要的安全配置
 */
export function validateSecurityConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  if (!import.meta.env.VITE_API_SECRET) {
    missing.push('VITE_API_SECRET')
  }
  if (!import.meta.env.VITE_STORAGE_KEY) {
    missing.push('VITE_STORAGE_KEY')
  }
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * 生成请求签名
 * 用于敏感操作的额外安全验证
 * @throws Error 如果 VITE_API_SECRET 未配置
 */
export async function generateSignature(data: any, timestamp: number): Promise<string> {
  const payload = JSON.stringify(data || {})
  const message = `${timestamp}:${payload}`
  
  // 使用 Web Crypto API 生成 HMAC-SHA256 签名
  const encoder = new TextEncoder()
  const keyData = encoder.encode(getApiSecret())
  const messageData = encoder.encode(message)
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 敏感数据加密（用于本地存储）
 */
export async function encryptData(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  
  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // 加密
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  )
  
  // 合并 IV 和密文
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

/**
 * 敏感数据解密
 */
export async function decryptData(encryptedData: string, key: string): Promise<string> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  // 解码 Base64
  const combined = new Uint8Array(
    atob(encryptedData).split('').map(c => c.charCodeAt(0))
  )
  
  // 分离 IV 和密文
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  
  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  // 解密
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  )
  
  return decoder.decode(decrypted)
}

/**
 * 安全的本地存储
 * @throws Error 如果使用加密功能但 VITE_STORAGE_KEY 未配置
 */
export const secureStorage = {
  async setItem(key: string, value: any, encrypt = false): Promise<void> {
    const data = JSON.stringify(value)
    if (encrypt) {
      const encrypted = await encryptData(data, getStorageKey())
      localStorage.setItem(key, encrypted)
    } else {
      localStorage.setItem(key, data)
    }
  },
  
  async getItem<T>(key: string, decrypt = false): Promise<T | null> {
    const data = localStorage.getItem(key)
    if (!data) return null
    
    try {
      if (decrypt) {
        const decrypted = await decryptData(data, getStorageKey())
        return JSON.parse(decrypted)
      }
      return JSON.parse(data)
    } catch {
      return null
    }
  },
  
  removeItem(key: string): void {
    localStorage.removeItem(key)
  }
}

/**
 * XSS 防护 - 转义 HTML
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return str.replace(/[&<>"']/g, char => htmlEntities[char])
}

/**
 * 输入验证
 */
export const validators = {
  // 验证是否为安全字符串（防止 SQL 注入）
  isSafeString(str: string): boolean {
    const dangerousPatterns = [
      /['";]/,
      /--/,
      /\/\*/,
      /\*\//,
      /\bor\b/i,
      /\band\b/i,
      /\bunion\b/i,
      /\bselect\b/i,
      /\binsert\b/i,
      /\bupdate\b/i,
      /\bdelete\b/i,
      /\bdrop\b/i
    ]
    return !dangerousPatterns.some(pattern => pattern.test(str))
  },
  
  // 验证邮箱
  isEmail(str: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
  },
  
  // 验证手机号
  isPhone(str: string): boolean {
    return /^1[3-9]\d{9}$/.test(str)
  }
}
