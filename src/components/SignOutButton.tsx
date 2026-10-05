import { useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ConfirmDialog } from './Sheet'

/** Кнопка «Выйти» с подтверждением — чтобы не вылететь из аккаунта случайным тапом. */
export function SignOutButton({ className, children }: { className?: string; children: ReactNode }) {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title="Выйти из аккаунта?"
        text="Демо-данные сохранятся. Можно войти снова под другой ролью — администратор или мастер."
        confirmLabel="Выйти"
        cancelLabel="Остаться"
        busyLabel="Выхожу…"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true)
          await signOut()
        }}
      />
    </>
  )
}
