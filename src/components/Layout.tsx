import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { NavLink, useLocation, type Location } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  Command,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Moon,
  PiggyBank,
  Plus,
  Settings,
  Shapes,
  Sun,
  Wallet,
} from 'lucide-react'
import { useTheme, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Background } from './Background'
import { CommandPalette } from './CommandPalette'
import { useTxForm } from './TransactionForm'
import { Kbd } from './ui/Misc'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ListOrdered },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/categories', label: 'Categories', icon: Shapes },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const mobileNav = [nav[0], nav[1], null, nav[2], nav[3]]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-9 place-items-center rounded-xl bg-brand shadow-lg shadow-violet-600/30">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17V7l7 6 7-6v10" />
        </svg>
        <span className="absolute -inset-px -z-10 rounded-xl bg-brand opacity-60 blur-md" />
      </div>
      <div className="leading-none">
        <div className="font-display text-[15px] font-bold tracking-tight">Money</div>
        <div className="text-[10px] font-medium tracking-[0.2em] text-muted uppercase">Manage</div>
      </div>
    </div>
  )
}

function ThemeSwitch({ className }: { className?: string }) {
  const { pref, setPref } = useTheme()
  const options: { value: ThemePref; icon: ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="size-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="size-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="size-4" />, label: 'System' },
  ]
  return (
    <div className={cn('flex rounded-xl border border-line bg-subtle p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={(e: MouseEvent) => setPref(o.value, { x: e.clientX, y: e.clientY })}
          className={cn(
            'relative flex flex-1 cursor-pointer items-center justify-center rounded-lg py-1.5 transition-colors',
            pref === o.value ? 'text-fg' : 'text-muted hover:text-fg',
          )}
          aria-label={o.label}
          title={o.label}
        >
          {pref === o.value && (
            <motion.span
              layoutId="theme-pill"
              className="absolute inset-0 rounded-lg bg-elevated shadow-sm ring-1 ring-line"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative">{o.icon}</span>
        </button>
      ))}
    </div>
  )
}

function QuickThemeToggle() {
  const { resolved, setPref } = useTheme()
  return (
    <button
      onClick={(e) => setPref(resolved === 'dark' ? 'light' : 'dark', { x: e.clientX, y: e.clientY })}
      className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line bg-subtle text-muted transition hover:text-fg"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {resolved === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export function Layout({ children }: { children: (location: Location) => ReactNode }) {
  const { openTx } = useTxForm()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') {
        if (document.querySelector('[role="dialog"]')) return
        e.preventDefault()
        openTx()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openTx])

  return (
    <div className="min-h-dvh">
      <Background />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 p-4 backdrop-blur-xl lg:flex">
        <div className="px-2 pt-2 pb-6">
          <Logo />
        </div>
        <button
          onClick={() => openTx()}
          className="group relative mb-6 flex h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:shadow-violet-600/50"
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <Plus className="size-4 transition-transform group-hover:rotate-90" />
          New transaction
          <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">N</span>
        </button>
        <nav className="flex-1 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'text-fg' : 'text-muted hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-subtle ring-1 ring-line"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    >
                      <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
                    </motion.span>
                  )}
                  <Icon className={cn('relative size-[18px]', isActive && 'text-violet-500')} />
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-muted transition hover:text-fg"
        >
          <Command className="size-3.5" />
          Command menu
          <span className="ml-auto flex gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <ThemeSwitch />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-bg/70 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line bg-subtle text-muted"
            aria-label="Open command menu"
          >
            <Command className="size-4" />
          </button>
          <NavLink
            to="/settings"
            className="grid size-10 place-items-center rounded-xl border border-line bg-subtle text-muted"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </NavLink>
          <QuickThemeToggle />
        </div>
      </header>

      <main className="px-4 pt-5 pb-32 sm:px-6 lg:ml-64 lg:px-10 lg:pt-8 lg:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-6xl"
          >
            {children(location)}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 items-center rounded-2xl border border-line bg-elevated/80 px-2 pb-[env(safe-area-inset-bottom)] shadow-2xl backdrop-blur-xl lg:hidden">
        {mobileNav.map((item) =>
          item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium', isActive ? 'text-violet-500' : 'text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="mnav" className="absolute -top-px h-0.5 w-8 rounded-full bg-brand" />
                  )}
                  <item.icon className="size-5" />
                  {item.label}
                </>
              )}
            </NavLink>
          ) : (
            <div key="fab" className="flex justify-center">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => openTx()}
                className="-mt-8 grid size-14 cursor-pointer place-items-center rounded-2xl bg-brand text-white shadow-xl shadow-violet-600/40 ring-4 ring-bg"
                aria-label="New transaction"
              >
                <Plus className="size-6" />
              </motion.button>
            </div>
          ),
        )}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
