import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Loader2, LogOut, Plus, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog, Sheet } from '@/components/Sheet'
import { EmptyState, ErrorState, ListSkeleton, OfflineEmpty } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { SignOutButton } from '@/components/SignOutButton'
import { DemoNotice } from '@/components/DemoNotice'
import { useDeleteService, useMoveService, useSaveService, useServices } from '@/lib/queries'
import { SERVICE_MAX, errorMessage, formatMoney, formatNumber, capitalizeInput, capitalizeFirst } from '@/lib/format'
import type { Service } from '@/lib/types'

export default function Services() {
  const q = useServices()
  const move = useMoveService()
  const del = useDeleteService()
  const { session } = useAuth()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)
  const list = q.data ?? []

  const onMove = (index: number, dir: -1 | 1) =>
    move.mutate({ list, index, dir }, { onError: (e) => toast.error('Порядок не сохранён', { description: errorMessage(e) }) })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold md:text-2xl">Услуги</h1>
          <p className="text-sm font-semibold text-muted">Кнопки быстрого выбора в новой записи</p>
        </div>
        <button className="btn btn-primary h-11 px-4 text-sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" strokeWidth={2.75} /> Добавить
        </button>
      </div>

      {q.isPending ? (
        q.fetchStatus === 'paused' ? <OfflineEmpty /> : <ListSkeleton rows={6} />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Settings2 className="size-7" />} title="Услуг нет" text="Добавьте услуги, чтобы выбирать их в записи одним тапом." />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {list.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1 py-1.5 pl-4 pr-1.5 transition-colors hover:bg-accent/[0.05]">
              <button className="min-w-0 flex-1 py-2 text-left transition-colors hover:text-neon" onClick={() => setEditing(s)}>
                <p className="text-[16px] font-bold leading-snug">{s.name}</p>
                <p className="text-[13px] font-semibold text-muted">
                  {s.default_price != null ? <span className="text-accent">{formatMoney(s.default_price)}</span> : 'цена не задана'}
                </p>
              </button>
              <button className="btn btn-icon text-muted hover:bg-raised hover:text-neon" onClick={() => onMove(i, -1)} disabled={i === 0 || move.isPending} aria-label="Выше">
                <ArrowUp className="size-[18px]" />
              </button>
              <button className="btn btn-icon text-muted hover:bg-raised hover:text-neon" onClick={() => onMove(i, 1)} disabled={i === list.length - 1 || move.isPending} aria-label="Ниже">
                <ArrowDown className="size-[18px]" />
              </button>
              <button className="btn btn-icon text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setDeleting(s)} aria-label="Удалить">
                <Trash2 className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Аккаунт — на телефоне выход живёт здесь */}
      <section className="card mt-8 flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">Аккаунт</p>
          <p className="truncate font-semibold">{session?.user.email}</p>
          <p className="text-[13px] font-semibold text-muted">{session?.user.title}</p>
        </div>
        <SignOutButton className="btn btn-ghost shrink-0">
          <LogOut className="size-4" /> Выйти
        </SignOutButton>
      </section>

      <DemoNotice className="mt-3" />

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Новая услуга' : 'Изменить услугу'}>
        {editing !== null && (
          <ServiceForm service={editing === 'new' ? null : editing} nextOrder={(list.at(-1)?.sort_order ?? 0) + 10} onDone={() => setEditing(null)} />
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Удалить услугу?"
        text={`«${deleting?.name}» исчезнет из быстрых кнопок. Старые записи с этой услугой не изменятся.`}
        busy={del.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Услуга удалена')
              setDeleting(null)
            },
            onError: (e) => toast.error('Не удалено', { description: errorMessage(e) }),
          })
        }
      />
    </div>
  )
}

function ServiceForm({ service, nextOrder, onDone }: { service: Service | null; nextOrder: number; onDone: () => void }) {
  const [name, setName] = useState(service?.name ?? '')
  const [price, setPrice] = useState(service?.default_price != null ? String(service.default_price) : '')
  const [error, setError] = useState<string | null>(null)
  const save = useSaveService()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Введите название')
      return
    }
    save.mutate(
      { id: service?.id, name, default_price: price ? Number(price) : null, sort_order: service ? undefined : nextOrder },
      {
        onSuccess: () => {
          toast.success(service ? 'Услуга обновлена' : 'Услуга добавлена')
          onDone()
        },
        onError: (err) => toast.error('Не сохранено', { description: errorMessage(err) }),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-2">
      <div>
        <label className="label" htmlFor="s-name">
          Название
        </label>
        <input
          id="s-name"
          className="field"
          maxLength={SERVICE_MAX}
          value={name}
          onChange={(e) => (setName(capitalizeInput(e.target, capitalizeFirst)), setError(null))}
          placeholder="Например: Бк ковры, с/з"
          autoComplete="off"
          aria-invalid={!!error}
          autoFocus
        />
        {error && <p className="mt-1.5 text-[13px] font-semibold text-danger">{error}</p>}
      </div>
      <div>
        <label className="label" htmlFor="s-price">
          Цена по умолчанию, ₽ <span className="font-medium text-dim">— необязательно</span>
        </label>
        <input
          id="s-price"
          className="field font-display text-neon"
          inputMode="numeric"
          value={price ? formatNumber(Number(price)) : ''}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="Подставится, если у клиента нет истории"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-5 animate-spin" /> : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
