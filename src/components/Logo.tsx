import clsx from 'clsx'
import { useId } from 'react'

/** Маленький силуэт спортивной машины рядом с названием. */
export function CarMark({ className }: { className?: string }) {
  const id = 'car' + useId().replace(/[^\w-]/g, '')
  return (
    <svg viewBox="0 0 48 18" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#5cff8f" />
        </linearGradient>
      </defs>
      {/* кузов */}
      <path
        d="M1.5 13.2V11c0-1.6 1-2.6 2.7-3l7.3-1.4 5.6-3.9c1-.7 2.2-1.1 3.5-1.1h7.6c1.5 0 2.9.6 3.9 1.7l3.5 3.6 6.3 1.3c2 .4 3.1 1.6 3.1 3.3v2H1.5z"
        fill={`url(#${id})`}
      />
      {/* стёкла */}
      <path d="M18.4 6.4l3.4-2.5c.5-.3 1-.5 1.6-.5h3.2v3h-8.2zM28.3 3.4h1.4c1 0 1.9.4 2.6 1.1l1.9 1.9h-5.9v-3z" fill="#0b0f0c" opacity="0.75" />
      {/* колёса */}
      <circle cx="12" cy="13.6" r="3.6" fill="#0b0f0c" stroke="#5cff8f" strokeWidth="1.6" />
      <circle cx="37" cy="13.6" r="3.6" fill="#0b0f0c" stroke="#5cff8f" strokeWidth="1.6" />
      {/* скорость */}
      <path d="M0 5.5h7M2 8h4" stroke="#5cff8f" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

export function Logo({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <div className={clsx('flex flex-col', size === 'lg' ? 'items-center' : 'items-start', className)}>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'font-display font-[850] leading-none tracking-[-0.02em]',
            size === 'lg' ? 'text-4xl' : 'text-[19px]',
          )}
        >
          PRISMA
        </span>
        <CarMark className={size === 'lg' ? 'ml-1 h-5 w-auto' : 'ml-0.5 h-[11px] w-auto'} />
      </div>
      <span
        className={clsx(
          'font-display font-semibold uppercase leading-none text-neon',
          size === 'lg' ? 'mt-2 text-[13px] tracking-[0.5em]' : 'mt-1 text-[8.5px] tracking-[0.42em]',
        )}
      >
        Detailing
      </span>
    </div>
  )
}

/** Метка «демо» рядом с логотипом — чтобы было видно, что данные вымышленные. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center rounded-md border border-warn/40 bg-warn/10 px-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-warn',
        className,
      )}
    >
      демо
    </span>
  )
}
