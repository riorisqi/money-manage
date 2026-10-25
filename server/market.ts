import { get, run } from './db'
import { fetchChart } from './stocks'
import type { Market, MarketQuote } from '../shared/types'

const TTL = 60_000
const memory = new Map<string, MarketQuote>()

const instruments = [
  { symbol: '^JKSE', label: 'IHSG', interval: '5m' },
  { symbol: 'IDR=X', label: 'USD/IDR', interval: '15m' },
  { symbol: 'SGDIDR=X', label: 'SGD/IDR', interval: '15m' },
  { symbol: 'EURIDR=X', label: 'EUR/IDR', interval: '15m' },
  { symbol: 'JPYIDR=X', label: 'JPY/IDR', interval: '15m' },
  { symbol: 'CNYIDR=X', label: 'CNY/IDR', interval: '15m' },
]

type Instrument = (typeof instruments)[number]

async function fetchMarketQuote({ symbol, label, interval }: Instrument): Promise<MarketQuote> {
  const { meta, indicators } = await fetchChart(symbol, '1d', interval)
  const series = (indicators.quote[0]?.close ?? []).filter((c): c is number => c != null)
  const previousClose = meta.chartPreviousClose ?? series[0] ?? meta.regularMarketPrice
  const period = meta.currentTradingPeriod?.regular
  const now = Date.now() / 1000
  return {
    symbol,
    label,
    name: meta.shortName ?? meta.longName ?? label,
    price: meta.regularMarketPrice,
    previousClose,
    change: meta.regularMarketPrice - previousClose,
    changePct: previousClose ? ((meta.regularMarketPrice - previousClose) / previousClose) * 100 : 0,
    series,
    marketTime: new Date(meta.regularMarketTime * 1000).toISOString(),
    open: !!period && now >= period.start && now <= period.end && now - meta.regularMarketTime < 30 * 60,
    updatedAt: new Date().toISOString(),
    stale: false,
  }
}

const cacheKey = (symbol: string) => `market:${symbol}`

function load(symbol: string): MarketQuote | undefined {
  const row = get<{ history: string }>('SELECT history FROM quotes WHERE symbol = :symbol', { symbol: cacheKey(symbol) })
  return row ? { ...(JSON.parse(row.history) as MarketQuote), open: false, stale: true } : undefined
}

function store(q: MarketQuote) {
  run(
    `INSERT INTO quotes (symbol, name, price, previousClose, currency, history, updatedAt)
     VALUES (:symbol, :name, :price, :previousClose, 'IDR', :history, :updatedAt)
     ON CONFLICT(symbol) DO UPDATE SET name = excluded.name, price = excluded.price,
       previousClose = excluded.previousClose, history = excluded.history, updatedAt = excluded.updatedAt`,
    {
      symbol: cacheKey(q.symbol),
      name: q.name,
      price: q.price,
      previousClose: q.previousClose,
      history: JSON.stringify(q),
      updatedAt: q.updatedAt,
    },
  )
}

async function getMarketQuote(instrument: Instrument, force: boolean) {
  const cached = memory.get(instrument.symbol) ?? load(instrument.symbol)
  if (!force && cached && !cached.stale && Date.now() - Date.parse(cached.updatedAt) < TTL) return cached
  try {
    const fresh = await fetchMarketQuote(instrument)
    memory.set(instrument.symbol, fresh)
    store(fresh)
    return fresh
  } catch {
    return cached ? { ...cached, open: false, stale: true } : null
  }
}

export async function getMarket(force = false): Promise<Market> {
  const [ihsg, ...rates] = await Promise.all(instruments.map((i) => getMarketQuote(i, force)))
  return { ihsg, rates: rates.filter((r): r is MarketQuote => !!r) }
}
