import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfMonth, format, parseISO } from 'date-fns'
import { demo, latency } from './demoDb'
import { shiftISODate, todayISO } from './format'
import type { Client, ClientInput, Service, Visit, VisitInput, VisitStatus } from './types'

export const qk = {
  services: ['services'] as const,
  clients: ['clients'] as const,
  day: (date: string) => ['visits', 'day', date] as const,
  visit: (id: string) => ['visits', 'one', id] as const,
  clientVisits: (clientId: string) => ['visits', 'client', clientId] as const,
  archive: (ym: string, today: string) => ['archive', ym, today] as const,
  trash: ['visits', 'trash'] as const,
}

export class OfflineError extends Error {
  constructor() {
    super('Нет связи. Сохранение недоступно — проверьте интернет и попробуйте снова.')
  }
}

/** Запись без сети не делаем — понятная ошибка вместо зависания (как в боевой версии). */
function ensureOnline() {
  if (!navigator.onLine) throw new OfflineError()
}

/** Демо-запрос: небольшая задержка «сети», затем ответ из локальной базы браузера. */
async function run<T>(fn: () => T): Promise<T> {
  await latency()
  return fn()
}

const byTime = (a: Visit, b: Visit) => a.time.localeCompare(b.time) || a.created_at.localeCompare(b.created_at)

// ---------------------------------------------------------------------------
// Чтение
// ---------------------------------------------------------------------------

export function useServices() {
  return useQuery({
    queryKey: qk.services,
    queryFn: () => run(demo.services),
    staleTime: 5 * 60_000,
  })
}

export function useClients() {
  return useQuery({
    queryKey: qk.clients,
    queryFn: () => run(demo.clients),
  })
}

export function useDayVisits(date: string) {
  return useQuery({
    queryKey: qk.day(date),
    queryFn: () => run(() => demo.dayVisits(date)),
  })
}

export function useVisit(id: string | undefined) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: qk.visit(id ?? ''),
    enabled: !!id,
    queryFn: () => run(() => demo.visit(id!)),
    // Мгновенно показываем запись из уже загруженного дня
    initialData: () => {
      for (const [, list] of qc.getQueriesData<Visit[]>({ queryKey: ['visits', 'day'] })) {
        const hit = list?.find((v) => v.id === id)
        if (hit) return hit
      }
      return undefined
    },
    initialDataUpdatedAt: 0,
  })
}

export function useClientVisits(clientId: string | undefined) {
  return useQuery({
    queryKey: qk.clientVisits(clientId ?? ''),
    enabled: !!clientId,
    queryFn: () => run(() => demo.clientVisits(clientId!)),
  })
}

export type PrevVisit = Pick<Visit, 'date' | 'price' | 'service'>

/**
 * Прошлый визит каждой машины дня (до этой даты, без отменённых).
 * Ключ — id записи дня. Машина ищется по карточке справочника, а у новых — по номеру и марке.
 */
export function usePrevVisits(date: string, visits: Visit[] | undefined) {
  const list = (visits ?? []).filter((v) => v.client_id || v.plate)
  const ids = [...new Set(list.map((v) => v.client_id).filter(Boolean))] as string[]
  const plates = [...new Set(list.filter((v) => !v.client_id).map((v) => v.plate))]
  return useQuery({
    queryKey: ['visits', 'prev', date, ids.join(','), plates.join(',')],
    enabled: list.length > 0,
    queryFn: async () => {
      const idSet = new Set(ids)
      const plateSet = new Set(plates)
      const rows = (await run(() => demo.visitsBefore(date))).filter(
        (r) => (r.client_id && idSet.has(r.client_id)) || plateSet.has(r.plate),
      )
      const result: Record<string, PrevVisit> = {}
      for (const v of list) {
        const hit = rows.find((r) =>
          v.client_id ? r.client_id === v.client_id : r.plate === v.plate && r.brand.toLowerCase() === v.brand.toLowerCase(),
        )
        if (hit) result[v.id] = { date: hit.date, price: hit.price, service: hit.service }
      }
      return result
    },
  })
}

/** Архив месяца: только прошедшие дни (дата < сегодня). ym = «2026-09». */
export function useArchiveMonth(ym: string) {
  const today = todayISO()
  return useQuery({
    queryKey: qk.archive(ym, today),
    queryFn: async () => {
      const start = `${ym}-01`
      const monthEnd = format(endOfMonth(parseISO(start)), 'yyyy-MM-dd')
      const yesterday = shiftISODate(today, -1)
      const end = monthEnd < yesterday ? monthEnd : yesterday
      if (start > end) return [] as Visit[]
      return run(() => demo.visitsBetween(start, end))
    },
  })
}

/** Корзина: отменённые записи, последние отменённые сверху. */
export function useTrash() {
  return useQuery({
    queryKey: qk.trash,
    queryFn: () => run(demo.trash),
  })
}

/** Очистить корзину: отменённые записи удаляются насовсем (только админ). */
export function useClearTrash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      ensureOnline()
      await run(demo.clearTrash)
    },
    onSuccess: () => {
      qc.setQueryData<Visit[]>(qk.trash, [])
      void qc.invalidateQueries({ queryKey: ['visits'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Записи
// ---------------------------------------------------------------------------

export function useSaveVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: VisitInput) => {
      ensureOnline()
      return run(() => demo.saveVisit(input))
    },
    onSuccess: (visit) => {
      qc.setQueryData<Visit[]>(qk.day(visit.date), (old) =>
        old ? [...old.filter((v) => v.id !== visit.id), visit].sort(byTime) : old,
      )
      qc.setQueryData(qk.visit(visit.id), visit)
      void qc.invalidateQueries({ queryKey: ['visits'] })
      void qc.invalidateQueries({ queryKey: qk.clients })
      void qc.invalidateQueries({ queryKey: ['archive'] })
    },
  })
}

export function useUpdateVisitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ visit, status }: { visit: Visit; status: VisitStatus }) => {
      ensureOnline()
      return run(() => demo.setVisitStatus(visit.id, status))
    },
    // Оптимистично: статус меняется на экране сразу, без ожидания сервера
    onMutate: async ({ visit, status }) => {
      const key = qk.day(visit.date)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Visit[]>(key)
      qc.setQueryData<Visit[]>(key, (old) => old?.map((v) => (v.id === visit.id ? { ...v, status } : v)))
      return { prev, key }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['visits'] })
      void qc.invalidateQueries({ queryKey: qk.clients })
    },
  })
}

/** Отмена: запись не удаляется, а уходит в корзину (статус «Отменён»). */
export function useCancelVisit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (visit: Visit) => {
      ensureOnline()
      return run(() => demo.setVisitStatus(visit.id, 'cancelled'))
    },
    onSuccess: (visit) => {
      qc.setQueryData<Visit[]>(qk.day(visit.date), (old) => old?.filter((v) => v.id !== visit.id))
      qc.setQueryData<Visit[]>(qk.trash, (old) => (old ? [visit, ...old.filter((v) => v.id !== visit.id)] : old))
      qc.setQueryData(qk.visit(visit.id), visit)
      void qc.invalidateQueries({ queryKey: ['visits'] })
      void qc.invalidateQueries({ queryKey: qk.clients })
      void qc.invalidateQueries({ queryKey: ['archive'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Клиенты
// ---------------------------------------------------------------------------

export function useSaveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput & { id?: string }) => {
      ensureOnline()
      return run(() => demo.saveClient(input))
    },
    onSuccess: (client) => {
      qc.setQueryData<Client[]>(qk.clients, (old) =>
        old ? [client, ...old.filter((c) => c.id !== client.id)] : old,
      )
      void qc.invalidateQueries({ queryKey: qk.clients })
    },
  })
}

/** В чёрный список (reason — строка, можно пустую) или обратно (reason = null). */
export function useSetBlacklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      ensureOnline()
      // Как функция set_blacklist в базе: мастеру можно занести в ЧС, не открывая ему весь справочник
      return run(() => demo.setBlacklist(id, reason))
    },
    onSuccess: (client) => {
      qc.setQueryData<Client[]>(qk.clients, (old) => old?.map((c) => (c.id === client.id ? client : c)))
      void qc.invalidateQueries({ queryKey: qk.clients })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      ensureOnline()
      await run(() => demo.deleteClient(id))
      return id
    },
    onSuccess: (id) => {
      qc.setQueryData<Client[]>(qk.clients, (old) => old?.filter((c) => c.id !== id))
      void qc.invalidateQueries({ queryKey: qk.clients })
      void qc.invalidateQueries({ queryKey: ['visits'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Услуги
// ---------------------------------------------------------------------------

export function useSaveService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Service> & { name: string }) => {
      ensureOnline()
      return run(() => demo.saveService(input))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.services }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      ensureOnline()
      await run(() => demo.deleteService(id))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.services }),
  })
}

/** Перестановка услуги на одну позицию вверх/вниз. */
export function useMoveService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ list, index, dir }: { list: Service[]; index: number; dir: -1 | 1 }) => {
      ensureOnline()
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + dir, 0, item)
      await run(() => demo.reorderServices(next.map((s) => s.id)))
      return next.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 }))
    },
    onMutate: ({ list, index, dir }) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + dir, 0, item)
      const prev = qc.getQueryData<Service[]>(qk.services)
      qc.setQueryData(qk.services, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(qk.services, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.services }),
  })
}
