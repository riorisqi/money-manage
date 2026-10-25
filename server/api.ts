import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { all, get, run, seed, transaction, uid } from './db'
import { buildPortfolio, computePositions, getQuote, listTrades, UnknownSymbolError } from './stocks'
import type {
  Account,
  Backup,
  Bootstrap,
  Budget,
  Category,
  CategoryTotal,
  Note,
  SeriesPoint,
  Settings,
  Stats,
  Trade,
  Transaction,
} from '../shared/types'
import { LOT_SIZE } from '../shared/types'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const money = z.number().finite()

const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['cash', 'bank', 'ewallet', 'credit', 'savings', 'investment']),
  color,
  icon: z.string().min(1).max(40),
  initialBalance: money.default(0),
})

const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  color,
  icon: z.string().min(1).max(40),
})

const txSchema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: money.positive().max(1e13),
    accountId: z.string().min(1),
    toAccountId: z.string().nullish(),
    categoryId: z.string().nullish(),
    note: z.string().max(500).default(''),
    date: dateStr,
  })
  .refine((t) => t.type !== 'transfer' || (!!t.toAccountId && t.toAccountId !== t.accountId), {
    message: 'Transfer needs a different destination account',
    path: ['toAccountId'],
  })

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  amount: money.positive().max(1e13),
})

const noteSchema = z
  .object({
    title: z.string().trim().max(120).default(''),
    content: z.string().max(20000).default(''),
    color: color,
    pinned: z.boolean().default(false),
  })
  .refine((n) => n.title || n.content.trim(), { message: 'Note is empty' })

const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,8}$/, 'Use an IDX ticker like BBCA')

const tradeSchema = z.object({
  symbol: symbolSchema,
  side: z.enum(['buy', 'sell']),
  lots: z.number().int('Lots must be a whole number').positive().max(1e9),
  price: money.positive().max(1e9),
  fee: money.min(0).max(1e12).default(0),
  accountId: z.string().nullish(),
  note: z.string().max(500).default(''),
  date: dateStr,
})

const settingsSchema = z.object({
  currency: z.string().length(3).toUpperCase(),
  locale: z.string().min(2).max(20),
})

const backupSchema = z.object({
  version: z.literal(1),
  accounts: z.array(accountSchema.extend({ id: z.string(), createdAt: z.string() })),
  categories: z.array(categorySchema.extend({ id: z.string() })),
  transactions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['income', 'expense', 'transfer']),
      amount: money.positive(),
      accountId: z.string(),
      toAccountId: z.string().nullable(),
      categoryId: z.string().nullable(),
      note: z.string(),
      date: dateStr,
      createdAt: z.string(),
    }),
  ),
  budgets: z.array(budgetSchema.extend({ id: z.string() })),
  notes: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        color,
        pinned: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .default([]),
  trades: z
    .array(
      z.object({
        id: z.string(),
        symbol: z.string(),
        side: z.enum(['buy', 'sell']),
        lots: money.positive(),
        price: money.positive(),
        fee: money.min(0),
        accountId: z.string().nullable(),
        note: z.string(),
        date: dateStr,
        createdAt: z.string(),
      }),
    )
    .default([]),
  settings: settingsSchema,
})

async function parse<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const json = await c.req.json().catch(() => null)
  const result = schema.safeParse(json)
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
    throw new HTTPException(400, { message })
  }
  return result.data
}

function notFound(what: string): never {
  throw new HTTPException(404, { message: `${what} not found` })
}

const accountsSql = `
  SELECT a.*,
    a.initialBalance
    + COALESCE((SELECT SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END)
                FROM transactions t WHERE t.accountId = a.id), 0)
    + COALESCE((SELECT SUM(t.amount) FROM transactions t
                WHERE t.type = 'transfer' AND t.toAccountId = a.id), 0)
    + COALESCE((SELECT SUM(CASE s.side WHEN 'sell' THEN s.lots * ${LOT_SIZE} * s.price - s.fee
                                      ELSE -(s.lots * ${LOT_SIZE} * s.price + s.fee) END)
                FROM trades s WHERE s.accountId = a.id), 0) AS balance
  FROM accounts a
`

function listAccounts() {
  return all<Account>(`${accountsSql} ORDER BY a.createdAt, a.name`)
}

type NoteRow = Omit<Note, 'pinned'> & { pinned: number }

const toNote = (row: NoteRow): Note => ({ ...row, pinned: !!row.pinned })

function listNotes() {
  return all<NoteRow>('SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC').map(toNote)
}

function getNote(id: string) {
  const row = get<NoteRow>('SELECT * FROM notes WHERE id = :id', { id })
  return row ? toNote(row) : undefined
}

function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings')
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { currency: map.currency ?? 'USD', locale: map.locale ?? 'en-US' }
}

function assertAccount(id: string) {
  if (!get('SELECT 1 FROM accounts WHERE id = :id', { id })) notFound('Account')
}

function normalizeTx(input: z.infer<typeof txSchema>) {
  assertAccount(input.accountId)
  if (input.type === 'transfer') {
    assertAccount(input.toAccountId!)
    return { ...input, toAccountId: input.toAccountId!, categoryId: null }
  }
  if (input.categoryId) {
    const cat = get<Category>('SELECT * FROM categories WHERE id = :id', { id: input.categoryId })
    if (!cat) notFound('Category')
    if (cat.type !== input.type) throw new HTTPException(400, { message: 'Category type does not match transaction type' })
  }
  return { ...input, toAccountId: null, categoryId: input.categoryId ?? null }
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

function totals(from: string, to: string) {
  const row = get<{ income: number | null; expense: number | null; count: number }>(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN amount END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount END) AS expense,
       COUNT(*) AS count
     FROM transactions WHERE date BETWEEN :from AND :to`,
    { from, to },
  )
  return { income: row?.income ?? 0, expense: row?.expense ?? 0, count: row?.count ?? 0 }
}

function txFilters(c: Context) {
  const q = c.req.query()
  const where: string[] = []
  const params: Record<string, string | number> = {}
  if (q.from) {
    where.push('t.date >= :from')
    params.from = q.from
  }
  if (q.to) {
    where.push('t.date <= :to')
    params.to = q.to
  }
  if (q.type) {
    where.push('t.type = :type')
    params.type = q.type
  }
  if (q.accountId) {
    where.push('(t.accountId = :accountId OR t.toAccountId = :accountId)')
    params.accountId = q.accountId
  }
  if (q.categoryId) {
    where.push('t.categoryId = :categoryId')
    params.categoryId = q.categoryId
  }
  if (q.q) {
    where.push('(t.note LIKE :search OR c.name LIKE :search OR CAST(t.amount AS TEXT) LIKE :search)')
    params.search = `%${q.q}%`
  }
  const limit = Math.min(Number(q.limit) || 1000, 5000)
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params, limit }
}

function queryTransactions(c: Context) {
  const { where, params, limit } = txFilters(c)
  return all<Transaction>(
    `SELECT t.* FROM transactions t LEFT JOIN categories c ON c.id = t.categoryId
     ${where} ORDER BY t.date DESC, t.createdAt DESC LIMIT ${limit}`,
    params,
  )
}

function csvCell(value: unknown) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const api = new Hono()

api.get('/health', (c) => c.json({ ok: true }))

api.get('/bootstrap', (c) => {
  const data: Bootstrap = {
    accounts: listAccounts(),
    categories: all<Category>('SELECT * FROM categories ORDER BY type DESC, name'),
    budgets: all<Budget>('SELECT * FROM budgets'),
    settings: getSettings(),
  }
  return c.json(data)
})

api.post('/accounts', async (c) => {
  const body = await parse(c, accountSchema)
  const id = uid()
  run(
    `INSERT INTO accounts (id, name, type, color, icon, initialBalance, createdAt)
     VALUES (:id, :name, :type, :color, :icon, :initialBalance, :createdAt)`,
    { id, ...body, createdAt: new Date().toISOString() },
  )
  return c.json(get<Account>(`${accountsSql} WHERE a.id = :id`, { id }), 201)
})

api.put('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  const body = await parse(c, accountSchema)
  const res = run(
    `UPDATE accounts SET name = :name, type = :type, color = :color, icon = :icon,
     initialBalance = :initialBalance WHERE id = :id`,
    { id, ...body },
  )
  if (!res.changes) notFound('Account')
  return c.json(get<Account>(`${accountsSql} WHERE a.id = :id`, { id }))
})

api.delete('/accounts/:id', (c) => {
  const id = c.req.param('id')
  const count = get<{ n: number }>('SELECT COUNT(*) AS n FROM accounts')?.n ?? 0
  if (count <= 1) throw new HTTPException(400, { message: 'You need at least one account' })
  const res = run('DELETE FROM accounts WHERE id = :id', { id })
  if (!res.changes) notFound('Account')
  return c.body(null, 204)
})

api.post('/categories', async (c) => {
  const body = await parse(c, categorySchema)
  const id = uid()
  run('INSERT INTO categories (id, name, type, color, icon) VALUES (:id, :name, :type, :color, :icon)', { id, ...body })
  return c.json(get<Category>('SELECT * FROM categories WHERE id = :id', { id }), 201)
})

api.put('/categories/:id', async (c) => {
  const id = c.req.param('id')
  const body = await parse(c, categorySchema)
  const current = get<Category>('SELECT * FROM categories WHERE id = :id', { id })
  if (!current) notFound('Category')
  transaction(() => {
    run('UPDATE categories SET name = :name, type = :type, color = :color, icon = :icon WHERE id = :id', { id, ...body })
    if (current.type !== body.type) {
      run('UPDATE transactions SET categoryId = NULL WHERE categoryId = :id', { id })
      run('DELETE FROM budgets WHERE categoryId = :id', { id })
    }
  })
  return c.json(get<Category>('SELECT * FROM categories WHERE id = :id', { id }))
})

api.delete('/categories/:id', (c) => {
  const res = run('DELETE FROM categories WHERE id = :id', { id: c.req.param('id') })
  if (!res.changes) notFound('Category')
  return c.body(null, 204)
})

api.get('/transactions', (c) => c.json(queryTransactions(c)))

api.get('/transactions.csv', (c) => {
  const rows = queryTransactions(c)
  const accounts = new Map(listAccounts().map((a) => [a.id, a.name]))
  const categories = new Map(all<Category>('SELECT * FROM categories').map((x) => [x.id, x.name]))
  const header = ['Date', 'Type', 'Amount', 'Account', 'To Account', 'Category', 'Note']
  const lines = rows.map((t) =>
    [
      t.date,
      t.type,
      t.amount,
      accounts.get(t.accountId),
      t.toAccountId ? accounts.get(t.toAccountId) : '',
      t.categoryId ? categories.get(t.categoryId) : '',
      t.note,
    ]
      .map(csvCell)
      .join(','),
  )
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`)
  return c.body([header.join(','), ...lines].join('\n'))
})

api.post('/transactions', async (c) => {
  const body = normalizeTx(await parse(c, txSchema))
  const id = uid()
  run(
    `INSERT INTO transactions (id, type, amount, accountId, toAccountId, categoryId, note, date, createdAt)
     VALUES (:id, :type, :amount, :accountId, :toAccountId, :categoryId, :note, :date, :createdAt)`,
    { id, ...body, createdAt: new Date().toISOString() },
  )
  return c.json(get<Transaction>('SELECT * FROM transactions WHERE id = :id', { id }), 201)
})

api.put('/transactions/:id', async (c) => {
  const id = c.req.param('id')
  const body = normalizeTx(await parse(c, txSchema))
  const res = run(
    `UPDATE transactions SET type = :type, amount = :amount, accountId = :accountId, toAccountId = :toAccountId,
     categoryId = :categoryId, note = :note, date = :date WHERE id = :id`,
    { id, ...body },
  )
  if (!res.changes) notFound('Transaction')
  return c.json(get<Transaction>('SELECT * FROM transactions WHERE id = :id', { id }))
})

api.delete('/transactions/:id', (c) => {
  const res = run('DELETE FROM transactions WHERE id = :id', { id: c.req.param('id') })
  if (!res.changes) notFound('Transaction')
  return c.body(null, 204)
})

api.get('/portfolio', async (c) => c.json(await buildPortfolio(c.req.query('refresh') === '1')))

api.get('/stocks/:symbol', async (c) => {
  const symbol = symbolSchema.safeParse(c.req.param('symbol'))
  if (!symbol.success) throw new HTTPException(400, { message: symbol.error.issues[0].message })
  try {
    const quote = await getQuote(symbol.data)
    if (!quote) throw new HTTPException(503, { message: 'Price service unavailable' })
    return c.json(quote)
  } catch (err) {
    if (err instanceof UnknownSymbolError) notFound(`Ticker ${symbol.data}`)
    throw err
  }
})

api.get('/trades', (c) => c.json(listTrades(c.req.query('symbol')?.toUpperCase())))

api.post('/trades', async (c) => {
  const body = await parse(c, tradeSchema)
  if (body.accountId) assertAccount(body.accountId)
  if (body.side === 'sell') {
    const held = computePositions(listTrades(body.symbol)).get(body.symbol)?.shares ?? 0
    if (body.lots * LOT_SIZE > held + 1e-9) {
      throw new HTTPException(400, { message: `You only hold ${held / LOT_SIZE} lot(s) of ${body.symbol}` })
    }
  } else {
    try {
      await getQuote(body.symbol)
    } catch (err) {
      if (err instanceof UnknownSymbolError) throw new HTTPException(400, { message: `Unknown ticker ${body.symbol}` })
    }
  }
  const id = uid()
  run(
    `INSERT INTO trades (id, symbol, side, lots, price, fee, accountId, note, date, createdAt)
     VALUES (:id, :symbol, :side, :lots, :price, :fee, :accountId, :note, :date, :createdAt)`,
    { id, ...body, accountId: body.accountId ?? null, createdAt: new Date().toISOString() },
  )
  return c.json(get<Trade>('SELECT * FROM trades WHERE id = :id', { id }), 201)
})

api.delete('/trades/:id', (c) => {
  const res = run('DELETE FROM trades WHERE id = :id', { id: c.req.param('id') })
  if (!res.changes) notFound('Trade')
  return c.body(null, 204)
})

api.get('/notes', (c) => c.json(listNotes()))

api.post('/notes', async (c) => {
  const body = await parse(c, noteSchema)
  const id = uid()
  const now = new Date().toISOString()
  run(
    `INSERT INTO notes (id, title, content, color, pinned, createdAt, updatedAt)
     VALUES (:id, :title, :content, :color, :pinned, :now, :now)`,
    { id, ...body, pinned: body.pinned ? 1 : 0, now },
  )
  return c.json(getNote(id), 201)
})

api.put('/notes/:id', async (c) => {
  const id = c.req.param('id')
  const body = await parse(c, noteSchema)
  const res = run(
    `UPDATE notes SET title = :title, content = :content, color = :color, pinned = :pinned, updatedAt = :now
     WHERE id = :id`,
    { id, ...body, pinned: body.pinned ? 1 : 0, now: new Date().toISOString() },
  )
  if (!res.changes) notFound('Note')
  return c.json(getNote(id))
})

api.delete('/notes/:id', (c) => {
  const res = run('DELETE FROM notes WHERE id = :id', { id: c.req.param('id') })
  if (!res.changes) notFound('Note')
  return c.body(null, 204)
})

api.put('/budgets', async (c) => {
  const body = await parse(c, budgetSchema)
  const cat = get<Category>('SELECT * FROM categories WHERE id = :id', { id: body.categoryId })
  if (!cat) notFound('Category')
  if (cat.type !== 'expense') throw new HTTPException(400, { message: 'Budgets apply to expense categories only' })
  run(
    `INSERT INTO budgets (id, categoryId, amount) VALUES (:id, :categoryId, :amount)
     ON CONFLICT(categoryId) DO UPDATE SET amount = excluded.amount`,
    { id: uid(), ...body },
  )
  return c.json(get<Budget>('SELECT * FROM budgets WHERE categoryId = :categoryId', { categoryId: body.categoryId }))
})

api.delete('/budgets/:categoryId', (c) => {
  run('DELETE FROM budgets WHERE categoryId = :categoryId', { categoryId: c.req.param('categoryId') })
  return c.body(null, 204)
})

api.put('/settings', async (c) => {
  const body = await parse(c, settingsSchema)
  try {
    new Intl.NumberFormat(body.locale, { style: 'currency', currency: body.currency })
  } catch {
    throw new HTTPException(400, { message: 'Unsupported currency or locale' })
  }
  transaction(() => {
    for (const [key, value] of Object.entries(body)) {
      run('INSERT INTO settings (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value', {
        key,
        value,
      })
    }
  })
  return c.json(getSettings())
})

api.get('/stats', (c) => {
  const from = dateStr.safeParse(c.req.query('from'))
  const to = dateStr.safeParse(c.req.query('to'))
  if (!from.success || !to.success) throw new HTTPException(400, { message: 'from and to are required' })
  const group = c.req.query('group') === 'month' ? 'month' : 'day'
  const range = { from: from.data, to: to.data }

  const span = daysBetween(range.from, range.to) + 1
  const prevTo = shiftDate(range.from, -1)
  const prevFrom = shiftDate(prevTo, -(span - 1))
  const current = totals(range.from, range.to)
  const previous = totals(prevFrom, prevTo)

  const byCategory = all<CategoryTotal>(
    `SELECT categoryId, type, SUM(amount) AS total, COUNT(*) AS count FROM transactions
     WHERE type != 'transfer' AND date BETWEEN :from AND :to
     GROUP BY categoryId, type ORDER BY total DESC`,
    range,
  )

  const keyExpr = group === 'month' ? 'substr(date, 1, 7)' : 'date'
  const series = all<SeriesPoint>(
    `SELECT ${keyExpr} AS key,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions WHERE type != 'transfer' AND date BETWEEN :from AND :to
     GROUP BY key ORDER BY key`,
    range,
  )

  const stats: Stats = {
    ...range,
    income: current.income,
    expense: current.expense,
    net: current.income - current.expense,
    count: current.count,
    previous: { income: previous.income, expense: previous.expense },
    byCategory,
    series,
  }
  return c.json(stats)
})

api.get('/backup', (c) => {
  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: all('SELECT * FROM accounts'),
    categories: all('SELECT * FROM categories'),
    transactions: all('SELECT * FROM transactions'),
    budgets: all('SELECT * FROM budgets'),
    notes: listNotes(),
    trades: listTrades(),
    settings: getSettings(),
  }
  c.header('Content-Disposition', `attachment; filename="money-backup-${backup.exportedAt.slice(0, 10)}.json"`)
  return c.json(backup)
})

api.post('/backup', async (c) => {
  const data = await parse(c, backupSchema)
  transaction(() => {
    run('DELETE FROM trades')
    run('DELETE FROM notes')
    run('DELETE FROM transactions')
    run('DELETE FROM budgets')
    run('DELETE FROM categories')
    run('DELETE FROM accounts')
    for (const a of data.accounts) {
      run(
        `INSERT INTO accounts (id, name, type, color, icon, initialBalance, createdAt)
         VALUES (:id, :name, :type, :color, :icon, :initialBalance, :createdAt)`,
        a,
      )
    }
    for (const x of data.categories) {
      run('INSERT INTO categories (id, name, type, color, icon) VALUES (:id, :name, :type, :color, :icon)', x)
    }
    for (const t of data.transactions) {
      run(
        `INSERT INTO transactions (id, type, amount, accountId, toAccountId, categoryId, note, date, createdAt)
         VALUES (:id, :type, :amount, :accountId, :toAccountId, :categoryId, :note, :date, :createdAt)`,
        t,
      )
    }
    for (const b of data.budgets) {
      run('INSERT INTO budgets (id, categoryId, amount) VALUES (:id, :categoryId, :amount)', b)
    }
    for (const t of data.trades) {
      run(
        `INSERT INTO trades (id, symbol, side, lots, price, fee, accountId, note, date, createdAt)
         VALUES (:id, :symbol, :side, :lots, :price, :fee, :accountId, :note, :date, :createdAt)`,
        t,
      )
    }
    for (const n of data.notes) {
      run(
        `INSERT INTO notes (id, title, content, color, pinned, createdAt, updatedAt)
         VALUES (:id, :title, :content, :color, :pinned, :createdAt, :updatedAt)`,
        { ...n, pinned: n.pinned ? 1 : 0 },
      )
    }
    for (const [key, value] of Object.entries(data.settings)) {
      run('INSERT INTO settings (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value', {
        key,
        value,
      })
    }
  })
  return c.json({ ok: true })
})

api.delete('/data', (c) => {
  const keepSetup = c.req.query('scope') === 'transactions'
  transaction(() => {
    run('DELETE FROM transactions')
    run('DELETE FROM trades')
    if (!keepSetup) {
      run('DELETE FROM notes')
      run('DELETE FROM budgets')
      run('DELETE FROM categories')
      run('DELETE FROM accounts')
    }
  })
  if (!keepSetup) seed()
  return c.body(null, 204)
})
