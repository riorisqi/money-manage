import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { compress } from 'hono/compress'
import { api } from './api'
import { db, seed } from './db'

seed()

const app = new Hono()
const clientRoot = process.env.CLIENT_DIR ?? './dist/client'

app.use('/api/*', logger())
app.use('*', compress())
app.route('/api', api)
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

app.use(
  '/assets/*',
  serveStatic({
    root: clientRoot,
    onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable'),
  }),
)
app.use('*', serveStatic({ root: clientRoot }))
app.get('*', serveStatic({ root: clientRoot, path: 'index.html' }))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT ?? 3000)
const server = Bun.serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
console.log(`Money Manage running on http://localhost:${server.port}`)

const shutdown = () => {
  server.stop()
  db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
