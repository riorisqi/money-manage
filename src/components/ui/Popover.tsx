import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface Placement {
  top: number
  left: number
  minWidth: number
  up: boolean
}

export function Popover({
  open,
  anchorRef,
  onClose,
  children,
  matchWidth,
  className,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  matchWidth?: boolean
  className?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const content = contentRef.current
    const height = content?.offsetHeight ?? 0
    const width = Math.max(content?.offsetWidth ?? 0, matchWidth ? rect.width : 0)
    const gap = 6
    const spaceBelow = window.innerHeight - rect.bottom
    const up = height > 0 && spaceBelow < height + gap + 8 && rect.top > spaceBelow
    setPlacement({
      top: up ? rect.top - gap - height : rect.bottom + gap,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      minWidth: matchWidth ? rect.width : 0,
      up,
    })
  }, [anchorRef, matchWidth])

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null)
      return
    }
    place()
    const frame = requestAnimationFrame(place)
    return () => cancelAnimationFrame(frame)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!contentRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, onClose, place, anchorRef])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, scale: 0.96, y: placement?.up ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          style={{
            position: 'fixed',
            top: placement?.top ?? -9999,
            left: placement?.left ?? -9999,
            minWidth: placement?.minWidth,
          }}
          className={cn(
            'z-[60] rounded-2xl border border-line bg-elevated shadow-2xl shadow-black/20',
            placement?.up ? 'origin-bottom' : 'origin-top',
            className,
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
