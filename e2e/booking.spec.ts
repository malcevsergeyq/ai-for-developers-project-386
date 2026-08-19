import { expect, test } from '@playwright/test'

import {
  createEventType,
  dayButton,
  fetchSlots,
  fillGuestForm,
  openBookingPage,
  slotButton,
  slotOn,
  uniqueTitle,
} from './helpers'

test('гость проходит путь записи, и встреча появляется у владельца', async ({ page, request }) => {
  const DAY = 5
  const TIME = '12:00'
  const guestEmail = 'guest-happy-path@example.com'

  const eventType = await createEventType(request, { title: uniqueTitle('Демо-звонок') })
  const slot = slotOn(await fetchSlots(request, eventType.id), DAY, TIME)

  await openBookingPage(page, eventType.title)
  await dayButton(page, DAY).click()
  await slotButton(page, TIME).click()
  await fillGuestForm(page, { email: guestEmail, notes: 'Записался через e2e' })
  await page.getByRole('button', { name: 'Записаться' }).click()

  await expect(page.getByText('Запись подтверждена')).toBeVisible()
  await expect(page.getByRole('heading', { name: eventType.title })).toBeVisible()

  // Второй сценарий того же пути: запись обязана сохраниться и быть видимой владельцу —
  // это единственная проверка, проходящая через оба контура приложения.
  await page.goto('/admin')
  const booking = page.getByRole('listitem').filter({ hasText: guestEmail })
  await expect(booking).toContainText(eventType.title)
  await expect(booking).toContainText('Записался через e2e')

  // И третий: то же время больше не предлагается другим гостям.
  await openBookingPage(page, eventType.title)
  await dayButton(page, DAY).click()
  await expect(slotButton(page, TIME)).toHaveCount(0)
  expect(slot.start.slice(11, 16)).toBe(TIME)
})

test('часовая встреча закрывает время и для другого типа встречи', async ({ page, request }) => {
  // Правило контракта: занятость глобальная, а не в рамках одного типа встречи.
  // Юнит-тест сервиса переживёт правку «брать брони только своего типа», если заодно
  // поправят заглушку, — а этот тест нет.
  const DAY = 6
  const consultation = await createEventType(request, {
    title: uniqueTitle('Консультация'),
    durationMinutes: 60,
  })
  const demo = await createEventType(request, { title: uniqueTitle('Демо'), durationMinutes: 30 })

  await openBookingPage(page, consultation.title)
  await dayButton(page, DAY).click()
  await slotButton(page, '12:00').click()
  await fillGuestForm(page, { email: 'guest-overlap@example.com' })
  await page.getByRole('button', { name: 'Записаться' }).click()
  await expect(page.getByText('Запись подтверждена')).toBeVisible()

  await openBookingPage(page, demo.title)
  await dayButton(page, DAY).click()

  // Консультация занимает 12:00–13:00, поэтому получасовое демо нельзя ни в 12:00, ни в 12:30.
  await expect(slotButton(page, '12:00')).toHaveCount(0)
  await expect(slotButton(page, '12:30')).toHaveCount(0)
  // А 11:30 остаётся: встреча закончится ровно в 12:00, стык пересечением не считается.
  await expect(slotButton(page, '11:30')).toBeVisible()
  await expect(slotButton(page, '13:00')).toBeVisible()
})
