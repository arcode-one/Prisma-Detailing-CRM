import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * На телефоне — шторка снизу (до неё дотягивается большой палец),
 * на ПК — диалог по центру.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] [animation:fade-in_.18s_ease-out]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[22px] border border-line-strong bg-surface shadow-2xl [animation:sheet-in_.24s_var(--ease-out-quart)] md:max-w-lg md:rounded-[20px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong md:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 md:pt-5">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button className="btn btn-icon -mr-2 text-muted hover:bg-raised hover:text-ink" onClick={onClose} aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  busyLabel = 'Удаляю…',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  text: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-muted">{text}</p>
    </Sheet>
  )
}
