import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, SearchX } from 'lucide-react'
import { LOT_SIZE, type Holding, type TradeSide } from '@shared/types'
import { useBootstrap, useQuote, useSaveTrade } from '@/lib/api'
import { useAmountInput } from '@/lib/amount'
import { toISODate, useIdr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input, Segmented, Select } from './ui/Form'
import { useToast } from './ui/Toast'

const feeRates: Record<TradeSide, number> = { buy: 0.0015, sell: 0.0025 }

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function TradeModal({
  open,
  side,
  symbol,
  holdings,
  onClose,
}: {
  open: boolean
  side: TradeSide
  symbol?: string
  holdings: Holding[]
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Record trade" description="Prices are per share · 1 lot = 100 shares">
      {open && <TradeForm key={`${side}-${symbol ?? ''}`} initialSide={side} initialSymbol={symbol} holdings={holdings} onClose={onClose} />}
    </Modal>
  )
}

function TradeForm({
  initialSide,
  initialSymbol,
  holdings,
  onClose,
}: {
  initialSide: TradeSide
  initialSymbol?: string
  holdings: Holding[]
  onClose: () => void
}) {
  const idr = useIdr()
  const toast = useToast()
  const save = useSaveTrade()
  const { data: boot } = useBootstrap()
  const accounts = boot?.accounts ?? []
  const defaultAccount = accounts.find((a) => a.type === 'investment')?.id ?? ''

  const [side, setSide] = useState<TradeSide>(initialSide)
  const [symbol, setSymbol] = useState(initialSymbol ?? (initialSide === 'sell' ? (holdings[0]?.symbol ?? '') : ''))
  const [accountId, setAccountId] = useState(holdings.length ? defaultAccount : '')
  const [date, setDate] = useState(toISODate(new Date()))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unit, setUnit] = useState<'lot' | 'share'>('lot')
  const qty = useAmountInput()
  const price = useAmountInput()
  const fee = useAmountInput()

  const lookup = useDebounced(symbol.trim().toUpperCase(), 400)
  const quote = useQuote(lookup)
  const holding = holdings.find((h) => h.symbol === symbol)
  const { setAmount: setPrice } = price

  const quotedPrice = quote.data?.price
  const quotedSymbol = quote.data?.symbol
  useEffect(() => {
    if (quotedPrice) setPrice(quotedPrice)
  }, [quotedSymbol, quotedPrice, setPrice])

  const shares = Math.round((qty.amount ?? 0) * (unit === 'lot' ? LOT_SIZE : 1) * 100) / 100
  const lots = shares / LOT_SIZE
  const heldShares = holding ? Math.round(holding.lots * LOT_SIZE) : 0
  const gross = shares * (price.amount ?? 0)
  const feeValue = fee.amount ?? 0
  const total = side === 'buy' ? gross + feeValue : gross - feeValue
  const realized = holding && side === 'sell' ? ((price.amount ?? 0) - holding.avgPrice) * shares - feeValue : 0

  const sellOptions = useMemo(() => holdings.map((h) => h.symbol), [holdings])

  const submit = async () => {
    setError(null)
    const ticker = symbol.trim().toUpperCase()
    if (!ticker) return setError('Enter a ticker')
    if (shares <= 0 || !Number.isInteger(shares)) return setError('Quantity must be a whole number of shares')
    if (!price.amount || price.amount <= 0) return setError('Enter a price per share')
    if (side === 'sell' && holding && shares > heldShares) return setError(`You only hold ${idr.number(heldShares)} shares`)
    try {
      await save.mutateAsync({
        symbol: ticker,
        side,
        lots,
        price: price.amount,
        fee: feeValue,
        accountId: accountId || null,
        note: note.trim(),
        date,
      })
      toast({ message: `${side === 'buy' ? 'Bought' : 'Sold'} ${Number.isInteger(lots) ? `${lots} lot` : `${idr.number(shares)} shares`} ${ticker}` })
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
      <Segmented
        value={side}
        onChange={(s) => {
          setSide(s)
          if (s === 'sell' && !sellOptions.includes(symbol)) setSymbol(sellOptions[0] ?? '')
        }}
        className="flex w-full"
        options={[
          { value: 'buy', label: <span className={cn(side === 'buy' && 'text-emerald-500')}>Buy</span>, activeClass: '!bg-emerald-500/15 !ring-emerald-500/30' },
          {
            value: 'sell',
            label: <span className={cn(side === 'sell' && 'text-rose-500')}>Sell</span>,
            activeClass: '!bg-rose-500/15 !ring-rose-500/30',
          },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticker">
          {side === 'sell' ? (
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {sellOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              autoFocus={!initialSymbol}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="e.g. BBCA"
              className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
            />
          )}
        </Field>
        <div className="flex min-h-[4.25rem] items-end">
          <AnimatePresence mode="wait">
            {quote.isFetching && !quote.data ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 pb-3 text-xs text-muted">
                <Loader2 className="size-4 animate-spin" /> Looking up {lookup}…
              </motion.div>
            ) : quote.isError ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 pb-3 text-xs text-rose-500">
                <SearchX className="size-4" /> {(quote.error as Error).message}
              </motion.div>
            ) : quote.data ? (
              <motion.button
                key={quote.data.symbol}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setPrice(quote.data!.price)}
                title="Use market price"
                className="w-full cursor-pointer rounded-xl border border-line bg-subtle px-3 py-2 text-left transition hover:border-violet-500/40"
              >
                <div className="truncate text-xs text-muted">{quote.data.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold">{idr.format(quote.data.price)}</span>
                  <span
                    className={cn(
                      'font-mono text-xs',
                      quote.data.price >= quote.data.previousClose ? 'text-emerald-500' : 'text-rose-500',
                    )}
                  >
                    {idr.pct(((quote.data.price - quote.data.previousClose) / quote.data.previousClose) * 100)}
                  </span>
                </div>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

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
          <Input {...qty.inputProps} autoFocus={!!initialSymbol} placeholder={unit === 'lot' ? '1' : '100'} />
          <div className="mt-1 flex min-h-4 items-center justify-between text-[11px] text-muted">
            <span>{shares > 0 && (unit === 'lot' ? `${idr.number(shares)} shares` : `${idr.number(lots)} lot`)}</span>
            {side === 'sell' && holding && (
              <button
                type="button"
                onClick={() => qty.setAmount(unit === 'lot' ? heldShares / LOT_SIZE : heldShares)}
                className="cursor-pointer text-violet-500 hover:underline"
              >
                Max {unit === 'lot' ? `${idr.number(holding.lots)} lot` : `${idr.number(heldShares)} shares`}
              </button>
            )}
          </div>
        </Field>
        <Field label="Price per share">
          <Input {...price.inputProps} placeholder="0" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Fee"
          hint={
            gross > 0 && (
              <button
                type="button"
                onClick={() => fee.setAmount(Math.round(gross * feeRates[side]))}
                className="cursor-pointer text-violet-500 hover:underline"
              >
                Est. {(feeRates[side] * 100).toFixed(2)}%
              </button>
            )
          }
        >
          <Input {...fee.inputProps} placeholder="0" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>

      <Field label={side === 'buy' ? 'Pay from' : 'Receive into'}>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">No cash account (existing holding)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={500} />
      </Field>

      <div className="rounded-2xl border border-line bg-subtle p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">{side === 'buy' ? 'Total cost' : 'You receive'}</span>
          <span className="font-display text-lg font-semibold tabular">{idr.format(Math.max(0, total))}</span>
        </div>
        {side === 'sell' && holding && shares > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted">Est. realized P/L (avg {idr.format(holding.avgPrice)})</span>
            <span className={cn('font-mono', realized >= 0 ? 'text-emerald-500' : 'text-rose-500')}>{idr.signed(realized)}</span>
          </div>
        )}
        {!accountId && <div className="mt-1 text-xs text-muted">Cash balances won't change.</div>}
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

      <Button
        type="submit"
        variant={side === 'buy' ? 'primary' : 'danger'}
        className="w-full"
        loading={save.isPending}
        disabled={side === 'sell' && !holdings.length}
      >
        {side === 'buy' ? 'Record buy' : 'Record sell'}
      </Button>
    </form>
  )
}
