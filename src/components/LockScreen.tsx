import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useLogin, useSetupPassword } from '@/lib/api'
import { Background } from './Background'
import { Button } from './ui/Button'
import { Input } from './ui/Form'

export function LockScreen({ mode }: { mode: 'setup' | 'login' }) {
  const login = useLogin()
  const setup = useSetupPassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const isSetup = mode === 'setup'
  const pending = login.isPending || setup.isPending || unlocked

  const fail = (message: string) => {
    setError(message)
    setAttempt((a) => a + 1)
  }

  const submit = async () => {
    setError(null)
    if (password.length < 4) return fail('Use at least 4 characters')
    if (isSetup && password !== confirm) return fail("Passwords don't match")
    try {
      if (isSetup) await setup.mutateAsync(password)
      else {
        setUnlocked(true)
        await login.mutateAsync(password)
      }
    } catch (e) {
      setUnlocked(false)
      setPassword('')
      fail((e as Error).message)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Background />
      <motion.form
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="glass w-full max-w-sm rounded-3xl p-7 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <motion.div
            key={attempt}
            animate={attempt ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
            transition={{ duration: 0.4 }}
            className="relative mb-4"
          >
            <div className="absolute inset-0 rounded-2xl bg-brand opacity-60 blur-xl" />
            <div className="relative grid size-16 place-items-center rounded-2xl bg-brand text-white shadow-lg">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isSetup ? 'setup' : unlocked ? 'open' : 'lock'}
                  initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                >
                  {isSetup ? <ShieldCheck className="size-7" /> : unlocked ? <LockOpen className="size-7" /> : <Lock className="size-7" />}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
          <h1 className="font-display text-xl font-bold tracking-tight">{isSetup ? 'Protect your money' : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-muted">
            {isSetup
              ? 'Set a password or PIN. You’ll need it on every new device.'
              : 'Enter your password or PIN to unlock.'}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Input
              autoFocus
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetup ? 'New password or PIN' : 'Password or PIN'}
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              className="pr-11 text-center tracking-widest"
              aria-label="Password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted hover:text-fg"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {isSetup && (
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm"
              autoComplete="new-password"
              className="text-center tracking-widest"
              aria-label="Confirm password"
            />
          )}

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
            {isSetup ? 'Set password' : 'Unlock'}
          </Button>
        </div>

        {!isSetup && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowHelp((s) => !s)}
              className="cursor-pointer text-xs text-muted hover:text-fg"
            >
              Forgot your password?
            </button>
            <AnimatePresence>
              {showHelp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="mt-3 rounded-xl bg-subtle p-3 text-left text-xs text-muted">
                    On the computer running the app, run this, then open the app to set a new password. Your data is kept.
                    <code className="mt-2 block rounded-lg bg-elevated p-2 font-mono text-[11px] break-all text-fg">
                      docker exec money-manage bun dist/server/index.js --reset-password
                    </code>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.form>
    </div>
  )
}
