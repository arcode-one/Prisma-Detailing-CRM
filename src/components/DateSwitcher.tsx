import clsx from 'clsx'
import { useState } from 'react'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Calendar, Popover } from './Pickers'
import { useSwipe } from '@/hooks/useSwipe'
import { shiftOf } from '@/lib/shifts'
import { formatDayLong, formatWeekday, relativeDayLabel, shiftISODate, toISODate, todayISO } from '@/lib/format'

/** Стрелки ← →, тап по дате — системный календарь, ниже — неделя в один тап. */
export function DateSwitcher({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const today = todayISO()
  const rel = relativeDayLabel(value)
  const weekStart = startOfWeek(parseISO(value), { weekStartsOn: 1 })
  const week = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)))
  const shift = shiftOf(value)

  // Свайп по полоске недели (палец, мышь, тачпад): влево — следующая неделя, вправо — прошлая (тот же день недели)
  const [dir, setDir] = useState<1 | -1 | 0>(0)
  const swipe = useSwipe((n) => {
    setDir(n)
    onChange(shiftISODate(value, n * 7))
  })

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-icon size-14 shrink-0 rounded-2xl" onClick={() => onChange(shiftISODate(value, -1))} aria-label="Предыдущий день">
          <ChevronLeft className="size-6" />
        </button>
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          align="center"
          className="min-w-0 flex-1"
          trigger={
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Выбрать дату"
              aria-expanded={open}
              className={clsx(
                'card flex h-14 w-full flex-col items-center justify-center rounded-2xl transition-colors hover:border-accent/40',
                open && 'border-accent/60',
              )}
            >
              <span className={clsx('text-[11px] font-bold uppercase tracking-[0.12em]', value === today ? 'text-neon' : 'text-muted')}>
                {rel ?? formatWeekday(value)}
                <span className="text-dim"> · </span>
                <span className={shift.text}>{shift.name}</span>
              </span>
              <span className="font-display text-[17px] font-bold leading-tight">{formatDayLong(value)}</span>
            </button>
          }
        >
          <Calendar
            value={value}
            onPick={(d) => {
              onChange(d)
              setOpen(false)
            }}
          />
        </Popover>
        <button className="btn btn-ghost btn-icon size-14 shrink-0 rounded-2xl" onClick={() => onChange(shiftISODate(value, 1))} aria-label="Следующий день">
          <ChevronRight className="size-6" />
        </button>
      </div>

      <div
        key={week[0]}
        className="grid touch-pan-y select-none grid-cols-7 gap-1.5"
        style={dir ? { animation: `${dir > 0 ? 'cal-next' : 'cal-prev'} 0.22s var(--ease-out-quart)` } : undefined}
        {...swipe}
        onAnimationEnd={() => setDir(0)}
      >
        {week.map((d) => {
          const active = d === value
          const isToday = d === today
          const worker = shiftOf(d)
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              className={clsx(
                'relative flex h-[60px] flex-col items-center justify-center rounded-xl border text-center transition-all',
                active
                  ? 'border-neon/70 bg-accent/12 text-neon'
                  : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-neon',
              )}
              aria-pressed={active}
              aria-label={`${format(parseISO(d), 'd MMMM', { locale: ru })}, смена: ${worker.name}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide">{format(parseISO(d), 'EEEEEE', { locale: ru })}</span>
              {/* Сегодня — число в зелёном кружке, как в календаре */}
              <span
                className={clsx(
                  'font-display text-[15px] font-bold',
                  isToday && 'my-px grid size-[22px] place-items-center rounded-full bg-neon text-[13px] leading-none text-accent-ink',
                )}
              >
                {format(parseISO(d), 'd')}
              </span>
              <span className={clsx('mt-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wide', worker.text, !active && 'opacity-80')}>{worker.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
