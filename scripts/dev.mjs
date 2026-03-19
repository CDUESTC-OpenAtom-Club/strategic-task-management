import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(currentDir, '..')
const viteCacheDir = join(projectRoot, 'node_modules', '.vite')

if (existsSync(viteCacheDir)) {
  rmSync(viteCacheDir, { recursive: true, force: true })
  console.log('[dev] Cleared Vite optimize-deps cache:', viteCacheDir)
}

const viteArgs = ['vite', ...process.argv.slice(2)]
const child = spawn('npx', viteArgs, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[dev] Failed to start Vite:', error)
  process.exit(1)
})
