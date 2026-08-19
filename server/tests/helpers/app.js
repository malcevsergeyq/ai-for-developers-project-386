import { createApp } from '../../app.js'
import { createMemoryRepositories } from '../../repositories/memory.js'

/** Понедельник, 07:00 UTC — рабочая неделя впереди целиком, тест не зависит от дня прогона. */
export const NOW = new Date('2026-09-07T07:00:00Z')

/**
 * Приложение на хранилище в памяти с зафиксированным «сейчас».
 * Хранилище то же самое, что и в проде без `DATABASE_URL`, — не заглушка,
 * поэтому тесты проверяют настоящую логику занятости, а не её имитацию.
 */
export const buildApp = async ({ eventTypes = [], now = NOW, staticDir = null } = {}) => {
  const repositories = createMemoryRepositories()
  const created = []
  for (const eventType of eventTypes) {
    created.push(await repositories.eventTypes.create(eventType))
  }
  return {
    app: createApp({ repositories, now: () => now, staticDir }),
    repositories,
    eventTypes: created,
  }
}

export const demoCall = { title: 'Демо-звонок', description: 'Знакомство', durationMinutes: 30 }
export const consultation = { title: 'Консультация', description: 'Разбор', durationMinutes: 60 }
