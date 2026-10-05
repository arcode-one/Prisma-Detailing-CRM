import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarPlus, Plus } from 'lucide-react'
import { DateSwitcher } from '@/components/DateSwitcher'
import { PaymentBreakdown } from '@/components/PaymentBreakdown'
import { VisitCard } from '@/components/VisitCard'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty } from '@/components/ui'
import { useDayVisits, usePrevVisits } from '@/lib/queries'
import { formatMoney, isISODate, plural, todayISO } from '@/lib/format'

export default function Visits() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('date')
  const date = isISODate(raw) ? raw : todayISO()
  const setDate = (d: string) => setParams(d === todayISO() ? {} : { date: d }, { replace: true })

  const q = useDayVisits(date)
  const visits = q.data
  const prev = usePrevVisits(date, visits).data
  // Переход в день прошлого визита — с историей, чтобы «назад» вернул сюда
  const openDay = (d: string) => {
    setParams(d === todayISO() ? {} : { date: d })
    window.scrollTo({ top: 0 })
  }

  const summary = useMemo(() => {
    const list = visits ?? []
    return { count: list.length, total: list.reduce((s, v) => s + (v.price ?? 0), 0) }
  }, [visits])

  const newHref = `/new${date !== todayISO() ? `?date=${date}` : ''}`

  return (
    <div>
      <div className="mb-5 hidden items-center justify-between md:flex">
        <h1 className="font-display text-2xl font-bold">Записи</h1>
        <Link to={newHref} className="btn btn-primary h-12 px-5">
          <Plus className="size-5" strokeWidth={2.75} /> Новая запись
        </Link>
      </div>

      <div className="sticky top-[var(--mobile-header)] z-10 -mx-4 -mt-4 mb-3 border-b border-line bg-bg px-4 pb-3 pt-2 md:static md:mb-0 md:border-0 md:mx-0 md:bg-transparent md:mt-0 md:px-0 md:pt-0">
        <DateSwitcher value={date} onChange={setDate} />
      </div>

      {visits && visits.length > 0 && (
        <div className="mb-3 rounded-2xl border border-line bg-surface/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[15px] font-bold">
              {summary.count} {plural(summary.count, 'машина', 'машины', 'машин')}
            </p>
            <p className="font-display text-[17px] font-bold text-neon">{formatMoney(summary.total)}</p>
          </div>
          <PaymentBreakdown visits={visits} className="mt-1.5" />
        </div>
      )}

      {q.isPending ? (
        q.fetchStatus === 'paused' ? <OfflineEmpty /> : <ListSkeleton />
      ) : q.isError && !visits ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : visits && visits.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visits.map((v) => (
            <VisitCard key={v.id} visit={v} prev={prev?.[v.id]} onOpenDay={openDay} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarPlus className="size-7" />}
          title="Записей нет"
          text="На этот день пока никто не записан."
          action={
            <Link to={newHref} className="btn btn-primary h-13 px-6">
              <Plus className="size-5" strokeWidth={2.75} /> Записать машину
            </Link>
          }
        />
      )}
    </div>
  )
}
