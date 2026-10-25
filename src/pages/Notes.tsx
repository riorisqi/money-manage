import { useDeferredValue, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Check, ListChecks, NotebookPen, Pin, PinOff, Plus, Search, SearchX, Trash2, X } from 'lucide-react'
import type { Note } from '@shared/types'
import { useDeleteNote, useNotes, useSaveNote, type NoteInput } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/Layout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Kbd, Skeleton } from '@/components/ui/Misc'
import { useToast } from '@/components/ui/Toast'

const noteColors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#64748b']

const checkLine = /^(\s*[-*] \[)( |x|X)(\] ?)(.*)$/

type Line = { kind: 'text'; text: string } | { kind: 'check'; text: string; done: boolean; index: number }

function parseLines(content: string): Line[] {
  return content.split('\n').map((text, index) => {
    const m = checkLine.exec(text)
    return m ? { kind: 'check', text: m[4], done: m[2] !== ' ', index } : { kind: 'text', text }
  })
}

function toggleLine(content: string, index: number) {
  const lines = content.split('\n')
  lines[index] = lines[index].replace(checkLine, (_, a, mark, b, rest) => `${a}${mark === ' ' ? 'x' : ' '}${b}${rest}`)
  return lines.join('\n')
}

const toInput = ({ title, content, color, pinned }: Note): NoteInput => ({ title, content, color, pinned })

export function Notes() {
  const { data: notes = [], isLoading } = useNotes()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Note> | null>(null)
  const q = useDeferredValue(search.trim().toLowerCase())

  const filtered = useMemo(
    () => (q ? notes.filter((n) => `${n.title}\n${n.content}`.toLowerCase().includes(q)) : notes),
    [notes, q],
  )
  const pinned = filtered.filter((n) => n.pinned)
  const others = filtered.filter((n) => !n.pinned)

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Plans, shopping lists, reminders — anything worth jotting down."
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Plus className="size-4" /> New note
          </Button>
        }
      />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="pl-10" />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted hover:text-fg"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {['h-28', 'h-44', 'h-36'].map((h) => (
            <Skeleton key={h} className={cn('mb-4 break-inside-avoid', h)} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={q ? <SearchX className="size-6" /> : <NotebookPen className="size-6" />}
          title={q ? 'No matching notes' : 'No notes yet'}
          message={q ? 'Try a different search.' : 'Capture savings goals, shopping lists or anything you want to remember.'}
          action={
            !q && (
              <Button variant="primary" onClick={() => setEditing({})}>
                <Plus className="size-4" /> Write a note
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && <NoteSection title="Pinned" notes={pinned} onOpen={setEditing} />}
          {others.length > 0 && <NoteSection title={pinned.length ? 'Others' : undefined} notes={others} onOpen={setEditing} />}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit note' : 'New note'}>
        {editing && <NoteEditor key={editing.id ?? 'new'} note={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}

function NoteSection({ title, notes, onOpen }: { title?: string; notes: Note[]; onOpen: (n: Note) => void }) {
  return (
    <section>
      {title && <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        <AnimatePresence mode="popLayout">
          {notes.map((n, i) => (
            <NoteCard key={n.id} note={n} index={i} onOpen={() => onOpen(n)} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

function NoteCard({ note, index, onOpen }: { note: Note; index: number; onOpen: () => void }) {
  const save = useSaveNote()
  const remove = useDeleteNote()
  const toast = useToast()
  const lines = useMemo(() => parseLines(note.content), [note.content])
  const checks = lines.filter((l) => l.kind === 'check')
  const done = checks.filter((l) => l.done).length

  const update = (patch: Partial<NoteInput>) => save.mutate({ id: note.id, ...toInput(note), ...patch })

  const destroy = async () => {
    await remove.mutateAsync(note.id)
    toast({
      message: 'Note deleted',
      tone: 'info',
      duration: 6000,
      action: { label: 'Undo', onClick: () => save.mutate(toInput(note)) },
    })
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      onClick={onOpen}
      className="group glass relative mb-4 cursor-pointer break-inside-avoid overflow-hidden rounded-2xl p-4 pt-5"
      style={{ boxShadow: `inset 0 3px 0 ${note.color}` }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60"
        style={{ background: `linear-gradient(to bottom, ${note.color}22, transparent)` }}
      />
      <div className="relative">
        <div className="flex items-start gap-2">
          {note.title && <h3 className="flex-1 font-display font-semibold tracking-tight break-words">{note.title}</h3>}
          <button
            onClick={(e) => {
              e.stopPropagation()
              update({ pinned: !note.pinned })
            }}
            className={cn(
              'ml-auto grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg transition hover:bg-subtle',
              note.pinned ? 'text-fg' : 'text-muted opacity-0 group-hover:opacity-100 max-sm:opacity-100',
            )}
            style={note.pinned ? { color: note.color } : undefined}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin className={cn('size-4', note.pinned && 'fill-current')} />
          </button>
        </div>

        {checks.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-subtle">
              <motion.div
                className="h-full rounded-full"
                style={{ background: note.color }}
                animate={{ width: `${(done / checks.length) * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
            {done}/{checks.length}
          </div>
        )}

        <div className="mt-2 space-y-1 text-sm text-muted">
          {lines.slice(0, 14).map((l, i) =>
            l.kind === 'check' ? (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation()
                  update({ content: toggleLine(note.content, l.index) })
                }}
                className="flex w-full cursor-pointer items-start gap-2 text-left"
              >
                <span
                  className={cn(
                    'mt-0.5 grid size-4 shrink-0 place-items-center rounded border transition',
                    l.done ? 'border-transparent text-white' : 'border-line',
                  )}
                  style={l.done ? { background: note.color } : undefined}
                >
                  {l.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cn('break-words transition', l.done && 'line-through opacity-60')}>{l.text}</span>
              </button>
            ) : (
              <p key={i} className="min-h-[1em] break-words whitespace-pre-wrap">
                {l.text}
              </p>
            ),
          )}
          {lines.length > 14 && <p className="text-xs opacity-70">…</p>}
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
          <span>{formatDistanceToNow(parseISO(note.updatedAt), { addSuffix: true })}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              destroy()
            }}
            className="grid size-7 cursor-pointer place-items-center rounded-lg opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 max-sm:opacity-100"
            aria-label="Delete note"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  )
}

function NoteEditor({ note, onClose }: { note: Partial<Note>; onClose: () => void }) {
  const save = useSaveNote()
  const remove = useDeleteNote()
  const toast = useToast()
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [color, setColor] = useState(note.color ?? noteColors[0])
  const [pinned, setPinned] = useState(note.pinned ?? false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim() && !content.trim()) return setError('Write something first')
    try {
      await save.mutateAsync({ id: note.id, title: title.trim(), content, color, pinned })
      toast({ message: note.id ? 'Note updated' : 'Note saved' })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const addChecklistItem = () => setContent((c) => `${c}${c && !c.endsWith('\n') ? '\n' : ''}- [ ] `)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          submit()
        }
      }}
      className="space-y-4"
    >
      <div
        className="overflow-hidden rounded-2xl border border-line bg-subtle transition-shadow focus-within:ring-4 focus-within:ring-violet-500/10"
        style={{ boxShadow: `inset 0 3px 0 ${color}` }}
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={120}
          className="w-full bg-transparent px-4 pt-4 pb-1 font-display text-lg font-semibold outline-none placeholder:text-muted/60"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return
            const el = e.currentTarget
            const before = content.slice(0, el.selectionStart)
            const line = before.slice(before.lastIndexOf('\n') + 1)
            const m = checkLine.exec(line)
            if (!m) return
            e.preventDefault()
            const next = m[4].trim()
              ? `${before}\n- [ ] ${content.slice(el.selectionEnd)}`
              : `${before.slice(0, before.length - line.length)}${content.slice(el.selectionEnd)}`
            const caret = m[4].trim() ? before.length + 7 : before.length - line.length
            setContent(next)
            requestAnimationFrame(() => el.setSelectionRange(caret, caret))
          }}
          placeholder="Take a note… use “- [ ] ” for a checklist"
          rows={8}
          maxLength={20000}
          className="block max-h-[45dvh] min-h-40 w-full resize-y bg-transparent px-4 pt-1 pb-4 text-sm leading-relaxed outline-none placeholder:text-muted/60"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {noteColors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="grid size-6 cursor-pointer place-items-center rounded-full transition hover:scale-110"
              style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--elevated), 0 0 0 4px ${c}` : undefined }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            >
              {color === c && <Check className="size-3 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={addChecklistItem} title="Add checklist item">
            <ListChecks className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setPinned((p) => !p)}
            title={pinned ? 'Unpin' : 'Pin'}
            className={pinned ? 'text-violet-500' : undefined}
          >
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        {note.id && (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
            onClick={async () => {
              await remove.mutateAsync(note.id!)
              toast({
                message: 'Note deleted',
                tone: 'info',
                duration: 6000,
                action: { label: 'Undo', onClick: () => save.mutate(toInput(note as Note)) },
              })
              onClose()
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted sm:flex">
          <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>
        </span>
        <Button type="submit" variant="primary" loading={save.isPending} className="min-w-24">
          {note.id ? 'Save changes' : 'Save note'}
        </Button>
      </div>
    </form>
  )
}
