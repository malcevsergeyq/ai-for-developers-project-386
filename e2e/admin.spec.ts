import { expect, test } from '@playwright/test'

import { uniqueTitle } from './helpers'

test('владелец публикует тип встречи, и гость сразу его видит', async ({ page }) => {
  const title = uniqueTitle('Стратегическая сессия')

  await page.goto('/admin')
  await page.getByLabel('Название').fill(title)
  await page.getByLabel('Описание').fill('Час на разбор целей и плана')
  await page.getByLabel('Длительность').selectOption('60')
  await page.getByRole('button', { name: 'Создать' }).click()

  // Сначала появляется в кабинете владельца...
  await expect(page.getByRole('listitem').filter({ hasText: title })).toContainText('1 ч')

  // ...и сразу же на публичной странице: отдельной публикации в контракте нет.
  await page.goto('/')
  const card = page.getByRole('listitem').filter({ hasText: title })
  await expect(card).toContainText('Час на разбор целей и плана')
  await expect(card.getByRole('link', { name: 'Выбрать время' })).toBeVisible()
})
