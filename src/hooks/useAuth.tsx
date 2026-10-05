import { createContext, useContext, useState, type ReactNode } from 'react'
import { setRole, type Role } from '@/lib/demoDb'
import { persister, queryClient } from '@/lib/queryClient'

/** Демо-вход: логин admin или master, пароль demo. Сессия хранится в localStorage. */
export const AUTH_STORAGE_KEY = 'prisma-auth'
export const DEMO_PASSWORD = 'demo'
export const DEMO_ACCOUNTS: Record<string, { role: Role; email: string; title: string }> = {
  admin: { role: 'admin', email: 'admin@prisma.demo', title: 'Администратор' },
  master: { role: 'staff', email: 'master@prisma.demo', title: 'Мастер' },
}

export interface DemoSession {
  user: { email: string; role: Role; title: string }
}

interface AuthState {
  session: DemoSession | null
  ready: boolean
  /** Админ — полный доступ. Мастер (role: staff) не правит справочник и корзину. */
  isAdmin: boolean
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function readStoredSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const s = raw ? (JSON.parse(raw) as DemoSession) : null
    if (!s?.user) return null
    setRole(s.user.role)
    return s
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(readStoredSession)

  const signIn = async (login: string, password: string) => {
    await new Promise((r) => setTimeout(r, 450))
    const account = DEMO_ACCOUNTS[login.trim().toLowerCase().replace(/@.*$/, '')]
    if (!account || password !== DEMO_PASSWORD) throw new Error('Неверный логин или пароль')
    const s: DemoSession = { user: { email: account.email, role: account.role, title: account.title } }
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s))
    } catch {
      // приватный режим — вход живёт до перезагрузки
    }
    setRole(account.role)
    // Права зависят от роли — сбрасываем кеш, чтобы экраны перечитали данные
    queryClient.clear()
    setSession(s)
  }

  const signOut = async () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }
    queryClient.clear()
    await persister.removeClient()
    setSession(null)
  }

  const isAdmin = session?.user.role !== 'staff'

  return <AuthContext.Provider value={{ session, ready: true, isAdmin, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
