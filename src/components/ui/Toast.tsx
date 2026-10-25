import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: ReactNode
  tone: Tone
  action?: { label: string; onClick: () => void }
}

type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: Tone; duration?: number }

const Ctx = createContext<((t: ToastInput) => void) | null>(null)

const toneIcon = {
  success: <CheckCircle2 className="size-4 text-emerald-500" />,
  error: <AlertTriangle className="size-4 text-rose-500" />,
  info: <Info className="size-4 text-sky-500" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const push = useCallback(
    ({ duration = 4000, tone = 'success', ...t }: ToastInput) => {
      const id = nextId.current++
      setToasts((ts) => [...ts.slice(-3), { ...t, tone, id }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-elevated/95 px-4 py-3 text-sm shadow-xl backdrop-blur-xl',
              )}
            >
              {toneIcon[t.tone]}
              <div className="min-w-0 flex-1">{t.message}</div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-violet-500 hover:bg-violet-500/10"
                >
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} className="cursor-pointer text-muted hover:text-fg" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
