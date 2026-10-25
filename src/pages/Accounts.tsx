import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftRight, Pencil, Plus } from 'lucide-react'
import type { Account, AccountType } from '@shared/types'
import { useBootstrap, useDeleteAccount, useSaveAccount } from '@/lib/api'
import { useMoney } from '@/lib/format'
import { Icon } from '@/lib/icons'
import { evaluateAmount } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ColorPicker, Field, IconPicker, Input, Select } from '@/components/ui/Form'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'
import { useTxForm } from '@/components/TransactionForm'

const accountTypes: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'wallet' },
  { value: 'bank', label: 'Bank', icon: 'landmark' },
  { value: 'ewallet', label: 'E-Wallet', icon: 'smartphone' },
  { value: 'credit', label: 'Credit card', icon: 'credit-card' },
  { value: 'savings', label: 'Savings', icon: 'piggy-bank' },
  { value: 'investment', label: 'Investment', icon: 'trending-up' },
]

const typeLabel = Object.fromEntries(accountTypes.map((t) => [t.value, t.label]))

export function Accounts() {
  const { data } = useBootstrap()
  const money = useMoney()
  const { openTx } = useTxForm()
  const [editing, setEditing] = useState<Partial<Account> | null>(null)
  const accounts = data?.accounts ?? []
  const total = accounts.reduce((s, a) => s + a.balance, 0)
  const assets = accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0)
  const debts = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0)

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Wallets, banks and cards — all in one place."
        actions={
          <>
            <Button variant="outline" onClick={() => openTx({ type: 'transfer' })} disabled={accounts.length < 2}>
              <ArrowLeftRight className="size-4" /> Transfer
            </Button>
            <Button variant="primary" onClick={() => setEditing({})}>
              <Plus className="size-4" /> New account
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Net worth', value: total, cls: 'text-gradient' },
          { label: 'Assets', value: assets, cls: 'text-emerald-500' },
          { label: 'Debts', value: debts, cls: 'text-rose-500' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className={`mt-1 font-display text-2xl font-bold tabular ${s.cls}`}>
              <AnimatedNumber value={s.value} format={money.format} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a, i) => (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 20, rotateX: -10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 220, damping: 24 }}
            whileHover={{ y: -4 }}
            onClick={() => setEditing(a)}
            className="group relative aspect-[1.7] cursor-pointer overflow-hidden rounded-3xl p-5 text-left text-white shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${a.color}, ${a.color}aa 50%, #0f172a)`,
              boxShadow: `0 20px 40px -18px ${a.color}`,
            }}
          >
            <div className="absolute -top-16 -right-10 size-48 rounded-full bg-white/15 blur-2xl transition group-hover:scale-125" />
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-white/20 backdrop-blur">
                  <Icon name={a.icon} className="size-5" />
                </div>
                <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
                  {typeLabel[a.type]}
                </span>
              </div>
              <div className="mt-auto">
                <div className="text-sm text-white/80">{a.name}</div>
                <div className="font-display text-2xl font-bold tracking-tight tabular">{money.format(a.balance)}</div>
              </div>
              <Pencil className="absolute right-0 bottom-1 size-4 opacity-0 transition group-hover:opacity-70" />
            </div>
          </motion.button>
        ))}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setEditing({})}
          className="group grid aspect-[1.7] cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-line text-muted transition hover:border-violet-500/50 hover:text-violet-500"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus className="size-6 transition group-hover:rotate-90" />
            <span className="text-sm font-medium">Add account</span>
          </div>
        </motion.button>
      </div>

      <AccountModal account={editing} onClose={() => setEditing(null)} canDelete={accounts.length > 1} />
    </div>
  )
}

function AccountModal({
  account,
  onClose,
  canDelete,
}: {
  account: Partial<Account> | null
  onClose: () => void
  canDelete: boolean
}) {
  return (
    <Modal open={!!account} onClose={onClose} title={account?.id ? 'Edit account' : 'New account'}>
      {account && <AccountForm key={account.id ?? 'new'} account={account} onClose={onClose} canDelete={canDelete} />}
    </Modal>
  )
}

function AccountForm({ account, onClose, canDelete }: { account: Partial<Account>; onClose: () => void; canDelete: boolean }) {
  const money = useMoney()
  const toast = useToast()
  const confirm = useConfirm()
  const save = useSaveAccount()
  const remove = useDeleteAccount()
  const [name, setName] = useState(account.name ?? '')
  const [type, setType] = useState<AccountType>(account.type ?? 'bank')
  const [color, setColor] = useState(account.color ?? '#6366f1')
  const [icon, setIcon] = useState(account.icon ?? 'landmark')
  const [initial, setInitial] = useState(account.initialBalance ? String(account.initialBalance) : '')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const initialBalance = initial.trim() ? evaluateAmount(initial) : 0
    if (!name.trim()) return setError('Name is required')
    if (initialBalance === null) return setError('Initial balance is not a valid number')
    try {
      await save.mutateAsync({ id: account.id, name: name.trim(), type, color, icon, initialBalance })
      toast({ message: account.id ? 'Account updated' : 'Account created' })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-4 text-white"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}aa 50%, #0f172a)` }}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white/20">
            <Icon name={icon} className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">{name || 'Account name'}</div>
            <div className="text-xs text-white/70">{typeLabel[type]}</div>
          </div>
          <div className="ml-auto font-display text-lg font-bold">{money.format(evaluateAmount(initial) ?? 0)}</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main bank" maxLength={60} />
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={(e) => {
              const t = e.target.value as AccountType
              setType(t)
              if (!account.id) setIcon(accountTypes.find((x) => x.value === t)!.icon)
            }}
          >
            {accountTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Starting balance" hint="Use a negative value for debt">
        <Input inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Icon">
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </Field>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        {account.id && canDelete && (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${account.name}?`,
                message: 'All transactions linked to this account will be deleted too. This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
              })
              if (!ok) return
              await remove.mutateAsync(account.id!)
              toast({ message: 'Account deleted', tone: 'info' })
              onClose()
            }}
          >
            Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="ml-auto" loading={save.isPending}>
          {account.id ? 'Save changes' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}

