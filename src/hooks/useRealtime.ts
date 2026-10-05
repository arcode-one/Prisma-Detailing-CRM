import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onExternalChange } from '@/lib/demoDb'

/**
 * В боевой версии — подписка Supabase Realtime: правка на одном телефоне сразу видна на всех.
 * В демо то же самое между вкладками браузера: изменили запись в одной — другая перечитает данные.
 */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    return onExternalChange(() => {
      void qc.invalidateQueries()
    })
  }, [enabled, qc])
}
