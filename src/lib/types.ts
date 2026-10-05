export type VisitStatus = 'booked' | 'arrived' | 'washing' | 'paid' | 'cancelled'

/** Способ оплаты: наличные / карта / перевод. null — не указан */
export type Payment = 'cash' | 'card' | 'transfer'

export interface Service {
  id: string
  name: string
  default_price: number | null
  sort_order: number
  created_at: string
}

export interface Client {
  id: string
  plate: string
  brand: string
  phone: string | null
  usual_service: string | null
  last_price: number | null
  last_visit_date: string | null
  visits_count: number
  created_at: string
  /** Когда занесли в чёрный список; null — не в списке */
  blacklisted_at: string | null
  blacklist_reason: string | null
}

export interface Visit {
  id: string
  client_id: string | null
  /** yyyy-MM-dd */
  date: string
  /** HH:mm:ss */
  time: string
  brand: string
  plate: string
  phone: string | null
  service: string
  price: number | null
  status: VisitStatus
  comment: string | null
  /** Есть после миграции 0009; у старых записей — null */
  payment?: Payment | null
  created_at: string
  updated_at: string
}

export interface VisitInput {
  id?: string | null
  /** Клиент, выбранный в форме из справочника */
  client_id?: string | null
  date: string
  time: string
  brand: string
  plate: string
  phone: string | null
  service: string
  price: number | null
  comment: string | null
  status?: VisitStatus | null
  payment?: Payment | null
}

export type ClientInput = Pick<Client, 'plate' | 'brand' | 'phone' | 'usual_service' | 'last_price'>
