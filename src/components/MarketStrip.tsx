import { useEffect, useMemo, useRef } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { format, parseISO } from 'date-fns'
import { TrendingDown, TrendingUp, WifiOff } from 'lucide-react'
import type { MarketQuote } from '@shared/types'
import { useMarket } from '@/lib/api'
import { useMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { Skeleton } from './ui/Misc'
import { Sparkline } from './charts/Sparkline'

function useFormatters() {
  const { locale } = useMoney()
  return useMemo(() => {
    const index = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const rate = new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 2, minimumFractionDigits: 0 })
    const pct = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return {
      index: (n: number) => index.format(n),
      rate: (n: number) => rate.format(n),
      signedIndex: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${index.format(Math.abs(n))}`,
      pct: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${pct.format(Math.abs(n))}%`,
    }
  }, [locale])
}

function useFlash(value: number | undefined) {
  const controls = useAnimationControls()
  const prev = useRef(value)
  useEffect(() => {
    if (value === undefined || prev.current === undefined || value === prev.current) {
      prev.current = value
      return
    }
    const color = value > prev.current ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'
    prev.current = value
    controls.start({ backgroundColor: [color, 'rgba(0,0,0,0)'], transition: { duration: 1.2 } })
  }, [value, controls])
  return controls
}

const tone = (n: number) => (n > 0 ? 'text-emerald-500' : n < 0 ? 'text-rose-500' : 'text-muted')

function LiveBadge({ quote }: { quote: MarketQuote }) {
  if (quote.stale) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
        <WifiOff className="size-3" /> Offline
      </span>
    )
  }
  if (quote.open) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-500 uppercase">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    )
  }
  return (
    <span className="text-[10px] font-medium text-muted">Closed · {format(parseISO(quote.marketTime), 'd MMM HH:mm')}</span>
  )
}

function IhsgTile({ quote }: { quote: MarketQuote }) {
  const f = useFormatters()
  const flash = useFlash(quote.price)
  const Icon = quote.change >= 0 ? TrendingUp : TrendingDown
  return (
    <motion.div
      animate={flash}
      className="glass spotlight relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl p-4 sm:col-span-2"
    >
      <div className="min-w-0 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold tracking-tight">IHSG</span>
          <LiveBadge quote={quote} />
        </div>
        <div className="mt-1 font-display text-2xl font-bold tabular">
          <AnimatedNumber value={quote.price} format={f.index} duration={0.8} />
        </div>
        <div className={cn('mt-0.5 flex items-center gap-1 font-mono text-xs font-semibold tabular', tone(quote.change))}>
          <Icon className="size-3.5" />
          {f.signedIndex(quote.change)} ({f.pct(quote.changePct)})
        </div>
      </div>
      <Sparkline data={quote.series} baseline={quote.previousClose} className="h-16 min-w-0 flex-1" />
    </motion.div>
  )
}

function RateTile({ quote, featured }: { quote: MarketQuote; featured?: boolean }) {
  const f = useFormatters()
  const flash = useFlash(quote.price)
  return (
    <motion.div animate={flash} className="glass spotlight relative min-w-0 overflow-hidden rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-muted">{quote.label}</span>
        {featured && <LiveBadge quote={quote} />}
      </div>
      <div className={cn('mt-1 font-display font-bold tabular', featured ? 'text-xl' : 'text-base')}>
        <AnimatedNumber value={quote.price} format={f.rate} duration={0.8} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={cn('font-mono text-[11px] font-semibold tabular', tone(quote.change))}>{f.pct(quote.changePct)}</span>
        <Sparkline data={quote.series} baseline={quote.previousClose} className="h-6 w-16" />
      </div>
    </motion.div>
  )
}

export function MarketStrip({ className, compact }: { className?: string; compact?: boolean }) {
  const { data, isLoading } = useMarket()

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
        <Skeleton className="col-span-2 h-[104px]" />
        <Skeleton className="h-[104px]" />
        {!compact && <Skeleton className="h-[104px]" />}
      </div>
    )
  }
  if (!data?.ihsg && !data?.rates.length) return null

  const [usd, ...others] = data.rates

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.ihsg && <IhsgTile quote={data.ihsg} />}
        {usd && <RateTile quote={usd} featured />}
      </div>
      {!compact && others.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {others.map((q) => (
            <RateTile key={q.symbol} quote={q} />
          ))}
        </div>
      )}
    </div>
  )
}
