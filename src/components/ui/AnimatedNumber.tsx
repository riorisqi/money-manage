import { useEffect, useRef } from 'react'
import { animate, useInView } from 'motion/react'

export function AnimatedNumber({
  value,
  format,
  className,
  duration = 1.1,
}: {
  value: number
  format: (n: number) => string
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = format(v)
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, format, inView, duration])

  return (
    <span ref={ref} className={className}>
      {format(prev.current)}
    </span>
  )
}
