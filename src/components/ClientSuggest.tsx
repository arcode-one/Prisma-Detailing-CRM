import clsx from 'clsx'
import type { Client } from '@/lib/types'
import { formatMoney } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { BlacklistBadge, PlateBadge } from './ui'

/** Выпадающий список клиентов под полем ввода. */
export function ClientSuggest({
  items,
  highlight,
  onPick,
  onHover,
}: {
  items: Client[]
  highlight: number
  onPick: (c: Client) => void
  onHover: (i: number) => void
}) {
  if (!items.length) return null
  return (
    <ul
      role="listbox"
      // mousedown не должен уводить фокус из поля, иначе список закроется до клика
      onMouseDown={(e) => e.preventDefault()}
      className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-line-strong bg-raised shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(92,255,143,0.08)] [animation:fade-in_.12s_ease-out]"
    >
      <li className="px-4 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-dim">Клиенты из справочника</li>
      {items.map((c, i) => (
        <li key={c.id} role="option" aria-selected={i === highlight}>
          <button
            type="button"
            onClick={() => onPick(c)}
            onMouseEnter={() => onHover(i)}
            className={clsx(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
              i === highlight ? 'bg-accent/10' : 'hover:bg-accent/10 active:bg-accent/10',
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <PlateBadge plate={c.plate} size="sm" />
                <span className="truncate font-bold">{c.brand || 'Без марки'}</span>
                {c.blacklisted_at && <BlacklistBadge />}
              </div>
              <p className="mt-1 truncate text-[13px] text-muted">
                {[formatPhone(c.phone), c.usual_service].filter(Boolean).join(' · ') || 'нет данных'}
              </p>
            </div>
            {c.last_price != null && <span className="shrink-0 font-display text-[15px] font-bold text-neon">{formatMoney(c.last_price)}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
