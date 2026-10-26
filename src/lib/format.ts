import { useMemo } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { useBootstrap } from './api'

export function useMoney() {
  const { data } = useBootstrap()
  const currency = data?.settings.currency ?? 'USD'
  const locale = data?.settings.locale ?? 'en-US'

  return useMemo(() => {
    const full = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 })
    const compact = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    })
    const symbol = full.formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
    return {
      currency,
      locale,
      symbol,
      format: (n: number) => full.format(n),
      compact: (n: number) => (Math.abs(n) >= 100_000 ? compact.format(n) : full.format(n)),
      axis: (n: number) => compact.format(n),
    }
  }, [currency, locale])
}

export function useIdr() {
  const { locale } = useMoney()
  return useMemo(() => {
    const full = new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 2, minimumFractionDigits: 0 })
    const compact = new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 })
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
    const precise = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 })
    const truncated = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      roundingMode: 'trunc',
    })
    return {
      format: (n: number) => full.format(n),
      price: (n: number) => truncated.format(n),
      compact: (n: number) => (Math.abs(n) >= 1e9 ? compact.format(n) : full.format(n)),
      signed: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${full.format(Math.abs(n))}`,
      short: (n: number) => `${n < 0 ? '−' : ''}${(Math.abs(n) >= 1e7 ? compact : full).format(Math.abs(n))}`,
      number: (n: number) => number.format(n),
      precise: (n: number) => precise.format(n),
      pct: (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${number.format(Math.abs(n))}%`,
    }
  }, [locale])
}

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

export function friendlyDate(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, d MMM yyyy')
}

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

export const currencies = [
  'USD', 'EUR', 'GBP', 'IDR', 'JPY', 'SGD', 'MYR', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'INR', 'KRW', 'THB', 'PHP', 'VND', 'BRL', 'MXN', 'AED', 'SAR', 'ZAR', 'NZD', 'SEK', 'NOK', 'TRY',
]

export const currencyLocale: Record<string, string> = {
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  IDR: 'id-ID',
  JPY: 'ja-JP',
  MYR: 'ms-MY',
  BRL: 'pt-BR',
  CNY: 'zh-CN',
}

export const locales = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'id-ID', label: 'Bahasa Indonesia' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ms-MY', label: 'Bahasa Melayu' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'zh-CN', label: '中文' },
]
