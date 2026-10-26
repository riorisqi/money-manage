import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { cn, palette } from '@/lib/utils'
import { Icon, iconNames } from '@/lib/icons'
import { Popover } from './Popover'

const FieldId = createContext<string | undefined>(undefined)

export const useFieldId = () => useContext(FieldId)

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
        <label htmlFor={id}>{label}</label>
        {hint && <span className="font-normal opacity-80">{hint}</span>}
      </div>
      <FieldId.Provider value={id}>{children}</FieldId.Provider>
    </div>
  )
}

export const control =
  'h-11 w-full rounded-xl border border-line bg-subtle px-3.5 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-violet-500/60 focus:bg-elevated focus:ring-4 focus:ring-violet-500/10'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  const fieldId = useContext(FieldId)
  return <input ref={ref} id={fieldId} className={cn(control, className)} {...props} />
})

interface SelectOption {
  value: string
  label: ReactNode
  text: string
  disabled?: boolean
}

function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

export function Select({
  value,
  onChange,
  children,
  className,
  disabled,
  placeholder = 'Select…',
  'aria-label': ariaLabel,
}: {
  value: string
  onChange?: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const fieldId = useContext(FieldId)
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const options = useMemo<SelectOption[]>(
    () =>
      Children.toArray(children)
        .filter((child) => isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child))
        .map((child) => {
          const props = (child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>).props
          return { value: String(props.value ?? ''), label: props.children, text: nodeText(props.children), disabled: props.disabled }
        }),
    [children],
  )
  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = options[selectedIndex]

  const close = useCallback(() => setOpen(false), [])

  const openList = () => {
    if (disabled) return
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return
    if (option.value !== value) onChange?.({ target: { value: option.value } })
    setOpen(false)
  }

  const move = (delta: number) => {
    if (!options.length) return
    let next = active
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length
      if (!options[next].disabled) break
    }
    setActive(next)
  }

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const key = e.key
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    if (key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault()
      move(key === 'ArrowDown' ? 1 : -1)
    } else if (key === 'Home' || key === 'End') {
      e.preventDefault()
      setActive(key === 'Home' ? 0 : options.length - 1)
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault()
      choose(options[active])
    } else if (key === 'Tab') {
      close()
    } else if (key.length === 1) {
      const now = Date.now()
      const buffer = now - typeahead.current.at > 600 ? key : typeahead.current.text + key
      typeahead.current = { text: buffer, at: now }
      const match = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(buffer.toLowerCase()))
      if (match >= 0) setActive(match)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={close}
        className={cn(
          control,
          'flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-violet-500/60 bg-elevated ring-4 ring-violet-500/10',
          className,
        )}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-muted/70')}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <Popover open={open} anchorRef={triggerRef} onClose={close} matchWidth className="p-1">
        <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto">
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 pl-8 text-sm transition-colors',
                  index === active && 'bg-subtle',
                  isSelected ? 'font-medium text-fg' : 'text-muted',
                  option.disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                {isSelected && <Check className="absolute left-2.5 size-4 text-violet-500" />}
                <span className="truncate">{option.label}</span>
              </div>
            )
          })}
        </div>
      </Popover>
    </>
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
              'grid aspect-square cursor-pointer place-items-center rounded-lg transition-transform duration-150 active:scale-90',
              !active && 'text-muted hover:bg-line hover:text-fg',
            )}
            style={active ? { color, background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
            aria-pressed={active}
            aria-label={name}
          >
            <Icon name={name} className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
