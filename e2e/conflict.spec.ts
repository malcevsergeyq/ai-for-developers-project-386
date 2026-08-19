import { expect, test } from '@playwright/test'

import {
  bookViaApi,
  createEventType,
  dayButton,
  fetchSlots,
  fillGuestForm,
  openBookingPage,
  slotButton,
  slotOn,
  uniqueTitle,
} from './helpers'

/**
 * Главный сценарий набора. 19.08 он сломался ровно здесь: сервер отвечал `409`
 * правильно, юнит-тест на API был зелёный, а сообщение на фронте отрисовывалось внутри
 * формы, которая при конфликте исчезала, — гость видел пустую панель без объяснения.
 * Тест API поймать это не мог в принципе, потому что ломался стык, а не слой.
 */
test('повторная запись на занятый слот не проходит и гость видит понятное сообщение', async ({
  page,
  request,
}) => {
  const DAY = 7
  const TIME = '12:00'

  const eventType = await createEventType(request, { title: uniqueTitle('Демо-конфликт') })
  const slot = slotOn(await fetchSlots(request, eventType.id), DAY, TIME)

  await openBookingPage(page, eventType.title)
  await dayButton(page, DAY).click()
  await slotButton(page, TIME).click()
  await fillGuestForm(page, { name: 'Опоздавший гость', email: 'late@example.com' })

  // Пока гость заполнял форму, слот заняли в обход браузера.
  await bookViaApi(request, { eventTypeId: eventType.id, start: slot.start })

  await page.getByRole('button', { name: 'Записаться' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('заняли')

  // Запись не создалась.
  await expect(page.getByText('Запись подтверждена')).toHaveCount(0)

  // И список слотов обновился сам — гостю не нужно перезагружать страницу,
  // чтобы увидеть актуальное свободное время.
  await expect(slotButton(page, TIME)).toHaveCount(0)
  await expect(slotButton(page, '12:30')).toBeVisible()
})
