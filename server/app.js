import cors from 'cors'
import express from 'express'

import { HttpError, routeNotFound, validationFailed } from './errors.js'
import { createAdminRouter } from './routes/admin.routes.js'
import { createPublicRouter } from './routes/public.routes.js'
import { createBookingsService } from './services/bookings.service.js'
import { createEventTypesService } from './services/event-types.service.js'

/** Заметка гостя ограничена 1000 символами — килобайты сверх этого можно отвергать сразу. */
const BODY_LIMIT = '32kb'

/**
 * Список origin из окружения: `CORS_ORIGIN=https://app.example.com,https://staging.example.com`.
 * Без переменной разрешаем всех — это дев-режим и осознанный дефолт, а не забытая настройка.
 *
 * Честная оговорка: CORS здесь не граница безопасности. `/admin/*` вообще не требует
 * авторизации (ТЗ вынесло её за скоуп), поэтому кто угодно дойдёт до него запросом
 * из curl, где CORS не действует. Настоящее лекарство — авторизация, а не список origin.
 */
const corsOptions = () => {
  const configured = process.env.CORS_ORIGIN
  if (!configured) return {}
  return { origin: configured.split(',').map((origin) => origin.trim()) }
}

/**
 * Репозитории приходят снаружи — благодаря этому одно и то же приложение работает
 * и на Postgres, и на хранилище в памяти, а тесты обходятся без поднятой базы.
 */
export const createApp = ({ repositories, now = () => new Date() }) => {
  const app = express()

  app.use(cors(corsOptions()))
  app.use(express.json({ limit: BODY_LIMIT }))

  const eventTypesService = createEventTypesService(repositories)
  const bookingsService = createBookingsService(repositories)
  const deps = { eventTypesService, bookingsService, now }

  app.use('/', createPublicRouter(deps))
  app.use('/admin', createAdminRouter(deps))

  // Без этого Express отдал бы на неизвестный путь свою HTML-страницу, и клиент,
  // который всегда ждёт `{ error, message }`, споткнулся бы на разборе ответа.
  app.use((req, res, next) => next(routeNotFound()))

  // Обработчик ошибок один на всё приложение: статус и тело физически не могут
  // разойтись между обработчиками, а текст ошибки БД наружу не утекает.
  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.error, message: err.message })
    }

    // Ошибки разбора тела express.json() бросает раньше любого обработчика.
    // Все три — вина запроса, и без явных веток каждая превращалась бы в 500.
    if (err?.type === 'entity.parse.failed') {
      const parseError = validationFailed('Тело запроса не является корректным JSON')
      return res.status(parseError.status).json({ error: parseError.error, message: parseError.message })
    }
    if (err?.type === 'entity.too.large') {
      return res
        .status(413)
        .json({ error: 'payload_too_large', message: `Тело запроса больше ${BODY_LIMIT}` })
    }
    if (err?.type === 'encoding.unsupported') {
      return res
        .status(415)
        .json({ error: 'unsupported_media_type', message: 'Неподдерживаемая кодировка тела запроса' })
    }

    console.error('Необработанная ошибка:', err)
    return res.status(500).json({ error: 'internal_error', message: 'Внутренняя ошибка сервера' })
  })

  return app
}
