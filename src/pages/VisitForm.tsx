import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Ban, Loader2, UserCheck, WifiOff, X } from 'lucide-react'
import { toast } from 'sonner'
import { ClientSuggest } from '@/components/ClientSuggest'
import { DateField, TimeField } from '@/components/Pickers'
import { ConfirmDialog } from '@/components/Sheet'
import { EmptyState, ListSkeleton, PlateBadge } from '@/components/ui'
import { useOnline } from '@/hooks/useOnline'
import { useAuth } from '@/hooks/useAuth'
import { useCancelVisit, useClients, useDayVisits, useSaveVisit, useServices, useVisit } from '@/lib/queries'
import { buildClientIndex, searchClients, type ClientField } from '@/lib/search'
import { normalizePlate } from '@/lib/plate'
import { formatPhone, formatPhoneInput, isPhoneValid, phoneDigits, toStoredPhone } from '@/lib/phone'
import {
  errorMessage,
  formatDayShort,
  formatMoney,
  formatNumber,
  hhmm,
  isISODate,
  plural,
  SERVICE_MAX,
  suggestTime,
  todayISO,
  capitalizeInput,
  capitalizeFirst,
  PAYMENTS,
} from '@/lib/format'
import type { Client, Payment, Visit, VisitStatus } from '@/lib/types'

interface FormState {
  date: string
  time: string
  brand: string
  plate: string
  phone: string
  service: string
  price: string
  comment: string
  status: VisitStatus
  payment: Payment | null
}

type Errors = Partial<Record<keyof FormState, string>>
type AcField = Extract<ClientField, 'brand' | 'plate' | 'phone'>

/** Откуда взялась цена — чтобы чипс услуги не затирал цену клиента или ручной ввод. */
type PriceSource = 'empty' | 'client' | 'service' | 'manual'

const FIELD_ORDER: (keyof FormState)[] = ['date', 'time', 'brand', 'plate', 'phone', 'service', 'price']

function fromVisit(v: Visit): FormState {
  return {
    date: v.date,
    time: hhmm(v.time),
    brand: v.brand,
    plate: v.plate,
    phone: formatPhone(v.phone),
    service: v.service,
    price: v.price != null ? String(v.price) : '',
    comment: v.comment ?? '',
    status: v.status,
    payment: v.payment ?? null,
  }
}

export default function VisitForm() {
  const { id } = useParams()
  const isEdit = !!id
  const visitQ = useVisit(id)

  if (isEdit) {
    if (visitQ.isPending) return <ListSkeleton rows={3} />
    if (!visitQ.data)
      return (
        <EmptyState
          icon={<X className="size-7" />}
          title="Запись не найдена"
          text="Возможно, её уже удалили на другом устройстве."
          action={
            <Link to="/" className="btn btn-ghost">
              К записям
            </Link>
          }
        />
      )
    return <VisitFormInner key={visitQ.data.id} visit={visitQ.data} />
  }
  return <VisitFormInner />
}

function VisitFormInner({ visit }: { visit?: Visit }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const online = useOnline()
  const isEdit = !!visit
  const { isAdmin } = useAuth()
  // Корзина: отменённую запись мастер только смотрит
  const locked = visit?.status === 'cancelled' && !isAdmin

  const initialDate = isISODate(params.get('date')) ? params.get('date')! : todayISO()
  const [form, setForm] = useState<FormState>(() =>
    visit
      ? fromVisit(visit)
      : { date: initialDate, time: suggestTime(initialDate), brand: '', plate: '', phone: '', service: '', price: '', comment: '', status: 'booked', payment: null },
  )
  const [errors, setErrors] = useState<Errors>({})
  const [priceSource, setPriceSource] = useState<PriceSource>(visit?.price != null ? 'manual' : 'empty')
  const [linked, setLinked] = useState<Client | null>(null)
  const [acField, setAcField] = useState<AcField | null>(null)
  const [hl, setHl] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fieldRefs = useRef<Partial<Record<keyof FormState, HTMLElement | null>>>({})

  const { data: clients } = useClients()
  const { data: services } = useServices()
  const { data: dayVisits } = useDayVisits(form.date)
  const save = useSaveVisit()
  const del = useCancelVisit()

  const index = useMemo(() => buildClientIndex(clients ?? []), [clients])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // --- Автоподбор клиента -------------------------------------------------

  const applyClient = (c: Client, onlyEmpty = false) => {
    setForm((f) => ({
      ...f,
      brand: onlyEmpty && f.brand.trim() ? f.brand : c.brand,
      plate: c.plate,
      phone: onlyEmpty && phoneDigits(f.phone) ? f.phone : formatPhone(c.phone),
      service: onlyEmpty && f.service.trim() ? f.service : (c.usual_service ?? f.service),
      price: onlyEmpty && f.price ? f.price : c.last_price != null ? String(c.last_price) : f.price,
    }))
    if (!(onlyEmpty && form.price) && c.last_price != null) setPriceSource('client')
    setLinked(c)
    setErrors({})
    setAcField(null)
  }

  // Карточка клиента → «Записать»: ?client=<id>
  const prefillId = params.get('client')
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !prefillId || !clients || isEdit) return
    const c = clients.find((x) => x.id === prefillId)
    if (c) applyClient(c)
    prefilled.current = true
  }, [clients, prefillId, isEdit])

  // Для уже существующей записи показываем, чей это клиент
  useEffect(() => {
    if (visit?.client_id && clients && !linked) setLinked(clients.find((c) => c.id === visit.client_id) ?? null)
  }, [clients, visit])

  const suggestions = useMemo(() => {
    if (!acField) return []
    const q = acField === 'phone' ? phoneDigits(form.phone) : form[acField].trim()
    const min = { plate: 1, brand: 2, phone: 3 }[acField]
    if (q.length < min) return []
    const fields: ClientField[] = acField === 'phone' ? ['phone'] : acField === 'plate' ? ['plate'] : ['brand', 'plate']
    return searchClients(index, q, { limit: 6, fields }).filter((c) => c.id !== linked?.id)
  }, [acField, form, index, linked])

  const acProps = (field: AcField) => ({
    onFocus: () => {
      setAcField(field)
      setHl(0)
    },
    onBlur: () => {
      setAcField((f) => (f === field ? null : f))
      // Номер однозначно указывает на одного клиента — подставляем недостающее.
      // Короткие номера («001») бывают у нескольких машин — тогда ничего не угадываем.
      if (field === 'plate' && !linked && plateNorm) {
        const brand = form.brand.trim().toLowerCase()
        const exact = (clients ?? []).filter((c) => c.plate === plateNorm && (!brand || c.brand.trim().toLowerCase() === brand))
        if (exact.length === 1) applyClient(exact[0], true)
      }
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (acField !== field || !suggestions.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHl((h) => (h + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHl((h) => (h - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        applyClient(suggestions[hl] ?? suggestions[0])
      } else if (e.key === 'Escape') {
        setAcField(null)
      }
    },
  })

  const dropdown = (field: AcField) =>
    acField === field && (
      <ClientSuggest items={suggestions} highlight={hl} onPick={(c) => applyClient(c)} onHover={setHl} />
    )

  // --- Услуга и цена --------------------------------------------------------

  const pickService = (name: string) => {
    set('service', name)
    const svc = services?.find((s) => s.name === name)
    // Цена услуги по умолчанию — только если цену не дал клиент и её не вводили руками
    if (svc?.default_price != null && (priceSource === 'empty' || priceSource === 'service')) {
      set('price', String(svc.default_price))
      setPriceSource('service')
    }
  }

  // --- Занятость времени ------------------------------------------------------

  const others = useMemo(
    () => (dayVisits ?? []).filter((v) => v.id !== visit?.id && v.status !== 'cancelled'),
    [dayVisits, visit?.id],
  )
  const sameTime = others.filter((v) => hhmm(v.time) === form.time)
  const plateNorm = normalizePlate(form.plate)
  const samePlate =
    plateNorm.length >= 3
      ? others.filter((v) => v.plate === plateNorm && v.brand.trim().toLowerCase() === form.brand.trim().toLowerCase() && hhmm(v.time) !== form.time)
      : []

  // --- Сохранение -------------------------------------------------------------

  const validate = (): Errors => {
    const e: Errors = {}
    if (!isISODate(form.date)) e.date = 'Укажите дату'
    if (!/^\d{2}:\d{2}$/.test(form.time)) e.time = 'Укажите время'
    if (!plateNorm && !phoneDigits(form.phone)) e.plate = 'Укажите гос номер или телефон'
    else if (plateNorm && !/^[0-9A-ZА-ЯЁ]+$/.test(plateNorm)) e.plate = 'Только буквы и цифры'
    if (!form.service.trim()) e.service = 'Выберите или впишите услугу'
    else if (form.service.trim().length > SERVICE_MAX) e.service = `Не больше ${SERVICE_MAX} символов`
    if (!isPhoneValid(form.phone)) e.phone = 'Номер неполный — 10 цифр после +7'
    if (form.price && !(Number(form.price) >= 0 && Number(form.price) <= 10_000_000)) e.price = 'Некорректная цена'
    return e
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      const first = FIELD_ORDER.find((k) => e[k])
      const el = first && fieldRefs.current[first]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
      return
    }
    if (!online) {
      toast.error('Нет связи', { description: 'Запись не сохранена. Проверьте интернет и попробуйте снова.' })
      return
    }
    save.mutate(
      {
        id: visit?.id ?? null,
        client_id: linked?.id ?? null,
        date: form.date,
        time: form.time,
        brand: form.brand,
        plate: plateNorm,
        phone: toStoredPhone(form.phone),
        service: form.service,
        price: form.price ? Number(form.price) : null,
        comment: form.comment.trim() || null,
        status: isEdit ? form.status : null,
        payment: form.payment,
      },
      {
        onSuccess: (v) => {
          toast.success(isEdit ? 'Запись обновлена' : 'Запись сохранена', {
            description: `${formatDayShort(v.date)}, ${hhmm(v.time)} · ${v.brand || v.plate}`,
          })
          navigate(v.date === todayISO() ? '/' : `/?date=${v.date}`)
        },
        onError: (err) => toast.error('Не сохранено', { description: errorMessage(err) }),
      },
    )
  }

  const remove = () => {
    if (!visit) return
    del.mutate(visit, {
      onSuccess: () => {
        toast.success('Запись отменена', { description: 'Она лежит в корзине' })
        navigate(visit.date === todayISO() ? '/' : `/?date=${visit.date}`)
      },
      onError: (err) => toast.error('Не получилось отменить', { description: errorMessage(err) }),
    })
  }

  const ref = (k: keyof FormState) => (el: HTMLElement | null) => {
    fieldRefs.current[k] = el
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl pb-28 md:pb-0">
      <div className="mb-5 flex items-center gap-2">
        <button type="button" className="btn btn-icon -ml-2 text-muted hover:bg-raised hover:text-ink" onClick={() => navigate(-1)} aria-label="Назад">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="font-display text-[22px] font-bold md:text-2xl">{isEdit ? 'Запись' : 'Новая запись'}</h1>
      </div>

      {visit?.status === 'cancelled' && (
        <p className="mb-4 rounded-xl border border-danger/40 px-3.5 py-3 text-[13px] font-semibold text-danger">
          Запись отменена и лежит в корзине.{locked && ' Менять её может только админ.'}
        </p>
      )}

      <fieldset disabled={locked} className="min-w-0 space-y-4">
        {/* Когда */}
        <Section title="Когда">
          <div className="grid grid-cols-[minmax(0,1fr)_118px] gap-3 sm:max-w-md">
            <DateField buttonRef={ref('date')} value={form.date} onChange={(d) => set('date', d)} invalid={!!errors.date} />
            <TimeField buttonRef={ref('time')} value={form.time} onChange={(t) => set('time', t)} invalid={!!errors.time} />
          </div>
          {sameTime.length > 0 && (
            <Warning>
              На {form.time} уже {sameTime.length > 1 ? `${sameTime.length} записи` : 'есть запись'}:{' '}
              {sameTime.map((v) => `${v.brand || 'без марки'} ${v.plate}`).join(', ')}. Сохранить всё равно можно.
            </Warning>
          )}
          {errors.date && <FieldError>{errors.date}</FieldError>}
          {errors.time && <FieldError>{errors.time}</FieldError>}
        </Section>

        {/* Машина и клиент */}
        <Section title="Машина">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <label className="label" htmlFor="brand">
                Марка
              </label>
              <input
                id="brand"
                ref={ref('brand')}
                className="field"
                placeholder="Toyota Camry"
                autoComplete="off"
                autoCapitalize="words"
                value={form.brand}
                onChange={(e) => {
                  set('brand', capitalizeInput(e.target))
                  setAcField('brand')
                  setHl(0)
                }}
                {...acProps('brand')}
              />
              {dropdown('brand')}
            </div>
            <div className="relative">
              <label className="label" htmlFor="plate">
                Гос номер
              </label>
              <input
                id="plate"
                ref={ref('plate')}
                className="field font-display uppercase tracking-[0.06em]"
                placeholder="А123ВС77"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={14}
                value={form.plate}
                onChange={(e) => {
                  const v = normalizePlate(e.target.value)
                  set('plate', v)
                  if (linked && v !== linked.plate) setLinked(null)
                  setAcField('plate')
                  setHl(0)
                }}
                aria-invalid={!!errors.plate}
                {...acProps('plate')}
              />
              {dropdown('plate')}
              {errors.plate && <FieldError>{errors.plate}</FieldError>}
            </div>
          </div>
          <div className="relative mt-3 sm:w-[calc(50%-6px)]">
            <label className="label" htmlFor="phone">
              Телефон
            </label>
            <input
              id="phone"
              ref={ref('phone')}
              className="field font-display tracking-[0.02em]"
              type="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              autoComplete="off"
              value={form.phone}
              onChange={(e) => {
                set('phone', formatPhoneInput(e.target.value))
                setAcField('phone')
                setHl(0)
              }}
              aria-invalid={!!errors.phone}
              {...acProps('phone')}
            />
            {dropdown('phone')}
            {errors.phone && <FieldError>{errors.phone}</FieldError>}
          </div>

          {linked?.blacklisted_at && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-danger/50 bg-danger/10 px-3.5 py-3 text-danger">
              <Ban className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 text-[13px] leading-snug">
                <p className="text-[14px] font-extrabold">Клиент в чёрном списке</p>
                <p className="mt-0.5 font-semibold text-ink/85">{linked.blacklist_reason || 'Причина не указана'}</p>
              </div>
            </div>
          )}
          {linked ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-3.5 py-3">
              <UserCheck className="size-5 shrink-0 text-neon" />
              <div className="min-w-0 flex-1 text-[13px] leading-snug">
                <p className="font-bold text-ink">
                  Постоянный клиент · {linked.visits_count} {plural(linked.visits_count, 'визит', 'визита', 'визитов')}
                </p>
                <p className="truncate text-muted">
                  {linked.last_visit_date ? `был ${formatDayShort(linked.last_visit_date)} · ` : ''}
                  {linked.usual_service ?? '—'} · {formatMoney(linked.last_price)}
                </p>
              </div>
              <Link to={`/clients/${linked.id}`} className="shrink-0 text-[13px] font-bold text-neon">
                История
              </Link>
            </div>
          ) : plateNorm.length >= 3 && !clients?.some((c) => c.plate === plateNorm) ? (
            <p className="mt-3 text-[13px] font-semibold text-muted">
              Новый клиент — <PlateBadge plate={plateNorm} size="sm" /> добавится в справочник после окончания дня.
            </p>
          ) : null}
          {samePlate.length > 0 && (
            <Warning>
              Эта машина уже записана на этот день в {samePlate.map((v) => hhmm(v.time)).join(', ')}.
            </Warning>
          )}
        </Section>

        {/* Услуга */}
        <Section title="Услуга">
          <textarea
            ref={ref('service')}
            className="field min-h-[76px]"
            rows={2}
            maxLength={SERVICE_MAX}
            placeholder="Выберите ниже или впишите свою"
            value={form.service}
            onChange={(e) => set('service', capitalizeInput(e.target, (v) => capitalizeFirst(v.replace(/\n/g, ' ').slice(0, SERVICE_MAX))))}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            aria-label="Вид услуги"
            aria-invalid={!!errors.service}
          />
          <div className="mt-1.5 flex justify-between gap-3">
            {errors.service ? <FieldError>{errors.service}</FieldError> : <span />}
            <span className={clsx('mt-1.5 shrink-0 text-xs font-semibold', form.service.length >= SERVICE_MAX ? 'text-warn' : 'text-dim')}>
              {form.service.length}/{SERVICE_MAX}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(services ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip h-11"
                aria-pressed={form.service.trim() === s.name}
                onClick={() => pickService(s.name)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="mt-4 sm:w-[200px]">
            <div>
              <label className="label" htmlFor="price">
                Цена
              </label>
              <div className="relative">
                <input
                  id="price"
                  ref={ref('price')}
                  className="field pr-10 font-display text-lg text-neon"
                  inputMode="numeric"
                  placeholder="0"
                  autoComplete="off"
                  value={form.price ? formatNumber(Number(form.price)) : ''}
                  onChange={(e) => {
                    set('price', e.target.value.replace(/\D/g, '').slice(0, 8))
                    setPriceSource(e.target.value ? 'manual' : 'empty')
                  }}
                  aria-invalid={!!errors.price}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-display font-bold text-muted">₽</span>
              </div>
              {priceSource === 'client' && <p className="mt-1.5 text-xs font-semibold text-accent/80">как в прошлый раз</p>}
              {priceSource === 'service' && <p className="mt-1.5 text-xs font-semibold text-muted">цена услуги по умолчанию</p>}
              {errors.price && <FieldError>{errors.price}</FieldError>}
            </div>
          </div>

          {/* Способ оплаты — повторное нажатие снимает выбор */}
          <div className="mt-4">
            <span className="label">Оплата</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Способ оплаты">
              {PAYMENTS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className="chip h-11 justify-center"
                  aria-pressed={form.payment === p.value}
                  onClick={() => set('payment', form.payment === p.value ? null : p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Section>


        {isEdit && visit?.status !== 'cancelled' && (
          <button type="button" className="btn btn-danger w-full" onClick={() => setConfirmDelete(true)}>
            Отменить запись
          </button>
        )}
      </fieldset>

      {/* Кнопка сохранения: на телефоне всегда под большим пальцем */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-bg via-bg/90 to-transparent px-4 pb-3 pt-6 md:static md:mt-6 md:bg-none md:p-0">
          <button type="submit" className="btn btn-primary mx-auto h-14 w-full max-w-2xl text-[16px]" disabled={save.isPending || !online}>
            {save.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : !online ? (
              <>
                <WifiOff className="size-5" /> Нет связи
              </>
            ) : isEdit ? (
              'Сохранить изменения'
            ) : (
              'Сохранить запись'
            )}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Отменить запись?"
        confirmLabel="Да, отменить"
        cancelLabel="Нет"
        busyLabel="Отменяю…"
        text={visit ? `${formatDayShort(visit.date)}, ${hhmm(visit.time)} · ${visit.brand} ${visit.plate}. Запись перейдёт в корзину.` : ''}
        busy={del.isPending}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4 md:p-5">
      <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-dim">{title}</h2>
      {children}
    </section>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className={clsx('mt-3 flex gap-2.5 rounded-xl border border-warn/35 bg-warn/[0.08] px-3.5 py-3 text-[13px] font-semibold leading-snug text-warn')} role="status">
      <AlertTriangle className="mt-px size-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] font-semibold text-danger">{children}</p>
}
