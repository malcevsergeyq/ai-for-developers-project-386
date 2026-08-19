import type { components } from './schema'

export type EventType = components['schemas']['EventType']
export type EventTypeCreate = components['schemas']['EventTypeCreate']
export type Slot = components['schemas']['Slot']
export type Booking = components['schemas']['Booking']
export type BookingCreate = components['schemas']['BookingCreate']

/**
 * Адрес бэкенда. Пустая строка по умолчанию — это «тот же origin»: в контейнере
 * фронт и API отдаёт один процесс, и запросы уходят относительными путями.
 *
 * Дефолт именно такой, а не адрес дев-сервера: `.env.development` при `npm run build`
 * не читается (сборка идёт в production-режиме), поэтому любой забытый `VITE_API_URL`
 * молча увёл бы прод в чужой адрес. Промах в сторону своего origin виден сразу,
 * промах в сторону чужого — только в проде.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/** Ошибка, пришедшая от API в формате контракта `{ error, message }`. */
export class ApiError extends Error {
  status: number
  /** Машиночитаемый код: `validation_failed`, `event_type_not_found`, `slot_unavailable`. */
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Сервер недоступен. Проверьте, что бэкенд запущен.')
  }

  if (!response.ok) {
    // Контракт обещает `{ error, message }` на любой ошибке, но сеть или прокси
    // могут вернуть что угодно — поэтому разбор в try.
    let code = 'unknown_error'
    let message = `Запрос завершился с кодом ${response.status}`
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      if (body.error) code = body.error
      if (body.message) message = body.message
    } catch {
      // тело не JSON — остаётся заглушка выше
    }
    throw new ApiError(response.status, code, message)
  }

  return (await response.json()) as T
}

export const api = {
  listEventTypes: () => request<EventType[]>('/event-types'),
  getEventType: (id: string) => request<EventType>(`/event-types/${encodeURIComponent(id)}`),
  listSlots: (id: string) => request<Slot[]>(`/event-types/${encodeURIComponent(id)}/slots`),
  createBooking: (body: BookingCreate) =>
    request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(body) }),

  listAdminEventTypes: () => request<EventType[]>('/admin/event-types'),
  createEventType: (body: EventTypeCreate) =>
    request<EventType>('/admin/event-types', { method: 'POST', body: JSON.stringify(body) }),
  listAdminBookings: () => request<Booking[]>('/admin/bookings'),
}
