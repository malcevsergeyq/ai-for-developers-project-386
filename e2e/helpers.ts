import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { API_URL } from './config'

export type Slot = { start: string; end: string }

let counter = 0

/**
 * Хранилище живёт всё время прогона, а занятость глобальная — поэтому каждый тест
 * заводит собственный тип встречи и работает со своим днём. Иначе тесты дрались бы
 * за одни и те же слоты и падали бы через раз.
 */
export const uniqueTitle = (prefix: string) => `${prefix} №${(counter += 1)}`

export const createEventType = async (
  request: APIRequestContext,
  { title, description = 'Создан e2e-тестом', durationMinutes = 30 },
) => {
  const response = await request.post(`${API_URL}/admin/event-types`, {
    data: { title, description, durationMinutes },
  })
  expect(response.status(), 'тип встречи должен создаваться').toBe(201)
  return (await response.json()) as { id: string; title: string; durationMinutes: number }
}

export const fetchSlots = async (request: APIRequestContext, eventTypeId: string) => {
  const response = await request.get(`${API_URL}/event-types/${eventTypeId}/slots`)
  expect(response.status()).toBe(200)
  return (await response.json()) as Slot[]
}

/**
 * Занять слот в обход браузера — так имитируется гость, опередивший нас на полсекунды.
 */
export const bookViaApi = async (
  request: APIRequestContext,
  { eventTypeId, start }: { eventTypeId: string; start: string },
) => {
  const response = await request.post(`${API_URL}/bookings`, {
    data: {
      eventTypeId,
      start,
      guestName: 'Кто-то быстрее',
      guestEmail: 'faster@example.com',
    },
  })
  expect(response.status(), 'слот должен успешно заниматься').toBe(201)
}

/**
 * Слот на нужное время N-го доступного дня. День берём из ответа API, а не вычисляем
 * заново: дублировать логику окна записи в тесте значило бы проверять её саму собой.
 */
export const slotOn = (slots: Slot[], dayIndex: number, time: string) => {
  const days = [...new Set(slots.map((slot) => slot.start.slice(0, 10)))]
  const day = days[dayIndex]
  if (!day) throw new Error(`В окне записи нет дня с индексом ${dayIndex}`)

  const slot = slots.find((item) => item.start.startsWith(day) && item.start.slice(11, 16) === time)
  if (!slot) throw new Error(`Нет свободного слота ${time} на день ${day}`)
  return slot
}

/** Кнопки дней подписаны днём недели — по нему они и отличаются от кнопок времени. */
export const dayButton = (page: Page, index: number) =>
  page.getByRole('button', { name: /^(пн|вт|ср|чт|пт|сб|вс),/ }).nth(index)

export const slotButton = (page: Page, time: string) =>
  page.getByRole('button', { name: time, exact: true })

export const openBookingPage = async (page: Page, eventTypeTitle: string) => {
  await page.goto('/')
  await page
    .getByRole('listitem')
    .filter({ hasText: eventTypeTitle })
    .getByRole('link', { name: 'Выбрать время' })
    .click()
}

export const fillGuestForm = async (
  page: Page,
  { name = 'Сергей Мальцев', email = 'guest@example.com', notes = '' } = {},
) => {
  await page.getByLabel('Имя').fill(name)
  await page.getByLabel('Email').fill(email)
  if (notes) await page.getByLabel(/Комментарий/).fill(notes)
}
