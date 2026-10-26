import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { evaluateAmount } from './utils'
import { useMoney } from './format'

interface Separators {
  group: string
  decimal: string
}

export function getSeparators(locale: string): Separators {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function isGroupChar(ch: string, seps: Separators) {
  return ch === seps.group || (/\s/.test(seps.group) && /\s/.test(ch))
}

function strip(text: string, seps: Separators) {
  return [...text].filter((ch) => !isGroupChar(ch, seps)).join('')
}

export function formatAmountText(text: string, seps: Separators) {
  const number = new RegExp(`\\d+(?:${escape(seps.decimal)}\\d*)?`, 'g')
  return strip(text, seps).replace(number, (match) => {
    const [int, frac] = match.split(seps.decimal)
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, seps.group)
    return frac === undefined ? grouped : `${grouped}${seps.decimal}${frac}`
  })
}

export function parseAmountText(text: string, seps: Separators) {
  return evaluateAmount(strip(text, seps).split(seps.decimal).join('.'))
}

function amountToText(n: number | null | undefined, seps: Separators) {
  return n ? formatAmountText(String(n).replace('.', seps.decimal), seps) : ''
}

function normalizeInsert(inserted: string, before: string, seps: Separators) {
  if (!/[.,]/.test(inserted)) return inserted
  const english = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(inserted)
  const european = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(inserted)
  if (english || european) {
    const [int, frac] = english ? inserted.replace(/,/g, '').split('.') : inserted.replace(/\./g, '').split(',')
    return frac ? `${int}${seps.decimal}${frac}` : int
  }
  if (!inserted.includes(seps.group)) return inserted
  if (inserted === seps.group) {
    const token = before.split(/[+\-*/x()]/).pop() ?? ''
    return token.includes(seps.decimal) || !/\d$/.test(token) ? '' : seps.decimal
  }
  const parts = inserted.split(seps.group)
  if (parts.length === 2 && !inserted.includes(seps.decimal) && /^\d{1,2}(?!\d)/.test(parts[1])) return parts.join(seps.decimal)
  return inserted
}

export function useAmountInput(initial?: number | null) {
  const { locale } = useMoney()
  const seps = useMemo(() => getSeparators(locale), [locale])
  const [text, setText] = useState(() => amountToText(initial, seps))
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (el && caret.current !== null && document.activeElement === el) el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])

  const commit = (raw: string, pos: number) => {
    const significant = strip(raw.slice(0, pos), seps).length
    const next = formatAmountText(raw, seps)
    let nextPos = 0
    for (let count = 0; nextPos < next.length && count < significant; nextPos++) {
      if (!isGroupChar(next[nextPos], seps)) count++
    }
    caret.current = nextPos
    setText(next)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value
    let pos = e.target.selectionStart ?? raw.length
    const native = e.nativeEvent as InputEvent
    const inserted = native.data ?? ''
    const start = pos - inserted.length
    if (inserted && start >= 0 && raw.slice(start, pos) === inserted) {
      const replacement = normalizeInsert(inserted, raw.slice(0, start), seps)
      raw = raw.slice(0, start) + replacement + raw.slice(pos)
      pos = start + replacement.length
    }
    if (native.inputType === 'deleteContentBackward' && strip(raw, seps) === strip(text, seps)) {
      let i = pos - 1
      while (i >= 0 && isGroupChar(raw[i], seps)) i--
      if (i >= 0) {
        raw = raw.slice(0, i) + raw.slice(i + 1)
        pos = i
      }
    }
    commit(raw, pos)
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted) return
    e.preventDefault()
    const el = e.currentTarget
    const from = el.selectionStart ?? el.value.length
    const to = el.selectionEnd ?? from
    const replacement = normalizeInsert(pasted.replace(/^Rp\s*/i, ''), el.value.slice(0, from), seps)
    commit(el.value.slice(0, from) + replacement + el.value.slice(to), from + replacement.length)
  }

  const setAmount = useCallback((n: number | null) => setText(amountToText(n, seps)), [seps])

  return {
    text,
    amount: parseAmountText(text, seps),
    setAmount,
    ref,
    inputProps: { ref, value: text, onChange, onPaste, inputMode: 'decimal' as const, autoComplete: 'off' },
  }
}
