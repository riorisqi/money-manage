import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { PiggyBank, Plus, Target } from 'lucide-react'
import type { Category } from '@shared/types'
import { useBootstrap, useDeleteBudget, useSaveBudget, useStats } from '@/lib/api'
import { useMoney } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { IconBadge } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useAmountInput } from '@/lib/amount'
import { PageHeader } from '@/components/Layout'
import { PeriodPicker } from '@/components/PeriodPicker'
import { Card, CardHeader, Pill } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input } from '@/components/ui/Form'
import { EmptyState, Progress } from '@/components/ui/Misc'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { useToast } from '@/components/ui/Toast'

function barColor(pct: number, fallback: string) {
  if (pct > 100) return '#f43f5e'
  if (pct > 80) return '#f59e0b'
  return fallback
}

export function Budgets() {
  const period = usePeriod()
  const money = useMoney()
  const { data: boot } = useBootstrap()
  const { data: stats } = useStats(period.from, period.to, period.group)
  const [editing, setEditing] = useState<Category | null>(null)

  useEffect(() => {
    if (period.mode !== 'month') period.setMode('month')
  }, [period])

  const rows = useMemo(() => {
    const expenseCats = (boot?.categories ?? []).filter((c) => c.type === 'expense')
    const budgets = new Map(boot?.budgets.map((b) => [b.categoryId, b.amount]))
    return expenseCats.map((cat) => {
      const spent = stats?.byCategory.find((x) => x.categoryId === cat.id && x.type === 'expense')?.total ?? 0
      const limit = budgets.get(cat.id)
      return { cat, spent, limit, pct: limit ? (spent / limit) * 100 : 0 }
    })
  }, [boot, stats])

  const budgeted = rows.filter((r) => r.limit).sort((a, b) => b.pct - a.pct)
  const unbudgeted = rows.filter((r) => !r.limit)
  const totalLimit = budgeted.reduce((s, r) => s + (r.limit ?? 0), 0)
  const totalSpent = budgeted.reduce((s, r) => s + r.spent, 0)
  const totalPct = totalLimit ? (totalSpent / totalLimit) * 100 : 0
  const daysLeft = period.isCurrent ? Math.max(1, differenceInCalendarDays(parseISO(period.to), new Date()) + 1) : 0
  const remaining = totalLimit - totalSpent

  return (
    <div>
      <PageHeader title="Budgets" subtitle="Set monthly limits per category and watch them fill up." actions={<PeriodPicker />} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center text-center">
          <div className="relative size-44">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--line)" strokeWidth="10" />
              <motion.circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={totalPct > 100 ? '#f43f5e' : 'url(#budgetGrad)'}
                strokeWidth="10"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.min(1, totalPct / 100) }}
                transition={{ type: 'spring', stiffness: 40, damping: 14 }}
              />
              <defs>
                <linearGradient id="budgetGrad">
                  <stop offset="0" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <div className="font-display text-3xl font-bold tabular">
                  <AnimatedNumber value={totalPct} format={(n) => `${n.toFixed(0)}%`} />
                </div>
                <div className="text-xs text-muted">used</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-muted">
            <span className="font-semibold text-fg">{money.format(totalSpent)}</span> of {money.format(totalLimit)}
          </div>
          {totalLimit > 0 && (
            <div className={cn('mt-1 text-xs', remaining < 0 ? 'text-rose-500' : 'text-muted')}>
              {remaining < 0
                ? `Over budget by ${money.format(-remaining)}`
                : period.isCurrent
                  ? `${money.format(remaining / daysLeft)} / day left for ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                  : `${money.format(remaining)} unspent`}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Active budgets" subtitle={period.label} />
          {budgeted.length ? (
            <div className="space-y-2">
              {budgeted.map((r, i) => (
                <motion.button
                  key={r.cat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setEditing(r.cat)}
                  className="w-full cursor-pointer rounded-xl p-2.5 text-left transition hover:bg-subtle"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <IconBadge name={r.cat.icon} color={r.cat.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{r.cat.name}</span>
                        {r.pct > 100 && <Pill className="bg-rose-500/10 text-rose-500">Over</Pill>}
                        {r.pct > 80 && r.pct <= 100 && <Pill className="bg-amber-500/10 text-amber-500">Close</Pill>}
                      </div>
                      <div className="text-xs text-muted">
                        {money.format(r.spent)} / {money.format(r.limit!)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn('font-mono text-sm font-semibold tabular', r.pct > 100 && 'text-rose-500')}>
                        {r.pct.toFixed(0)}%
                      </div>
                      <div className="text-[11px] text-muted">
                        {r.limit! - r.spent >= 0 ? `${money.compact(r.limit! - r.spent)} left` : `${money.compact(r.spent - r.limit!)} over`}
                      </div>
                    </div>
                  </div>
                  <Progress value={r.pct} color={barColor(r.pct, r.cat.color)} />
                </motion.button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Target className="size-6" />}
              title="No budgets yet"
              message="Pick a category below and give it a monthly limit."
              className="py-8"
            />
          )}
        </Card>

        {unbudgeted.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader title="Categories without a budget" subtitle="Tap one to set a limit" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unbudgeted.map((r) => (
                <button
                  key={r.cat.id}
                  onClick={() => setEditing(r.cat)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-3 text-left transition hover:border-violet-500/50 hover:bg-subtle"
                >
                  <IconBadge name={r.cat.icon} color={r.cat.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.cat.name}</div>
                    <div className="text-xs text-muted">Spent {money.format(r.spent)}</div>
                  </div>
                  <Plus className="size-4 text-muted transition group-hover:rotate-90 group-hover:text-violet-500" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      <BudgetModal
        category={editing}
        current={editing ? boot?.budgets.find((b) => b.categoryId === editing.id)?.amount : undefined}
        spent={editing ? (rows.find((r) => r.cat.id === editing.id)?.spent ?? 0) : 0}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function BudgetModal({
  category,
  current,
  spent,
  onClose,
}: {
  category: Category | null
  current?: number
  spent: number
  onClose: () => void
}) {
  const money = useMoney()
  const toast = useToast()
  const save = useSaveBudget()
  const remove = useDeleteBudget()
  const limit = useAmountInput(current)
  const { setAmount } = limit

  useEffect(() => {
    setAmount(current ?? null)
  }, [category, current, setAmount])

  const amount = limit.amount
  const suggestions = [spent * 1.1, spent * 1.25, spent * 1.5].filter((n) => n > 0).map((n) => Math.ceil(n / 10) * 10)

  const submit = async () => {
    if (!category || !amount || amount <= 0) return
    await save.mutateAsync({ categoryId: category.id, amount })
    toast({ message: `Budget set for ${category.name}` })
    onClose()
  }

  return (
    <Modal open={!!category} onClose={onClose} title={category ? `${category.name} budget` : ''} description="Monthly spending limit">
      {category && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-subtle p-4">
            <IconBadge name={category.icon} color={category.color} size="lg" />
            <div>
              <div className="text-xs text-muted">Spent this month</div>
              <div className="font-display text-xl font-semibold">{money.format(spent)}</div>
            </div>
          </div>
          <Field label={`Limit (${money.symbol})`}>
            <Input autoFocus {...limit.inputProps} placeholder="e.g. 500" />
          </Field>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAmount(s)}
                  className="cursor-pointer rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-violet-500/50 hover:text-fg"
                >
                  {money.format(s)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {current && (
              <Button
                type="button"
                variant="ghost"
                className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                onClick={async () => {
                  await remove.mutateAsync(category.id)
                  toast({ message: 'Budget removed', tone: 'info' })
                  onClose()
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" variant="primary" className="ml-auto" loading={save.isPending} disabled={!amount || amount <= 0}>
              <PiggyBank className="size-4" />
              Save budget
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
