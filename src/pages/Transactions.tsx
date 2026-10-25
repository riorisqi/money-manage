import { useDeferredValue, useMemo, useState } from 'react'
import { Download, Infinity as InfinityIcon, Plus, Search, SearchX, X } from 'lucide-react'
import { fetchCsv, useBootstrap, useTransactions, type TxFilters } from '@/lib/api'
import { useMoney } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { cn, download } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { PeriodPicker } from '@/components/PeriodPicker'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Segmented, Select } from '@/components/ui/Form'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { GroupedTransactions } from '@/components/TransactionList'
import { useTxForm } from '@/components/TransactionForm'
import { useToast } from '@/components/ui/Toast'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

type TypeFilter = 'all' | 'income' | 'expense' | 'transfer'

export function Transactions() {
  const period = usePeriod()
  const money = useMoney()
  const toast = useToast()
  const { openTx } = useTxForm()
  const { data: boot } = useBootstrap()
  const [allTime, setAllTime] = useState(false)
  const [type, setType] = useState<TypeFilter>('all')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())

  const filters: TxFilters = {
    from: allTime ? undefined : period.from,
    to: allTime ? undefined : period.to,
    type: type === 'all' ? undefined : type,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    q: q || undefined,
  }
  const { data: items = [], isLoading, isFetching } = useTransactions(filters)

  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of items) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
    }
    return { income, expense, net: income - expense }
  }, [items])

  const categories = (boot?.categories ?? []).filter((c) => type === 'all' || c.type === type)
  const hasFilters = type !== 'all' || accountId || categoryId || search

  const exportCsv = async () => {
    try {
      const csv = await fetchCsv(filters)
      download(`transactions-${allTime ? 'all' : period.label.replace(/\s+/g, '-').toLowerCase()}.csv`, csv, 'text/csv')
      toast({ message: 'CSV exported' })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={allTime ? 'All time' : period.label}
        actions={
          <>
            {!allTime && <PeriodPicker />}
            <Button
              variant={allTime ? 'primary' : 'outline'}
              size="sm"
              className="h-9"
              onClick={() => setAllTime((v) => !v)}
              title="Toggle all time"
            >
              <InfinityIcon className="size-4" />
              All time
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Income', value: summary.income, cls: 'text-emerald-500' },
          { label: 'Expenses', value: summary.expense, cls: 'text-rose-500' },
          { label: 'Net', value: summary.net, cls: summary.net >= 0 ? 'text-fg' : 'text-rose-500' },
        ].map((s) => (
          <Card key={s.label} className="p-3 sm:p-4">
            <div className="text-[11px] text-muted sm:text-xs">{s.label}</div>
            <div className={cn('mt-0.5 truncate font-display text-sm font-semibold tabular sm:text-xl', s.cls)}>
              <AnimatedNumber value={s.value} format={money.compact} duration={0.6} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, categories, amounts…"
                className="pl-10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted hover:text-fg"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11" onClick={exportCsv} title="Export CSV">
              <Download className="size-4" />
            </Button>
            <Button variant="primary" className="h-11 max-sm:hidden" onClick={() => openTx()}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={type}
              onChange={(v) => {
                setType(v)
                setCategoryId('')
              }}
              className="max-sm:w-full"
              options={[
                { value: 'all', label: 'All' },
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
                { value: 'transfer', label: 'Transfer' },
              ]}
            />
            <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-9 text-xs sm:w-44">
                <option value="">All accounts</option>
                {boot?.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 text-xs sm:w-44"
                disabled={type === 'transfer'}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setType('all')
                  setAccountId('')
                  setCategoryId('')
                  setSearch('')
                }}
                className="cursor-pointer text-xs font-medium text-violet-500 hover:underline"
              >
                Reset filters
              </button>
            )}
            <span className={cn('ml-auto text-xs text-muted transition', isFetching && 'animate-pulse')}>
              {items.length} result{items.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length ? (
          <GroupedTransactions items={items} />
        ) : (
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No transactions found"
            message={hasFilters ? 'Try adjusting the filters or search.' : 'Nothing recorded for this period yet.'}
            action={
              <Button variant="primary" onClick={() => openTx()}>
                <Plus className="size-4" /> Add transaction
              </Button>
            }
          />
        )}
      </Card>
    </div>
  )
}
