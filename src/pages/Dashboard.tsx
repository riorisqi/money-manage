import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { differenceInCalendarDays, getDaysInMonth, parseISO } from 'date-fns'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Gauge,
  Lightbulb,
  Plus,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useBootstrap, useStats, useStocksValue, useTransactions } from '@/lib/api'
import { percentChange, useMoney } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { IconBadge } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { PeriodPicker } from '@/components/PeriodPicker'
import { MarketStrip } from '@/components/MarketStrip'
import { Card, CardHeader, Pill } from '@/components/ui/Card'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Segmented } from '@/components/ui/Form'
import { EmptyState, Progress, Skeleton } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { CashflowChart } from '@/components/charts/CashflowChart'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { TransactionRow, useLookups } from '@/components/TransactionList'
import { useTxForm } from '@/components/TransactionForm'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

function Delta({ value, invert }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0
  const Icon = value >= 0 ? TrendingUp : TrendingDown
  return (
    <Pill className={good ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}>
      <Icon className="size-3" />
      {Math.abs(value).toFixed(0)}%
    </Pill>
  )
}

export function Dashboard() {
  const period = usePeriod()
  const money = useMoney()
  const { openTx } = useTxForm()
  const { data: boot } = useBootstrap()
  const { data: stats, isLoading } = useStats(period.from, period.to, period.group)
  const { data: recent = [] } = useTransactions({ from: period.from, to: period.to, limit: 6 })
  const lookups = useLookups()
  const [chartMode, setChartMode] = useState<'flow' | 'cumulative'>('flow')
  const [donutType, setDonutType] = useState<'expense' | 'income'>('expense')

  const accounts = boot?.accounts ?? []
  const stocksValue = useStocksValue()
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0) + stocksValue
  const income = stats?.income ?? 0
  const expense = stats?.expense ?? 0
  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0

  const insights = useMemo(() => {
    if (!stats) return []
    const list: { icon: ReactNode; text: ReactNode; tone: string }[] = []
    const start = parseISO(stats.from)
    const end = parseISO(stats.to)
    const today = new Date()
    const elapsed = Math.max(1, differenceInCalendarDays(today < end ? today : end, start) + 1)
    const avgDaily = stats.expense / elapsed
    if (stats.expense > 0) {
      list.push({
        icon: <Gauge className="size-4" />,
        tone: 'text-sky-500 bg-sky-500/10',
        text: (
          <>
            You spend about <b className="text-fg">{money.format(avgDaily)}</b> per day
          </>
        ),
      })
    }
    if (period.mode === 'month' && period.isCurrent && stats.expense > 0) {
      const projected = avgDaily * getDaysInMonth(start)
      list.push({
        icon: <Sparkles className="size-4" />,
        tone: 'text-violet-500 bg-violet-500/10',
        text: (
          <>
            Projected spending this month: <b className="text-fg">{money.format(projected)}</b>
          </>
        ),
      })
    }
    const top = stats.byCategory.find((c) => c.type === 'expense')
    if (top) {
      const cat = top.categoryId ? lookups.category.get(top.categoryId) : undefined
      list.push({
        icon: <Flame className="size-4" />,
        tone: 'text-orange-500 bg-orange-500/10',
        text: (
          <>
            Top spending: <b className="text-fg">{cat?.name ?? 'Uncategorized'}</b> at{' '}
            {stats.expense ? ((top.total / stats.expense) * 100).toFixed(0) : 0}% of expenses
          </>
        ),
      })
    }
    const change = percentChange(stats.expense, stats.previous.expense)
    if (stats.previous.expense > 0) {
      list.push({
        icon: change <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />,
        tone: change <= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10',
        text: (
          <>
            Spending is {change <= 0 ? 'down' : 'up'} <b className="text-fg">{Math.abs(change).toFixed(0)}%</b> vs the
            previous {period.mode}
          </>
        ),
      })
    }
    return list
  }, [stats, money, lookups, period.mode, period.isCurrent])

  const budgetRows = useMemo(() => {
    if (!boot || !stats || period.mode !== 'month') return []
    return boot.budgets
      .map((b) => {
        const cat = lookups.category.get(b.categoryId)
        const spent = stats.byCategory.find((c) => c.categoryId === b.categoryId && c.type === 'expense')?.total ?? 0
        return { ...b, cat, spent, pct: (spent / b.amount) * 100 }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4)
  }, [boot, stats, lookups, period.mode])

  const stat = [
    {
      label: 'Income',
      value: income,
      icon: <ArrowDownLeft className="size-4" />,
      tone: 'text-emerald-500 bg-emerald-500/10',
      delta: <Delta value={percentChange(income, stats?.previous.income ?? 0)} />,
    },
    {
      label: 'Expenses',
      value: expense,
      icon: <ArrowUpRight className="size-4" />,
      tone: 'text-rose-500 bg-rose-500/10',
      delta: <Delta value={percentChange(expense, stats?.previous.expense ?? 0)} invert />,
    },
  ]

  return (
    <div>
      <PageHeader title={`${greeting()} 👋`} subtitle={`Here's your money at a glance for ${period.label}.`} actions={<PeriodPicker />} />

      <MarketStrip compact className="mb-4" />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="relative overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-2xl shadow-violet-600/25 lg:col-span-2"
        >
          <div className="absolute -top-20 -right-16 size-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 left-10 size-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <svg className="absolute inset-0 size-full opacity-[0.12]" aria-hidden>
            <defs>
              <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" style={{ maskImage: 'linear-gradient(to left, black, transparent 70%)' }} />
          </svg>
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/75">Total balance</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                {accounts.length} account{accounts.length === 1 ? '' : 's'}
                {stocksValue > 0 && ' + stocks'}
              </span>
            </div>
            <div className="mt-3 font-display text-4xl font-bold tracking-tight tabular sm:text-5xl">
              <AnimatedNumber value={totalBalance} format={money.format} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  (stats?.net ?? 0) >= 0 ? 'bg-emerald-400/25 text-emerald-100' : 'bg-rose-400/25 text-rose-100',
                )}
              >
                {(stats?.net ?? 0) >= 0 ? '+' : ''}
                {money.format(stats?.net ?? 0)}
              </span>
              net in {period.label}
            </div>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {accounts.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}
                  className="min-w-36 shrink-0 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-md"
                >
                  <div className="truncate text-xs text-white/70">{a.name}</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular">{money.compact(a.balance)}</div>
                </motion.div>
              ))}
              {stocksValue > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + accounts.length * 0.07 }}
                  className="shrink-0"
                >
                  <Link
                    to="/stocks"
                    className="block min-w-36 rounded-2xl border border-white/25 bg-white/20 px-3.5 py-3 backdrop-blur-md transition hover:bg-white/30"
                  >
                    <div className="flex items-center gap-1 text-xs text-white/80">
                      <TrendingUp className="size-3" /> Stocks
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-semibold tabular">{money.compact(stocksValue)}</div>
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {stat.map((s) => (
            <Card key={s.label} className="flex items-center gap-4 p-4">
              <span className={cn('grid size-11 place-items-center rounded-xl', s.tone)}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  {s.label}
                  {stats && s.delta}
                </div>
                <div className="mt-0.5 truncate font-display text-xl font-semibold tabular">
                  {isLoading ? <Skeleton className="h-7 w-28" /> : <AnimatedNumber value={s.value} format={money.format} />}
                </div>
              </div>
            </Card>
          ))}
          <Card className="flex items-center gap-4 p-4">
            <div className="relative size-11">
              <svg viewBox="0 0 36 36" className="size-11 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="url(#rate)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: Math.max(0, Math.min(1, savingsRate / 100)) }}
                  transition={{ type: 'spring', stiffness: 50, damping: 15, delay: 0.3 }}
                />
                <defs>
                  <linearGradient id="rate">
                    <stop offset="0" stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted">Savings rate</div>
              <div className="mt-0.5 font-display text-xl font-semibold tabular">
                <AnimatedNumber value={savingsRate} format={(n) => `${n.toFixed(0)}%`} />
              </div>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Cash flow"
            subtitle={period.mode === 'month' ? 'Daily income vs expenses' : 'Monthly income vs expenses'}
            action={
              <Segmented
                size="sm"
                value={chartMode}
                onChange={setChartMode}
                options={[
                  { value: 'flow', label: 'Flow' },
                  { value: 'cumulative', label: 'Cumulative' },
                ]}
              />
            }
          />
          <div className="h-64">
            {stats ? (
              <CashflowChart
                series={stats.series}
                from={period.from}
                to={period.to}
                group={period.group}
                cumulative={chartMode === 'cumulative'}
              />
            ) : (
              <Skeleton className="size-full" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Insights"
            subtitle="Generated from your activity"
            action={<Lightbulb className="size-4 animate-float text-amber-400" />}
          />
          {insights.length ? (
            <ul className="space-y-3">
              {insights.map((ins, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="flex gap-3 text-sm text-muted"
                >
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', ins.tone)}>{ins.icon}</span>
                  <span className="pt-1.5 leading-snug">{ins.text}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Add a few transactions and insights will appear here.</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Breakdown"
            subtitle={`Where your money ${donutType === 'expense' ? 'went' : 'came from'}`}
            action={
              <Segmented
                size="sm"
                value={donutType}
                onChange={setDonutType}
                options={[
                  { value: 'expense', label: 'Expenses' },
                  { value: 'income', label: 'Income' },
                ]}
              />
            }
          />
          {stats && stats.byCategory.some((c) => c.type === donutType) ? (
            <CategoryDonut totals={stats.byCategory} type={donutType} />
          ) : (
            <EmptyState icon={<Receipt className="size-6" />} title="Nothing here yet" message={`No ${donutType} recorded in ${period.label}.`} className="py-8" />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Budgets"
            subtitle={period.mode === 'month' ? 'This month' : 'Switch to month view to track'}
            action={
              <Link to="/budgets" className="text-xs font-medium text-violet-500 hover:underline">
                Manage
              </Link>
            }
          />
          {budgetRows.length ? (
            <div className="space-y-4">
              {budgetRows.map((b) => (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center gap-2 text-sm">
                    {b.cat && <IconBadge name={b.cat.icon} color={b.cat.color} size="sm" />}
                    <span className="flex-1 truncate font-medium">{b.cat?.name}</span>
                    <span className={cn('font-mono text-xs tabular', b.pct > 100 ? 'text-rose-500' : 'text-muted')}>
                      {b.pct.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={b.pct} color={b.pct > 100 ? '#f43f5e' : b.pct > 80 ? '#f59e0b' : (b.cat?.color ?? '#8b5cf6')} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              {period.mode === 'month' ? 'No budgets yet. Set limits to stay on track.' : 'Budgets are tracked monthly.'}
            </p>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent activity"
            subtitle={`Latest transactions in ${period.label}`}
            action={
              <Link to="/transactions" className="group flex items-center gap-1 text-xs font-medium text-violet-500">
                View all <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
              </Link>
            }
          />
          {recent.length ? (
            <div className="grid gap-x-6 md:grid-cols-2">
              {recent.map((t) => (
                <TransactionRow key={t.id} tx={t} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Plus className="size-6" />}
              title="No transactions yet"
              message="Record your first income or expense to bring this dashboard to life."
              action={
                <Button variant="primary" onClick={() => openTx()}>
                  <Plus className="size-4" /> Add transaction
                </Button>
              }
              className="py-8"
            />
          )}
        </Card>
      </motion.div>
    </div>
  )
}
