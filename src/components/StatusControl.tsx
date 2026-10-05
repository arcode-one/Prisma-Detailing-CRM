import type { CSSProperties } from 'react'
import { STATUSES } from '@/lib/format'
import type { VisitStatus } from '@/lib/types'

export const statusVar = (s: VisitStatus) => ({ '--st': `var(--color-st-${s})` }) as CSSProperties

export function StatusPill({ status }: { status: VisitStatus }) {
  const label = STATUSES.find((s) => s.value === status)?.label
  return (
    <span
      style={statusVar(status)}
      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--st)_14%,transparent)] px-2.5 text-[11px] font-bold text-[var(--st)]"
    >
      <span className="size-1.5 rounded-full bg-[var(--st)]" />
      {label}
    </span>
  )
}
