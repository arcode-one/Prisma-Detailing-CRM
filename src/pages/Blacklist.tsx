import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { Ban, Search, X } from 'lucide-react'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty, PhoneLink, PlateBadge } from '@/components/ui'
import { useClients } from '@/lib/queries'
import { buildClientIndex, searchClients } from '@/lib/search'
import { formatDayShort, formatMoney, plural } from '@/lib/format'

/** Чёрный список: клиенты, которых больше не берём. Карточка целиком, с причиной. */
export default function Blacklist() {
  const q = useClients()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  const list = useMemo(
    () => (q.data ?? []).filter((c) => c.blacklisted_at).sort((a, b) => b.blacklisted_at!.localeCompare(a.blacklisted_at!)),
    [q.data],
  )
  const index = useMemo(() => buildClientIndex(list), [list])
  const filtered = useMemo(() => (deferred.trim() ? searchClients(index, deferred) : list), [index, list, deferred])
  const count = list.length

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold md:text-2xl">Чёрный список</h1>
        {count > 0 && (
          <p className="text-[13px] font-semibold text-muted">
            {count} {plural(count, 'клиент', 'клиента', 'клиентов')}
          </p>
        )}
      </div>

      {count > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field h-13 pl-12 pr-12"
            placeholder="Номер, марка или телефон"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Поиск по чёрному списку"
          />
          {query && (
            <button className="btn btn-icon absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" onClick={() => setQuery('')} aria-label="Очистить">
              <X className="size-5" />
            </button>
          )}
        </div>
      )}

      {q.isPending ? (
        q.fetchStatus === 'paused' ? <OfflineEmpty /> : <ListSkeleton />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : count === 0 ? (
        <EmptyState
          icon={<Ban className="size-7" />}
          title="Список пуст"
          text="Занести клиента сюда можно из его карточки в справочнике — кнопка «В чёрный список»."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Ничего не найдено" text="Попробуйте изменить запрос." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id}>
              {/* div, а не ссылка: внутри есть ссылка на телефон */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/clients/${c.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/clients/${c.id}`)}
                className="card card-link relative cursor-pointer flex flex-col gap-2.5 overflow-hidden p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="text-[17px] font-extrabold leading-tight">{c.brand || 'Без марки'}</span>
                    <PlateBadge plate={c.plate} />
                    <PhoneLink phone={c.phone} className="text-[14px] font-semibold" />
                  </div>
                  <p className="shrink-0 font-display text-[16px] font-bold text-muted">{formatMoney(c.last_price)}</p>
                </div>
                <p className="text-[15px] font-semibold leading-snug text-ink/90">
                  <span className="mr-1.5 text-[13px] text-muted">Причина:</span>
                  {c.blacklist_reason || <span className="text-dim">не указана</span>}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-2 py-1 text-danger">
                    <Ban className="size-3.5" />В списке с {format(parseISO(c.blacklisted_at!), 'd MMM yyyy', { locale: ru }).replace('.', '')}
                  </span>
                  <span>
                    {c.visits_count} {plural(c.visits_count, 'визит', 'визита', 'визитов')}
                    {c.last_visit_date && ` · последний ${formatDayShort(c.last_visit_date)}`}
                  </span>
                  {c.usual_service && <span>· {c.usual_service}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
