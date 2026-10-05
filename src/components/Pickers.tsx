import clsx from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { addDays, addMonths, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useSwipe } from '@/hooks/useSwipe'
import { WORKERS, shiftOf } from '@/lib/shifts'
import { WORK_END, WORK_START, monthName, relativeDayLabel, shiftISODate, toISODate, todayISO } from '@/lib/format'

// ---------------------------------------------------------------------------
// Всплывающая панель под кнопкой: закрывается кликом мимо и Esc
// ---------------------------------------------------------------------------

export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'start',
  className,
}: {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div ref={ref} className={clsx('relative', className)}>
      {trigger}
      {open && (
        <div
          className={clsx(
            'absolute top-[calc(100%+8px)] z-40 rounded-2xl border border-line-strong bg-raised p-3 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(92,255,143,0.08)] [animation:fade-in_.14s_ease-out]',
            align === 'start' && 'left-0',
            align === 'end' && 'right-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Календарь
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function Calendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value)))
  // Направление последнего листания — для анимации сдвига сетки
  const [dir, setDir] = useState<1 | -1 | 0>(0)
  const go = (n: 1 | -1) => {
    setDir(n)
    setMonth((m) => addMonths(m, n))
  }
  // Свайп / перетаскивание мышью / тачпад влево-вправо листает месяцы
  const swipe = useSwipe(go)
  const today = todayISO()
  const gridStart = startOfWeek(month, { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="w-[300px] max-w-[calc(100vw-48px)] touch-pan-y select-none overflow-hidden" {...swipe}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn btn-icon size-10 min-h-10 min-w-10 rounded-xl text-muted hover:bg-surface hover:text-neon" onClick={() => go(-1)} aria-label="Предыдущий месяц">
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-[15px] font-bold">
          {monthName(month.getMonth())} {month.getFullYear()}
        </span>
        <button type="button" className="btn btn-icon size-10 min-h-10 min-w-10 rounded-xl text-muted hover:bg-surface hover:text-neon" onClick={() => go(1)} aria-label="Следующий месяц">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div
        key={month.getTime()}
        className="grid grid-cols-7 gap-1 text-center"
        style={dir ? { animation: `${dir > 0 ? 'cal-next' : 'cal-prev'} 0.22s var(--ease-out-quart)` } : undefined}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={clsx('pb-1 text-[11px] font-bold uppercase', i >= 5 ? 'text-accent/70' : 'text-dim')}>
            {d}
          </span>
        ))}
        {days.map((d) => {
          const iso = toISODate(d)
          const selected = iso === value
          const isToday = iso === today
          const outside = !isSameMonth(d, month)
          const worker = shiftOf(iso)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              aria-pressed={selected}
              aria-label={`${format(d, 'd MMMM yyyy', { locale: ru })}, смена: ${worker.name}`}
              className={clsx(
                'flex h-10 flex-col items-center justify-center gap-1 rounded-xl font-display text-[14px] font-bold transition-colors',
                selected
                  ? 'bg-accent/15 text-neon ring-1 ring-inset ring-neon'
                  : outside
                    ? 'text-dim/60 hover:bg-surface hover:text-muted'
                    : 'text-ink hover:bg-accent/15 hover:text-neon',
              )}
            >
              {/* Сегодня — число в залитом кружке; выбранный день — рамка, чтобы полоска смены была видна */}
              <span className={clsx('leading-none', isToday && 'grid size-[24px] place-items-center rounded-full bg-neon text-accent-ink')}>{format(d, 'd')}</span>
              <span className={clsx('h-[3px] w-3.5 shrink-0 rounded-full', worker.dot, outside && !selected && 'opacity-35')} />
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 text-[12px] font-bold">
        {WORKERS.map((w) => (
          <span key={w.name} className="flex items-center gap-1.5 text-muted">
            <span className={clsx('h-[3px] w-3.5 rounded-full', w.dot)} />
            {w.name}
          </span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <button type="button" className="chip h-10 justify-center" onClick={() => onPick(today)}>
          Сегодня
        </button>
        <button type="button" className="chip h-10 justify-center" onClick={() => onPick(shiftISODate(today, 1))}>
          Завтра
        </button>
      </div>
    </div>
  )
}

/** Поле даты: кнопка в стиле поля ввода + наш календарь. */
export function DateField({
  value,
  onChange,
  invalid,
  buttonRef,
  className,
}: {
  value: string
  onChange: (iso: string) => void
  invalid?: boolean
  buttonRef?: (el: HTMLElement | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rel = relativeDayLabel(value)
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className={className}
      trigger={
        <button
          ref={buttonRef}
          type="button"
          className={clsx('field flex items-center justify-between gap-2 text-left', open && 'border-accent')}
          aria-invalid={invalid}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="truncate">
            {format(parseISO(value), value.slice(0, 4) === todayISO().slice(0, 4) ? 'd MMMM' : 'd MMMM yyyy', { locale: ru })}
            <span className="ml-2 hidden font-semibold text-muted sm:inline">{rel ?? format(parseISO(value), 'EEEEEE', { locale: ru })}</span>
          </span>
          <CalendarDays className="size-5 shrink-0 text-accent" />
        </button>
      }
    >
      <Calendar
        value={value}
        onPick={(iso) => {
          onChange(iso)
          setOpen(false)
        }}
      />
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Время: часы рабочего дня + минуты с шагом 5
// ---------------------------------------------------------------------------

const HOURS = Array.from({ length: Math.floor(WORK_END / 60) - Math.floor(WORK_START / 60) + 1 }, (_, i) => Math.floor(WORK_START / 60) + i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const pad = (n: number) => String(n).padStart(2, '0')

function inWorkHours(h: number, m: number) {
  const t = h * 60 + m
  return t >= WORK_START && t <= WORK_END
}

export function TimePicker({ value, onPick }: { value: string; onPick: (t: string, done: boolean) => void }) {
  const [h, m] = value.split(':').map(Number)
  const hoursRef = useRef<HTMLDivElement>(null)
  const minsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    for (const box of [hoursRef.current, minsRef.current]) {
      const el = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2
    }
  }, [])

  const cell = (active: boolean, disabled: boolean) =>
    clsx(
      'h-10 w-full rounded-xl font-display text-[15px] font-bold transition-colors',
      active
        ? 'bg-gradient-to-b from-neon to-accent text-accent-ink'
        : disabled
          ? 'text-dim/50'
          : 'text-ink hover:bg-accent/15 hover:text-neon',
    )

  return (
    <div className="w-[220px] select-none">
      <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-dim">
        <span>Часы</span>
        <span>Минуты</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div ref={hoursRef} className="no-scrollbar relative max-h-[260px] space-y-1 overflow-y-auto">
          {HOURS.map((hh) => {
            // При смене часа минуты подрезаются, чтобы не выйти за 18:00
            const mm = inWorkHours(hh, m) ? m : 0
            return (
              <button key={hh} type="button" aria-pressed={hh === h} className={cell(hh === h, false)} onClick={() => onPick(`${pad(hh)}:${pad(mm)}`, false)}>
                {pad(hh)}
              </button>
            )
          })}
        </div>
        <div ref={minsRef} className="no-scrollbar relative max-h-[260px] space-y-1 overflow-y-auto">
          {MINUTES.map((mm) => {
            const disabled = !inWorkHours(h, mm)
            return (
              <button
                key={mm}
                type="button"
                aria-pressed={mm === m}
                disabled={disabled}
                className={cell(mm === m, disabled)}
                onClick={() => onPick(`${pad(h)}:${pad(mm)}`, true)}
              >
                {pad(mm)}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold text-dim">
        Запись с {pad(WORK_START / 60)}:00 до {pad(Math.floor(WORK_END / 60))}:{pad(WORK_END % 60)}
      </p>
    </div>
  )
}

/** Поле времени: кнопка в стиле поля ввода + наш выбор часов и минут. */
export function TimeField({
  value,
  onChange,
  invalid,
  buttonRef,
  className,
}: {
  value: string
  onChange: (t: string) => void
  invalid?: boolean
  buttonRef?: (el: HTMLElement | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      className={className}
      trigger={
        <button
          ref={buttonRef}
          type="button"
          className={clsx('field flex items-center justify-between gap-2 px-4', open && 'border-accent')}
          aria-invalid={invalid}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Время"
          onClick={() => setOpen((o) => !o)}
        >
          {value || '--:--'}
          <Clock className="size-5 shrink-0 text-accent" />
        </button>
      }
    >
      <TimePicker
        value={value || '10:00'}
        onPick={(t, done) => {
          onChange(t)
          if (done) setOpen(false)
        }}
      />
    </Popover>
  )
}
