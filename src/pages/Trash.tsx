import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Trash2, X } from 'lucide-react'
import { VisitCard } from '@/components/VisitCard'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/Sheet'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { useClearTrash, useTrash } from '@/lib/queries'
import { parseQuery, visitMatches } from '@/lib/search'
import { errorMessage, plural } from '@/lib/format'

/** Корзина: отменённые записи. Лежат, чтобы было видно; админ может очистить корзину. */
export default function Trash() {
  const q = useTrash()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  const filtered = useMemo(() => {
    const pq = parseQuery(deferred)
    return (q.data ?? []).filter((v) => visitMatches(v, pq))
  }, [q.data, deferred])

  const count = q.data?.length ?? 0
  const { isAdmin } = useAuth()
  const clear = useClearTrash()
  const [confirm, setConfirm] = useState(false)

  const clearAll = () =>
    clear.mutate(undefined, {
      onSuccess: () => {
        setConfirm(false)
        toast.success('Корзина очищена')
      },
      onError: (e) => toast.error('Не получилось', { description: errorMessage(e) }),
    })

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold md:text-2xl">Корзина</h1>
        {count > 0 && (
          <div className="flex items-baseline gap-3">
            <p className="text-[13px] font-semibold text-muted">
              {count} {plural(count, 'отменённая', 'отменённые', 'отменённых')}
            </p>
            {isAdmin && (
              <button
                className="rounded-lg px-2 py-1 text-[13px] font-bold text-danger transition-colors hover:bg-danger/10"
                onClick={() => setConfirm(true)}
              >
                Очистить корзину
              </button>
            )}
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field h-13 pl-12 pr-12"
            placeholder="Марка, номер, телефон, услуга"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Поиск по корзине"
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
        <EmptyState icon={<Trash2 className="size-7" />} title="Корзина пуста" text="Сюда попадают отменённые записи." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Ничего не найдено" text="Попробуйте изменить запрос." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((v) => (
            <VisitCard key={v.id} visit={v} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Очистить корзину?"
        text={`${count} ${plural(count, 'отменённая запись удалится', 'отменённые записи удалятся', 'отменённых записей удалятся')} насовсем. Вернуть их будет нельзя.`}
        confirmLabel="Очистить"
        busyLabel="Очищаю…"
        busy={clear.isPending}
        onConfirm={clearAll}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}
