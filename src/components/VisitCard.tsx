import clsx from 'clsx'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { History } from 'lucide-react'
import { toast } from 'sonner'
import type { Visit } from '@/lib/types'
import { errorMessage, formatDayShort, formatMoney, hhmm, paymentLabel } from '@/lib/format'
import { useCancelVisit, useClients, type PrevVisit } from '@/lib/queries'
import { BlacklistBadge, PhoneLink, PlateBadge } from './ui'
import { ConfirmDialog } from './Sheet'

/**
 * Карточка записи, сверху вниз:
 *  10:00                                   2 200 ₽
 *  Марка: Bmw [909] [новый]
 *  Телефон: +7 (922) 244-33-44
 *  Вид услуги: 2ф комплекс
 *  Был: 18 авг · 2 200 ₽                   [Отменить запись]
 * Тап по «Был» (прошлый визит) открывает тот день, по карточке — саму запись.
 *
 * Отменённая запись (корзина) не открывается: рядом со временем — дата,
 * вместо кнопки — когда отменили.
 */
export function VisitCard({ visit, prev, onOpenDay }: { visit: Visit; prev?: PrevVisit; onOpenDay?: (date: string) => void }) {
  const navigate = useNavigate()
  const cancel = useCancelVisit()
  const [confirm, setConfirm] = useState(false)
  const cancelled = visit.status === 'cancelled'
  const blacklisted = useClients().data?.find((c) => c.id === visit.client_id)?.blacklisted_at

  return (
    <>
      <article
        onClick={cancelled ? undefined : () => navigate(`/visits/${visit.id}`)}
        className={clsx(
          'card relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 overflow-hidden p-4',
          !cancelled && 'card-link cursor-pointer',
        )}
      >
        {/* Сетка в 2 колонки: справа колонка цены — способ оплаты и «Отменить» стоят по её центру.
            Время — в цветной плашке, чтобы взгляд цеплялся за него первым */}
        <p className="flex items-center gap-2">
          <span
            className={clsx(
              'rounded-xl border px-2.5 py-1.5 font-display text-[24px] font-bold leading-none tracking-[-0.02em]',
              cancelled ? 'border-danger/30 bg-danger/10 text-danger/90' : 'border-accent/35 bg-accent/12 text-neon',
            )}
          >
            {hhmm(visit.time)}
          </span>
          {cancelled && <span className="text-[13px] font-bold text-muted">{formatDayShort(visit.date)}</span>}
        </p>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <p
            className={clsx(
              'font-display text-[17px] font-bold leading-none',
              visit.price == null ? 'text-dim' : cancelled ? 'text-muted' : 'text-neon',
            )}
          >
            {formatMoney(visit.price)}
          </p>
          {visit.payment && <span className="text-[12px] font-bold leading-none text-muted">{paymentLabel(visit.payment)}</span>}
        </div>

        {/* Машина, телефон, услуга: подписи одной колонкой (тише), значения — ровной колонкой (жирно, один размер).
            Сверху тонкая линия — отделяет шапку «время + цена» от описания машины. */}
        <dl className="col-span-2 mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[15px] leading-snug">
          <dt className="text-[13px] font-medium text-ink/75">Марка:</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="font-bold text-ink">{visit.brand || 'Без марки'}</span>
            <PlateBadge plate={visit.plate} />
            {blacklisted && <BlacklistBadge />}
            {!visit.client_id && !cancelled && (
              <span
                className="rounded-md border border-accent/40 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-neon"
                title="Новый клиент — попадёт в справочник после окончания дня"
              >
                новый
              </span>
            )}
          </dd>
          <dt className="text-[13px] font-medium text-ink/75">Телефон:</dt>
          <dd className="min-w-0">
            {visit.phone ? (
              <PhoneLink phone={visit.phone} bright className="font-bold" />
            ) : (
              <span className="text-[13px] font-semibold text-dim">звонить некуда</span>
            )}
          </dd>
          <dt className="self-start pt-px text-[13px] font-medium text-ink/75">Вид услуги:</dt>
          <dd className="line-clamp-2 min-w-0 break-words font-bold text-ink">{visit.service}</dd>
        </dl>

        {/* Прошлый визит слева, «Отменить» — под ценой */}
        {prev && onOpenDay ? (
          <button
            type="button"
            className="group -mx-1 inline-flex justify-self-start min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[13px] font-semibold text-muted transition-colors hover:text-neon active:text-neon"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDay(prev.date)
            }}
            title={`Прошлый визит: ${prev.service} — открыть этот день`}
          >
            <History className="size-3.5 shrink-0" />
            <span className="truncate">
              Был:{' '}
              <span className="text-ink/90 underline decoration-line-strong underline-offset-2 transition-colors group-hover:text-neon group-hover:decoration-neon/50 group-active:text-neon">
                {formatDayShort(prev.date)}
                {prev.date.slice(0, 4) !== visit.date.slice(0, 4) && ` ${prev.date.slice(0, 4)}`}
              </span>
              {prev.price != null && <> · {formatMoney(prev.price)}</>}
            </span>
          </button>
        ) : (
          <span />
        )}
        {cancelled ? (
          <span className="justify-self-center inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg border border-danger/40 px-3 text-[12px] font-bold text-danger">
            Отменена{' '}
            {format(parseISO(visit.updated_at), 'd MMM, HH:mm', {
              locale: ru,
            }).replace('.', '')}
          </span>
        ) : (
          <button
            type="button"
            className="justify-self-center inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-[12px] font-semibold text-dim transition-colors hover:bg-danger/10 hover:text-danger active:text-danger"
            onClick={(e) => {
              e.stopPropagation()
              setConfirm(true)
            }}
          >
            Отменить
          </button>
        )}
      </article>

      {/* Диалог вне карточки: клики в нём не должны открывать запись */}
      {!cancelled && (
        <ConfirmDialog
          open={confirm}
          title="Отменить запись?"
          text={`${hhmm(visit.time)} · ${visit.brand || 'Без марки'} ${visit.plate}. Запись перейдёт в корзину.`}
          confirmLabel="Да, отменить"
          cancelLabel="Нет"
          busyLabel="Отменяю…"
          busy={cancel.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            cancel.mutate(visit, {
              onSuccess: () => {
                setConfirm(false)
                toast.success('Запись отменена', {
                  description: 'Она лежит в корзине',
                })
              },
              onError: (e) =>
                toast.error('Не получилось отменить', {
                  description: errorMessage(e),
                }),
            })
          }
        />
      )}
    </>
  )
}
