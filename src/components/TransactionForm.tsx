import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Trash2 } from 'lucide-react'
import { subDays } from 'date-fns'
import type { Transaction, TxType } from '@shared/types'
import { useBootstrap, useDeleteTransaction, useSaveTransaction, type TxInput } from '@/lib/api'
import { toISODate, useMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAmountInput } from '@/lib/amount'
import { IconBadge } from '@/lib/icons'
import { Modal } from './ui/Modal'
import { DateInput } from './ui/DateInput'
import { Button } from './ui/Button'
import { Field, Input, Segmented, Select } from './ui/Form'
import { Kbd } from './ui/Misc'
import { useToast } from './ui/Toast'

type Draft = Partial<Transaction>

const Ctx = createContext<{ openTx: (draft?: Draft) => void } | null>(null)

export function useTxForm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTxForm must be used inside TxFormProvider')
  return ctx
}

export function useDeleteWithUndo() {
  const del = useDeleteTransaction()
  const save = useSaveTransaction()
  const toast = useToast()
  return useCallback(
    async (tx: Transaction) => {
      await del.mutateAsync(tx.id)
      const { id: _id, createdAt: _c, ...rest } = tx
      toast({
        message: 'Transaction deleted',
        tone: 'info',
        duration: 6000,
        action: { label: 'Undo', onClick: () => save.mutate(rest) },
      })
    },
    [del, save, toast],
  )
}

export function TxFormProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const openTx = useCallback((d?: Draft) => setDraft(d ?? {}), [])
  const close = useCallback(() => setDraft(null), [])

  return (
    <Ctx.Provider value={{ openTx }}>
      {children}
      <Modal open={!!draft} onClose={close} title={draft?.id ? 'Edit transaction' : 'New transaction'}>
        {draft && <TransactionForm key={draft.id ?? 'new'} draft={draft} onDone={close} />}
      </Modal>
    </Ctx.Provider>
  )
}

const typeMeta: Record<TxType, { label: string; icon: ReactNode; color: string; ring: string }> = {
  expense: {
    label: 'Expense',
    icon: <ArrowUpRight className="size-4" />,
    color: 'text-rose-500',
    ring: '!bg-rose-500/15 !ring-rose-500/30',
  },
  income: {
    label: 'Income',
    icon: <ArrowDownLeft className="size-4" />,
    color: 'text-emerald-500',
    ring: '!bg-emerald-500/15 !ring-emerald-500/30',
  },
  transfer: {
    label: 'Transfer',
    icon: <ArrowLeftRight className="size-4" />,
    color: 'text-sky-500',
    ring: '!bg-sky-500/15 !ring-sky-500/30',
  },
}

function celebrate(origin: HTMLElement | null) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = origin?.getBoundingClientRect()
  const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5
  const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.7
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: { x, y },
    colors: ['#10b981', '#06b6d4', '#8b5cf6', '#facc15'],
    zIndex: 70,
    scalar: 0.9,
  })
}

function TransactionForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const { data } = useBootstrap()
  const money = useMoney()
  const toast = useToast()
  const save = useSaveTransaction()
  const deleteWithUndo = useDeleteWithUndo()
  const submitRef = useRef<HTMLButtonElement>(null)

  const accounts = data?.accounts ?? []
  const categories = data?.categories ?? []

  const [type, setType] = useState<TxType>(draft.type ?? 'expense')
  const amountInput = useAmountInput(draft.amount)
  const [accountId, setAccountId] = useState(draft.accountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(draft.toAccountId ?? accounts[1]?.id ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(draft.categoryId ?? null)
  const [date, setDate] = useState(draft.date ?? toISODate(new Date()))
  const [note, setNote] = useState(draft.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const amount = amountInput.amount
  const isExpression = /[+\-*/x()km]/i.test(amountInput.text.replace(/^-/, ''))
  const visibleCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  useEffect(() => {
    if (type !== 'transfer' && categoryId && !visibleCategories.some((c) => c.id === categoryId)) setCategoryId(null)
  }, [type, categoryId, visibleCategories])

  const submit = async (again = false) => {
    setError(null)
    if (!amount || amount <= 0) return setError('Enter a valid amount')
    if (!accountId) return setError('Choose an account')
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return setError('Choose a different destination account')
    const payload: TxInput & { id?: string } = {
      id: draft.id,
      type,
      amount,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : categoryId,
      note: note.trim(),
      date,
    }
    try {
      await save.mutateAsync(payload)
      if (type === 'income' && !draft.id) celebrate(submitRef.current)
      toast({ message: draft.id ? 'Transaction updated' : `${typeMeta[type].label} of ${money.format(amount)} saved` })
      if (again) {
        amountInput.setAmount(null)
        setNote('')
        amountInput.ref.current?.focus()
      } else onDone()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const today = toISODate(new Date())
  const yesterday = toISODate(subDays(new Date(), 1))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          submit()
        }
      }}
      className="space-y-5"
    >
      <Segmented
        value={type}
        onChange={setType}
        className="flex w-full"
        options={(Object.keys(typeMeta) as TxType[]).map((t) => ({
          value: t,
          activeClass: typeMeta[t].ring,
          label: (
            <span className={cn('flex items-center gap-1.5', type === t && typeMeta[t].color)}>
              {typeMeta[t].icon}
              {typeMeta[t].label}
            </span>
          ),
        }))}
      />

      <div className="relative overflow-hidden rounded-2xl border border-line bg-subtle px-4 pt-3 pb-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Amount</span>
          <span className="hidden sm:inline">
            Supports math like <span className="font-mono">25k+500</span>
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className={cn('font-display text-2xl font-semibold', typeMeta[type].color)}>{money.symbol}</span>
          <input
            {...amountInput.inputProps}
            autoFocus
            placeholder="0"
            className="w-full min-w-0 bg-transparent font-display text-4xl font-semibold tracking-tight outline-none tabular placeholder:text-muted/40"
          />
        </div>
        <AnimatePresence>
          {isExpression && amount !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="font-mono text-sm text-muted"
            >
              = {money.format(amount)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {type === 'transfer' ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="From">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <button
            type="button"
            onClick={() => {
              setAccountId(toAccountId)
              setToAccountId(accountId)
            }}
            className="mb-1 grid size-9 cursor-pointer place-items-center rounded-full border border-line text-sky-500 transition hover:rotate-180 hover:bg-sky-500/10"
            aria-label="Swap accounts"
          >
            <ArrowLeftRight className="size-4" />
          </button>
          <Field label="To">
            <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Category</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {visibleCategories.map((c, i) => {
                const active = c.id === categoryId
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.015 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setCategoryId(active ? null : c.id)}
                    className={cn(
                      'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition',
                      active ? 'border-transparent' : 'border-line hover:bg-subtle',
                    )}
                    style={active ? { background: `${c.color}18`, boxShadow: `inset 0 0 0 1.5px ${c.color}` } : undefined}
                  >
                    <IconBadge name={c.icon} color={c.color} size="sm" />
                    <span className="line-clamp-1 text-[11px] leading-tight font-medium">{c.name}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {money.format(a.balance)}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Date"
          hint={
            <span className="flex gap-1">
              {[
                ['Today', today],
                ['Yesterday', yesterday],
              ].map(([l, v]) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setDate(v)}
                  className={cn('cursor-pointer rounded px-1 hover:text-fg', date === v && 'text-violet-500')}
                >
                  {l}
                </button>
              ))}
            </span>
          }
        >
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" maxLength={500} />
        </Field>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
            exit={{ opacity: 0 }}
            className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {draft.id ? (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            onClick={async () => {
              await deleteWithUndo(draft as Transaction)
              onDone()
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => submit(true)} disabled={save.isPending}>
            Save & add another
          </Button>
        )}
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted sm:flex">
          <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
        </span>
        <Button ref={submitRef} type="submit" variant="primary" loading={save.isPending} className="min-w-28">
          {draft.id ? 'Save changes' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
