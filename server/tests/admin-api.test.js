import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { buildApp, consultation, demoCall } from './helpers/app.js'

describe('POST /admin/event-types', () => {
  it('создаёт тип встречи и возвращает 201', async () => {
    const { app } = await buildApp()
    const response = await request(app)
      .post('/admin/event-types')
      .send({ title: 'Демо-звонок', description: 'Знакомство', durationMinutes: 30 })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ title: 'Демо-звонок', durationMinutes: 30 })
    expect(response.body.id).toEqual(expect.any(String))
  })

  it('созданный тип сразу виден гостю', async () => {
    const { app } = await buildApp()
    await request(app)
      .post('/admin/event-types')
      .send({ title: 'Демо-звонок', description: '', durationMinutes: 30 })

    const guest = await request(app).get('/event-types')
    expect(guest.body).toHaveLength(1)
  })

  const invalid = [
    ['пустое название', { title: '  ' }],
    ['длительность не кратна 30', { durationMinutes: 45 }],
    ['длительность меньше минимума', { durationMinutes: 0 }],
    ['длительность больше максимума', { durationMinutes: 300 }],
    ['длительность строкой', { durationMinutes: '30' }],
  ]

  it.each(invalid)('на %s отвечает 400', async (_name, overrides) => {
    const { app } = await buildApp()
    const response = await request(app)
      .post('/admin/event-types')
      .send({ title: 'Демо', description: '', durationMinutes: 30, ...overrides })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
  })
})

describe('GET /admin/bookings', () => {
  it('без записей отдаёт пустой список', async () => {
    const { app } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app).get('/admin/bookings')

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
  })

  it('показывает брони всех типов встреч в одном списке, по возрастанию времени', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall, consultation] })
    const [demo, consult] = eventTypes

    const guest = (eventTypeId, start) =>
      request(app)
        .post('/bookings')
        .send({ eventTypeId, start, guestName: 'Гость', guestEmail: 'guest@example.com' })

    // Отправляем в обратном порядке — список обязан отсортировать сам.
    await guest(consult.id, '2026-09-07T14:00:00Z')
    await guest(demo.id, '2026-09-07T09:00:00Z')

    const response = await request(app).get('/admin/bookings')

    expect(response.body.map((booking) => booking.eventTypeTitle)).toEqual([
      'Демо-звонок',
      'Консультация',
    ])
    expect(response.body[0].start).toBe('2026-09-07T09:00:00.000Z')
  })
})
