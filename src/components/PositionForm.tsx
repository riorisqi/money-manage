import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { LOT_SIZE, type Holding, type Trade } from '@shared/types'
import { useSetPosition } from '@/lib/api'
import { useAmountInput } from '@/lib/amount'
import { useIdr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Form'
import { useConfirm } from './ui/Confirm'
import { useToast } from './ui/Toast'

export function cashEffect(trades: Trade[]) {
  return trades
    .filter((t) => t.accountId)
    .reduce((sum, t) => {
      const gross = t.lots * LOT_SIZE * t.price
      return sum + (t.side === 'buy' ? -(gross + t.fee) : gross - t.fee)
    }, 0)
}

export function replacementWarning(trades: Trade[], formatSigned: (n: number) => string) {
  const linked = trades.filter((t) => t.accountId).length
  if (!linked) return null
  return `${linked} of these trades moved money in or out of your accounts. Removing them changes those balances by ${formatSigned(-cashEffect(trades))}.`
}

export function PositionModal({ holding, trades, onClose }: { holding: Holding | null; trades: Trade[]; onClose: () => void }) {
  return (
    <Modal
      open={!!holding}
      onClose={onClose}
      title={holding ? `Edit ${holding.symbol} position` : ''}
      description="Set your quantity and average price directly"
    >
      {holding && <PositionForm key={holding.symbol} holding={holding} trades={trades} onClose={onClose} />}
    </Modal>
  )
}

function PositionForm({ holding, trades, onClose }: { holding: Holding; trades: Trade[]; onClose: () => void }) {
  const idr = useIdr()
  const toast = useToast()
  const confirm = useConfirm()
  const save = useSetPosition()
  const heldShares = Math.round(holding.lots * LOT_SIZE)
  const wholeLots = heldShares % LOT_SIZE === 0
  const [unit, setUnit] = useState<'lot' | 'share'>(wholeLots ? 'lot' : 'share')
  const qty = useAmountInput(wholeLots ? heldShares / LOT_SIZE : heldShares)
  const roundAvg = Math.abs(holding.avgPrice * 100 - Math.round(holding.avgPrice * 100)) < 1e-6
  const [priceMode, setPriceMode] = useState<'avg' | 'invested'>(roundAvg ? 'avg' : 'invested')
  const avg = useAmountInput(Math.round(holding.avgPrice * 100) / 100)
  const invested = useAmountInput(Math.round(holding.cost * 100) / 100)
  const earliest = trades.map((t) => t.date).sort()[0]
  const [date, setDate] = useState(earliest ?? new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  const shares = Math.round((qty.amount ?? 0) * (unit === 'lot' ? LOT_SIZE : 1) * 100) / 100
  const avgPrice = priceMode === 'avg' ? (avg.amount ?? 0) : shares > 0 ? (invested.amount ?? 0) / shares : 0
  const costBasis = priceMode === 'avg' ? shares * (avg.amount ?? 0) : (invested.amount ?? 0)
  const warning = replacementWarning(trades, idr.signed)
  const hasSells = trades.some((t) => t.side === 'sell')

  const submit = async () => {
    setError(null)
    if (shares <= 0 || !Number.isInteger(shares)) return setError('Quantity must be a whole number of shares')
    if (avgPrice <= 0) return setError(priceMode === 'avg' ? 'Enter an average price' : 'Enter the invested amount')
    const ok = await confirm({
      title: `Replace ${holding.symbol} history?`,
      message: [
        `${trades.length} trade${trades.length === 1 ? '' : 's'} will be replaced with one position of ${idr.number(shares)} shares, invested ${idr.format(costBasis)}.`,
        hasSells && 'Realized P/L from past sells will be cleared.',
        warning,
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Replace',
      danger: true,
    })
    if (!ok) return
    try {
      await save.mutateAsync({ symbol: holding.symbol, lots: shares / LOT_SIZE, avgPrice, date })
      toast({ message: `${holding.symbol} position updated` })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Quantity"
          hint={
            <span className="flex gap-0.5 rounded-md bg-subtle p-0.5">
              {(['lot', 'share'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    if (u === unit) return
                    setUnit(u)
                    if (qty.amount) qty.setAmount(u === 'share' ? Math.round(qty.amount * LOT_SIZE) : qty.amount / LOT_SIZE)
                  }}
                  className={cn(
                    'cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium transition',
                    u === unit ? 'bg-elevated text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {u === 'lot' ? 'Lot' : 'Shares'}
                </button>
              ))}
            </span>
          }
        >
          <Input {...qty.inputProps} autoFocus />
          <div className="mt-1 text-[11px] text-muted">
            {shares > 0 && (unit === 'lot' ? `${idr.number(shares)} shares` : `${idr.number(shares / LOT_SIZE)} lot`)}
          </div>
        </Field>
        <Field
          label={priceMode === 'avg' ? 'Average price' : 'Invested'}
          hint={
            <span className="flex gap-0.5 rounded-md bg-subtle p-0.5">
              {(['avg', 'invested'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (m === priceMode) return
                    if (m === 'invested') invested.setAmount(Math.round(costBasis * 100) / 100 || null)
                    else avg.setAmount(avgPrice ? Math.round(avgPrice * 100) / 100 : null)
                    setPriceMode(m)
                  }}
                  className={cn(
                    'cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium transition',
                    m === priceMode ? 'bg-elevated text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {m === 'avg' ? 'Avg price' : 'Invested'}
                </button>
              ))}
            </span>
          }
        >
          {priceMode === 'avg' ? <Input {...avg.inputProps} /> : <Input {...invested.inputProps} />}
          <div className="mt-1 text-[11px] text-muted">
            {priceMode === 'avg'
              ? costBasis > 0 && `Invested ${idr.format(costBasis)}`
              : avgPrice > 0 && `Avg ${idr.precise(avgPrice)} per share`}
          </div>
        </Field>
      </div>
      <Field label="Position date">
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>

      <div className="rounded-2xl border border-line bg-subtle p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Cost basis</span>
          <span className="font-display text-lg font-semibold tabular">{idr.format(costBasis)}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          Replaces {trades.length} trade{trades.length === 1 ? '' : 's'} with one entry. Cash balances are not affected by the new entry.
        </div>
      </div>

      {warning && (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" />
          {warning}
        </div>
      )}

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

      <Button type="submit" variant="primary" className="w-full" loading={save.isPending}>
        Save position
      </Button>
    </form>
  )
}
