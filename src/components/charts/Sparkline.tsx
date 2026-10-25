import { useId } from 'react'
import { motion } from 'motion/react'

export function Sparkline({ data, baseline, className }: { data: number[]; baseline?: number; className?: string }) {
  const id = useId()
  if (data.length < 2) return <div className={className} />
  const values = baseline === undefined ? data : [...data, baseline]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const y = (v: number) => 30 - ((v - min) / span) * 28 - 1
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${y(v)}`).join(' ')
  const up = data[data.length - 1] >= (baseline ?? data[0])
  const color = up ? '#10b981' : '#f43f5e'
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {baseline !== undefined && (
        <line x1="0" x2="100" y1={y(baseline)} y2={y(baseline)} stroke="var(--muted)" strokeOpacity="0.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      )}
      <polygon points={`0,30 ${points} 100,30`} fill={`url(#${id})`} />
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  )
}
