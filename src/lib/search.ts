import { queryVariants, searchKey } from './plate'
import { phoneSearchDigits } from './phone'
import type { Client, Visit } from './types'

interface Query {
  variants: string[]
  digits: string
  rawDigits: string
  /** Запрос похож на телефон (только цифры и +()-) — иначе «Е001КХ» находил бы «…001…» в номерах */
  phoneLike: boolean
}

export function parseQuery(q: string): Query {
  return {
    variants: queryVariants(q),
    digits: phoneSearchDigits(q),
    rawDigits: q.replace(/\D/g, ''),
    phoneLike: /^[\d\s()+-]+$/.test(q.trim()),
  }
}

const phoneKey = (p: string | null) => (p ? p.replace(/\D/g, '').slice(1) : '')

function phoneMatches(phone: string, q: Query) {
  if (!phone || !q.phoneLike || q.rawDigits.length < 3) return false
  return phone.includes(q.digits) || phone.includes(q.rawDigits)
}

function textScore(key: string, variants: string[], base: number): number {
  let best = 0
  for (const v of variants) {
    if (key.startsWith(v)) best = Math.max(best, base + 2)
    else if (key.includes(v)) best = Math.max(best, base + 1)
  }
  return best
}

export interface ClientIndexEntry {
  client: Client
  plate: string
  brand: string
  phone: string
  service: string
}

export function buildClientIndex(clients: Client[]): ClientIndexEntry[] {
  return clients.map((c) => ({
    client: c,
    plate: searchKey(c.plate),
    brand: searchKey(c.brand),
    phone: phoneKey(c.phone),
    service: searchKey(c.usual_service ?? ''),
  }))
}

export type ClientField = 'plate' | 'brand' | 'phone' | 'service'
const ALL_FIELDS: ClientField[] = ['plate', 'brand', 'phone', 'service']

/**
 * Частичное совпадение по номеру, марке, телефону (и услуге).
 * Ранжирование: номер с начала > номер внутри > марка > телефон > услуга.
 */
export function searchClients(
  index: ClientIndexEntry[],
  raw: string,
  { limit = Infinity, fields = ALL_FIELDS }: { limit?: number; fields?: ClientField[] } = {},
): Client[] {
  const q = parseQuery(raw)
  if (!q.variants.length) return index.slice(0, limit).map((e) => e.client)
  const on = (f: ClientField) => fields.includes(f)
  const scored: { c: Client; s: number }[] = []
  for (const e of index) {
    const s = Math.max(
      on('plate') ? textScore(e.plate, q.variants, 30) : 0,
      on('brand') ? textScore(e.brand, q.variants, 20) : 0,
      on('phone') && phoneMatches(e.phone, q) ? 15 : 0,
      on('service') ? textScore(e.service, q.variants, 0) : 0,
    )
    if (s > 0) scored.push({ c: e.client, s })
  }
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, limit).map((x) => x.c)
}

export function visitMatches(v: Visit, q: Query): boolean {
  if (!q.variants.length) return true
  const keys = [searchKey(v.plate), searchKey(v.brand), searchKey(v.service), searchKey(v.comment ?? '')]
  return keys.some((k) => q.variants.some((x) => k.includes(x))) || phoneMatches(phoneKey(v.phone), q)
}
