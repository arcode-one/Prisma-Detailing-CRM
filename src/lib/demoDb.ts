/**
 * Демо-бэкенд Prisma: вместо Supabase все данные живут в localStorage браузера.
 * Логика повторяет серверную (save_visit, find_client, promote_new_clients, set_blacklist,
 * триггер пересчёта клиента), поэтому интерфейс работает так же, как в боевой версии.
 *
 * Данные вымышленные и генерируются относительно сегодняшней даты. Пока демо не трогали,
 * каждый новый день оно пересоздаётся, чтобы «сегодня» всегда было заполнено.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { normalizePlate } from './plate'
import { todayISO } from './format'
import type { Client, ClientInput, Payment, Service, Visit, VisitInput, VisitStatus } from './types'

const KEY = 'prisma-demo-db'
const VERSION = 6

export type Table = 'visits' | 'clients' | 'services'
export type Role = 'admin' | 'staff'

interface DB {
  version: number
  /** День, относительно которого сгенерированы данные */
  seededOn: string
  /** Пользователь что-то менял — тогда демо не пересоздаём */
  touched: boolean
  services: Service[]
  clients: Client[]
  visits: Visit[]
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Детерминированный генератор — демо выглядит одинаково при каждом пересоздании. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Небольшая задержка «сети», чтобы были видны скелетоны и состояния загрузки. */
export const latency = () => sleep(120 + Math.random() * 180)

const nowISO = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// Генерация демо-данных
// ---------------------------------------------------------------------------

const SERVICES: [string, number][] = [
  ['Комплексная мойка', 1800],
  ['Двухфазная мойка кузова', 1200],
  ['Химчистка салона', 9500],
  ['Химчистка кожи + пропитка', 6500],
  ['Полировка кузова', 16000],
  ['Керамическое покрытие', 28000],
  ['Нанесение воска', 2500],
  ['Полировка фар', 3200],
  ['Мойка двигателя', 3500],
  ['Чистка дисков и шин', 900],
  ['Озонирование салона', 2000],
  ['Антидождь', 1500],
  ['Плёнка PPF на зоны риска', 48000],
]

const CARS = [
  'BMW X5', 'BMW 5', 'BMW X3', 'Mercedes-Benz GLE', 'Mercedes-Benz E', 'Mercedes-Benz S', 'Porsche Cayenne',
  'Porsche Macan', 'Audi Q7', 'Audi A6', 'Lexus RX', 'Lexus LX', 'Toyota Land Cruiser', 'Toyota Camry',
  'Toyota RAV4', 'Range Rover', 'Range Rover Sport', 'Tesla Model 3', 'Tesla Model Y', 'Volkswagen Tiguan',
  'Volkswagen Touareg', 'Skoda Kodiaq', 'Kia K5', 'Kia Sportage', 'Hyundai Palisade', 'Hyundai Santa Fe',
  'Geely Monjaro', 'Chery Tiggo 8 Pro', 'Haval Jolion', 'Haval F7', 'Zeekr 001', 'Li Auto L7', 'Mazda CX-5',
  'Volvo XC90', 'Genesis G80', 'Infiniti QX60', 'Exeed RX', 'Tank 500', 'Mini Cooper', 'Land Rover Defender',
]
const PREMIUM = /BMW|Mercedes|Porsche|Audi|Lexus|Range|Land Rover|Volvo|Genesis|Zeekr|Li Auto|Tank|Land Cruiser/

const PLATE_LETTERS = 'АВЕКМНОРСТУХ'
const REGIONS = ['77', '97', '99', '177', '197', '199', '777', '797', '50', '750', '190']

const COMMENTS = [
  'Скол на капоте — показать клиенту',
  'Оплата переводом',
  'Ждёт в зоне отдыха',
  'Детское кресло — не снимать',
  'Не трогать багажник',
  'Просил позвонить за час до готовности',
  'Сильное загрязнение салона, шерсть собаки',
  'После химчистки — озонирование в подарок',
  'Клиент привезёт свой воск',
  'Царапина на двери водителя была до мойки',
  'Забрать в 19:00, ключи на ресепшене',
]

/** Причина и услуга последнего визита перед занесением в ЧС */
const BLACKLIST: [string, string | null][] = [
  ['Трижды не приехал на запись', null],
  ['Отказался платить после полировки', 'Полировка кузова'],
  ['Грубил мастерам', null],
]

const payFor = (r: number): Payment | null => (r < 0.47 ? 'card' : r < 0.72 ? 'transfer' : r < 0.95 ? 'cash' : null)

const SLOTS = Array.from({ length: 21 }, (_, i) => 9 * 60 + i * 30) // 9:00 … 19:00
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`

function generate(today: string): DB {
  const rnd = mulberry32(20260401)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const d0 = parseISO(today)
  const iso = (offset: number) => format(addDays(d0, offset), 'yyyy-MM-dd')

  const services: Service[] = SERVICES.map(([name, price], i) => ({
    id: uuid(),
    name,
    default_price: price,
    sort_order: (i + 1) * 10,
    created_at: new Date(d0.getTime() - 300 * 864e5).toISOString(),
  }))

  const plates = new Set<string>()
  const plate = () => {
    for (;;) {
      const p = `${pick([...PLATE_LETTERS])}${String(int(1, 999)).padStart(3, '0')}${pick([...PLATE_LETTERS])}${pick([...PLATE_LETTERS])}${pick(REGIONS)}`
      if (!plates.has(p)) {
        plates.add(p)
        return p
      }
    }
  }
  const phone = () => `+79${int(10, 99)}${String(int(0, 9999999)).padStart(7, '0')}`

  // Клиенты: у каждого любимая услуга и «частота» визитов
  interface Seed { client: Client; weight: number; favorite: number }
  const seeds: Seed[] = []
  for (let i = 0; i < 64; i++) {
    const brand = pick(CARS)
    seeds.push({
      client: {
        id: uuid(),
        plate: rnd() < 0.05 ? String(int(100, 999)) : plate(),
        brand,
        phone: rnd() < 0.9 ? phone() : null,
        usual_service: null,
        last_price: null,
        last_visit_date: null,
        visits_count: 0,
        created_at: nowISO(),
        blacklisted_at: null,
        blacklist_reason: null,
      },
      weight: rnd() < 0.25 ? 6 : rnd() < 0.5 ? 2.5 : 1,
      favorite: rnd() < 0.6 ? int(0, 1) : int(0, SERVICES.length - 1),
    })
  }
  // Несколько владельцев с двумя машинами (один телефон)
  for (let i = 0; i < 5; i++) {
    const owner = seeds[i * 7]
    if (!owner.client.phone) owner.client.phone = phone()
    seeds.push({
      client: { ...owner.client, id: uuid(), brand: pick(CARS), plate: plate() },
      weight: 1.5,
      favorite: int(0, 3),
    })
  }
  const totalWeight = seeds.reduce((s, x) => s + x.weight, 0)
  const pickAny = () => {
    let r = rnd() * totalWeight
    for (const s of seeds) if ((r -= s.weight) <= 0) return s
    return seeds[seeds.length - 1]
  }
  /** Клиент по «частоте», без повторов в пределах одного дня */
  const pickSeed = (used: Set<Seed>) => {
    let s = pickAny()
    for (let i = 0; i < 20 && used.has(s); i++) s = pickAny()
    used.add(s)
    return s
  }

  const priceFor = (svc: number, brand: string) => {
    const base = SERVICES[svc][1] * (PREMIUM.test(brand) ? 1.2 : 1)
    const step = base >= 10000 ? 500 : 100
    return Math.round((base * (0.92 + rnd() * 0.16)) / step) * step
  }
  const serviceFor = (s: Seed) => (rnd() < 0.55 ? s.favorite : int(0, SERVICES.length - 1))

  const visits: Visit[] = []
  const addVisit = (date: string, minutes: number, s: Seed | null, status: VisitStatus, extra?: Partial<Visit>) => {
    const svc = s ? serviceFor(s) : int(0, 6)
    const brand = s?.client.brand ?? pick(CARS)
    const created = new Date(parseISO(date).getTime() - int(1, 4) * 864e5 + minutes * 6e4).toISOString()
    visits.push({
      id: uuid(),
      client_id: s?.client.id ?? null,
      date,
      time: hm(minutes),
      brand,
      plate: s?.client.plate ?? plate(),
      phone: s?.client.phone ?? null,
      service: SERVICES[svc][0],
      price: priceFor(svc, brand),
      status,
      comment: rnd() < 0.14 ? pick(COMMENTS) : null,
      // Оплаченные — чаще картой, реже наличными и переводом; у части способ не отмечен
      payment: status === 'paid' ? payFor(rnd()) : null,
      created_at: created,
      updated_at: created,
      ...extra,
    })
  }
  const dayTimes = (n: number) => {
    const set = new Set<number>()
    while (set.size < n) set.add(pick(SLOTS))
    return [...set].sort((a, b) => a - b)
  }

  // Прошлое: ~8 месяцев истории
  for (let off = -240; off < 0; off++) {
    const dow = addDays(d0, off).getDay()
    const n = dow === 0 || dow === 6 ? int(5, 9) : int(3, 7)
    const used = new Set<Seed>()
    for (const t of dayTimes(n)) {
      const cancelled = off > -21 && rnd() < 0.07
      const s = pickSeed(used)
      addVisit(iso(off), t, s, cancelled ? 'cancelled' : 'paid', cancelled ? { updated_at: new Date(addDays(d0, off).getTime() - 864e5 + int(9 * 60, 21 * 60) * 6e4).toISOString() } : {})
    }
  }
  // У каждого клиента хотя бы один визит
  for (const s of seeds) {
    if (!visits.some((v) => v.client_id === s.client.id)) addVisit(iso(-int(5, 200)), pick(SLOTS), s, 'paid')
  }

  // Сегодня: часть уже оплачена, одна машина в работе, одна приехала, остальные записаны
  const todayTimes = dayTimes(7)
  const usedToday = new Set<Seed>()
  todayTimes.forEach((t, i) => {
    const status: VisitStatus = i < 2 ? 'paid' : i === 2 ? 'washing' : i === 3 ? 'arrived' : 'booked'
    addVisit(today, t, i === 4 ? null : pickSeed(usedToday), status)
  })
  // Будущее: неделя записей, иногда новые клиенты
  for (let off = 1; off <= 10; off++) {
    const used = new Set<Seed>()
    for (const t of dayTimes(int(2, 5))) addVisit(iso(off), t, rnd() < 0.2 ? null : pickSeed(used), 'booked')
  }

  // Новые клиенты на будущее/сегодня — «новый», без карточки; телефон для части
  for (const v of visits) if (!v.client_id && rnd() < 0.7) v.phone = phone()

  const clients = seeds.map((s) => s.client)
  // Карточка создаётся в день первого визита
  for (const c of clients) {
    const first = visits.filter((v) => v.client_id === c.id).reduce((m, v) => (v.date < m ? v.date : m), today)
    c.created_at = new Date(parseISO(first).getTime() + 20 * 3600e3).toISOString()
  }
  // Чёрный список: в ЧС попадают после последнего визита, дальше записей у них нет
  let kept = visits
  BLACKLIST.forEach(([reason, service], i) => {
    const c = clients[clients.length - 10 - i * 3]
    const cut = iso(-int(12, 75))
    kept = kept.filter((v) => v.client_id !== c.id || v.date < cut)
    const own = kept.filter((v) => v.client_id === c.id).sort(byDateTimeDesc)
    if (!own.length) return
    if (service) {
      own[0].service = service
      own[0].price = priceFor(SERVICES.findIndex(([n]) => n === service), own[0].brand)
    }
    const bannedOn = addDays(parseISO(own[0].date), int(0, 2))
    bannedOn.setHours(int(10, 19), int(0, 59))
    c.blacklisted_at = bannedOn.toISOString()
    c.blacklist_reason = reason
  })
  const db: DB = { version: VERSION, seededOn: today, touched: false, services, clients, visits: kept }
  for (const c of db.clients) syncClient(db, c.id)
  return db
}

// ---------------------------------------------------------------------------
// Хранение
// ---------------------------------------------------------------------------

let cache: DB | null = null

function load(): DB {
  const today = todayISO()
  if (!cache) {
    try {
      const raw = localStorage.getItem(KEY)
      const parsed = raw ? (JSON.parse(raw) as DB) : null
      if (parsed?.version === VERSION) cache = parsed
    } catch {
      cache = null
    }
  }
  if (!cache || (!cache.touched && cache.seededOn !== today)) {
    cache = generate(today)
    persist()
  } else if (cache.seededOn !== today) {
    // Демо меняли — не пересоздаём, а сдвигаем все даты вместе с правками посетителя
    shiftDates(cache, differenceInCalendarDays(parseISO(today), parseISO(cache.seededOn)))
    cache.seededOn = today
    persist()
  }
  promoteNewClients(cache)
  return cache
}

/** Сдвиг всех дат демо на days дней: «сегодня» остаётся заполненным и через неделю. */
function shiftDates(db: DB, days: number) {
  if (!days) return
  const day = (d: string) => format(addDays(parseISO(d), days), 'yyyy-MM-dd')
  const stamp = (s: string) => new Date(new Date(s).getTime() + days * 864e5).toISOString()
  for (const v of db.visits) {
    v.date = day(v.date)
    v.created_at = stamp(v.created_at)
    v.updated_at = stamp(v.updated_at)
  }
  for (const c of db.clients) {
    if (c.last_visit_date) c.last_visit_date = day(c.last_visit_date)
    if (c.blacklisted_at) c.blacklisted_at = stamp(c.blacklisted_at)
    c.created_at = stamp(c.created_at)
  }
  for (const s of db.services) s.created_at = stamp(s.created_at)
}

function persist() {
  try {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Переполненное или закрытое хранилище — демо продолжит работать в памяти
  }
}

function commit(db: DB) {
  db.touched = true
  persist()
}

/** Другая вкладка поменяла демо — перечитаем при следующем запросе. */
export function onExternalChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/** Вернуть демо к исходному состоянию. */
export function resetDemo() {
  cache = generate(todayISO())
  persist()
}

// ---------------------------------------------------------------------------
// Роль текущего пользователя (как app_metadata.role в боевой версии)
// ---------------------------------------------------------------------------

let role: Role = 'admin'
export const setRole = (r: Role) => {
  role = r
}
const isAdmin = () => role === 'admin'

// ---------------------------------------------------------------------------
// Серверная логика
// ---------------------------------------------------------------------------

const notCancelled = (v: Visit) => v.status !== 'cancelled'
const byDateTimeDesc = (a: Visit, b: Visit) =>
  b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.created_at.localeCompare(a.created_at)

/** Пересчёт «последней услуги / цены / визитов» клиента (триггер tg_sync_client_from_visits). */
function syncClient(db: DB, id: string | null) {
  if (!id) return
  const c = db.clients.find((x) => x.id === id)
  if (!c) return
  const list = db.visits.filter((v) => v.client_id === id && notCancelled(v)).sort(byDateTimeDesc)
  const last = list[0]
  c.usual_service = last?.service ?? c.usual_service
  c.last_price = last?.price ?? c.last_price
  c.last_visit_date = last?.date ?? null
  c.visits_count = list.length
}

/** «Kia Rio» → ['kia', 'rio'] */
function carKey(brand: string): [string, string] {
  const k = brand.trim().replace(/\s+/g, ' ').toLowerCase()
  const [w1 = '', ...rest] = k.split(' ')
  return [w1, rest.join(' ').replace(/[^a-zа-яё0-9 ]/g, '')]
}
function sameCar(a: string, b: string) {
  const [x1, x2] = carKey(a)
  const [y1, y2] = carKey(b)
  return x1 === y1 && (x2 === y2 || !x2 || !y2)
}

/** Та же машина в справочнике: марка/модель + номер, без номера — телефон (find_client). */
function findClient(db: DB, brand: string, plate: string, phone: string | null): string | null {
  const hits = db.clients
    .filter(
      (c) =>
        sameCar(c.brand, brand) &&
        ((plate !== '' && c.plate === plate && (phone == null || c.phone == null || c.phone === phone)) ||
          (plate === '' && c.plate === '' && c.phone === phone)),
    )
    .sort(
      (a, b) =>
        Number(b.brand.toLowerCase() === brand.toLowerCase()) - Number(a.brand.toLowerCase() === brand.toLowerCase()) ||
        Number(b.phone === phone) - Number(a.phone === phone) ||
        (b.last_visit_date ?? '').localeCompare(a.last_visit_date ?? '') ||
        a.created_at.localeCompare(b.created_at),
    )
  if (hits[0]) return hits[0].id
  if (phone) {
    const byPhone = db.clients.filter((c) => c.phone === phone && sameCar(c.brand, brand))
    if (byPhone.length === 1) return byPhone[0].id
  }
  return null
}

/** Конец дня: записи прошедших дней без клиента → карточки справочника (promote_new_clients). */
function promoteNewClients(db: DB) {
  const today = todayISO()
  const pending = db.visits.filter((v) => !v.client_id && v.date < today && notCancelled(v) && (v.plate || v.phone))
  if (!pending.length) return
  const groups = new Map<string, Visit[]>()
  for (const v of pending) {
    const k = `${v.brand.toLowerCase()}|${v.plate}|${v.phone ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), v])
  }
  for (const list of groups.values()) {
    const latest = [...list].sort(byDateTimeDesc)[0]
    let id = findClient(db, latest.brand, latest.plate, latest.phone)
    if (!id) {
      id = uuid()
      db.clients.push({
        id,
        plate: latest.plate,
        brand: latest.brand,
        phone: latest.phone,
        usual_service: null,
        last_price: null,
        last_visit_date: null,
        visits_count: 0,
        created_at: nowISO(),
        blacklisted_at: null,
        blacklist_reason: null,
      })
    } else {
      const c = db.clients.find((x) => x.id === id)!
      c.phone = c.phone ?? latest.phone
    }
    for (const v of list) v.client_id = id
    syncClient(db, id)
  }
  persist()
}

// ---------------------------------------------------------------------------
// API для React Query
// ---------------------------------------------------------------------------

const clone = <T,>(x: T): T => structuredClone(x)

export const demo = {
  services(): Service[] {
    return clone(load().services).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  },

  clients(): Client[] {
    return clone(load().clients).sort(
      (a, b) =>
        (b.last_visit_date ?? '').localeCompare(a.last_visit_date ?? '') ||
        a.brand.localeCompare(b.brand) ||
        a.plate.localeCompare(b.plate),
    )
  },

  allVisits(): Visit[] {
    return clone(load().visits).sort((a, b) => -byDateTimeDesc(a, b))
  },

  dayVisits(date: string): Visit[] {
    return clone(load().visits.filter((v) => v.date === date && notCancelled(v))).sort(
      (a, b) => a.time.localeCompare(b.time) || a.created_at.localeCompare(b.created_at),
    )
  },

  visit(id: string): Visit | null {
    const v = load().visits.find((x) => x.id === id)
    return v ? clone(v) : null
  },

  clientVisits(clientId: string): Visit[] {
    return clone(load().visits.filter((v) => v.client_id === clientId)).sort(byDateTimeDesc)
  },

  visitsBefore(date: string): Visit[] {
    return clone(load().visits.filter((v) => v.date < date && notCancelled(v))).sort(byDateTimeDesc)
  },

  visitsBetween(start: string, end: string): Visit[] {
    return clone(load().visits.filter((v) => v.date >= start && v.date <= end && notCancelled(v))).sort(byDateTimeDesc)
  },

  trash(): Visit[] {
    return clone(load().visits.filter((v) => v.status === 'cancelled')).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  },

  clearTrash() {
    if (!isAdmin()) throw new Error('Очистить корзину может только админ')
    const db = load()
    db.visits = db.visits.filter(notCancelled)
    commit(db)
  },

  /** save_visit: клиента не создаём, только привязываем к существующему. */
  saveVisit(input: VisitInput): Visit {
    const db = load()
    const plate = normalizePlate(input.plate)
    const brand = input.brand.trim().replace(/\s+/g, ' ')
    const phone = input.phone?.trim() || null
    const service = input.service.trim()
    const comment = input.comment?.trim() || null
    if (!plate && !phone) throw new Error('Укажите гос номер или телефон')
    if (!service) throw new Error('Не указана услуга')
    const existing = input.id ? db.visits.find((v) => v.id === input.id) : undefined
    if (input.id && !existing) throw new Error('Запись не найдена')
    if (existing?.status === 'cancelled' && !isAdmin()) throw new Error('Отменённую запись может менять только админ')

    let clientId: string | null = null
    // 1) клиент выбран в форме: админ дополняет его данные введёнными
    if (input.client_id) {
      const c = db.clients.find((x) => x.id === input.client_id)
      if (c) {
        clientId = c.id
        if (isAdmin()) {
          c.brand = brand || c.brand
          c.phone = phone ?? c.phone
          if (plate) c.plate = plate
        }
      }
    }
    // 2) та же машина уже есть в справочнике
    if (!clientId) {
      clientId = findClient(db, brand, plate, phone)
      if (clientId && isAdmin()) {
        const c = db.clients.find((x) => x.id === clientId)!
        c.phone = c.phone ?? phone
      }
    }
    // 3) новый клиент: запись без client_id, в справочник — после окончания дня

    const prevClient = existing?.client_id ?? null
    const now = nowISO()
    let visit: Visit
    if (existing) {
      Object.assign(existing, {
        client_id: clientId,
        date: input.date,
        time: input.time.length === 5 ? `${input.time}:00` : input.time,
        brand,
        plate,
        phone,
        service,
        price: input.price,
        comment,
        status: input.status ?? existing.status,
        payment: input.payment !== undefined ? input.payment : (existing.payment ?? null),
        updated_at: now,
      })
      visit = existing
    } else {
      visit = {
        id: uuid(),
        client_id: clientId,
        date: input.date,
        time: input.time.length === 5 ? `${input.time}:00` : input.time,
        brand,
        plate,
        phone,
        service,
        price: input.price,
        status: input.status ?? 'booked',
        comment,
        payment: input.payment ?? null,
        created_at: now,
        updated_at: now,
      }
      db.visits.push(visit)
    }
    syncClient(db, prevClient)
    syncClient(db, clientId)
    commit(db)
    return clone(visit)
  },

  setVisitStatus(id: string, status: VisitStatus): Visit {
    const db = load()
    const v = db.visits.find((x) => x.id === id)
    if (!v) throw new Error('Запись не найдена')
    if (v.status === 'cancelled' && !isAdmin()) throw new Error('Отменённую запись может менять только админ')
    v.status = status
    v.updated_at = nowISO()
    syncClient(db, v.client_id)
    commit(db)
    return clone(v)
  },

  saveClient(input: ClientInput & { id?: string }): Client {
    if (!isAdmin()) throw new Error('Справочник может менять только админ')
    const db = load()
    const row = {
      plate: normalizePlate(input.plate),
      brand: input.brand.trim(),
      phone: input.phone,
      usual_service: input.usual_service,
      last_price: input.last_price,
    }
    let c = input.id ? db.clients.find((x) => x.id === input.id) : undefined
    if (input.id && !c) throw new Error('Клиент не найден')
    if (c) Object.assign(c, row)
    else {
      c = { id: uuid(), ...row, last_visit_date: null, visits_count: 0, created_at: nowISO(), blacklisted_at: null, blacklist_reason: null }
      db.clients.push(c)
    }
    commit(db)
    return clone(c)
  },

  /** set_blacklist: занести может каждый, убрать — только админ. */
  setBlacklist(id: string, reason: string | null): Client {
    if (reason == null && !isAdmin()) throw new Error('Убрать из чёрного списка может только админ')
    const db = load()
    const c = db.clients.find((x) => x.id === id)
    if (!c) throw new Error('Клиент не найден')
    c.blacklisted_at = reason != null ? (c.blacklisted_at ?? nowISO()) : null
    c.blacklist_reason = reason != null ? reason.trim() || null : null
    commit(db)
    return clone(c)
  },

  deleteClient(id: string) {
    if (!isAdmin()) throw new Error('Удалить клиента может только админ')
    const db = load()
    db.clients = db.clients.filter((c) => c.id !== id)
    // on delete set null
    for (const v of db.visits) if (v.client_id === id) v.client_id = null
    commit(db)
  },

  saveService({ id, name, default_price, sort_order }: Partial<Service> & { name: string }): Service {
    const db = load()
    const clean = name.trim()
    if (!clean) throw new Error('Введите название услуги')
    if (db.services.some((s) => s.id !== id && s.name.toLowerCase() === clean.toLowerCase())) throw new Error('Такая услуга уже есть')
    let s = id ? db.services.find((x) => x.id === id) : undefined
    if (s) {
      s.name = clean
      s.default_price = default_price ?? null
      if (sort_order != null) s.sort_order = sort_order
    } else {
      const max = db.services.reduce((m, x) => Math.max(m, x.sort_order), 0)
      s = { id: uuid(), name: clean, default_price: default_price ?? null, sort_order: sort_order ?? max + 10, created_at: nowISO() }
      db.services.push(s)
    }
    commit(db)
    return clone(s)
  },

  deleteService(id: string) {
    const db = load()
    db.services = db.services.filter((s) => s.id !== id)
    commit(db)
  },

  reorderServices(ids: string[]) {
    const db = load()
    ids.forEach((id, i) => {
      const s = db.services.find((x) => x.id === id)
      if (s) s.sort_order = (i + 1) * 10
    })
    commit(db)
  },
}

/** Сколько дней истории в демо — для подписи на экране входа. */
export function demoStats() {
  const db = load()
  const first = db.visits.reduce((m, v) => (v.date < m ? v.date : m), todayISO())
  return {
    clients: db.clients.length,
    visits: db.visits.length,
    days: differenceInCalendarDays(new Date(), parseISO(first)),
  }
}
