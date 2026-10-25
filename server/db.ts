import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new Database(join(dataDir, 'money.db'), { create: true, strict: true })

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    initialBalance REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT NOT NULL,
    icon TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL CHECK (amount > 0),
    accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    toAccountId TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(accountId);
  CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(categoryId);

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    categoryId TEXT NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
    amount REAL NOT NULL CHECK (amount > 0)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

type Params = Record<string, string | number | bigint | boolean | null>

export function all<T>(sql: string, params: Params = {}): T[] {
  return db.query(sql).all(params) as T[]
}

export function get<T>(sql: string, params: Params = {}): T | undefined {
  return (db.query(sql).get(params) as T | null) ?? undefined
}

export function run(sql: string, params: Params = {}) {
  return db.query(sql).run(params)
}

export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)()
}

export const uid = () => randomUUID()

const defaultCategories: [string, 'income' | 'expense', string, string][] = [
  ['Salary', 'income', '#10b981', 'briefcase'],
  ['Freelance', 'income', '#06b6d4', 'laptop'],
  ['Investment', 'income', '#8b5cf6', 'trending-up'],
  ['Gift', 'income', '#f59e0b', 'gift'],
  ['Other Income', 'income', '#64748b', 'sparkles'],
  ['Food & Drinks', 'expense', '#f97316', 'utensils'],
  ['Groceries', 'expense', '#84cc16', 'shopping-basket'],
  ['Transport', 'expense', '#3b82f6', 'car'],
  ['Shopping', 'expense', '#ec4899', 'shopping-bag'],
  ['Bills & Utilities', 'expense', '#eab308', 'receipt'],
  ['Housing', 'expense', '#a855f7', 'home'],
  ['Health', 'expense', '#ef4444', 'heart-pulse'],
  ['Entertainment', 'expense', '#6366f1', 'gamepad'],
  ['Education', 'expense', '#14b8a6', 'graduation-cap'],
  ['Travel', 'expense', '#0ea5e9', 'plane'],
  ['Subscriptions', 'expense', '#d946ef', 'repeat'],
  ['Other Expense', 'expense', '#64748b', 'circle-dot'],
]

export function seed() {
  const hasCategories = get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')
  const hasAccounts = get<{ n: number }>('SELECT COUNT(*) AS n FROM accounts')
  const isFresh = !hasCategories?.n && !hasAccounts?.n
  if (!isFresh) return

  transaction(() => {
    for (const [name, type, color, icon] of defaultCategories) {
      run('INSERT INTO categories (id, name, type, color, icon) VALUES (:id, :name, :type, :color, :icon)', {
        id: uid(),
        name,
        type,
        color,
        icon,
      })
    }
    const now = new Date().toISOString()
    run(
      'INSERT INTO accounts (id, name, type, color, icon, initialBalance, createdAt) VALUES (:id, :name, :type, :color, :icon, 0, :createdAt)',
      { id: uid(), name: 'Cash', type: 'cash', color: '#10b981', icon: 'wallet', createdAt: now },
    )
    run(
      'INSERT INTO accounts (id, name, type, color, icon, initialBalance, createdAt) VALUES (:id, :name, :type, :color, :icon, 0, :createdAt)',
      { id: uid(), name: 'Bank', type: 'bank', color: '#6366f1', icon: 'landmark', createdAt: now },
    )
    run("INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'USD'), ('locale', 'en-US')")
  })
}
