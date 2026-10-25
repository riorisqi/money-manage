import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemePref = 'light' | 'dark' | 'system'

interface ThemeCtx {
  pref: ThemePref
  resolved: 'light' | 'dark'
  setPref: (pref: ThemePref, origin?: { x: number; y: number }) => void
}

const Ctx = createContext<ThemeCtx | null>(null)
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem('theme')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (pref: ThemePref) => (pref === 'system' ? (media().matches ? 'dark' : 'light') : pref)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolve(readPref()))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#06070c' : '#f4f5fa')
  }, [resolved])

  useEffect(() => {
    if (pref !== 'system') return
    const mq = media()
    const onChange = () => setResolved(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const setPref = useCallback((next: ThemePref, origin?: { x: number; y: number }) => {
    try {
      localStorage.setItem('theme', next)
    } catch {}
    const nextResolved = resolve(next)
    const apply = () => {
      setPrefState(next)
      setResolved(nextResolved)
      document.documentElement.classList.toggle('dark', nextResolved === 'dark')
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce || nextResolved === currentScheme()) {
      apply()
      return
    }
    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? 0
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const transition = document.startViewTransition(() => flushSync(apply))
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }, [])

  return <Ctx.Provider value={{ pref, resolved, setPref }}>{children}</Ctx.Provider>
}

const currentScheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
