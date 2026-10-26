import { useEffect, useRef } from 'react'
import { useTheme } from '@/lib/theme'

const SIDEBAR = 256
const CONTENT = 1152
const LINK = 150
const MOUSE_RADIUS = 170

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: 0 | 1
  side: -1 | 1
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function Constellation({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const palette = dark
      ? { dots: ['196, 181, 253', '103, 232, 249'], line: '167, 139, 250', alpha: 1 }
      : { dots: ['99, 102, 241', '8, 145, 178'], line: '99, 102, 241', alpha: 0.7 }

    let width = 0
    let height = 0
    let leftMax = 0
    let rightMin = 0
    let particles: Particle[] = []
    let frame = 0
    let start = performance.now()
    const mouse = { x: -9999, y: -9999 }

    const contentCenter = () => (width >= 1024 ? SIDEBAR + (width - SIDEBAR) / 2 : width / 2)
    const sideFade = (x: number) => {
      const half = Math.min(CONTENT, width >= 1024 ? width - SIDEBAR : width) / 2
      return smoothstep(half - 60, half + 220, Math.abs(x - contentCenter()))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const half = Math.min(CONTENT, width >= 1024 ? width - SIDEBAR : width) / 2
      leftMax = Math.max(0, contentCenter() - half + 30)
      rightMin = Math.min(width, contentCenter() + half - 30)
      const leftWidth = width >= 1024 ? Math.max(0, leftMax - SIDEBAR) : leftMax
      const rightWidth = width - rightMin
      const count = Math.round(Math.min(240, ((leftWidth + rightWidth) * height) / 6500))
      particles = Array.from({ length: count }, () => {
        const side: -1 | 1 = Math.random() * (leftWidth + rightWidth) < leftWidth ? -1 : 1
        const x = side === -1 ? leftMax - Math.random() * leftWidth : rightMin + Math.random() * rightWidth
        return {
          x,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() < 0.08 ? Math.random() * 1.2 + 2 : Math.random() * 1.3 + 0.8,
          hue: Math.random() < 0.6 ? 0 : 1,
          side,
        }
      })
    }

    const draw = (now: number) => {
      const intro = reduceMotion ? 1 : smoothstep(0, 1600, now - start)
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        if (!reduceMotion) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (1 - dist / MOUSE_RADIUS) * 0.6
            p.vx += (dx / dist) * force * 0.05
            p.vy += (dy / dist) * force * 0.05
          }
          p.vx *= 0.99
          p.vy *= 0.99
          const speed = Math.hypot(p.vx, p.vy)
          if (speed < 0.08) {
            p.vx += (Math.random() - 0.5) * 0.02
            p.vy += (Math.random() - 0.5) * 0.02
          }
          p.x += p.vx
          p.y += p.vy
          if (p.side === -1 && p.x > leftMax) p.vx = -Math.abs(p.vx)
          if (p.side === 1 && p.x < rightMin) p.vx = Math.abs(p.vx)
          if (p.x < -20) p.x = p.side === -1 ? leftMax : width + 20
          if (p.x > width + 20) p.x = p.side === 1 ? rightMin : -20
          if (p.y < -20) p.y = height + 20
          if (p.y > height + 20) p.y = -20
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        const fa = sideFade(a.x)
        if (fa <= 0.01) continue
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist > LINK) continue
          const alpha = (1 - dist / LINK) * 0.45 * Math.min(fa, sideFade(b.x)) * palette.alpha * intro
          if (alpha <= 0.005) continue
          ctx.strokeStyle = `rgba(${palette.line}, ${alpha})`
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y)
        if (md < MOUSE_RADIUS) {
          ctx.strokeStyle = `rgba(${palette.dots[1]}, ${(1 - md / MOUSE_RADIUS) * 0.35 * fa * intro})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
      }

      for (const p of particles) {
        const fade = sideFade(p.x) * intro
        if (fade <= 0.01) continue
        if (p.r > 2) {
          ctx.fillStyle = `rgba(${palette.dots[p.hue]}, ${0.12 * fade * palette.alpha})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = `rgba(${palette.dots[p.hue]}, ${0.9 * fade * palette.alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!reduceMotion) frame = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(draw)
    }

    resize()
    start = performance.now()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dark])

  return <canvas ref={canvasRef} className="absolute inset-0" />
}

export function Background() {
  const { resolved } = useTheme()
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 70% 55% at 50% 0%, black 25%, transparent 100%), linear-gradient(to right, black, transparent 22%, transparent 78%, black)',
          maskComposite: 'add',
          WebkitMaskComposite: 'source-over',
        }}
      />
      <div className="absolute -top-40 -left-32 size-[560px] animate-aurora rounded-full bg-violet-500/25 blur-[120px] dark:bg-violet-600/25" />
      <div
        className="absolute top-1/3 -left-48 size-[680px] animate-aurora rounded-full bg-cyan-400/20 blur-[140px] dark:bg-indigo-500/20"
        style={{ animationDelay: '-9s' }}
      />
      <div
        className="absolute top-1/4 -right-40 size-[560px] animate-aurora rounded-full bg-cyan-400/20 blur-[120px] dark:bg-cyan-500/15"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute -right-48 bottom-0 size-[680px] animate-aurora rounded-full bg-fuchsia-400/20 blur-[140px] dark:bg-fuchsia-600/20"
        style={{ animationDelay: '-14s' }}
      />
      <div
        className="absolute -bottom-48 left-1/3 size-[420px] animate-aurora rounded-full bg-emerald-400/15 blur-[120px] dark:bg-emerald-500/10"
        style={{ animationDelay: '-12s' }}
      />
      <Constellation dark={resolved === 'dark'} />
    </div>
  )
}
