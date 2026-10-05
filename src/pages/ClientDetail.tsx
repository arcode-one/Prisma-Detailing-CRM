import clsx from 'clsx'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { ArrowLeft, Ban, CarFront, ChevronRight, History, Pencil, Phone, Plus, Trash2, Undo2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { ClientEditSheet } from '@/components/ClientEditSheet'
import { useAuth } from '@/hooks/useAuth'
import { ConfirmDialog, Sheet } from '@/components/Sheet'
import { StatusPill } from '@/components/StatusControl'
import { BlacklistBadge, EmptyState, ListSkeleton, PlateBadge, Skeleton } from '@/components/ui'
import { useClientVisits, useClients, useDeleteClient, useSetBlacklist } from '@/lib/queries'
import { formatPhone } from '@/lib/phone'
import { errorMessage, formatDateFull, formatDayShort, formatMoney, hhmm, plural } from '@/lib/format'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const clientsQ = useClients()
  const client = clientsQ.data?.find((c) => c.id === id)
  const visitsQ = useClientVisits(id)
  const del = useDeleteClient()
  const [editing, setEditing] = useState(false)
  const { isAdmin } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const blacklist = useSetBlacklist()
  const [banOpen, setBanOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (clientsQ.isPending) return <ListSkeleton rows={3} />
  if (!client)
    return (
      <EmptyState
        icon={<UserX className="size-7" />}
        title="Клиент не найден"
        text="Возможно, его удалили."
        action={
          <Link to="/clients" className="btn btn-ghost">
            К справочнику
          </Link>
        }
      />
    )

  // Другие машины этого же владельца — по телефону
  const otherCars = client.phone
    ? (clientsQ.data ?? [])
        .filter((c) => c.id !== client.id && c.phone === client.phone)
        .sort((a, b) => (b.last_visit_date ?? '').localeCompare(a.last_visit_date ?? ''))
    : []

  const visits = visitsQ.data ?? []
  const active = visits.filter((v) => v.status !== 'cancelled')
  const total = active.reduce((s, v) => s + (v.price ?? 0), 0)

  const remove = () =>
    del.mutate(client.id, {
      onSuccess: () => {
        toast.success('Клиент удалён')
        navigate('/clients', { replace: true })
      },
      onError: (e) => toast.error('Не удалено', { description: errorMessage(e) }),
    })

  const setBan = (r: string | null) =>
    blacklist.mutate(
      { id: client.id, reason: r },
      {
        onSuccess: () => {
          setBanOpen(false)
          toast.success(r == null ? 'Убран из чёрного списка' : 'Клиент в чёрном списке', {
            description: r == null ? 'Он снова в справочнике' : 'В справочнике его больше не видно',
          })
        },
        onError: (e) => toast.error('Не получилось', { description: errorMessage(e) }),
      },
    )

  return (
    <div className="mx-auto max-w-3xl">
      <button className="btn btn-icon -ml-2 mb-2 text-muted hover:bg-raised hover:text-ink" onClick={() => navigate(-1)} aria-label="Назад">
        <ArrowLeft className="size-6" />
      </button>

      {/* Шапка клиента */}
      <section className={clsx('card relative overflow-hidden p-5', client.blacklisted_at && 'border-danger/50')}>
        {client.blacklisted_at && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-danger">
            <Ban className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold">
                В чёрном списке с {format(parseISO(client.blacklisted_at), 'd MMMM yyyy', { locale: ru })}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink/85">{client.blacklist_reason || 'Причина не указана'}</p>
            </div>
          </div>
        )}
        <div className="relative">
          <PlateBadge plate={client.plate} size="lg" />
          <h1 className="mt-4 font-display text-[26px] font-bold leading-tight">{client.brand || 'Без марки'}</h1>
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="mt-1 inline-flex items-center gap-2 text-[17px] font-bold text-muted hover:bg-raised hover:text-ink">
              <Phone className="size-4" />
              {formatPhone(client.phone)}
            </a>
          ) : (
            <p className="mt-1 text-muted">Телефон не указан</p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Последняя цена" value={formatMoney(client.last_price)} accent />
            <Stat label="Обычная услуга" value={client.usual_service ?? '—'} />
            <Stat label="Визитов" value={String(client.visits_count)} />
            <Stat label="Всего потратил" value={formatMoney(total)} />
          </dl>

          {/* Мастер: «Записать» и «В ЧС». Админ: ещё изменить, убрать из ЧС, удалить */}
          <div className="mt-5 flex gap-2">
            <Link to={`/new?client=${client.id}`} className="btn btn-primary h-13 flex-1">
              <Plus className="size-5" strokeWidth={2.75} /> Записать
            </Link>
            {isAdmin && (
              <button className="btn btn-ghost btn-icon h-13 w-13" onClick={() => setEditing(true)} aria-label="Изменить клиента">
                <Pencil className="size-5" />
              </button>
            )}
            {!client.blacklisted_at ? (
              <button
                className="btn btn-danger btn-icon h-13 w-13"
                onClick={() => {
                  setReason('')
                  setBanOpen(true)
                }}
                aria-label="В чёрный список"
                title="В чёрный список"
              >
                <Ban className="size-5" />
              </button>
            ) : (
              isAdmin && (
                <button
                  className="btn btn-ghost btn-icon h-13 w-13"
                  onClick={() => setBan(null)}
                  disabled={blacklist.isPending}
                  aria-label="Убрать из чёрного списка"
                  title="Убрать из чёрного списка"
                >
                  <Undo2 className="size-5" />
                </button>
              )
            )}
            {isAdmin && (
              <button className="btn btn-danger btn-icon h-13 w-13" onClick={() => setConfirm(true)} aria-label="Удалить клиента">
                <Trash2 className="size-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {otherCars.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 flex items-center gap-2 font-display text-lg font-bold">
            <CarFront className="size-5 text-accent" />
            Другие машины владельца
            <span className="text-sm font-semibold text-muted">· {otherCars.length}</span>
          </h2>
          <ul className="space-y-2">
            {otherCars.map((c) => (
              <li key={c.id}>
                <Link to={`/clients/${c.id}`} className="card card-link flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[17px] font-bold">{c.brand || 'Без марки'}</span>
                      {c.plate && <PlateBadge plate={c.plate} size="sm" />}
                      {c.blacklisted_at && <BlacklistBadge />}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-muted">
                      {c.visits_count} {plural(c.visits_count, 'визит', 'визита', 'визитов')}
                      {c.last_visit_date && ` · был ${formatDayShort(c.last_visit_date)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-dim" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* История визитов: от новых к старым, цена — крупно */}
      <h2 className="mb-3 mt-7 flex items-center gap-2 font-display text-lg font-bold">
        <History className="size-5 text-accent" />
        История визитов
        {visits.length > 0 && <span className="text-sm font-semibold text-muted">· {visits.length}</span>}
      </h2>

      {visitsQ.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <p className="card px-4 py-6 text-center text-muted">Визитов пока нет.</p>
      ) : (
        <ol className="space-y-2">
          {visits.map((v, i) => {
            const cancelled = v.status === 'cancelled'
            const isLast = i === visits.findIndex((x) => x.status !== 'cancelled')
            return (
              <li key={v.id}>
                <Link
                  to={`/visits/${v.id}`}
                  className={clsx(
                    'card card-link flex items-center gap-4 px-4 py-3.5',
                    isLast && 'border-accent/40',
                  )}
                >
                  <div className={clsx('min-w-0 flex-1', cancelled && 'opacity-50')}>
                    <p className="text-[13px] font-bold text-muted">
                      {formatDateFull(v.date)} · {hhmm(v.time)}
                      {isLast && <span className="ml-2 text-accent">последний раз</span>}
                    </p>
                    <p className={clsx('mt-0.5 truncate text-[16px] font-bold', cancelled && 'line-through')}>{v.service}</p>
                    {cancelled && (
                      <div className="mt-1.5">
                        <StatusPill status={v.status} />
                      </div>
                    )}
                  </div>
                  <p className={clsx('shrink-0 font-display text-[24px] font-bold tracking-[-0.02em]', cancelled ? 'text-dim line-through' : 'text-neon')}>
                    {formatMoney(v.price)}
                  </p>
                </Link>
              </li>
            )
          })}
        </ol>
      )}

      <Sheet
        open={banOpen}
        onClose={() => setBanOpen(false)}
        title="В чёрный список"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-ghost" onClick={() => setBanOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-danger" onClick={() => setBan(reason)} disabled={blacklist.isPending}>
              {blacklist.isPending ? 'Сохраняю…' : 'Занести'}
            </button>
          </div>
        }
      >
        <p className="text-muted">
          {client.brand} {client.plate} пропадёт из справочника и будет лежать в чёрном списке. История визитов сохранится. {isAdmin ? 'Вернуть можно в любой момент.' : 'Вернуть обратно может только админ.'}
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-bold text-muted">Причина (необязательно)</span>
          <textarea
            className="field min-h-24 py-3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: не заплатил, хамил, не приехал"
            maxLength={300}
          />
        </label>
      </Sheet>

      <ClientEditSheet open={editing} client={client} onClose={() => setEditing(false)} />
      <ConfirmDialog
        open={confirm}
        title="Удалить клиента?"
        text={`${client.brand} ${client.plate} будет удалён из справочника. ${
          client.visits_count ? `${client.visits_count} ${plural(client.visits_count, 'визит останется', 'визита останутся', 'визитов останутся')} в архиве.` : ''
        }`}
        busy={del.isPending}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-field/70 px-3 py-2.5">
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-dim">{label}</dt>
      <dd className={clsx('mt-0.5 truncate font-display font-bold', accent ? 'text-[20px] text-neon' : 'text-[15px]')}>{value}</dd>
    </div>
  )
}
