import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Database, Download, FileJson, Keyboard, Monitor, Moon, Palette, Sun, Trash2, Upload } from 'lucide-react'
import type { Backup } from '@shared/types'
import { fetchBackup, fetchCsv, useBootstrap, useRestoreBackup, useSaveSettings, useWipeData } from '@/lib/api'
import { currencies, currencyLocale, locales } from '@/lib/format'
import { useTheme, type ThemePref } from '@/lib/theme'
import { cn, download } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Form'
import { Kbd } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { BackupsCard, SecurityCard } from '@/components/SettingsCards'

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs text-muted">{description}</div>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { data } = useBootstrap()
  const { pref, setPref } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()
  const saveSettings = useSaveSettings()
  const restore = useRestoreBackup()
  const wipe = useWipeData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const settings = data?.settings ?? { currency: 'USD', locale: 'en-US' }
  const sample = (() => {
    try {
      return new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency }).format(1234567.89)
    } catch {
      return ''
    }
  })()

  const update = async (patch: Partial<typeof settings>) => {
    try {
      await saveSettings.mutateAsync({ ...settings, ...patch })
      toast({ message: 'Preferences saved' })
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    }
  }

  const exportJson = async () => {
    const backup = await fetchBackup()
    download(`money-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
    toast({ message: 'Backup downloaded' })
  }

  const importJson = async (file: File) => {
    try {
      const backup = JSON.parse(await file.text()) as Backup
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `This replaces all current data with ${backup.transactions?.length ?? 0} transactions from the file.`,
        confirmLabel: 'Restore',
        danger: true,
      })
      if (!ok) return
      setBusy(true)
      await restore.mutateAsync(backup)
      toast({ message: 'Backup restored' })
    } catch (e) {
      toast({ message: e instanceof SyntaxError ? 'That file is not valid JSON' : (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const themes: { value: ThemePref; label: string; icon: ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="size-5" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="size-5" /> },
    { value: 'system', label: 'System', icon: <Monitor className="size-5" /> },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Make it yours." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" subtitle="Theme switches with a little flourish" action={<Palette className="size-4 text-muted" />} />
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={(e: MouseEvent) => setPref(t.value, { x: e.clientX, y: e.clientY })}
                className={cn(
                  'group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 transition',
                  pref === t.value ? 'border-violet-500/60 bg-violet-500/10 text-violet-500' : 'border-line text-muted hover:text-fg',
                )}
              >
                <span className="transition group-hover:scale-110 group-hover:rotate-12">{t.icon}</span>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Currency & format" subtitle={sample ? `Preview: ${sample}` : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency">
              <Select value={settings.currency} onChange={(e) => update({ currency: e.target.value, locale: currencyLocale[e.target.value] ?? settings.locale })}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Number format">
              <Select value={settings.locale} onChange={(e) => update({ locale: e.target.value })}>
                {locales.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <SecurityCard />
        <BackupsCard />

        <Card>
          <CardHeader title="Data" subtitle="Stored locally in SQLite on your machine" action={<Database className="size-4 text-muted" />} />
          <Row title="Export backup" description="Everything as a JSON file you can restore later">
            <Button size="sm" onClick={exportJson}>
              <FileJson className="size-4" /> JSON
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                download('transactions-all.csv', await fetchCsv({}), 'text/csv')
                toast({ message: 'CSV exported' })
              }}
            >
              <Download className="size-4" /> CSV
            </Button>
          </Row>
          <Row title="Restore backup" description="Replace all data with a JSON backup">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
            <Button size="sm" loading={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Import
            </Button>
          </Row>
          <Row title="Danger zone" description="Permanently remove data">
            <Button
              size="sm"
              variant="outline"
              className="text-rose-500"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete all transactions?',
                  message: 'Accounts, categories and budgets are kept. This cannot be undone.',
                  confirmLabel: 'Delete',
                  danger: true,
                })
                if (!ok) return
                await wipe.mutateAsync('transactions')
                toast({ message: 'Transactions cleared', tone: 'info' })
              }}
            >
              Clear transactions
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Reset everything?',
                  message: 'All accounts, categories, budgets and transactions will be erased and defaults restored.',
                  confirmLabel: 'Reset',
                  danger: true,
                })
                if (!ok) return
                await wipe.mutateAsync('all')
                toast({ message: 'App reset to defaults', tone: 'info' })
              }}
            >
              <Trash2 className="size-4" /> Reset all
            </Button>
          </Row>
        </Card>

        <Card>
          <CardHeader title="Keyboard shortcuts" subtitle="Move faster" action={<Keyboard className="size-4 text-muted" />} />
          <ul className="space-y-3 text-sm">
            {[
              [['N'], 'New transaction'],
              [['Ctrl', 'K'], 'Command menu'],
              [['Ctrl', 'Enter'], 'Save transaction form'],
              [['Esc'], 'Close dialogs'],
            ].map(([keys, label]) => (
              <li key={label as string} className="flex items-center justify-between">
                <span className="text-muted">{label}</span>
                <span className="flex gap-1">
                  {(keys as string[]).map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-subtle p-3 text-xs text-muted">
            Tip: the amount field understands math — type <span className="font-mono text-fg">12.5k + 300</span> or{' '}
            <span className="font-mono text-fg">45*3</span>.
          </p>
        </Card>
      </div>
    </div>
  )
}
