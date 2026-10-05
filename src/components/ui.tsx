import clsx from 'clsx'
import type { ReactNode } from 'react'
import { WifiOff } from 'lucide-react'
import { splitPlate } from '@/lib/plate'
import { formatPhone } from '@/lib/phone'

/** Гос номер в виде настоящего номерного знака — узнаётся с одного взгляда. */
/** Метка «ЧС» — клиент в чёрном списке */
export function BlacklistBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx('shrink-0 rounded-md border border-danger/50 bg-danger/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-danger', className)}
      title="Клиент в чёрном списке"
    >
      ЧС
    </span>
  )
}

export function PlateBadge({ plate, size = 'md', className }: { plate: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  if (!plate) return <span className={clsx('inline-flex shrink-0 rounded-[6px] border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] font-semibold text-dim', className)}>без номера</span>
  const parts = splitPlate(plate)
  const text = { sm: 'text-[12px]', md: 'text-[14px]', lg: 'text-[20px]' }[size]
  const region = { sm: 'text-[10px]', md: 'text-[11px]', lg: 'text-[14px]' }[size]
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-stretch overflow-hidden rounded-[6px] border-[1.5px] border-[#0b0f0c] bg-[#eef3ef] font-bold leading-none text-[#0b0f0c] shadow-[0_0_0_1px_rgba(255,255,255,0.25)]',
        className,
      )}
    >
      <span className={clsx('flex items-center whitespace-nowrap tracking-[0.04em]', text, size === 'lg' ? 'px-3 py-2' : 'px-1.5 py-1')}>
        {parts ? parts.main : plate}
      </span>
      {parts && (
        <span className={clsx('flex items-center border-l-[1.5px] border-[#0b0f0c]', region, size === 'lg' ? 'px-2' : 'px-1')}>
          {parts.region}
        </span>
      )}
    </span>
  )
}

/** Телефон-ссылка. По умолчанию серый; bright — белый (как остальной текст карточки). */
export function PhoneLink({ phone, className, bright }: { phone: string | null; className?: string; bright?: boolean }) {
  if (!phone) return null
  return (
    <a
      href={`tel:${phone}`}
      onClick={(e) => e.stopPropagation()}
      className={clsx('whitespace-nowrap underline-offset-4', bright ? 'text-ink' : 'text-muted', 'transition-colors hover:text-neon hover:underline', className)}
    >
      {formatPhone(phone)}
    </a>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('space-y-3', className)} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card space-y-3 p-4" style={{ opacity: 1 - i * 0.18 }}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="ml-auto h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  text?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid size-16 place-items-center rounded-2xl border border-line bg-surface text-accent">
        {icon}
      </div>
      <p className="text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Состояние «нет сети и нет сохранённых данных». */
export function OfflineEmpty() {
  return (
    <EmptyState
      icon={<WifiOff className="size-7" />}
      title="Нет связи"
      text="Эти данные ещё не загружались на этом устройстве. Подключитесь к интернету."
    />
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<WifiOff className="size-7" />}
      title="Не удалось загрузить"
      text={error instanceof Error ? error.message : 'Попробуйте ещё раз'}
      action={
        <button className="btn btn-ghost" onClick={onRetry}>
          Повторить
        </button>
      }
    />
  )
}
