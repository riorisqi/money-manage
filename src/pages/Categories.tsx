import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import type { Category, CategoryType } from '@shared/types'
import { useBootstrap, useDeleteCategory, useSaveCategory, useStats } from '@/lib/api'
import { useMoney } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { IconBadge } from '@/lib/icons'
import { PageHeader } from '@/components/Layout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ColorPicker, Field, IconPicker, Input, Segmented } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

export function Categories() {
  const { data } = useBootstrap()
  const period = usePeriod()
  const money = useMoney()
  const { data: stats } = useStats(period.from, period.to, period.group)
  const [tab, setTab] = useState<CategoryType>('expense')
  const [editing, setEditing] = useState<Partial<Category> | null>(null)

  const items = useMemo(() => (data?.categories ?? []).filter((c) => c.type === tab), [data, tab])
  const totals = useMemo(() => new Map(stats?.byCategory.map((c) => [c.categoryId, c])), [stats])

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organize your money with your own labels, colors and icons."
        actions={
          <Button variant="primary" onClick={() => setEditing({ type: tab })}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'expense', label: 'Expenses', activeClass: '!bg-rose-500/10 !ring-rose-500/30' },
          { value: 'income', label: 'Income', activeClass: '!bg-emerald-500/10 !ring-emerald-500/30' },
        ]}
      />
      <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {items.map((c, i) => {
            const t = totals.get(c.id)
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.02 } }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card
                  initial={false}
                  className="flex cursor-pointer items-center gap-3 p-4 transition hover:-translate-y-0.5"
                  onClick={() => setEditing(c)}
                >
                  <IconBadge name={c.icon} color={c.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="text-xs text-muted">
                      {t ? `${money.compact(t.total)} · ${t.count} in ${period.label}` : `No activity in ${period.label}`}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'New category'}>
        {editing && <CategoryForm key={editing.id ?? 'new'} category={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}

function CategoryForm({ category, onClose }: { category: Partial<Category>; onClose: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const save = useSaveCategory()
  const remove = useDeleteCategory()
  const [name, setName] = useState(category.name ?? '')
  const [type, setType] = useState<CategoryType>(category.type ?? 'expense')
  const [color, setColor] = useState(category.color ?? '#8b5cf6')
  const [icon, setIcon] = useState(category.icon ?? 'sparkles')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('Name is required')
    if (category.id && category.type !== type) {
      const ok = await confirm({
        title: 'Change category type?',
        message: 'Existing transactions will become uncategorized and its budget will be removed.',
        confirmLabel: 'Change',
      })
      if (!ok) return
    }
    try {
      await save.mutateAsync({ id: category.id, name: name.trim(), type, color, icon })
      toast({ message: category.id ? 'Category updated' : 'Category created' })
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
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-subtle p-4">
        <motion.div key={icon + color} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
          <IconBadge name={icon} color={color} size="lg" />
        </motion.div>
        <div>
          <div className="font-medium">{name || 'Category name'}</div>
          <div className="text-xs text-muted capitalize">{type}</div>
        </div>
      </div>
      <Segmented
        value={type}
        onChange={setType}
        className="flex w-full"
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />
      <Field label="Name">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" maxLength={60} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Icon">
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </Field>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        {category.id && (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${category.name}?`,
                message: 'Transactions keep their amounts but become uncategorized.',
                confirmLabel: 'Delete',
                danger: true,
              })
              if (!ok) return
              await remove.mutateAsync(category.id!)
              toast({ message: 'Category deleted', tone: 'info' })
              onClose()
            }}
          >
            Delete
          </Button>
        )}
        <Button type="submit" variant="primary" className="ml-auto" loading={save.isPending}>
          {category.id ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  )
}
