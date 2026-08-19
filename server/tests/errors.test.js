import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { buildApp } from './helpers/app.js'

/**
 * Контракт обещает клиенту одну форму ошибки — `{ error, message }`. Эти тесты про то,
 * что обещание держится и на путях, которых в контракте нет: иначе фронт, типизированный
 * спекой, споткнётся на разборе ответа именно там, где что-то уже пошло не так.
 */
describe('единый формат ошибок', () => {
  it('на неизвестный путь отдаёт JSON, а не HTML-страницу Express', async () => {
    const { app } = await buildApp()
    const response = await request(app).get('/такого-эндпоинта-нет')

    expect(response.status).toBe(404)
    expect(response.type).toBe('application/json')
    expect(response.body).toEqual({ error: 'not_found', message: expect.any(String) })
  })

  it('на битый JSON отдаёт 400, а не 500', async () => {
    const { app } = await buildApp()
    const response = await request(app)
      .post('/bookings')
      .set('Content-Type', 'application/json')
      .send('{"eventTypeId": ')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
  })

  it('на слишком большое тело отдаёт 413, а не 500', async () => {
    const { app } = await buildApp()
    const response = await request(app)
      .post('/bookings')
      .send({ eventTypeId: 'x', notes: 'а'.repeat(40_000) })

    expect(response.status).toBe(413)
    expect(response.body.error).toBe('payload_too_large')
  })

  it('на тело не-объект отдаёт 400', async () => {
    const { app } = await buildApp()
    const response = await request(app)
      .post('/bookings')
      .set('Content-Type', 'application/json')
      .send('[]')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
  })
})
