/** 10 значимых цифр номера (без кода страны) из произвольного ввода. */
export function phoneDigits(raw: string): string {
  const t = raw.trim()
  let d = t.replace(/\D/g, '')
  if (t.startsWith('+7')) d = d.slice(1)
  // «8 916…», «7916…» целиком или первая набранная «8»/«7» — это код страны
  else if ((d.length === 11 || d.length === 1) && (d[0] === '7' || d[0] === '8')) d = d.slice(1)
  return d.slice(0, 10)
}

/**
 * Маска ввода «+7 (916) 123-45-67». Разделители добавляются только перед
 * следующей цифрой, поэтому Backspace не «залипает» на скобке или дефисе.
 */
export function formatPhoneInput(raw: string): string {
  const d = phoneDigits(raw)
  if (!d) return /^[+78]$/.test(raw.trim()) ? '+7 (' : ''
  let out = '+7 (' + d.slice(0, 3)
  if (d.length > 3) out += ') ' + d.slice(3, 6)
  if (d.length > 6) out += '-' + d.slice(6, 8)
  if (d.length > 8) out += '-' + d.slice(8, 10)
  return out
}

/** Формат хранения: +7XXXXXXXXXX или null, если номер не введён. */
export function toStoredPhone(raw: string): string | null {
  const d = phoneDigits(raw)
  return d.length === 10 ? '+7' + d : null
}

export function isPhoneValid(raw: string): boolean {
  const d = phoneDigits(raw)
  return d.length === 0 || d.length === 10
}

/** Красивое отображение сохранённого номера. */
export function formatPhone(stored: string | null | undefined): string {
  return stored ? formatPhoneInput(stored) : ''
}

/** Цифры для поиска: «8916…» и «+7916…» дают одно и то же. */
export function phoneSearchDigits(q: string): string {
  const d = q.replace(/\D/g, '')
  if (d.length >= 2 && (d[0] === '8' || d[0] === '7')) return d.slice(1)
  return d
}
