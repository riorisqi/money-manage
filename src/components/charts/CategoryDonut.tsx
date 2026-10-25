import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { CategoryTotal } from '@shared/types'
import { useMoney } from '@/lib/format'
import { IconBadge } from '@/lib/icons'
import { useLookups } from '../TransactionList'
import { cn } from '@/lib/utils'

export function CategoryDonut({ totals, type }: { totals: CategoryTotal[]; type: 'income' | 'expense' }) {
  const money = useMoney()
  const lookups = useLookups()
  const [active, setActive] = useState<number | null>(null)

  const rows = useMemo(() => {
    const filtered = totals.filter((t) => t.type === type)
    const sum = filtered.reduce((s, t) => s + t.total, 0)
    return filtered.map((t) => {
      const cat = t.categoryId ? lookups.category.get(t.categoryId) : undefined
      return {
        id: t.categoryId ?? 'none',
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#64748b',
        icon: cat?.icon ?? 'circle-dot',
        total: t.total,
        count: t.count,
        pct: sum ? (t.total / sum) * 100 : 0,
      }
    })
  }, [totals, type, lookups])

  const sum = rows.reduce((s, r) => s + r.total, 0)
  const focus = active !== null ? rows[active] : null

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto size-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="total"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={rows.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
              animationDuration={1000}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {rows.map((r, i) => (
                <Cell
                  key={r.id}
                  fill={r.color}
                  opacity={active === null || active === i ? 1 : 0.3}
                  style={{ transition: 'opacity .2s', outline: 'none', filter: active === i ? `drop-shadow(0 0 8px ${r.color})` : undefined }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <motion.div key={focus?.id ?? 'all'} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="max-w-24 truncate text-[11px] text-muted">{focus ? focus.name : 'Total'}</div>
            <div className="font-display text-base font-semibold tabular">{money.compact(focus ? focus.total : sum)}</div>
            {focus && <div className="text-[11px] text-muted">{focus.pct.toFixed(1)}%</div>}
          </motion.div>
        </div>
      </div>
      <div className="space-y-1">
        {rows.slice(0, 6).map((r, i) => (
          <div
            key={r.id}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn('flex items-center gap-3 rounded-xl px-2 py-1.5 transition', active === i && 'bg-subtle')}
          >
            <IconBadge name={r.icon} color={r.color} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{r.name}</span>
                <span className="font-mono text-xs tabular">{money.compact(r.total)}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-subtle">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: r.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.pct}%` }}
                  transition={{ delay: 0.2 + i * 0.06, type: 'spring', stiffness: 70, damping: 18 }}
                />
              </div>
            </div>
          </div>
        ))}
        {rows.length > 6 && <div className="px-2 pt-1 text-xs text-muted">+{rows.length - 6} more categories</div>}
      </div>
    </div>
  )
}
