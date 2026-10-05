import clsx from 'clsx'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Archive, Ban, CalendarDays, LogOut, Plus, Settings2, Trash2, Users, WifiOff } from 'lucide-react'
import { DemoBadge, Logo } from './Logo'
import { DemoNotice } from './DemoNotice'
import { SignOutButton } from './SignOutButton'
import { useOnline } from '@/hooks/useOnline'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'

const NAV = [
  { to: '/', label: 'Записи', icon: CalendarDays, end: true },
  { to: '/clients', label: 'Справочник', icon: Users },
  { to: '/archive', label: 'Архив', icon: Archive },
  { to: '/services', label: 'Услуги', icon: Settings2 },
  { to: '/blacklist', label: 'Чёрный список', icon: Ban },
  { to: '/trash', label: 'Корзина', icon: Trash2 },
]

export function Layout() {
  const online = useOnline()
  const { session } = useAuth()
  useRealtime(!!session && online)

  return (
    <div className="min-h-dvh md:pl-[260px]">
      {/* ПК: боковое меню */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-[#0c110e]/90 px-4 py-6 backdrop-blur md:flex">
        <div className="flex items-center gap-2">
          <Link to="/" aria-label="Записи" className="rounded-lg px-2 py-1 transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <DemoBadge />
        </div>
        <NavLink to="/new" className="btn btn-primary mt-8 h-14 text-[15px]">
          <Plus className="size-5" strokeWidth={2.75} />
          Новая запись
        </NavLink>
        <nav className="mt-6 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex h-12 items-center gap-3 rounded-xl px-3 font-semibold transition-colors',
                  isActive ? 'bg-accent/10 text-neon shadow-[inset_0_0_0_1px_rgba(92,255,143,0.25)]' : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-1">
          <DemoNotice compact className="mb-3" />
          <SignOutButton className="flex h-11 w-full items-center gap-3 rounded-xl px-2 text-sm font-semibold text-muted transition-colors hover:bg-danger/10 hover:text-danger">
            <LogOut className="size-4" />
            Выйти
          </SignOutButton>
        </div>
      </aside>

      {/* Телефон: шапка закреплена сверху на сплошном фоне, снизу чёткая линия, как у нижнего меню. iOS 26 размывает верх страницы
          (Liquid Glass), но не трогает fixed-блок с непрозрачным фоном у верхнего края —
          закрашивает его цветом. Корзина — здесь: в нижней панели нет места */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--mobile-header)] items-end justify-between border-b border-line bg-bg px-4 pb-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <Link to="/" aria-label="Записи" className="-mx-1 rounded-lg px-1 py-1 active:opacity-70">
            <Logo />
          </Link>
          <Link to="/services" aria-label="Демо-версия: подробнее">
            <DemoBadge />
          </Link>
        </div>
        <div className="flex items-center gap-2">
        <NavLink
          to="/blacklist"
          aria-label="Чёрный список"
          className={({ isActive }) =>
            clsx(
              'grid size-10 place-items-center rounded-xl border transition-colors',
              isActive ? 'border-danger/50 bg-danger/10 text-danger' : 'border-line text-muted hover:border-danger/40 hover:text-danger',
            )
          }
        >
          <Ban className="size-4" />
        </NavLink>
        <NavLink
          to="/trash"
          aria-label="Корзина"
          className={({ isActive }) =>
            clsx(
              'flex h-10 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition-colors',
              isActive ? 'border-accent/40 bg-accent/10 text-neon' : 'border-line text-muted hover:border-accent/30 hover:text-ink',
            )
          }
        >
          <Trash2 className="size-4" />
          Корзина
        </NavLink>
        </div>
      </header>
      <div aria-hidden="true" className="h-[var(--mobile-header)] md:hidden" />

      {!online && (
        <div className="mx-4 mt-2 flex items-start gap-2.5 rounded-xl border border-warn/30 bg-[#1d1a0c]/95 px-3.5 py-2.5 text-[13px] font-semibold text-warn backdrop-blur md:mx-8 md:mt-6">
          <WifiOff className="mt-px size-4 shrink-0" />
          <span>Нет связи. Показаны сохранённые данные — создавать и менять записи пока нельзя.</span>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}


function BottomNav() {
  const { pathname } = useLocation()
  const item = (to: string, label: string, Icon: typeof CalendarDays, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors',
          isActive ? 'text-neon' : 'text-muted hover:text-ink active:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={'size-6'} strokeWidth={isActive ? 2.4 : 2} />
          {label}
        </>
      )}
    </NavLink>
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#0b0f0c]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Навигация"
    >
      <div className="mx-auto flex h-[68px] max-w-lg items-stretch px-1">
        {item('/', 'Записи', CalendarDays, true)}
        {item('/clients', 'Справочник', Users)}
        <div className="flex flex-1 items-start justify-center">
          <NavLink
            to="/new"
            aria-label="Новая запись"
            className={clsx(
              '-mt-5 grid size-[62px] place-items-center rounded-[20px] bg-gradient-to-b from-neon to-accent text-accent-ink shadow-[0_0_0_4px_#0b0f0c] transition-[transform,filter] hover:brightness-110 active:scale-95',
              pathname === '/new' && 'ring-2 ring-neon/60 ring-offset-2 ring-offset-bg',
            )}
          >
            <Plus className="size-8" strokeWidth={2.75} />
          </NavLink>
        </div>
        {item('/archive', 'Архив', Archive)}
        {item('/services', 'Услуги', Settings2)}
      </div>
    </nav>
  )
}
