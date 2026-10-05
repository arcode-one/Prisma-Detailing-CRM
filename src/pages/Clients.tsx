import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Search, UserPlus, Users, X } from 'lucide-react'
import { ClientEditSheet } from '@/components/ClientEditSheet'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty, PhoneLink, PlateBadge } from '@/components/ui'
import { useClients } from '@/lib/queries'
import { buildClientIndex, searchClients, type ClientField } from '@/lib/search'
import { formatDayShort, formatMoney, plural } from '@/lib/format'
import type { Client } from '@/lib/types'

const PAGE = 60

/** По алфавиту: сначала латиница A→Z, потом кириллица; одинаковые марки — по номеру */
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
// \u041c\u0430\u0440\u043a\u0438 \u0441 \u0431\u0443\u043a\u0432\u044b \u2014 \u043f\u0435\u0440\u0432\u044b\u043c\u0438, \u0441 \u0446\u0438\u0444\u0440\u044b (2114, 2115) \u2014 \u043f\u043e\u0441\u043b\u0435 \u043d\u0438\u0445, \u0431\u0435\u0437 \u043c\u0430\u0440\u043a\u0438 \u2014 \u0432 \u0441\u0430\u043c\u043e\u043c \u043a\u043e\u043d\u0446\u0435
const brandGroup = (b: string) => (!b ? 2 : /^\p{L}/u.test(b) ? 0 : 1)
const byBrand = (a: Client, b: Client) => {
  const x = a.brand.trim()
  const y = b.brand.trim()
  return brandGroup(x) - brandGroup(y) || collator.compare(x, y) || collator.compare(a.plate, b.plate)
}

/** Где искать: везде или только в одном поле */
const MODES = [
  { id: 'all', label: 'Везде', placeholder: 'Номер, марка или телефон', fields: ['plate', 'brand', 'phone', 'service'] },
  { id: 'brand', label: 'Марка', placeholder: 'Например: Camry', fields: ['brand'] },
  { id: 'plate', label: 'Гос номер', placeholder: 'Например: 505 или А505ВС', fields: ['plate'] },
  { id: 'phone', label: 'Телефон', placeholder: 'Цифры телефона', fields: ['phone'] },
] as const satisfies readonly { id: string; label: string; placeholder: string; fields: readonly ClientField[] }[]
type Mode = (typeof MODES)[number]['id']

export default function Clients() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const mode = MODES.find((m) => m.id === params.get('by')) ?? MODES[0]
  const deferred = useDeferredValue(query)
  const [limit, setLimit] = useState(PAGE)
  const [adding, setAdding] = useState(false)
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const q = useClients()
  // Чёрный список в справочнике не показываем — у него свой раздел. Порядок — по алфавиту марки, затем по номеру
  const list = useMemo(() => q.data?.filter((c) => !c.blacklisted_at).sort(byBrand), [q.data])
  const index = useMemo(() => buildClientIndex(list ?? []), [list])
  const found = useMemo(() => searchClients(index, deferred, { fields: [...mode.fields] }), [index, deferred, mode])
  // Один владелец (телефон) — одна строка; остальные его машины видны внутри карточки.
  // Показываем первую найденную машину — при поиске «Tiguan» это будет Tiguan.
  const carsByPhone = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of list ?? []) if (c.phone) m.set(c.phone, (m.get(c.phone) ?? 0) + 1)
    return m
  }, [list])
  const results = useMemo(() => {
    // Без поиска у владельца показываем машину, на которой он был последним
    if (!deferred.trim()) {
      const latest = new Map<string, Client>()
      for (const c of found) {
        if (!c.phone) continue
        const cur = latest.get(c.phone)
        if (!cur || (c.last_visit_date ?? '') > (cur.last_visit_date ?? '')) latest.set(c.phone, c)
      }
      return found.filter((c) => !c.phone || latest.get(c.phone) === c)
    }
    const seen = new Set<string>()
    return found.filter((c) => {
      if (!c.phone) return true
      if (seen.has(c.phone)) return false
      seen.add(c.phone)
      return true
    })
  }, [found, deferred])
  const owners = useMemo(() => {
    if (!list) return 0
    return list.filter((c) => !c.phone).length + carsByPhone.size
  }, [list, carsByPhone])

  const setSearch = (q: string, by: Mode) => {
    const next: Record<string, string> = {}
    if (q) next.q = q
    if (by !== 'all') next.by = by
    setParams(next, { replace: true })
    setLimit(PAGE)
  }
  const setQuery = (v: string) => setSearch(v, mode.id)

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold md:text-2xl">Справочник</h1>
          {list && (
            <p className="text-sm font-semibold text-muted">
              {owners} {plural(owners, 'клиент', 'клиента', 'клиентов')} · {list.length} {plural(list.length, 'машина', 'машины', 'машин')}
            </p>
          )}
        </div>
        {isAdmin && (
          <button className="btn btn-ghost h-11 px-4 text-sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Добавить
          </button>
        )}
      </div>

      <div className="sticky top-[var(--mobile-header)] z-10 -mx-4 mb-3 border-b border-line bg-bg px-4 pb-3 pt-2 md:static md:mb-0 md:border-0 md:mx-0 md:bg-transparent md:px-0 md:pt-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field h-14 pl-12 pr-12"
            placeholder={mode.placeholder}
            inputMode={mode.id === 'phone' ? 'tel' : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Поиск клиента"
          />
          {query && (
            <button className="btn btn-icon absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" onClick={() => setQuery('')} aria-label="Очистить поиск">
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto" role="group" aria-label="Где искать">
          {MODES.map((m) => (
            <button key={m.id} className="chip h-9 shrink-0 text-[13px]" aria-pressed={m.id === mode.id} onClick={() => setSearch(query, m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {q.isPending ? (
        q.fetchStatus === 'paused' ? <OfflineEmpty /> : <ListSkeleton rows={6} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : results.length === 0 ? (
        query ? (
          <EmptyState icon={<Search className="size-7" />} title="Никого не нашли" text={`По запросу «${query}» клиентов нет. Проверьте номер или марку.`} />
        ) : (
          <EmptyState
            icon={<Users className="size-7" />}
            title="Справочник пуст"
            text="Клиенты появятся здесь автоматически после первой записи."
          />
        )
      ) : (
        <>
          {/* ПК: заголовки таблицы */}
          <div className={`hidden ${COLS} border border-transparent px-4 pb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim md:grid`}>
            <span className="text-left">Марка</span>
            <span>Гос номер</span>
            <span>Телефон</span>
            <span>Обычная услуга</span>
            <span>Цена</span>
          </div>
          <ul className="space-y-2">
            {results.slice(0, limit).map((c) => (
              <ClientRow key={c.id} client={c} more={c.phone ? (carsByPhone.get(c.phone) ?? 1) - 1 : 0} onOpen={() => navigate(`/clients/${c.id}`)} />
            ))}
          </ul>
          {results.length > limit && (
            <button className="btn btn-ghost mt-4 w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Показать ещё ({results.length - limit})
            </button>
          )}
        </>
      )}

      <ClientEditSheet open={adding} onClose={() => setAdding(false)} onSaved={(c) => navigate(`/clients/${c.id}`)} />
    </div>
  )
}

/** Одна сетка на заголовки и строки — колонки совпадают. Всё, кроме марки, по центру. */
const COLS = 'md:grid-cols-[1.1fr_130px_190px_1.5fr_110px] md:gap-4'

function ClientRow({ client: c, more, onOpen }: { client: Client; more: number; onOpen: () => void }) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        className={`card card-link grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3.5 ${COLS} md:py-3`}
      >
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 md:contents">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[16px] font-extrabold md:text-[15px]">{c.brand || <span className="text-dim">—</span>}</span>
            {more > 0 && (
              <span className="hidden shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[12px] font-bold text-neon md:inline">
                +{more}
              </span>
            )}
          </span>
          <PlateBadge plate={c.plate} className="md:justify-self-center" />
          {more > 0 && (
            <span className="shrink-0 rounded-full border border-accent/35 bg-accent/10 px-2 py-0.5 text-[12px] font-bold text-neon md:hidden">
              +{more} {plural(more, 'машина', 'машины', 'машин')}
            </span>
          )}
        </div>
        <span className="col-start-1 row-start-2 min-w-0 truncate text-[13px] font-semibold text-muted md:col-auto md:row-auto md:text-center md:text-sm">
          <PhoneLink phone={c.phone} />
          {!c.phone && <span className="hidden text-dim md:inline">—</span>}
        </span>
        <span className="col-span-2 row-start-3 min-w-0 truncate text-[14px] text-ink/85 md:col-span-1 md:row-auto md:text-center">
          {c.usual_service ?? <span className="text-dim">—</span>}
          {c.last_visit_date && <span className="ml-2 text-xs text-dim md:hidden">· был {formatDayShort(c.last_visit_date)}</span>}
        </span>
        <span className="col-start-2 row-span-2 row-start-1 text-right font-display text-[17px] font-bold text-neon md:col-auto md:row-auto md:text-center md:text-[15px]">
          {formatMoney(c.last_price)}
        </span>
      </div>
    </li>
  )
}
