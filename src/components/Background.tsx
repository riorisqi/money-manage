export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      <div className="absolute -top-40 -left-32 size-[520px] animate-aurora rounded-full bg-violet-500/25 blur-[120px] dark:bg-violet-600/25" />
      <div
        className="absolute top-1/4 -right-40 size-[480px] animate-aurora rounded-full bg-cyan-400/20 blur-[120px] dark:bg-cyan-500/15"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute -bottom-48 left-1/3 size-[420px] animate-aurora rounded-full bg-emerald-400/15 blur-[120px] dark:bg-emerald-500/10"
        style={{ animationDelay: '-12s' }}
      />
    </div>
  )
}
