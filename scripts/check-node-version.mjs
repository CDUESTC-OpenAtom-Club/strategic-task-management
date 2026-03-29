const [major] = process.versions.node.split('.').map(Number)

if (major < 22 || major >= 26) {
  console.error('')
  console.error('[startup] Unsupported Node.js version detected.')
  console.error(`[startup] Current: v${process.versions.node}`)
  console.error('[startup] Required: Node.js 22.x - 25.x')
  console.error('')
  console.error('[startup] Fix:')
  console.error('  1. cd strategic-task-management')
  console.error('  2. Use Node.js 22, 23, 24, or 25')
  console.error('  3. npm install')
  console.error('  4. npm run dev')
  console.error('')
  process.exit(1)
}
