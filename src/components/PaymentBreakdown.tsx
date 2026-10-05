import clsx from 'clsx'
import { formatMoney, paymentTotals } from '@/lib/format'
import type { Payment } from '@/lib/types'

/**
 * Разбивка суммы по способам оплаты: «Нал 4 500 ₽ · Карта 2 200 ₽ · Перевод 1 000 ₽».
 * Показываются только способы с деньгами; «Не указано» — если есть записи без способа.
 * Ничего не рисует, пока ни у одной записи способ не указан.
 */
export function PaymentBreakdown({
  visits,
  className,
}: {
  visits: { price: number | null; payment?: Payment | null }[]
  className?: string
}) {
  const t = paymentTotals(visits)
  if (!t.cash && !t.card && !t.transfer) return null
  const parts = [
    { label: 'Нал', sum: t.cash },
    { label: 'Карта', sum: t.card },
    { label: 'Перевод', sum: t.transfer },
    { label: 'Не указано', sum: t.none },
  ].filter((p) => p.sum > 0)

  return (
    <p className={clsx('flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-muted', className)}>
      {parts.map((p) => (
        <span key={p.label}>
          {p.label} <span className="font-bold text-ink">{formatMoney(p.sum)}</span>
        </span>
      ))}
    </p>
  )
}
