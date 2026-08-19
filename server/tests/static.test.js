import { fileURLToPath } from 'node:url'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { buildApp, demoCall } from './helpers/app.js'

/**
 * В образе фронт и API отдаются одним процессом с одного origin. Раздача статики
 * не должна перекрывать API и не должна ломать формат ошибок — оба риска ниже.
 */
const staticDir = fileURLToPath(new URL('./fixtures/dist', import.meta.url))

describe('раздача собранного фронта', () => {
  it('на маршрут SPA отдаёт index.html', async () => {
    // /admin существует только в браузерном роутере — на сервере такого пути нет,
    // и без фолбэка перезагрузка страницы у пользователя давала бы 404.
    const { app } = await buildApp({ staticDir })
    const response = await request(app).get('/admin').set('Accept', 'text/html')

    expect(response.status).toBe(200)
    expect(response.type).toBe('text/html')
    expect(response.text).toContain('<div id="root">')
  })

  it('не перекрывает API: /admin/event-types остаётся JSON', async () => {
    const { app } = await buildApp({ staticDir, eventTypes: [demoCall] })
    const response = await request(app).get('/admin/event-types').set('Accept', 'text/html')

    expect(response.status).toBe(200)
    expect(response.type).toBe('application/json')
    expect(response.body).toHaveLength(1)
  })

  it('на неизвестный путь без Accept: text/html отдаёт JSON-ошибку, а не страницу', async () => {
    // Иначе клиент, который всегда ждёт `{ error, message }`, получил бы HTML —
    // ровно тот баг, что нашёл аудит 15.08, только вернувшийся с другой стороны.
    const { app } = await buildApp({ staticDir })
    const response = await request(app).get('/такого-пути-нет').set('Accept', 'application/json')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found', message: expect.any(String) })
  })

  it('без собранного фронта неизвестный путь отдаёт JSON даже браузеру', async () => {
    const { app } = await buildApp()
    const response = await request(app).get('/admin/нет').set('Accept', 'text/html')

    expect(response.status).toBe(404)
    expect(response.type).toBe('application/json')
  })
})
