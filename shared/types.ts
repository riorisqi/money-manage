export type TxType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit' | 'savings' | 'investment'

export interface Account {
  id: string
  name: string
  type: AccountType
  color: string
  icon: string
  initialBalance: number
  balance: number
  createdAt: string
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  icon: string
}

export interface Transaction {
  id: string
  type: TxType
  amount: number
  accountId: string
  toAccountId: string | null
  categoryId: string | null
  note: string
  date: string
  createdAt: string
}

export interface Budget {
  id: string
  categoryId: string
  amount: number
}

export interface Note {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export const LOT_SIZE = 100

export type TradeSide = 'buy' | 'sell'

export interface Trade {
  id: string
  symbol: string
  side: TradeSide
  lots: number
  price: number
  fee: number
  accountId: string | null
  note: string
  date: string
  createdAt: string
}

export interface Quote {
  symbol: string
  name: string
  price: number
  previousClose: number
  currency: string
  history: number[]
  updatedAt: string
  stale: boolean
}

export interface Holding {
  symbol: string
  name: string
  lots: number
  avgPrice: number
  cost: number
  price: number
  previousClose: number
  marketValue: number
  unrealized: number
  unrealizedPct: number
  dayChange: number
  dayChangePct: number
  realized: number
  history: number[]
  updatedAt: string | null
  stale: boolean
}

export interface Portfolio {
  holdings: Holding[]
  totals: {
    marketValue: number
    cost: number
    unrealized: number
    unrealizedPct: number
    dayChange: number
    dayChangePct: number
    realized: number
  }
  updatedAt: string | null
}

export interface MarketQuote {
  symbol: string
  label: string
  name: string
  price: number
  previousClose: number
  change: number
  changePct: number
  series: number[]
  marketTime: string
  open: boolean
  updatedAt: string
  stale: boolean
}

export interface Market {
  ihsg: MarketQuote | null
  rates: MarketQuote[]
}

export interface Settings {
  currency: string
  locale: string
}

export interface Bootstrap {
  accounts: Account[]
  categories: Category[]
  budgets: Budget[]
  settings: Settings
}

export interface CategoryTotal {
  categoryId: string | null
  type: CategoryType
  total: number
  count: number
}

export interface SeriesPoint {
  key: string
  income: number
  expense: number
}

export interface Stats {
  from: string
  to: string
  income: number
  expense: number
  net: number
  count: number
  previous: { income: number; expense: number }
  byCategory: CategoryTotal[]
  series: SeriesPoint[]
}

export interface Backup {
  version: 1
  exportedAt: string
  accounts: Omit<Account, 'balance'>[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  notes: Note[]
  trades: Trade[]
  settings: Settings
}
