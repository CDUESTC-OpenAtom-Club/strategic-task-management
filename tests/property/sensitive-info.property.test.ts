/**
 * 敏感信息隔离属性测试
 * 
 * **Feature: github-delivery-prep, Property 6: 敏感信息隔离**
 * **Validates: Requirements 5.2**
 * 
 * *For any* 代码文件，不应包含硬编码的数据库密码、API 密钥等敏感信息。
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// 敏感信息模式定义
const SENSITIVE_PATTERNS = [
  /(?:db_)?password\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*]{8,}['"]/gi,
  /DB_PASSWORD\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*]{8,}['"]/gi,
  /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
  /secret[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
  /jwt[_-]?secret\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*_-]{20,}['"]/gi,
  /(?:DB_HOST|host)\s*[:=]\s*['"](?!localhost|127\.0\.0\.1)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}['"]/gi,
]

const EXCLUDED_PATHS = [
  'node_modules',
  'dist',
  '.git',
  '.env',
  '.env.local',
  'coverage',
  '*.log',
  '*.lock',
  'pnpm-lock.yaml',
  'package-lock.json',
  'bun.lock',
]

const ALLOWED_EXCEPTIONS = [
  '.env.example',
  'sensitive-info.property.test.ts',
]

function getCodeFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(process.cwd(), fullPath)
    
    const shouldExclude = EXCLUDED_PATHS.some(pattern => {
      if (pattern.startsWith('*')) {
        return entry.name.endsWith(pattern.slice(1))
      }
      return relativePath.includes(pattern) || entry.name === pattern
    })
    
    if (shouldExclude) continue
    
    if (entry.isDirectory()) {
      getCodeFiles(fullPath, files)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      const codeExtensions = ['.ts', '.js', '.vue', '.json', '.yml', '.yaml', '.sql']
      if (codeExtensions.includes(ext)) {
        files.push(fullPath)
      }
    }
  }
  
  return files
}


function checkFileForSensitiveInfo(filePath: string): { hasSensitive: boolean; matches: string[] } {
  const fileName = path.basename(filePath)
  
  if (ALLOWED_EXCEPTIONS.some(ex => fileName === ex || filePath.endsWith(ex))) {
    return { hasSensitive: false, matches: [] }
  }
  
  const content = fs.readFileSync(filePath, 'utf-8')
  const matches: string[] = []
  
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0
    const found = content.match(pattern)
    if (found) {
      const realMatches = found.filter(m => {
        const lowerMatch = m.toLowerCase()
        return !lowerMatch.includes('your_') &&
               !lowerMatch.includes('_here') &&
               !lowerMatch.includes('placeholder') &&
               !lowerMatch.includes('example') &&
               !lowerMatch.includes('process.env') &&
               !lowerMatch.includes('import.meta.env')
      })
      matches.push(...realMatches)
    }
  }
  
  return { hasSensitive: matches.length > 0, matches }
}

describe('Property 6: 敏感信息隔离', () => {
  it('should not contain hardcoded sensitive information in any code file', () => {
    const projectRoot = path.resolve(__dirname, '../..')
    const codeFiles = getCodeFiles(projectRoot)
    const violations: Array<{ file: string; matches: string[] }> = []
    
    for (const file of codeFiles) {
      const result = checkFileForSensitiveInfo(file)
      if (result.hasSensitive) {
        violations.push({
          file: path.relative(projectRoot, file),
          matches: result.matches
        })
      }
    }
    
    if (violations.length > 0) {
      const details = violations.map(v => 
        `  ${v.file}:\n    ${v.matches.join('\n    ')}`
      ).join('\n')
      console.error(`发现敏感信息:\n${details}`)
    }
    
    expect(violations).toHaveLength(0)
  })

  it('should use environment variables for database configuration', () => {
    const configPath = path.resolve(__dirname, '../../scripts/config.js')
    
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      expect(content).toContain('process.env')
      
      const hasHardcodedPassword = /password\s*[:=]\s*['"][^'"]{8,}['"]/.test(content) &&
        !content.includes('process.env.DB_PASSWORD')
      expect(hasHardcodedPassword).toBe(false)
    }
  })

  it('should have .env in .gitignore', () => {
    const gitignorePath = path.resolve(__dirname, '../../.gitignore')
    
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toMatch(/\.env/)
    }
  })

  it('should detect any hardcoded password pattern', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }).filter(s => 
          /^[a-zA-Z0-9!@#$%^&*]+$/.test(s) && 
          !s.includes('your_') && 
          !s.includes('_here')
        ),
        (password) => {
          const testContent = `const config = { password: "${password}" }`
          const pattern = /password\s*[:=]\s*['"][^'"]{8,}['"]/gi
          const matches = testContent.match(pattern)
          
          expect(matches).not.toBeNull()
          expect(matches!.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should NOT flag environment variable references as sensitive', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('DB_PASSWORD', 'JWT_SECRET', 'API_KEY', 'SECRET_KEY'),
        (envVar) => {
          const safePatterns = [
            `process.env.${envVar}`,
            `import.meta.env.${envVar}`,
            `${envVar}=your_password_here`,
            `${envVar}=\${process.env.${envVar}}`
          ]
          
          for (const safePattern of safePatterns) {
            let flagged = false
            for (const pattern of SENSITIVE_PATTERNS) {
              pattern.lastIndex = 0
              if (pattern.test(safePattern)) {
                const lowerPattern = safePattern.toLowerCase()
                if (!lowerPattern.includes('your_') && 
                    !lowerPattern.includes('_here') &&
                    !lowerPattern.includes('process.env') &&
                    !lowerPattern.includes('import.meta.env')) {
                  flagged = true
                }
              }
            }
            expect(flagged).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('.env.example should only contain placeholder values', () => {
    const envExamplePath = path.resolve(__dirname, '../../.env.example')
    
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, 'utf-8')
      const lines = content.split('\n')
      
      for (const line of lines) {
        if (line.trim().startsWith('#') || line.trim() === '') continue
        
        const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
        if (match) {
          const key = match[1]
          const value = match[2]
          
          if (!key || value === undefined) continue
          
          if (['DB_PASSWORD', 'JWT_SECRET', 'API_KEY', 'SECRET_KEY'].includes(key)) {
            const lowerValue = value.toLowerCase()
            const isPlaceholder = lowerValue.includes('your_') ||
                                  lowerValue.includes('_here') ||
                                  lowerValue.includes('placeholder') ||
                                  lowerValue.includes('example') ||
                                  value === ''
            
            expect(isPlaceholder).toBe(true)
          }
          
          if (key === 'DB_HOST') {
            const isLocalhost = value === 'localhost' || 
                               value === '127.0.0.1' ||
                               value.includes('your_') ||
                               value.includes('_here')
            expect(isLocalhost).toBe(true)
          }
        }
      }
    }
  })
})
