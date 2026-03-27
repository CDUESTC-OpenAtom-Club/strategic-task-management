const [major] = process.versions.node.split('.').map(Number)

if (major !== 22) {
  console.error('')
  console.error('[startup] Unsupported Node.js version detected.')
  console.error(`[startup] Current: v${process.versions.node}`)
  console.error('[startup] Required: Node.js 22.x')
  console.error('')
  console.error('[startup] Fix:')
  console.error('  1. cd strategic-task-management')
  console.error('  2. nvm use')
  console.error('  3. npm ci')
  console.error('  4. npm run dev')
  console.error('')
  process.exit(1)
}
