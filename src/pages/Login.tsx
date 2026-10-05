import clsx from 'clsx'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Eye, EyeOff, FlaskConical, Loader2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { session, signIn } = useAuth()
  const [login, setLogin] = useState('admin')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signIn(login, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted">CRM-система</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]" noValidate>
          {/* Демо: подсказка с готовыми доступами */}
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-neon">
              <FlaskConical className="size-4" /> Демо-версия
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-muted">
              Данные вымышленные и хранятся только в вашем браузере — можно добавлять, менять и удалять что угодно.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Роль">
              {Object.entries(DEMO_ACCOUNTS).map(([key, acc]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={login.trim().toLowerCase() === key}
                  onClick={() => {
                    setLogin(key)
                    setPassword(DEMO_PASSWORD)
                    setError(null)
                  }}
                  className={clsx(
                    'rounded-lg border px-2.5 py-2 text-left transition-colors',
                    login.trim().toLowerCase() === key
                      ? 'border-neon/60 bg-neon/10'
                      : 'border-line-strong bg-field hover:border-accent/50',
                  )}
                >
                  <span className="block text-[13px] font-bold text-ink">{acc.title}</span>
                  <span className="block font-mono text-[12px] text-muted">
                    {key} / {DEMO_PASSWORD}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="login">
              Логин
            </label>
            <input
              id="login"
              className="field"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              aria-invalid={!!error && !login.trim()}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <div className="relative">
              <input
                id="password"
                className="field pr-14"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!error && !password}
              />
              <button
                type="button"
                className="btn btn-icon absolute right-1 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary h-14 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="size-5 animate-spin" />}
            {busy ? 'Вход…' : 'Войти в демо'}
          </button>
        </form>
      </div>
    </div>
  )
}
