import { format } from 'date-fns'
import { demo } from './demoDb'
import { formatPhone } from './phone'
import { paymentLabel, statusLabel } from './format'

/**
 * Резервная копия базы в Excel: листы «Записи», «Клиенты», «Услуги».
 * Библиотека грузится только при нажатии — в обычную загрузку приложения не попадает.
 */
export async function downloadBackup() {
  const XLSX = await import('xlsx')
  const visits = demo.allVisits()
  const clients = demo.clients().sort((a, b) => a.brand.localeCompare(b.brand) || a.plate.localeCompare(b.plate))
  const services = demo.services()

  const phone = (p: string | null) => (p ? formatPhone(p) : '')

  const visitRows = visits.map((v) => ({
    Дата: v.date.split('-').reverse().join('.'),
    Время: v.time.slice(0, 5),
    Марка: v.brand,
    'Гос номер': v.plate,
    Телефон: phone(v.phone),
    Услуга: v.service,
    Цена: v.price ?? '',
    Статус: statusLabel(v.status),
    Оплата: paymentLabel(v.payment),
    Комментарий: v.comment ?? '',
  }))
  const clientRows = clients.map((c) => ({
    Марка: c.brand,
    'Гос номер': c.plate,
    Телефон: phone(c.phone),
    'Обычная услуга': c.usual_service ?? '',
    'Последняя цена': c.last_price ?? '',
    Визитов: c.visits_count,
    'Последний визит': c.last_visit_date ? c.last_visit_date.split('-').reverse().join('.') : '',
    'Чёрный список': c.blacklisted_at ? c.blacklist_reason || 'да' : '',
  }))
  const serviceRows = services.map((s) => ({ Услуга: s.name, 'Цена по умолчанию': s.default_price ?? '' }))

  const wb = XLSX.utils.book_new()
  const add = (rows: object[], name: string, widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  add(visitRows, 'Записи', [11, 7, 18, 11, 18, 30, 9, 11, 11, 36])
  add(clientRows, 'Клиенты', [20, 11, 18, 30, 14, 9, 15, 30])
  add(serviceRows, 'Услуги', [30, 18])

  XLSX.writeFile(wb, `prisma-demo-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, { compression: true })
  return { visits: visits.length, clients: clients.length }
}
