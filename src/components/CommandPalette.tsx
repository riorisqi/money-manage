import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CornerDownLeft,
  LayoutDashboard,
  ListOrdered,
  Moon,
  PiggyBank,
  Search,
  Settings,
  Shapes,
  Sun,
  Wallet,
} from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useTxForm } from './TransactionForm'
import { Kbd } from './ui/Misc'

interface Command {
  id: string
  label: string
  group: string
  icon: ReactNode
  keywords?: string
  run: () => void
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { openTx } = useTxForm()
  const { resolved, setPref } = useTheme()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(
    () => [
      { id: 'expense', group: 'Actions', label: 'Add expense', icon: <ArrowUpRight />, keywords: 'new spend', run: () => openTx({ type: 'expense' }) },
      { id: 'income', group: 'Actions', label: 'Add income', icon: <ArrowDownLeft />, keywords: 'new earn salary', run: () => openTx({ type: 'income' }) },
      { id: 'transfer', group: 'Actions', label: 'Transfer between accounts', icon: <ArrowLeftRight />, keywords: 'move', run: () => openTx({ type: 'transfer' }) },
      {
        id: 'theme',
        group: 'Actions',
        label: `Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`,
        icon: resolved === 'dark' ? <Sun /> : <Moon />,
        keywords: 'theme appearance',
        run: () => setPref(resolved === 'dark' ? 'light' : 'dark'),
      },
      { id: 'dash', group: 'Navigate', label: 'Dashboard', icon: <LayoutDashboard />, keywords: 'home overview', run: () => navigate('/') },
      { id: 'tx', group: 'Navigate', label: 'Transactions', icon: <ListOrdered />, keywords: 'history list', run: () => navigate('/transactions') },
      { id: 'budgets', group: 'Navigate', label: 'Budgets', icon: <PiggyBank />, keywords: 'limit plan', run: () => navigate('/budgets') },
      { id: 'accounts', group: 'Navigate', label: 'Accounts', icon: <Wallet />, keywords: 'wallet bank', run: () => navigate('/accounts') },
      { id: 'categories', group: 'Navigate', label: 'Categories', icon: <Shapes />, keywords: 'tags', run: () => navigate('/categories') },
      { id: 'settings', group: 'Navigate', label: 'Settings', icon: <Settings />, keywords: 'currency backup export', run: () => navigate('/settings') },
    ],
    [navigate, openTx, resolved, setPref],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  const execute = (c?: Command) => {
    if (!c) return
    onClose()
    setTimeout(c.run, 60)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => (i + 1) % Math.max(results.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => (i - 1 + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      execute(results[index])
    } else if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search…"
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <div className="py-10 text-center text-sm text-muted">No matching commands</div>}
              {results.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null
                lastGroup = c.group
                return (
                  <div key={c.id}>
                    {header && <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{header}</div>}
                    <button
                      onMouseMove={() => setIndex(i)}
                      onClick={() => execute(c)}
                      className={cn(
                        'relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm',
                        i === index ? 'text-fg' : 'text-muted',
                      )}
                    >
                      {i === index && (
                        <motion.span
                          layoutId="cmd-active"
                          className="absolute inset-0 rounded-xl bg-subtle ring-1 ring-line"
                          transition={{ type: 'spring', stiffness: 600, damping: 40 }}
                        />
                      )}
                      <span className="relative [&>svg]:size-4">{c.icon}</span>
                      <span className="relative flex-1">{c.label}</span>
                      {i === index && <CornerDownLeft className="relative size-3.5 text-muted" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
