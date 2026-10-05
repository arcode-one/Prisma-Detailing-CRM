import clsx from 'clsx'
import { useLayoutEffect, useRef } from 'react'
import { SLOT_STEP, WORK_END, WORK_START, minutesToHHMM } from '@/lib/format'

// 10:00 … 18:00 — рабочие часы, см. WORK_START / WORK_END
const SLOTS = Array.from({ length: (WORK_END - WORK_START) / SLOT_STEP + 1 }, (_, i) => minutesToHHMM(WORK_START + i * SLOT_STEP))

/** Лента получасовых слотов: занятые видны сразу, выбор в один тап. */
export function TimeSlots({ value, busy, onChange }: { value: string; busy: Map<string, number>; onChange: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = ref.current
    const el = box?.querySelector<HTMLElement>('[data-active="true"]')
    if (box && el) box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2
  }, [value])

  return (
    <div ref={ref} className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {SLOTS.map((t) => {
        const n = busy.get(t) ?? 0
        const active = t === value
        return (
          <button
            key={t}
            type="button"
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(t)}
            className={clsx(
              'chip relative h-11 shrink-0 justify-center px-3.5 font-display text-[13px] font-bold',
              n > 0 && !active && 'border-warn/40 text-warn/90',
            )}
            title={n > 0 ? `Занято: ${n}` : 'Свободно'}
          >
            {t}
            {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-warn text-[10px] font-extrabold text-black">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
