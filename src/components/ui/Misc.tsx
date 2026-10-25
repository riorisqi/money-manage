import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-xl bg-[length:200%_100%] bg-gradient-to-r from-subtle via-line to-subtle',
        className,
      )}
    />
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  message?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl" />
        <div className="relative grid size-14 animate-float place-items-center rounded-2xl border border-line bg-elevated text-violet-500">
          {icon}
        </div>
      </div>
      <h3 className="font-display font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-xs text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>
  )
}

export function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-subtle">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 12px ${color}88` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      />
    </div>
  )
}
