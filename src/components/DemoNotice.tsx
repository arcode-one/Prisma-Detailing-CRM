import clsx from 'clsx'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { resetDemo } from '@/lib/demoDb'
import { ConfirmDialog } from './Sheet'

/** Плашка «это демо» с кнопкой сброса данных к исходным. */
export function DemoNotice({ compact = false, className }: { compact?: boolean; className?: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  return (
    <section className={clsx('rounded-2xl border border-warn/25 bg-warn/[0.06]', compact ? 'p-3' : 'p-4', className)}>
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-warn">
        <FlaskConical className="size-3.5" /> Демо-версия
      </p>
      <p className={clsx('mt-1.5 font-medium leading-snug text-muted', compact ? 'text-[12px]' : 'text-[13px]')}>
        Все клиенты, номера и телефоны вымышленные. Изменения хранятся только в этом браузере.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'mt-2.5 inline-flex items-center gap-1.5 rounded-lg font-bold text-ink transition-colors hover:text-neon',
          compact ? 'text-[12px]' : 'text-[13px]',
        )}
      >
        <RotateCcw className="size-3.5" /> Сбросить демо-данные
      </button>

      <ConfirmDialog
        open={open}
        title="Сбросить демо?"
        text="Всё, что вы добавили или удалили, пропадёт — вернутся исходные демо-записи, клиенты и услуги."
        confirmLabel="Сбросить"
        onClose={() => setOpen(false)}
        onConfirm={() => {
          resetDemo()
          void qc.resetQueries()
          setOpen(false)
          toast.success('Демо-данные восстановлены')
        }}
      />
    </section>
  )
}
