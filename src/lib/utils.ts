import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const palette = [
  '#8b5cf6',
  '#6366f1',
  '#3b82f6',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#64748b',
]

export function evaluateAmount(input: string): number | null {
  const src = input.replace(/,/g, '').replace(/\s+/g, '')
  if (!src) return null
  let i = 0

  const peek = () => src[i]
  const number = (): number => {
    if (peek() === '(') {
      i++
      const v = expr()
      if (peek() !== ')') throw new Error()
      i++
      return v
    }
    if (peek() === '-') {
      i++
      return -number()
    }
    const m = /^\d*\.?\d+(?:k|m)?/i.exec(src.slice(i))
    if (!m) throw new Error()
    i += m[0].length
    const raw = m[0].toLowerCase()
    const mult = raw.endsWith('k') ? 1e3 : raw.endsWith('m') ? 1e6 : 1
    return parseFloat(raw) * mult
  }
  const term = (): number => {
    let v = number()
    while (peek() === '*' || peek() === '/' || peek() === 'x') {
      const op = src[i++]
      const r = number()
      v = op === '/' ? v / r : v * r
    }
    return v
  }
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = src[i++]
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  try {
    const v = expr()
    if (i !== src.length || !Number.isFinite(v)) return null
    return Math.round(v * 100) / 100
  } catch {
    return null
  }
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
