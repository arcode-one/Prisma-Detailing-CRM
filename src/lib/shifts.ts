import { differenceInCalendarDays, parseISO } from 'date-fns'

/** График 2/2: два дня работает один, два дня — другой. Имена и цвета меняются здесь. */
export const WORKERS = [
  { name: 'Артём', dot: 'bg-shift-a', text: 'text-shift-a' },
  { name: 'Илья', dot: 'bg-shift-b', text: 'text-shift-b' },
] as const

export type Worker = (typeof WORKERS)[number]

/** Первый день какой-нибудь смены Артёма — от него считается весь график */
const ANCHOR = parseISO('2026-10-03')

export function shiftOf(iso: string): Worker {
  const n = differenceInCalendarDays(parseISO(iso), ANCHOR)
  const block = Math.floor(n / 2)
  return WORKERS[((block % 2) + 2) % 2]
}
