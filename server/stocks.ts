import { all, get, run } from './db'
import { LOT_SIZE, type Holding, type Portfolio, type Quote, type Trade } from '../shared/types'

const TTL = 60_000
const memory = new Map<string, Quote>()

export class UnknownSymbolError extends Error {}

const jakartaDate = (unix: number, offset: number) => new Date((unix + offset) * 1000).toISOString().slice(0, 10)

async function fetchQuote(symbol: string): Promise<Quote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.JK?range=1mo&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
  if (res.status === 404) throw new UnknownSymbolError(symbol)
  if (!res.ok) throw new Error(`Quote request failed (${res.status})`)

  const json = (await res.json()) as {
    chart: {
      result: {
        meta: {
          regularMarketPrice: number
          regularMarketTime: number
          gmtoffset: number
          currency: string
          longName?: string
          shortName?: string
          chartPreviousClose?: number
        }
        timestamp?: number[]
        indicators: { quote: { close: (number | null)[] }[] }
      }[] | null
    }
  }
  const result = json.chart.result?.[0]
  if (!result) throw new UnknownSymbolError(symbol)

  const { meta } = result
  const timestamps = result.timestamp ?? []
  const closes = result.indicators.quote[0]?.close ?? []
  const today = jakartaDate(meta.regularMarketTime, meta.gmtoffset)
  let previousClose = meta.chartPreviousClose ?? meta.regularMarketPrice
  for (let i = timestamps.length - 1; i >= 0; i--) {
    const close = closes[i]
    if (close != null && jakartaDate(timestamps[i], meta.gmtoffset) < today) {
      previousClose = close
      break
    }
  }

  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    price: meta.regularMarketPrice,
    previousClose,
    currency: meta.currency,
    history: closes.filter((c): c is number => c != null),
    updatedAt: new Date().toISOString(),
    stale: false,
  }
}

function loadQuote(symbol: string): Quote | undefined {
  const row = get<Omit<Quote, 'history' | 'stale'> & { history: string }>('SELECT * FROM quotes WHERE symbol = :symbol', {
    symbol,
  })
  return row ? { ...row, history: JSON.parse(row.history), stale: true } : undefined
}

function storeQuote(q: Quote) {
  run(
    `INSERT INTO quotes (symbol, name, price, previousClose, currency, history, updatedAt)
     VALUES (:symbol, :name, :price, :previousClose, :currency, :history, :updatedAt)
     ON CONFLICT(symbol) DO UPDATE SET name = excluded.name, price = excluded.price,
       previousClose = excluded.previousClose, currency = excluded.currency,
       history = excluded.history, updatedAt = excluded.updatedAt`,
    {
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      previousClose: q.previousClose,
      currency: q.currency,
      history: JSON.stringify(q.history),
      updatedAt: q.updatedAt,
    },
  )
}

export async function getQuote(symbol: string, force = false): Promise<Quote | undefined> {
  const cached = memory.get(symbol) ?? loadQuote(symbol)
  if (!force && cached && !cached.stale && Date.now() - Date.parse(cached.updatedAt) < TTL) return cached
  try {
    const fresh = await fetchQuote(symbol)
    memory.set(symbol, fresh)
    storeQuote(fresh)
    return fresh
  } catch (err) {
    if (err instanceof UnknownSymbolError) throw err
    if (cached) memory.set(symbol, { ...cached, stale: true })
    return cached && { ...cached, stale: true }
  }
}

export function listTrades(symbol?: string) {
  return all<Trade>(
    `SELECT * FROM trades ${symbol ? 'WHERE symbol = :symbol' : ''} ORDER BY date DESC, createdAt DESC`,
    symbol ? { symbol } : {},
  )
}

interface Position {
  symbol: string
  shares: number
  cost: number
  realized: number
}

export function computePositions(trades: Trade[]) {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const positions = new Map<string, Position>()
  for (const t of ordered) {
    const p = positions.get(t.symbol) ?? { symbol: t.symbol, shares: 0, cost: 0, realized: 0 }
    const shares = t.lots * LOT_SIZE
    if (t.side === 'buy') {
      p.shares += shares
      p.cost += shares * t.price + t.fee
    } else {
      const sold = Math.min(shares, p.shares)
      const avg = p.shares ? p.cost / p.shares : 0
      p.realized += sold * t.price - t.fee - avg * sold
      p.cost -= avg * sold
      p.shares -= sold
    }
    positions.set(t.symbol, p)
  }
  return positions
}

export async function buildPortfolio(force = false): Promise<Portfolio> {
  const positions = [...computePositions(listTrades()).values()]
  const open = positions.filter((p) => p.shares > 0)
  const quotes = await Promise.all(open.map((p) => getQuote(p.symbol, force).catch(() => undefined)))

  const holdings: Holding[] = open.map((p, i) => {
    const q = quotes[i]
    const avgPrice = p.cost / p.shares
    const price = q?.price ?? avgPrice
    const previousClose = q?.previousClose ?? price
    const marketValue = price * p.shares
    return {
      symbol: p.symbol,
      name: q?.name ?? p.symbol,
      lots: p.shares / LOT_SIZE,
      avgPrice,
      cost: p.cost,
      price,
      previousClose,
      marketValue,
      unrealized: marketValue - p.cost,
      unrealizedPct: p.cost ? ((marketValue - p.cost) / p.cost) * 100 : 0,
      dayChange: (price - previousClose) * p.shares,
      dayChangePct: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
      realized: p.realized,
      history: q?.history ?? [],
      updatedAt: q?.updatedAt ?? null,
      stale: !q || q.stale,
    }
  })
  holdings.sort((a, b) => b.marketValue - a.marketValue)

  const sum = (pick: (h: Holding) => number) => holdings.reduce((s, h) => s + pick(h), 0)
  const marketValue = sum((h) => h.marketValue)
  const cost = sum((h) => h.cost)
  const dayChange = sum((h) => h.dayChange)
  const updated = holdings.map((h) => h.updatedAt).filter((u): u is string => !!u).sort()

  return {
    holdings,
    totals: {
      marketValue,
      cost,
      unrealized: marketValue - cost,
      unrealizedPct: cost ? ((marketValue - cost) / cost) * 100 : 0,
      dayChange,
      dayChangePct: marketValue - dayChange ? (dayChange / (marketValue - dayChange)) * 100 : 0,
      realized: positions.reduce((s, p) => s + p.realized, 0),
    },
    updatedAt: updated[0] ?? null,
  }
}
