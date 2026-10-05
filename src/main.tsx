import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { persistOptions, queryClient } from './lib/queryClient'

// Новая версия ставится сама при следующем открытии; проверяем обновления раз в час
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000)
  },
})

// При открытии и обновлении «Записи» всегда начинаются с сегодня, а не с дня, где листали календарь
if (location.pathname === '/' && location.search.includes('date=')) history.replaceState(history.state, '', '/' + location.hash)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <App />
        <Toaster
          theme="dark"
          position="top-center"
          offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          toastOptions={{
            classNames: {
              toast: '!bg-raised !border-line-strong !rounded-2xl !font-sans !text-[15px] !font-semibold !text-ink',
              description: '!text-muted !font-medium',
              success: '[&_[data-icon]]:!text-neon',
              error: '[&_[data-icon]]:!text-danger',
            },
          }}
        />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
