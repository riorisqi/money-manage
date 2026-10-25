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
  settings: Settings
}
