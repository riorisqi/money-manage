import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setMonth,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toISODate } from '@/lib/format'
import { control, useFieldId } from './Form'
import { Popover } from './Popover'

const weekStartsOn = 1

function monthGrid(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn })
  return eachDayOfInterval({ start, end: addDays(start, 41) })
}

export function DateInput({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const fieldId = useFieldId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected = value ? parseISO(value) : null
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [cursor, setCursor] = useState(() => selected ?? new Date())
  const [direction, setDirection] = useState(1)

  const close = useCallback(() => setOpen(false), [])

  const openPicker = () => {
    setCursor(selected ?? new Date())
    setView('days')
    setOpen(true)
  }

  const moveCursor = (next: Date) => {
    setDirection(next > cursor ? 1 : -1)
    setCursor(next)
  }

  const pick = (date: Date) => {
    onChange(toISODate(date))
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openPicker()
      }
      return
    }
    const steps: Record<string, () => Date> = {
      ArrowLeft: () => subDays(cursor, 1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => subDays(cursor, 7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, e.shiftKey ? 12 : 1),
      Home: () => startOfWeek(cursor, { weekStartsOn }),
      End: () => endOfWeek(cursor, { weekStartsOn }),
    }
    if (steps[e.key]) {
      e.preventDefault()
      moveCursor(steps[e.key]())
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  const days = monthGrid(cursor)
  const weekdays = days.slice(0, 7).map((d) => format(d, 'EEEEEE'))
  const monthKey = format(cursor, 'yyyy-MM')

  return (
    <>
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={cn(
          control,
          'flex cursor-pointer items-center justify-between gap-2 text-left',
          open && 'border-violet-500/60 bg-elevated ring-4 ring-violet-500/10',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted/70')}>
          {selected ? format(selected, 'EEE, d MMM yyyy') : 'Pick a date'}
        </span>
        <CalendarDays className={cn('size-4 shrink-0 text-muted transition-colors', open && 'text-violet-500')} />
      </button>

      <Popover open={open} anchorRef={triggerRef} onClose={close} className="w-[18.5rem] p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView((v) => (v === 'days' ? 'months' : 'days'))}
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-display text-sm font-semibold transition hover:bg-subtle"
          >
            {view === 'days' ? format(cursor, 'MMMM yyyy') : format(cursor, 'yyyy')}
            <ChevronRight className={cn('size-3.5 text-muted transition-transform', view === 'months' && 'rotate-90')} />
          </button>
          <div className="flex gap-1">
            {[-1, 1].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => moveCursor(view === 'days' ? addMonths(cursor, delta) : addYears(cursor, delta))}
                className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg"
                aria-label={delta < 0 ? 'Previous' : 'Next'}
              >
                {delta < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ))}
          </div>
        </div>

        {view === 'days' ? (
          <>
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted">
              {weekdays.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="relative overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                  key={monthKey}
                  custom={direction}
                  initial={{ x: direction * 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction * -40, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="grid grid-cols-7 gap-0.5"
                  role="grid"
                >
                  {days.map((day) => {
                    const isSelected = !!selected && isSameDay(day, selected)
                    const isCursor = isSameDay(day, cursor)
                    const outside = !isSameMonth(day, cursor)
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        role="gridcell"
                        aria-selected={isSelected}
                        onClick={() => pick(day)}
                        className={cn(
                          'relative grid aspect-square cursor-pointer place-items-center rounded-xl text-sm tabular transition',
                          outside ? 'text-muted/40' : 'text-fg',
                          !isSelected && 'hover:bg-subtle',
                          isCursor && !isSelected && 'ring-1 ring-violet-500/50',
                          isSelected && 'bg-brand font-semibold text-white shadow-lg shadow-violet-600/30',
                        )}
                      >
                        {format(day, 'd')}
                        {isToday(day) && !isSelected && (
                          <span className="absolute bottom-1 size-1 rounded-full bg-violet-500" />
                        )}
                      </button>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {Array.from({ length: 12 }, (_, m) => {
              const date = setMonth(cursor, m)
              const isSelected = !!selected && isSameMonth(date, selected)
              const isCurrent = isSameMonth(date, new Date())
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    moveCursor(date)
                    setView('days')
                  }}
                  className={cn(
                    'cursor-pointer rounded-xl py-3 text-sm transition',
                    isSelected ? 'bg-brand font-semibold text-white' : 'hover:bg-subtle',
                    isCurrent && !isSelected && 'text-violet-500',
                  )}
                >
                  {format(date, 'MMM')}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <div className="flex gap-1">
            {[
              ['Today', new Date()],
              ['Yesterday', subDays(new Date(), 1)],
            ].map(([label, date]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => pick(date as Date)}
                className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-violet-500 transition hover:bg-violet-500/10"
              >
                {label as string}
              </button>
            ))}
          </div>
          <span className="hidden text-[10px] text-muted sm:inline">← → ↑ ↓ · PgUp/PgDn</span>
        </div>
      </Popover>
    </>
  )
}
