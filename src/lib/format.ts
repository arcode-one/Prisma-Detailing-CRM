import { addDays, format, isValid, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import type { VisitStatus, Payment } from './types'

export const ISO_DATE = 'yyyy-MM-dd'

export const toISODate = (d: Date) => format(d, ISO_DATE)
export const todayISO = () => toISODate(new Date())
export const shiftISODate = (iso: string, days: number) => toISODate(addDays(parseISO(iso), days))

export function isISODate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s))
}

/** «Сегодня», «Завтра», «Вчера» или «пн, 6 окт». */
export function relativeDayLabel(iso: string): string | null {
  const today = todayISO()
  if (iso === today) return 'Сегодня'
  if (iso === shiftISODate(today, 1)) return 'Завтра'
  if (iso === shiftISODate(today, -1)) return 'Вчера'
  return null
}

export const formatDayLong = (iso: string) => format(parseISO(iso), 'd MMMM, EEEEEE', { locale: ru })
export const formatDayShort = (iso: string) => format(parseISO(iso), 'd MMM', { locale: ru }).replace('.', '')
export const formatDateFull = (iso: string) => format(parseISO(iso), 'd MMMM yyyy', { locale: ru })
export const formatWeekday = (iso: string) => format(parseISO(iso), 'EEEE', { locale: ru })

/** «10:30:00» → «10:30» */
export const hhmm = (t: string) => t.slice(0, 5)

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
export const monthName = (m: number) => MONTHS[m]

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
export const formatMoney = (n: number | null | undefined) => (n == null ? '—' : `${rub.format(n)} ₽`)
export const formatNumber = (n: number) => rub.format(n)

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
export const carsLabel = (n: number) => `${n} ${plural(n, 'машина', 'машины', 'машин')}`

export const STATUSES: { value: VisitStatus; label: string; short: string }[] = [
  { value: 'booked', label: 'Записан', short: 'Записан' },
  { value: 'arrived', label: 'Приехал', short: 'Приехал' },
  { value: 'washing', label: 'В работе', short: 'В работе' },
  { value: 'paid', label: 'Оплачен', short: 'Оплачен' },
  { value: 'cancelled', label: 'Отменён', short: 'Отмена' },
]

export const statusLabel = (s: VisitStatus) => STATUSES.find((x) => x.value === s)?.label ?? s

export const PAYMENTS: { value: Payment; label: string; short: string }[] = [
  { value: 'cash', label: 'Наличные', short: 'нал' },
  { value: 'card', label: 'Карта', short: 'карта' },
  { value: 'transfer', label: 'Перевод', short: 'перевод' },
]
export const paymentLabel = (p: Payment | null | undefined) => PAYMENTS.find((x) => x.value === p)?.label ?? ''

/** Итог по способам оплаты: { cash: 4500, card: 2200, transfer: 0, none: 1800 } */
export function paymentTotals(visits: { price: number | null; payment?: Payment | null }[]) {
  const t = { cash: 0, card: 0, transfer: 0, none: 0 }
  for (const v of visits) t[v.payment ?? 'none'] += v.price ?? 0
  return t
}

/** Максимальная длина названия услуги */
export const SERVICE_MAX = 70

/** Часы работы детейлинг-центра: первая запись и последняя запись (в минутах от полуночи) */
export const WORK_START = 9 * 60
export const WORK_END = 19 * 60
export const SLOT_STEP = 30

export const minutesToHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Время по умолчанию для новой записи: ближайший слот в рабочих часах. */
export function suggestTime(dateISO: string): string {
  if (dateISO !== todayISO()) return minutesToHHMM(WORK_START)
  const now = new Date()
  const next = Math.ceil((now.getHours() * 60 + now.getMinutes()) / SLOT_STEP) * SLOT_STEP
  return minutesToHHMM(Math.min(Math.max(next, WORK_START), WORK_END))
}

/** Текст ошибки сервера/сети для тоста. */
export function errorMessage(e: unknown): string {
  if (!navigator.onLine) return 'Нет связи с интернетом'
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Нет связи с сервером'
  if (/duplicate key|unique/i.test(msg)) return 'Такая запись уже существует'
  if (/JWT|not authenticated|permission denied/i.test(msg)) return 'Сессия истекла — войдите заново'
  return msg
}

/** Марка с большой буквы: «toyota camry» → «Toyota Camry». Остальные буквы не трогаем (BMW остаётся BMW). */
export const capitalizeWords = (s: string) => s.replace(/(^|[\s-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())

/** Услуга с большой буквы: «комплекс, химка» → «Комплекс, химка» (только первая буква) */
export const capitalizeFirst = (s: string) => s.replace(/^(\s*)(\p{Ll})/u, (_, sp: string, ch: string) => sp + ch.toUpperCase())

/**
 * Для onChange: меняет текст прямо в поле (большая буква и т.п.), не сбивая курсор при правке в середине.
 * По умолчанию — каждое слово с большой буквы (марка).
 */
export function capitalizeInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  fix: (s: string) => string = capitalizeWords,
): string {
  const next = fix(el.value)
  if (next !== el.value) {
    const pos = el.selectionStart
    el.value = next
    if (pos != null) el.setSelectionRange(Math.min(pos, next.length), Math.min(pos, next.length))
  }
  return next
}
