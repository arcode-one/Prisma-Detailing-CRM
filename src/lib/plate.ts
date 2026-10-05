/** Латинские буквы, внешне совпадающие с кириллическими на русских номерах. */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н',
  O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х',
}

const foldLookalikes = (s: string) => s.replace(/[ABEKMHOPCTYX]/g, (ch) => LATIN_TO_CYRILLIC[ch])

/**
 * Гос номер в каноническом виде: верхний регистр, без пробелов и дефисов,
 * латинские двойники → кириллица. Совпадает с public.normalize_plate в БД.
 */
export function normalizePlate(raw: string): string {
  return foldLookalikes(raw.toUpperCase().replace(/[\s-]+/g, ''))
}

const RU_PLATE = /^([АВЕКМНОРСТУХ])(\d{3})([АВЕКМНОРСТУХ]{2})(\d{2,3})$/

/** Разбивка стандартного номера на части для отображения «А 123 ВС | 77». */
export function splitPlate(plate: string): { main: string; region: string } | null {
  const m = RU_PLATE.exec(plate)
  if (!m) return null
  return { main: `${m[1]} ${m[2]} ${m[3]}`, region: m[4] }
}

// ---------------------------------------------------------------------------
// Поиск без учёта регистра и раскладки
// ---------------------------------------------------------------------------

const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`"
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё'
const EN_TO_RU = new Map([...EN].map((c, i) => [c, RU[i]]))
const RU_TO_EN = new Map([...RU].map((c, i) => [c, EN[i]]))

const swapLayout = (s: string, map: Map<string, string>) =>
  [...s.toLowerCase()].map((c) => map.get(c) ?? c).join('')

/** Ключ для сравнения: верхний регистр, без пробелов/дефисов, двойники → кириллица, Ё → Е. */
export function searchKey(s: string): string {
  return foldLookalikes(s.toUpperCase().replace(/[\s-]+/g, '')).replace(/Ё/g, 'Е')
}

/**
 * Варианты поискового запроса: как набран + «набран не в той раскладке»
 * (например, «ащкв» → «ford», «ифьц» → «bmw»).
 */
export function queryVariants(q: string): string[] {
  const trimmed = q.trim()
  if (!trimmed) return []
  const variants = new Set([
    searchKey(trimmed),
    searchKey(swapLayout(trimmed, EN_TO_RU)),
    searchKey(swapLayout(trimmed, RU_TO_EN)),
  ])
  return [...variants].filter(Boolean)
}
