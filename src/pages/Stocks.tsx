import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { CandlestickChart, Clock, Minus, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, WifiOff } from 'lucide-react'
import { LOT_SIZE, type Holding, type Trade, type TradeSide } from '@shared/types'
import { refreshPortfolio, useBootstrap, useDeleteTrade, usePortfolio, useTrades } from '@/lib/api'
import { friendlyDate, useIdr } from '@/lib/format'
import { cn, palette } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader, Pill } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState, Skeleton } from '@/components/ui/Misc'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { TradeModal } from '@/components/TradeForm'
import { Sparkline } from '@/components/charts/Sparkline'
import { MarketStrip } from '@/components/MarketStrip'

const tone = (n: number) => (n > 0 ? 'text-emerald-500' : n < 0 ? 'text-rose-500' : 'text-muted')

function TickerBadge({ symbol, color }: { symbol: string; color: string }) {
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[10px] font-bold tracking-tight"
      style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}
    >
      {symbol.slice(0, 4)}
    </span>
  )
}

export function Stocks() {
  const { data: portfolio, isLoading, isFetching } = usePortfolio()
  const { data: trades = [] } = useTrades()
  const idr = useIdr()
  const qc = useQueryClient()
  const toast = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [trade, setTrade] = useState<{ side: TradeSide; symbol?: string } | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const holdings = portfolio?.holdings ?? []
  const totals = portfolio?.totals
  const colors = useMemo(() => new Map(holdings.map((h, i) => [h.symbol, palette[(i * 5) % palette.length]])), [holdings])
  const anyStale = holdings.some((h) => h.stale)

  const refresh = async () => {
    setRefreshing(true)
    try {
      qc.setQueryData(['portfolio'], await refreshPortfolio())
      toast({ message: 'Prices updated' })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  const visibleTrades = filter ? trades.filter((t) => t.symbol === filter) : trades

  return (
    <div>
      <PageHeader
        title="Stocks"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            IDX portfolio · prices delayed ~15 min
            {portfolio?.updatedAt && (
              <span className="inline-flex items-center gap-1 text-xs">
                <Clock className="size-3" />
                updated {formatDistanceToNow(parseISO(portfolio.updatedAt), { addSuffix: true })}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="icon" onClick={refresh} disabled={refreshing || !holdings.length} title="Refresh prices" aria-label="Refresh prices">
              <RefreshCw className={cn('size-4', (refreshing || isFetching) && 'animate-spin')} />
            </Button>
            <Button variant="outline" onClick={() => setTrade({ side: 'sell' })} disabled={!holdings.length}>
              <Minus className="size-4" /> Sell
            </Button>
            <Button variant="primary" onClick={() => setTrade({ side: 'buy' })}>
              <Plus className="size-4" /> Buy
            </Button>
          </>
        }
      />

      <MarketStrip className="mb-4" />

      {anyStale && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <WifiOff className="size-4 shrink-0" />
          Couldn't reach the price service for some stocks — showing the last known prices.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
          <Skeleton className="h-72 lg:col-span-3" />
        </div>
      ) : !holdings.length && !trades.length ? (
        <Card>
          <EmptyState
            icon={<CandlestickChart className="size-6" />}
            title="Track your stock portfolio"
            message="Add the stocks you already own (choose “No cash account” so your balances don't change), or record new buys and sells as you trade."
            action={
              <Button variant="primary" onClick={() => setTrade({ side: 'buy' })}>
                <Plus className="size-4" /> Add first stock
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-2xl shadow-emerald-700/25 lg:col-span-2"
          >
            <div className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-cyan-300/20 blur-3xl" />
            <CandlestickChart className="absolute right-6 bottom-6 size-28 text-white/5" strokeWidth={1} />
            <div className="relative">
              <div className="text-sm font-medium text-white/75">Market value</div>
              <div className="mt-2 font-display text-4xl font-bold tracking-tight tabular sm:text-5xl">
                <AnimatedNumber value={totals?.marketValue ?? 0} format={idr.format} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
                  {(totals?.dayChange ?? 0) >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {idr.signed(totals?.dayChange ?? 0)} ({idr.pct(totals?.dayChangePct ?? 0)})
                </span>
                <span className="text-white/75">today</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Invested', value: idr.short(totals?.cost ?? 0) },
                  {
                    label: 'Unrealized P/L',
                    value: `${(totals?.unrealized ?? 0) > 0 ? '+' : ''}${idr.short(totals?.unrealized ?? 0)}`,
                    sub: idr.pct(totals?.unrealizedPct ?? 0),
                  },
                  { label: 'Realized P/L', value: `${(totals?.realized ?? 0) > 0 ? '+' : ''}${idr.short(totals?.realized ?? 0)}` },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 backdrop-blur-md">
                    <div className="text-xs text-white/70">{s.label}</div>
                    <div className="mt-0.5 truncate font-mono text-sm font-semibold tabular">{s.value}</div>
                    {s.sub && <div className="text-[11px] text-white/70">{s.sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <Card>
            <CardHeader title="Allocation" subtitle="By market value" />
            {holdings.length ? (
              <Allocation holdings={holdings} colors={colors} total={totals?.marketValue ?? 0} />
            ) : (
              <p className="text-sm text-muted">No open positions.</p>
            )}
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader title="Holdings" subtitle={`${holdings.length} open position${holdings.length === 1 ? '' : 's'} · 1 lot = ${LOT_SIZE} shares`} />
            {holdings.length ? (
              <div className="-mx-2">
                <div className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1.2fr_auto] gap-4 px-2 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase md:grid">
                  <span>Stock</span>
                  <span>Trend 1M</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">P/L</span>
                  <span className="w-16" />
                </div>
                {holdings.map((h, i) => (
                  <HoldingRow
                    key={h.symbol}
                    holding={h}
                    color={colors.get(h.symbol)!}
                    index={i}
                    active={filter === h.symbol}
                    onSelect={() => setFilter((f) => (f === h.symbol ? null : h.symbol))}
                    onTrade={(side) => setTrade({ side, symbol: h.symbol })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">All positions are closed. Buy a stock to open a new one.</p>
            )}
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader
              title="Trade history"
              subtitle={filter ? `Showing ${filter} only` : 'All buys and sells'}
              action={
                filter && (
                  <button onClick={() => setFilter(null)} className="cursor-pointer text-xs font-medium text-violet-500 hover:underline">
                    Show all
                  </button>
                )
              }
            />
            <TradeList trades={visibleTrades} />
          </Card>
        </div>
      )}

      <TradeModal
        open={!!trade}
        side={trade?.side ?? 'buy'}
        symbol={trade?.symbol}
        holdings={holdings}
        onClose={() => setTrade(null)}
      />
    </div>
  )
}

function Allocation({ holdings, colors, total }: { holdings: Holding[]; colors: Map<string, string>; total: number }) {
  const idr = useIdr()
  const [active, setActive] = useState<number | null>(null)
  const focus = active !== null ? holdings[active] : null
  return (
    <div>
      <div className="relative mx-auto size-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={holdings}
              dataKey="marketValue"
              nameKey="symbol"
              innerRadius={50}
              outerRadius={74}
              paddingAngle={holdings.length > 1 ? 3 : 0}
              cornerRadius={5}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {holdings.map((h, i) => (
                <Cell key={h.symbol} fill={colors.get(h.symbol)} opacity={active === null || active === i ? 1 : 0.3} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] text-muted">{focus ? focus.symbol : 'Stocks'}</div>
            <div className="font-display text-sm font-semibold">
              {focus ? `${((focus.marketValue / total) * 100).toFixed(1)}%` : holdings.length}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {holdings.slice(0, 5).map((h, i) => (
          <div
            key={h.symbol}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-2 text-xs"
          >
            <span className="size-2.5 rounded-full" style={{ background: colors.get(h.symbol) }} />
            <span className="font-mono font-semibold">{h.symbol}</span>
            <span className="ml-auto text-muted tabular">{idr.compact(h.marketValue)}</span>
            <span className="w-12 text-right font-mono tabular">{total ? ((h.marketValue / total) * 100).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HoldingRow({
  holding: h,
  color,
  index,
  active,
  onSelect,
  onTrade,
}: {
  holding: Holding
  color: string
  index: number
  active: boolean
  onSelect: () => void
  onTrade: (side: TradeSide) => void
}) {
  const idr = useIdr()
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={cn(
        'group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-2 py-3 transition hover:bg-subtle md:grid-cols-[minmax(0,2fr)_1fr_1fr_1.2fr_1.2fr_auto]',
        active && 'bg-subtle ring-1 ring-line',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <TickerBadge symbol={h.symbol} color={color} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {h.symbol}
            {h.stale && <WifiOff className="size-3 text-amber-500" aria-label="Price may be outdated" />}
          </div>
          <div className="truncate text-xs text-muted">{h.name}</div>
          <div className="text-[11px] text-muted tabular">
            {idr.number(h.lots)} lot · avg {idr.format(h.avgPrice)}
          </div>
        </div>
      </div>

      <div className="text-right md:hidden">
        <div className="font-mono text-sm font-semibold tabular">{idr.compact(h.marketValue)}</div>
        <div className={cn('font-mono text-xs tabular', tone(h.unrealized))}>
          {idr.signed(h.unrealized)} ({idr.pct(h.unrealizedPct)})
        </div>
      </div>

      <Sparkline data={h.history} className="hidden h-8 w-full md:block" />

      <div className="hidden text-right md:block">
        <div className="font-mono text-sm tabular">{idr.format(h.price)}</div>
        <div className={cn('font-mono text-xs tabular', tone(h.dayChangePct))}>{idr.pct(h.dayChangePct)}</div>
      </div>

      <div className="hidden text-right md:block">
        <div className="font-mono text-sm font-semibold tabular">{idr.format(h.marketValue)}</div>
        <div className="text-[11px] text-muted tabular">cost {idr.compact(h.cost)}</div>
      </div>

      <div className="hidden text-right md:block">
        <div className={cn('font-mono text-sm font-semibold tabular', tone(h.unrealized))}>{idr.signed(h.unrealized)}</div>
        <Pill className={cn('mt-0.5', h.unrealized >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}>
          {idr.pct(h.unrealizedPct)}
        </Pill>
      </div>

      <div className="col-span-2 flex justify-end gap-1 md:col-span-1 md:w-16 md:opacity-0 md:group-hover:opacity-100">
        <Button
          size="sm"
          variant="ghost"
          className="text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
          onClick={(e) => {
            e.stopPropagation()
            onTrade('buy')
          }}
        >
          Buy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
          onClick={(e) => {
            e.stopPropagation()
            onTrade('sell')
          }}
        >
          Sell
        </Button>
      </div>
    </motion.div>
  )
}

function TradeList({ trades }: { trades: Trade[] }) {
  const idr = useIdr()
  const { data: boot } = useBootstrap()
  const confirm = useConfirm()
  const toast = useToast()
  const remove = useDeleteTrade()
  const accounts = useMemo(() => new Map(boot?.accounts.map((a) => [a.id, a.name])), [boot])

  if (!trades.length) return <p className="text-sm text-muted">No trades yet.</p>

  return (
    <div className="-mx-2">
      <AnimatePresence initial={false}>
        {trades.map((t) => {
          const gross = t.lots * LOT_SIZE * t.price
          const total = t.side === 'buy' ? gross + t.fee : gross - t.fee
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-subtle"
            >
              <Pill className={t.side === 'buy' ? 'w-11 justify-center bg-emerald-500/10 text-emerald-500' : 'w-11 justify-center bg-rose-500/10 text-rose-500'}>
                {t.side.toUpperCase()}
              </Pill>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  <span className="font-mono">{t.symbol}</span>
                  <span className="text-muted">
                    {' '}
                    · {idr.number(t.lots)} lot @ {idr.format(t.price)}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">
                  {friendlyDate(t.date)} · {t.accountId ? (accounts.get(t.accountId) ?? 'Deleted account') : 'No cash account'}
                  {t.fee > 0 && ` · fee ${idr.format(t.fee)}`}
                  {t.note && ` · ${t.note}`}
                </div>
              </div>
              <div className={cn('font-mono text-sm font-semibold tabular', t.side === 'sell' && 'text-emerald-500')}>
                {t.side === 'buy' ? '−' : '+'}
                {idr.format(total)}
              </div>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this trade?',
                    message: 'Holdings, average price and the linked cash balance will be recalculated.',
                    confirmLabel: 'Delete',
                    danger: true,
                  })
                  if (!ok) return
                  await remove.mutateAsync(t.id)
                  toast({ message: 'Trade deleted', tone: 'info' })
                }}
                className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 max-sm:opacity-100"
                aria-label="Delete trade"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
