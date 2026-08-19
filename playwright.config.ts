import { defineConfig, devices } from '@playwright/test'

import { API_PORT, API_URL, IS_EXTERNAL, WEB_PORT, WEB_URL } from './e2e/config'

/**
 * e2e-проверки идут против собранного фронта и настоящего бэкенда — так же, как будет
 * работать проверка проекта. Оба сервера поднимает сам Playwright, чтобы прогон в CI
 * не зависел от того, что кто-то заранее что-то запустил.
 *
 * Порты специально не совпадают с дев-серверами (3000 и 5173): иначе прогон убивал бы
 * то, с чем работает человек, или цеплялся к чужому процессу с другими данными.
 */

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },

  /**
   * Один воркер осознанно. Занятость в проекте глобальная: две записи на пересекающееся
   * время запрещены независимо от типа встречи, поэтому параллельные тесты дрались бы
   * за одни и те же слоты. Тесты и так разведены по разным дням, но последовательный
   * прогон снимает целый класс мигающих падений.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    locale: 'ru-RU',
    // Время в приложении всегда UTC — фиксируем зону, иначе подписи слотов
    // зависели бы от настроек машины, где идёт прогон.
    timezoneId: 'UTC',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // При E2E_BASE_URL приложение уже работает — поднимать нечего.
  webServer: IS_EXTERNAL ? undefined : [
    {
      // Без DATABASE_URL бэкенд поднимается на хранилище в памяти и засевает демо-данные —
      // ровно тот режим, в котором приложение попадёт на проверку.
      command: 'node server/index.js',
      url: `${API_URL}/event-types`,
      env: { PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Именно сборка, а не dev-сервер: VITE_API_URL подставляется на этапе сборки,
      // и проверять надо тот артефакт, который поедет в образ.
      command: `npm run build && npm run preview -- --port ${WEB_PORT} --host 127.0.0.1 --strictPort`,
      cwd: 'ui',
      url: WEB_URL,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
