import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { eachDayOfInterval, eachMonthOfInterval, format, parseISO } from 'date-fns'
import type { SeriesPoint } from '@shared/types'
import { useMoney } from '@/lib/format'

interface Props {
  series: SeriesPoint[]
  from: string
  to: string
  group: 'day' | 'month'
  cumulative?: boolean
}

export function CashflowChart({ series, from, to, group, cumulative }: Props) {
  const money = useMoney()

  const data = useMemo(() => {
    const byKey = new Map(series.map((p) => [p.key, p]))
    const interval = { start: parseISO(from), end: parseISO(to) }
    const keys =
      group === 'day'
        ? eachDayOfInterval(interval).map((d) => format(d, 'yyyy-MM-dd'))
        : eachMonthOfInterval(interval).map((d) => format(d, 'yyyy-MM'))
    let inc = 0
    let exp = 0
    return keys.map((key) => {
      const p = byKey.get(key)
      inc = cumulative ? inc + (p?.income ?? 0) : (p?.income ?? 0)
      exp = cumulative ? exp + (p?.expense ?? 0) : (p?.expense ?? 0)
      const date = parseISO(group === 'day' ? key : `${key}-01`)
      return {
        key,
        label: group === 'day' ? format(date, 'd MMM') : format(date, 'MMM'),
        full: group === 'day' ? format(date, 'EEE, d MMM yyyy') : format(date, 'MMMM yyyy'),
        income: inc,
        expense: exp,
      }
    })
  }, [series, from, to, group, cumulative])

  const renderTooltip = (active: boolean | undefined, payload: readonly { payload?: unknown }[] | undefined) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload as (typeof data)[number]
    return (
      <div className="rounded-xl border border-line bg-elevated/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
        <div className="mb-1.5 font-medium">{row.full}</div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-muted">Income</span>
          <span className="ml-auto pl-4 font-mono">{money.format(row.income)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-rose-500" />
          <span className="text-muted">Expense</span>
          <span className="ml-auto pl-4 font-mono">{money.format(row.expense)}</span>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          minTickGap={24}
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          tickFormatter={money.axis}
          width={64}
        />
        <Tooltip content={({ active, payload }) => renderTooltip(active, payload)} cursor={{ stroke: 'var(--muted)', strokeDasharray: '4 4', strokeOpacity: 0.5 }} />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={2.5}
          fill="url(#gIncome)"
          animationDuration={1200}
          activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--elevated)' }}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#f43f5e"
          strokeWidth={2.5}
          fill="url(#gExpense)"
          animationDuration={1400}
          activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--elevated)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
