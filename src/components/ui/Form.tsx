import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { cn, palette } from '@/lib/utils'
import { Icon, iconNames } from '@/lib/icons'

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
        {label}
        {hint && <span className="font-normal opacity-80">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

const control =
  'h-11 w-full rounded-xl border border-line bg-subtle px-3.5 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-violet-500/60 focus:bg-elevated focus:ring-4 focus:ring-violet-500/10'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, className)} {...props} />
})

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, 'cursor-pointer appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; activeClass?: string }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div className={cn('inline-flex rounded-xl border border-line bg-subtle p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 cursor-pointer rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                className={cn('absolute inset-0 rounded-lg bg-elevated shadow-sm ring-1 ring-line', o.activeClass)}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="grid size-7 cursor-pointer place-items-center rounded-full transition hover:scale-110"
          style={{ background: c, boxShadow: value === c ? `0 0 0 2px var(--elevated), 0 0 0 4px ${c}` : undefined }}
          aria-label={c}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  )
}

export function IconPicker({ value, onChange, color }: { value: string; onChange: (i: string) => void; color: string }) {
  return (
    <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-line bg-subtle p-2">
      {iconNames.map((name) => {
        const active = value === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              'grid aspect-square cursor-pointer place-items-center rounded-lg transition hover:bg-elevated',
              active ? 'bg-elevated shadow-sm' : 'text-muted',
            )}
            style={active ? { color, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
            aria-label={name}
          >
            <Icon name={name} className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
