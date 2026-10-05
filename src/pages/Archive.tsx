import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { addMonths, format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { Archive as ArchiveIcon, ChevronDown, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useOnline } from '@/hooks/useOnline'
import { downloadBackup } from '@/lib/export'
import { PaymentBreakdown } from '@/components/PaymentBreakdown'
import { Sheet } from '@/components/Sheet'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty, PhoneLink, PlateBadge } from '@/components/ui'
import { useArchiveMonth } from '@/lib/queries'
import { parseQuery, visitMatches } from '@/lib/search'
import { MONTHS_SHORT, carsLabel, errorMessage, formatMoney, hhmm, monthName, plural, todayISO } from '@/lib/format'
import type { Visit } from '@/lib/types'

const ymOf = (iso: string) => iso.slice(0, 7)
const shiftYm = (ym: string, n: number) => format(addMonths(parseISO(`${ym}-01`), n), 'yyyy-MM')

/** По умолчанию — текущий месяц, а 1-го числа (прошедших дней ещё нет) — прошлый. */
function defaultYm() {
  const t = todayISO()
  return t.endsWith('-01') ? shiftYm(ymOf(t), -1) : ymOf(t)
}

export default function Archive() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('m')
  const currentYm = ymOf(todayISO())
  const ym = raw && /^\d{4}-\d{2}$/.test(raw) && raw <= currentYm ? raw : defaultYm()
  const [query, setQuery] = useState('')
  const [service, setService] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const deferred = useDeferredValue(query)
  const { isAdmin } = useAuth()
  const online = useOnline()
  const [exporting, setExporting] = useState(false)

  const exportAll = async () => {
    setExporting(true)
    try {
      const r = await downloadBackup()
      toast.success('База скачана', {
        description: `${r.visits} ${plural(r.visits, 'запись', 'записи', 'записей')}, ${r.clients} ${plural(r.clients, 'клиент', 'клиента', 'клиентов')}`,
      })
    } catch (e) {
      toast.error('Не получилось скачать', { description: errorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  const setYm = (next: string) => {
    setParams(next === defaultYm() ? {} : { m: next }, { replace: true })
    setService(null)
  }

  const q = useArchiveMonth(ym)

  const services = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of q.data ?? []) counts.set(v.service, (counts.get(v.service) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  }, [q.data])

  const filtered = useMemo(() => {
    const pq = parseQuery(deferred)
    return (q.data ?? []).filter((v) => (!service || v.service === service) && visitMatches(v, pq))
  }, [q.data, deferred, service])

  const totals = useMemo(() => {
    // Отменённые сюда не приходят — они в корзине
    return { cars: filtered.length, sum: filtered.reduce((s, v) => s + (v.price ?? 0), 0) }
  }, [filtered])

  const days = useMemo(() => {
    const map = new Map<string, Visit[]>()
    for (const v of filtered) map.set(v.date, [...(map.get(v.date) ?? []), v])
    return [...map.entries()]
  }, [filtered])

  const [y, m] = ym.split('-').map(Number)
  const filterActive = !!(query || service)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold md:text-2xl">Архив</h1>
        {isAdmin && (
          <button className="btn btn-ghost h-11 px-4 text-sm" onClick={exportAll} disabled={exporting || !online} title="Вся база в Excel: записи, клиенты, услуги">
            <Download className="size-4" />
            {exporting ? 'Собираю…' : 'Скачать базу'}
          </button>
        )}
      </div>

      {/* Переключатель месяца */}
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-icon size-14 shrink-0 rounded-2xl" onClick={() => setYm(shiftYm(ym, -1))} aria-label="Предыдущий месяц">
          <ChevronLeft className="size-6" />
        </button>
        <button className="card flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-display text-[17px] font-bold transition-colors hover:border-accent/40 hover:text-neon" onClick={() => setPicker(true)}>
          {monthName(m - 1)} {y}
          <ChevronDown className="size-4 text-muted" />
        </button>
        <button
          className="btn btn-ghost btn-icon size-14 shrink-0 rounded-2xl"
          onClick={() => setYm(shiftYm(ym, 1))}
          disabled={ym >= currentYm}
          aria-label="Следующий месяц"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      {/* Итог за месяц */}
      <div className="card relative mt-3 overflow-hidden p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">
          Итог за {monthName(m - 1).toLowerCase()}
          {filterActive && ' · с фильтром'}
        </p>
        <div className="relative mt-1.5 flex items-end justify-between gap-3">
          <p className="font-display text-[22px] font-bold">{q.data ? carsLabel(totals.cars) : '…'}</p>
          <p className="font-display text-[26px] font-bold leading-none text-neon">
            {q.data ? formatMoney(totals.sum) : '…'}
          </p>
        </div>
        {filtered && <PaymentBreakdown visits={filtered} className="mt-2" />}
      </div>

      {/* Поиск и фильтр */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className="field h-13 pl-12 pr-12"
          placeholder="Марка, номер, телефон, услуга"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Поиск по архиву"
        />
        {query && (
          <button className="btn btn-icon absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" onClick={() => setQuery('')} aria-label="Очистить">
            <X className="size-5" />
          </button>
        )}
      </div>
      {services.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <button className="chip shrink-0" aria-pressed={!service} onClick={() => setService(null)}>
            Все услуги
          </button>
          {services.map((s) => (
            <button key={s} className="chip shrink-0" aria-pressed={service === s} onClick={() => setService(service === s ? null : s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        {q.isPending ? (
          q.fetchStatus === 'paused' ? <OfflineEmpty /> : <ListSkeleton rows={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : days.length === 0 ? (
          filterActive ? (
            <EmptyState icon={<Search className="size-7" />} title="Ничего не найдено" text="Попробуйте изменить запрос или фильтр." />
          ) : (
            <EmptyState icon={<ArchiveIcon className="size-7" />} title="Архив пуст" text="За этот месяц прошедших записей нет." />
          )
        ) : (
          <>
            {/* ПК: заголовки колонок — как в справочнике */}
            <div className={`hidden ${COLS} border border-transparent px-4 pb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim md:grid`}>
              <span className="text-left">Время</span>
              <span>Марка</span>
              <span>Гос номер</span>
              <span>Телефон</span>
              <span>Услуга</span>
              <span>Цена</span>
            </div>
            <div className="space-y-6">
              {days.map(([date, list]) => (
                <DayGroup key={date} date={date} visits={list} />
              ))}
            </div>
          </>
        )}
      </div>

      <MonthPicker open={picker} value={ym} max={currentYm} onClose={() => setPicker(false)} onPick={(v) => (setYm(v), setPicker(false))} />
    </div>
  )
}

/** Одна сетка на заголовки и строки: время и марка слева, остальное по центру. */
const COLS = 'md:grid-cols-[56px_1.1fr_130px_190px_1.5fr_110px] md:gap-4'

function DayGroup({ date, visits }: { date: string; visits: Visit[] }) {
  const navigate = useNavigate()
  const sum = visits.reduce((s, v) => s + (v.price ?? 0), 0)
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-[15px] font-bold first-letter:uppercase">{format(parseISO(date), 'EEEEEE, d MMMM', { locale: ru })}</h2>
        <p className="text-[13px] font-semibold text-muted">
          {carsLabel(visits.length)} · <span className="text-accent">{formatMoney(sum)}</span>
        </p>
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {visits.map((v) => (
          <div
            key={v.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/visits/${v.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/visits/${v.id}`)}
            className={`grid cursor-pointer grid-cols-[48px_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-accent/[0.06] ${COLS}`}
          >
            <span className="row-span-2 self-start pt-0.5 font-display text-[15px] font-bold md:row-span-1 md:self-center md:pt-0">{hhmm(v.time)}</span>
            <div className="flex min-w-0 items-center gap-2 md:contents">
              <span className="truncate font-bold md:text-center">{v.brand || '—'}</span>
              <PlateBadge plate={v.plate} className="md:justify-self-center" />
            </div>
            <span className="row-span-2 self-start text-right font-display text-[16px] font-bold text-neon md:order-last md:row-span-1 md:self-center md:text-center">
              {formatMoney(v.price)}
            </span>
            <p className="col-start-2 min-w-0 truncate text-[13px] text-muted md:col-auto md:text-center md:text-sm">
              <span className="md:hidden">{v.service}</span>
              <span className="md:hidden">{v.phone && ' · '}</span>
              <PhoneLink phone={v.phone} />
              {!v.phone && <span className="hidden text-dim md:inline">—</span>}
            </p>
            <span className="hidden min-w-0 truncate text-center text-sm md:block">{v.service}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function MonthPicker({ open, value, max, onClose, onPick }: { open: boolean; value: string; max: string; onClose: () => void; onPick: (ym: string) => void }) {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))
  const maxYear = Number(max.slice(0, 4))
  return (
    <Sheet open={open} onClose={onClose} title="Выберите месяц">
      <div className="mb-4 flex items-center justify-between">
        <button className="btn btn-ghost btn-icon" onClick={() => setYear((y) => y - 1)} aria-label="Предыдущий год">
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-xl font-bold">{year}</span>
        <button className="btn btn-ghost btn-icon" onClick={() => setYear((y) => y + 1)} disabled={year >= maxYear} aria-label="Следующий год">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 pb-3 sm:grid-cols-4">
        {MONTHS_SHORT.map((label, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, '0')}`
          return (
            <button key={ym} className="chip h-14 justify-center text-[15px] capitalize" aria-pressed={ym === value} disabled={ym > max} onClick={() => onPick(ym)}>
              {label}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
