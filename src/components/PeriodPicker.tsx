import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod } from '@/lib/period'
import { Segmented } from './ui/Form'
import { useRef } from 'react'

export function PeriodPicker() {
  const p = usePeriod()
  const dir = useRef(1)

  const go = (d: number) => {
    dir.current = d
    p.shift(d)
  }

  return (
    <div className="flex items-center gap-2">
      <Segmented
        size="sm"
        value={p.mode}
        onChange={p.setMode}
        options={[
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
      />
      <div className="flex items-center rounded-xl border border-line bg-subtle p-0.5">
        <button
          onClick={() => go(-1)}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg"
          aria-label="Previous period"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          onClick={p.reset}
          title="Jump to current"
          className="relative h-7 w-32 cursor-pointer overflow-hidden text-center text-xs font-semibold"
        >
          <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
            <motion.span
              key={p.label}
              custom={dir.current}
              initial={{ y: dir.current * 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: dir.current * -16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="absolute inset-0 grid place-items-center"
            >
              <span className="flex items-center gap-1.5">
                {p.label}
                {p.isCurrent && <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500" />}
              </span>
            </motion.span>
          </AnimatePresence>
        </button>
        <button
          onClick={() => go(1)}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg"
          aria-label="Next period"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
