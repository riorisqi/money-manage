import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type {
  Account,
  Backup,
  Bootstrap,
  Budget,
  Category,
  Market,
  Note,
  Portfolio,
  Quote,
  Settings,
  Stats,
  Trade,
  Transaction,
} from '@shared/types'

export type TxInput = Omit<Transaction, 'id' | 'createdAt'>
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'balance'>
export type CategoryInput = Omit<Category, 'id'>
export type TradeInput = Omit<Trade, 'id' | 'createdAt'>
export type NoteInput = Pick<Note, 'title' | 'content' | 'color' | 'pinned'>

export interface TxFilters {
  from?: string
  to?: string
  type?: string
  accountId?: string
  categoryId?: string
  q?: string
  limit?: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  })
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })

export const toQuery = (params: object) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : ''
}

export interface AuthStatus {
  configured: boolean
  authenticated: boolean
}

export interface BackupList {
  directory: string
  keep: number
  items: { name: string; size: number; createdAt: string }[]
}

export function useAuthStatus() {
  return useQuery({ queryKey: ['auth'], queryFn: () => request<AuthStatus>('/auth/status'), staleTime: Infinity, retry: 1 })
}

function useAuthAction<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
      await qc.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export const useLogin = () => useAuthAction((password: string) => send('POST', '/auth/login', { password }))
export const useSetupPassword = () => useAuthAction((password: string) => send('POST', '/auth/setup', { password }))
export const useLogout = () => useAuthAction(() => send('POST', '/auth/logout'))
export const useChangePassword = () =>
  useMutation({ mutationFn: (data: { current: string; next: string }) => send('POST', '/auth/change', data) })
export const useLogoutOthers = () => useMutation({ mutationFn: () => send<{ signedOut: number }>('POST', '/auth/logout-others') })

export function useBackups() {
  return useQuery({ queryKey: ['backups'], queryFn: () => request<BackupList>('/backups') })
}

export const useCreateBackup = () => useInvalidating(() => send<{ name: string }>('POST', '/backups'))

export const useRestoreSnapshot = () =>
  useInvalidating((name: string) => send<void>('POST', `/backups/${encodeURIComponent(name)}/restore`))

export function useBootstrap() {
  return useQuery({ queryKey: ['bootstrap'], queryFn: () => request<Bootstrap>('/bootstrap') })
}

export function useTransactions(filters: TxFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => request<Transaction[]>(`/transactions${toQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStats(from: string, to: string, group: 'day' | 'month') {
  return useQuery({
    queryKey: ['stats', from, to, group],
    queryFn: () => request<Stats>(`/stats${toQuery({ from, to, group })}`),
    placeholderData: keepPreviousData,
  })
}

function useInvalidating<TVars, TRes>(fn: (vars: TVars) => Promise<TRes>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() })
}

export const useSaveTransaction = () =>
  useInvalidating(({ id, ...data }: TxInput & { id?: string }) =>
    id ? send<Transaction>('PUT', `/transactions/${id}`, data) : send<Transaction>('POST', '/transactions', data),
  )

export const useDeleteTransaction = () =>
  useInvalidating((id: string) => send<void>('DELETE', `/transactions/${id}`))

export const useSaveAccount = () =>
  useInvalidating(({ id, ...data }: AccountInput & { id?: string }) =>
    id ? send<Account>('PUT', `/accounts/${id}`, data) : send<Account>('POST', '/accounts', data),
  )

export const useDeleteAccount = () => useInvalidating((id: string) => send<void>('DELETE', `/accounts/${id}`))

export const useSaveCategory = () =>
  useInvalidating(({ id, ...data }: CategoryInput & { id?: string }) =>
    id ? send<Category>('PUT', `/categories/${id}`, data) : send<Category>('POST', '/categories', data),
  )

export const useDeleteCategory = () => useInvalidating((id: string) => send<void>('DELETE', `/categories/${id}`))

export function usePortfolio(enabled = true) {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => request<Portfolio>('/portfolio'),
    refetchInterval: 60_000,
    enabled,
  })
}

export function useMarket() {
  return useQuery({
    queryKey: ['market'],
    queryFn: () => request<Market>('/market'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  })
}

export function useStocksValue() {
  const { data: boot } = useBootstrap()
  const isIdr = boot?.settings.currency === 'IDR'
  const { data } = usePortfolio(isIdr)
  return isIdr ? (data?.totals.marketValue ?? 0) : 0
}

export const refreshPortfolio = () => request<Portfolio>('/portfolio?refresh=1')

export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => request<Quote>(`/stocks/${encodeURIComponent(symbol)}`),
    enabled: /^[A-Z0-9]{2,8}$/.test(symbol),
    retry: false,
    staleTime: 60_000,
  })
}

export function useTrades() {
  return useQuery({ queryKey: ['trades'], queryFn: () => request<Trade[]>('/trades') })
}

export const useSaveTrade = () => useInvalidating((data: TradeInput) => send<Trade>('POST', '/trades', data))

export const useDeleteTrade = () => useInvalidating((id: string) => send<void>('DELETE', `/trades/${id}`))

export function useNotes() {
  return useQuery({ queryKey: ['notes'], queryFn: () => request<Note[]>('/notes') })
}

export const useSaveNote = () =>
  useInvalidating(({ id, ...data }: NoteInput & { id?: string }) =>
    id ? send<Note>('PUT', `/notes/${id}`, data) : send<Note>('POST', '/notes', data),
  )

export const useDeleteNote = () => useInvalidating((id: string) => send<void>('DELETE', `/notes/${id}`))

export const useSaveBudget = () =>
  useInvalidating((data: Omit<Budget, 'id'>) => send<Budget>('PUT', '/budgets', data))

export const useDeleteBudget = () =>
  useInvalidating((categoryId: string) => send<void>('DELETE', `/budgets/${categoryId}`))

export const useSaveSettings = () => useInvalidating((data: Settings) => send<Settings>('PUT', '/settings', data))

export const useRestoreBackup = () => useInvalidating((data: Backup) => send<void>('POST', '/backup', data))

export const useWipeData = () =>
  useInvalidating((scope: 'transactions' | 'all') => send<void>('DELETE', `/data${toQuery({ scope })}`))

export const fetchBackup = () => request<Backup>('/backup')

export const fetchCsv = async (filters: TxFilters) => {
  const res = await fetch(`/api/transactions.csv${toQuery(filters)}`)
  if (!res.ok) throw new Error('Export failed')
  return res.text()
}
