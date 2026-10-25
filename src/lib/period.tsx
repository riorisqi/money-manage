import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfYear,
} from 'date-fns'
import { toISODate } from './format'

export type PeriodMode = 'month' | 'year'

interface PeriodCtx {
  mode: PeriodMode
  anchor: Date
  from: string
  to: string
  label: string
  isCurrent: boolean
  group: 'day' | 'month'
  setMode: (mode: PeriodMode) => void
  shift: (delta: number) => void
  reset: () => void
}

const Ctx = createContext<PeriodCtx | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PeriodMode>('month')
  const [anchor, setAnchor] = useState(() => new Date())

  const value = useMemo<PeriodCtx>(() => {
    const isMonth = mode === 'month'
    const start = isMonth ? startOfMonth(anchor) : startOfYear(anchor)
    const end = isMonth ? endOfMonth(anchor) : endOfYear(anchor)
    const now = new Date()
    return {
      mode,
      anchor,
      from: toISODate(start),
      to: toISODate(end),
      label: isMonth ? format(anchor, 'MMMM yyyy') : format(anchor, 'yyyy'),
      isCurrent: isMonth ? isSameMonth(anchor, now) : isSameYear(anchor, now),
      group: isMonth ? 'day' : 'month',
      setMode,
      shift: (delta) => setAnchor((a) => (isMonth ? addMonths(a, delta) : addYears(a, delta))),
      reset: () => setAnchor(new Date()),
    }
  }, [mode, anchor])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePeriod() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePeriod must be used inside PeriodProvider')
  return ctx
}
