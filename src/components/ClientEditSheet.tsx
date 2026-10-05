import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet } from './Sheet'
import { useSaveClient, useServices } from '@/lib/queries'
import { normalizePlate } from '@/lib/plate'
import { formatPhone, formatPhoneInput, isPhoneValid, toStoredPhone } from '@/lib/phone'
import { SERVICE_MAX, errorMessage, formatNumber, capitalizeInput, capitalizeFirst } from '@/lib/format'
import type { Client } from '@/lib/types'

export function ClientEditSheet({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean
  client?: Client | null
  onClose: () => void
  onSaved?: (c: Client) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={client ? 'Изменить клиента' : 'Новый клиент'}>
      {open && <ClientForm client={client} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function ClientForm({ client, onClose, onSaved }: { client?: Client | null; onClose: () => void; onSaved?: (c: Client) => void }) {
  const [plate, setPlate] = useState(client?.plate ?? '')
  const [brand, setBrand] = useState(client?.brand ?? '')
  const [phone, setPhone] = useState(formatPhone(client?.phone))
  const [service, setService] = useState(client?.usual_service ?? '')
  const [price, setPrice] = useState(client?.last_price != null ? String(client.last_price) : '')
  const [errors, setErrors] = useState<{ plate?: string; phone?: string }>({})
  const save = useSaveClient()
  const { data: services } = useServices()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!normalizePlate(plate) && !toStoredPhone(phone)) errs.plate = 'Укажите гос номер или телефон'
    if (!isPhoneValid(phone)) errs.phone = 'Номер неполный'
    setErrors(errs)
    if (Object.keys(errs).length) return
    save.mutate(
      {
        id: client?.id,
        plate,
        brand,
        phone: toStoredPhone(phone),
        usual_service: service.trim() || null,
        last_price: price ? Number(price) : null,
      },
      {
        onSuccess: (c) => {
          toast.success(client ? 'Клиент обновлён' : 'Клиент добавлен')
          onSaved?.(c)
          onClose()
        },
        onError: (err) => toast.error('Не сохранено', { description: errorMessage(err) }),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-plate">
            Гос номер
          </label>
          <input
            id="c-plate"
            className="field font-display uppercase tracking-[0.06em]"
            value={plate}
            onChange={(e) => setPlate(normalizePlate(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="А123ВС77"
            aria-invalid={!!errors.plate}
          />
          {errors.plate && <p className="mt-1.5 text-[13px] font-semibold text-danger">{errors.plate}</p>}
        </div>
        <div>
          <label className="label" htmlFor="c-brand">
            Марка
          </label>
          <input id="c-brand" className="field" value={brand} onChange={(e) => setBrand(capitalizeInput(e.target))} autoCapitalize="words" autoComplete="off" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-phone">
          Телефон
        </label>
        <input
          id="c-phone"
          className="field font-display"
          type="tel"
          inputMode="tel"
          placeholder="+7 (___) ___-__-__"
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          aria-invalid={!!errors.phone}
        />
        {errors.phone && <p className="mt-1.5 text-[13px] font-semibold text-danger">{errors.phone}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="label" htmlFor="c-service">
            Обычная услуга
          </label>
          <input id="c-service" className="field" maxLength={SERVICE_MAX} list="c-services" value={service} onChange={(e) => setService(capitalizeInput(e.target, capitalizeFirst))} autoComplete="off" />
          <datalist id="c-services">
            {services?.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="c-price">
            Последняя цена, ₽
          </label>
          <input
            id="c-price"
            className="field font-display text-neon"
            inputMode="numeric"
            value={price ? formatNumber(Number(price)) : ''}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Отмена
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-5 animate-spin" /> : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
