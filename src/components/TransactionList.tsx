import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Trash2 } from 'lucide-react'
import type { Transaction } from '@shared/types'
import { useBootstrap } from '@/lib/api'
import { friendlyDate, useMoney } from '@/lib/format'
import { IconBadge } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useDeleteWithUndo, useTxForm } from './TransactionForm'

export function useLookups() {
  const { data } = useBootstrap()
  return useMemo(
    () => ({
      account: new Map(data?.accounts.map((a) => [a.id, a])),
      category: new Map(data?.categories.map((c) => [c.id, c])),
    }),
    [data],
  )
}

export function TransactionRow({ tx, compact }: { tx: Transaction; compact?: boolean }) {
  const lookups = useLookups()
  const money = useMoney()
  const { openTx } = useTxForm()
  const deleteWithUndo = useDeleteWithUndo()

  const account = lookups.account.get(tx.accountId)
  const toAccount = tx.toAccountId ? lookups.account.get(tx.toAccountId) : undefined
  const category = tx.categoryId ? lookups.category.get(tx.categoryId) : undefined

  const isTransfer = tx.type === 'transfer'
  const iconName = isTransfer ? 'repeat' : (category?.icon ?? 'circle-dot')
  const iconColor = isTransfer ? '#0ea5e9' : (category?.color ?? '#64748b')
  const title = isTransfer ? 'Transfer' : category?.name ?? 'Uncategorized'
  const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className="group relative flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-subtle"
      onClick={() => openTx(tx)}
    >
      <IconBadge name={iconName} color={iconColor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{tx.note && compact ? tx.note : title}</span>
        </div>
        <div className="flex items-center gap-1 truncate text-xs text-muted">
          {isTransfer ? (
            <>
              <span className="truncate">{account?.name}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span className="truncate">{toAccount?.name}</span>
            </>
          ) : (
            <span className="truncate">
              {compact ? `${title} · ${account?.name ?? ''}` : account?.name}
              {!compact && tx.note && <span className="opacity-80"> · {tx.note}</span>}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            'font-mono text-sm font-semibold tabular',
            tx.type === 'income' && 'text-emerald-500',
            tx.type === 'expense' && 'text-fg',
            isTransfer && 'text-sky-500',
          )}
        >
          {sign}
          {money.format(tx.amount)}
        </div>
        {compact && <div className="text-[11px] text-muted">{friendlyDate(tx.date)}</div>}
      </div>
      {!compact && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteWithUndo(tx)
          }}
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 max-sm:hidden"
          aria-label="Delete transaction"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </motion.div>
  )
}

export function GroupedTransactions({ items }: { items: Transaction[] }) {
  const money = useMoney()
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of items) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()]
  }, [items])

  return (
    <div className="space-y-5">
      <AnimatePresence initial={false}>
        {groups.map(([date, txs]) => {
          const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
          return (
            <motion.section key={date} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sticky top-16 z-10 -mx-2 mb-1 flex items-center justify-between bg-gradient-to-b from-elevated via-elevated/90 to-transparent px-2 py-1.5 text-xs font-medium text-muted lg:top-0">
                <span>{friendlyDate(date)}</span>
                <span className={cn('font-mono tabular', net > 0 ? 'text-emerald-500' : net < 0 && 'text-rose-500')}>
                  {net > 0 ? '+' : ''}
                  {money.format(net)}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {txs.map((t) => (
                  <TransactionRow key={t.id} tx={t} />
                ))}
              </AnimatePresence>
            </motion.section>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
