import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { dataDir, db, transaction } from './db'

export const backupDir = process.env.BACKUP_DIR ?? join(dataDir, 'backups')
const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 30)
const filePattern = /^money-\d{4}-\d{2}-\d{2}(?:-\d{6}(?:-\d+)?)?\.db$/

function stamp(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: process.env.TZ || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}${parts.minute}${parts.second}` }
}

export function listBackups() {
  if (!existsSync(backupDir)) return []
  return readdirSync(backupDir)
    .filter((name) => filePattern.test(name))
    .map((name) => {
      const stat = statSync(join(backupDir, name))
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function prune(protect?: string) {
  const removable = listBackups().filter((b) => b.name !== protect)
  for (const old of removable.slice(protect ? keep - 1 : keep)) unlinkSync(join(backupDir, old.name))
}

const restorableTables = ['accounts', 'categories', 'transactions', 'budgets', 'notes', 'trades']

function columns(schema: string, table: string) {
  return (db.query(`PRAGMA ${schema}.table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
}

export function restoreBackup(name: string) {
  const path = join(backupDir, name)
  createBackup(true, name)
  db.exec(`ATTACH DATABASE '${path.replace(/'/g, "''")}' AS snapshot`)
  try {
    transaction(() => {
      for (const table of [...restorableTables].reverse()) db.exec(`DELETE FROM main.${table}`)
      for (const table of restorableTables) {
        const available = new Set(columns('snapshot', table))
        const shared = columns('main', table).filter((c) => available.has(c))
        if (!shared.length) continue
        const list = shared.join(', ')
        db.exec(`INSERT INTO main.${table} (${list}) SELECT ${list} FROM snapshot.${table}`)
      }
      db.exec(`INSERT INTO main.settings (key, value)
        SELECT key, value FROM snapshot.settings WHERE key IN ('currency', 'locale')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    })
  } finally {
    db.exec('DETACH DATABASE snapshot')
  }
}

export function createBackup(manual = false, protect?: string) {
  mkdirSync(backupDir, { recursive: true })
  const { day, time } = stamp()
  let name = manual ? `money-${day}-${time}.db` : `money-${day}.db`
  if (!manual && existsSync(join(backupDir, name))) return name
  for (let n = 2; existsSync(join(backupDir, name)); n++) name = `money-${day}-${time}-${n}.db`
  const path = join(backupDir, name)
  db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`)
  prune(protect)
  return name
}

function ensureDailyBackup() {
  try {
    const name = createBackup()
    console.log(`Backup ready: ${name}`)
  } catch (err) {
    console.error('Automatic backup failed', err)
  }
}

export function startBackupSchedule() {
  ensureDailyBackup()
  setInterval(ensureDailyBackup, 60 * 60 * 1000)
}

export const backups = new Hono()

backups.get('/', (c) => c.json({ directory: backupDir, keep, items: listBackups() }))

backups.post('/', (c) => {
  try {
    return c.json({ name: createBackup(true) }, 201)
  } catch (err) {
    throw new HTTPException(500, { message: `Backup failed: ${(err as Error).message}` })
  }
})

backups.post('/:name/restore', (c) => {
  const name = c.req.param('name')
  if (!filePattern.test(name) || !existsSync(join(backupDir, name))) throw new HTTPException(404, { message: 'Backup not found' })
  try {
    restoreBackup(name)
  } catch (err) {
    throw new HTTPException(500, { message: `Restore failed: ${(err as Error).message}` })
  }
  return c.json({ ok: true })
})

backups.get('/:name', (c) => {
  const name = c.req.param('name')
  const path = join(backupDir, name)
  if (!filePattern.test(name) || !existsSync(path)) throw new HTTPException(404, { message: 'Backup not found' })
  return new Response(Bun.file(path), {
    headers: {
      'Content-Type': 'application/vnd.sqlite3',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
})
