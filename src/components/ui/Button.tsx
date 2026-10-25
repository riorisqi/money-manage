import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 hover:brightness-110 active:brightness-95',
  secondary: 'bg-subtle text-fg hover:bg-line/80 border border-line',
  outline: 'border border-line text-fg hover:bg-subtle',
  ghost: 'text-muted hover:text-fg hover:bg-subtle',
  danger: 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
  icon: 'size-10 rounded-xl',
  'icon-sm': 'size-8 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-all duration-200 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
})
