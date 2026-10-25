import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

const Ctx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = useCallback((v: boolean) => {
    resolver.current(v)
    setOptions(null)
  }, [])

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal open={!!options} onClose={() => close(false)} hideClose className="sm:max-w-sm">
        {options && (
          <div className="text-center">
            <div
              className={`mx-auto mb-4 grid size-12 place-items-center rounded-2xl ${options.danger ? 'bg-rose-500/10 text-rose-500' : 'bg-violet-500/10 text-violet-500'}`}
            >
              <AlertTriangle className="size-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">{options.title}</h2>
            {options.message && <p className="mt-2 text-sm text-muted">{options.message}</p>}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button onClick={() => close(false)}>Cancel</Button>
              <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
