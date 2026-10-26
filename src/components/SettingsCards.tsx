import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ArchiveRestore, DatabaseBackup, Download, KeyRound, Lock, LogOut, ShieldCheck } from 'lucide-react'
import { useBackups, useChangePassword, useCreateBackup, useLogout, useLogoutOthers, useRestoreSnapshot } from '@/lib/api'
import { Card, CardHeader } from './ui/Card'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Form'
import { Skeleton } from './ui/Misc'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/Confirm'

const fileSize = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function SecurityCard() {
  const toast = useToast()
  const change = useChangePassword()
  const logoutOthers = useLogoutOthers()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (next.length < 4) return setError('Use at least 4 characters')
    if (next !== confirm) return setError("New passwords don't match")
    try {
      await change.mutateAsync({ current, next })
      toast({ message: 'Password changed. Other devices were signed out.' })
      setOpen(false)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader title="Security" subtitle="Password, devices and lock" action={<ShieldCheck className="size-4 text-muted" />} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <KeyRound className="size-4" /> Change password
        </Button>
        <Button
          size="sm"
          loading={logoutOthers.isPending}
          onClick={async () => {
            const res = await logoutOthers.mutateAsync()
            toast({ message: res.signedOut ? `Signed out ${res.signedOut} other device(s)` : 'No other devices were signed in', tone: 'info' })
          }}
        >
          <LogOut className="size-4" /> Sign out other devices
        </Button>
        <Button size="sm" variant="outline" className="text-rose-500" onClick={() => logout.mutate()}>
          <Lock className="size-4" /> Lock now
        </Button>
      </div>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mt-4 space-y-3 rounded-2xl border border-line bg-subtle p-4"
        >
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New password">
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Confirm new">
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={change.isPending}>
              Update password
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export function BackupsCard() {
  const toast = useToast()
  const confirm = useConfirm()
  const { data, isLoading } = useBackups()
  const create = useCreateBackup()
  const restore = useRestoreSnapshot()
  const items = data?.items ?? []
  const latest = items[0]

  return (
    <Card>
      <CardHeader
        title="Automatic backups"
        subtitle={data ? `Saved daily · keeping the latest ${data.keep}` : 'Saved daily'}
        action={<DatabaseBackup className="size-4 text-muted" />}
      />
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              {latest ? (
                <>
                  Last backup <span className="font-medium">{formatDistanceToNow(parseISO(latest.createdAt), { addSuffix: true })}</span>
                  <span className="text-muted"> · {items.length} stored</span>
                </>
              ) : (
                <span className="text-muted">No backups yet</span>
              )}
            </div>
            <Button
              size="sm"
              loading={create.isPending}
              onClick={async () => {
                try {
                  const res = await create.mutateAsync()
                  toast({ message: `Backup saved: ${res.name}` })
                } catch (e) {
                  toast({ message: (e as Error).message, tone: 'error' })
                }
              }}
            >
              <DatabaseBackup className="size-4" /> Back up now
            </Button>
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {items.map((b) => (
              <li key={b.name} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-subtle">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{b.name}</span>
                <span className="text-xs text-muted">{fileSize(b.size)}</span>
                <a
                  href={`/api/backups/${encodeURIComponent(b.name)}`}
                  download
                  className="grid size-7 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                  aria-label={`Download ${b.name}`}
                  title="Download"
                >
                  <Download className="size-3.5" />
                </a>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Restore this backup?',
                      message: `All current data will be replaced with ${b.name}. A safety backup of the current state is made first.`,
                      confirmLabel: 'Restore',
                      danger: true,
                    })
                    if (!ok) return
                    try {
                      await restore.mutateAsync(b.name)
                      toast({ message: 'Backup restored' })
                    } catch (e) {
                      toast({ message: (e as Error).message, tone: 'error' })
                    }
                  }}
                  className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg"
                  aria-label={`Restore ${b.name}`}
                  title="Restore"
                >
                  <ArchiveRestore className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {data && (
            <p className="mt-3 rounded-xl bg-subtle p-3 text-xs text-muted">
              Files are stored in <span className="font-mono break-all text-fg">{data.directory}</span>
              {data.directory === '/backups' && <> — the <span className="font-mono text-fg">backups</span> folder next to docker-compose.yml on your PC</>}.
              Sync that folder to Google Drive or OneDrive for off-site copies.
            </p>
          )}
        </>
      )}
    </Card>
  )
}
