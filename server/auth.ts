import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { get, run } from './db'

const COOKIE = 'mm_session'
const SESSION_DAYS = 30
const DAY = 86_400_000
const MAX_FAILURES = 5
const BASE_LOCK_MS = 60_000
const MAX_LOCK_MS = 15 * 60_000

const publicPaths = new Set(['/api/health', '/api/auth/status', '/api/auth/setup', '/api/auth/login'])
const failures = new Map<string, { count: number; until: number }>()

const passwordSchema = z.string().min(4, 'Use at least 4 characters').max(128)
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const clientKey = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'direct'
const isSecure = (c: Context) => c.req.header('x-forwarded-proto') === 'https' || c.req.url.startsWith('https:')

function storedHash() {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = 'passwordHash'")?.value
}

function savePasswordHash(hash: string) {
  run(
    "INSERT INTO settings (key, value) VALUES ('passwordHash', :hash) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    { hash },
  )
}

function currentSession(c: Context) {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const id = hashToken(token)
  const row = get<{ id: string; expiresAt: string }>('SELECT id, expiresAt FROM sessions WHERE id = :id', { id })
  if (!row) return null
  if (Date.parse(row.expiresAt) < Date.now()) {
    run('DELETE FROM sessions WHERE id = :id', { id })
    return null
  }
  return { ...row, token }
}

function issueSession(c: Context) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  run('DELETE FROM sessions WHERE expiresAt < :now', { now: new Date(now).toISOString() })
  run('INSERT INTO sessions (id, userAgent, createdAt, expiresAt) VALUES (:id, :ua, :createdAt, :expiresAt)', {
    id: hashToken(token),
    ua: (c.req.header('user-agent') ?? '').slice(0, 300),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * DAY).toISOString(),
  })
  writeCookie(c, token)
}

function writeCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: isSecure(c),
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

function extendSession(c: Context, session: { id: string; expiresAt: string; token: string }) {
  if (Date.parse(session.expiresAt) - Date.now() > (SESSION_DAYS - 1) * DAY) return
  run('UPDATE sessions SET expiresAt = :expiresAt WHERE id = :id', {
    id: session.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * DAY).toISOString(),
  })
  writeCookie(c, session.token)
}

function assertNotLocked(c: Context) {
  const entry = failures.get(clientKey(c))
  if (entry && entry.until > Date.now()) {
    const seconds = Math.ceil((entry.until - Date.now()) / 1000)
    c.header('Retry-After', String(seconds))
    throw new HTTPException(429, { message: `Too many attempts. Try again in ${seconds}s` })
  }
}

async function registerFailure(c: Context) {
  const key = clientKey(c)
  const entry = failures.get(key) ?? { count: 0, until: 0 }
  entry.count++
  if (entry.count >= MAX_FAILURES) {
    entry.until = Date.now() + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (entry.count - MAX_FAILURES))
  }
  failures.set(key, entry)
  await Bun.sleep(400)
}

async function readPassword(c: Context) {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const parsed = passwordSchema.safeParse(body.password)
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0].message })
  return parsed.data
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (publicPaths.has(c.req.path)) return next()
  const session = currentSession(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  extendSession(c, session)
  return next()
}

export function resetPassword() {
  run("DELETE FROM settings WHERE key = 'passwordHash'")
  run('DELETE FROM sessions')
}

export const auth = new Hono()

auth.get('/status', (c) => c.json({ configured: !!storedHash(), authenticated: !!currentSession(c) }))

auth.post('/setup', async (c) => {
  if (storedHash()) throw new HTTPException(409, { message: 'A password is already set' })
  const password = await readPassword(c)
  savePasswordHash(await Bun.password.hash(password))
  issueSession(c)
  return c.json({ ok: true })
})

auth.post('/login', async (c) => {
  assertNotLocked(c)
  const hash = storedHash()
  if (!hash) throw new HTTPException(409, { message: 'No password set yet' })
  const password = await readPassword(c)
  if (!(await Bun.password.verify(password, hash))) {
    await registerFailure(c)
    throw new HTTPException(401, { message: 'Wrong password' })
  }
  failures.delete(clientKey(c))
  issueSession(c)
  return c.json({ ok: true })
})

auth.post('/logout', (c) => {
  const session = currentSession(c)
  if (session) run('DELETE FROM sessions WHERE id = :id', { id: session.id })
  deleteCookie(c, COOKIE, { path: '/' })
  return c.json({ ok: true })
})

auth.post('/logout-others', (c) => {
  const session = currentSession(c)
  const res = run('DELETE FROM sessions WHERE id != :id', { id: session?.id ?? '' })
  return c.json({ signedOut: res.changes })
})

auth.post('/change', async (c) => {
  assertNotLocked(c)
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const current = typeof body.current === 'string' ? body.current : ''
  const next = passwordSchema.safeParse(body.next)
  if (!next.success) throw new HTTPException(400, { message: next.error.issues[0].message })
  const hash = storedHash()
  if (!hash || !(await Bun.password.verify(current, hash))) {
    await registerFailure(c)
    throw new HTTPException(401, { message: 'Current password is wrong' })
  }
  savePasswordHash(await Bun.password.hash(next.data))
  run('DELETE FROM sessions')
  issueSession(c)
  return c.json({ ok: true })
})
