import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value
    let pos = e.target.selectionStart ?? raw.length
    const native = e.nativeEvent as InputEvent
    const inserted = native.data ?? ''
    const start = pos - inserted.length
    if (inserted && start >= 0 && raw.slice(start, pos) === inserted && inserted.includes(seps.group)) {
      let replacement = inserted
      if (inserted === seps.group) {
        const token = raw.slice(0, start).split(/[+\-*/x()]/).pop() ?? ''
        replacement = token.includes(seps.decimal) || !/\d$/.test(token) ? '' : seps.decimal
      } else {
        const parts = inserted.split(seps.group)
        if (parts.length === 2 && !inserted.includes(seps.decimal) && /^\d{1,2}(?!\d)/.test(parts[1])) {
          replacement = parts.join(seps.decimal)
        }
      }
      raw = raw.slice(0, start) + replacement + raw.slice(pos)
      pos = start + replacement.length
    }
    const removedSeparatorOnly =
      native.inputType === 'deleteContentBackward' && strip(raw, seps) === strip(text, seps)
    if (removedSeparatorOnly) {
      let i = pos - 1
      while (i >= 0 && isGroupChar(raw[i], seps)) i--
      if (i >= 0) {
        raw = raw.slice(0, i) + raw.slice(i + 1)
        pos = i
      }
    }
    const significant = strip(raw.slice(0, pos), seps).length
    const next = formatAmountText(raw, seps)
    let nextPos = 0
    for (let count = 0; nextPos < next.length && count < significant; nextPos++) {
      if (!isGroupChar(next[nextPos], seps)) count++
    }
    caret.current = nextPos
    setText(next)
  }

  const setAmount = useCallback((n: number | null) => setText(amountToText(n, seps)), [seps])

  return {
    text,
    amount: parseAmountText(text, seps),
    setAmount,
    ref,
    inputProps: { ref, value: text, onChange, inputMode: 'decimal' as const, autoComplete: 'off' },
  }
}
