import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { removeOldestQuery } from '@tanstack/react-query-persist-client'

const WEEK = 1000 * 60 * 60 * 24 * 7

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: WEEK,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    // Мутации не ставим в очередь до появления сети — сразу показываем «нет связи».
    mutations: { networkMode: 'always' },
  },
})

/** Последние загруженные данные живут в localStorage → видны без сети. */
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'prisma-cache',
  throttleTime: 1000,
  retry: removeOldestQuery,
})

export const persistOptions = {
  persister,
  maxAge: WEEK,
  buster: 'prisma-demo-v1',
  dehydrateOptions: {
    // Архив большой и нужен только онлайн — его не сохраняем.
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
      q.state.status === 'success' && q.queryKey[0] !== 'archive',
  },
}
