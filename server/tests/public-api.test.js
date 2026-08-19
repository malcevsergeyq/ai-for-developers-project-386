import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { buildApp, consultation, demoCall } from './helpers/app.js'

const bookingBody = (overrides = {}) => ({
  start: '2026-09-07T09:30:00Z',
  guestName: 'Сергей',
  guestEmail: 'guest@example.com',
  ...overrides,
})

describe('GET /event-types', () => {
  it('отдаёт список в формате контракта', async () => {
    const { app } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app).get('/event-types')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(1)
    expect(Object.keys(response.body[0]).sort()).toEqual([
      'description',
      'durationMinutes',
      'id',
      'title',
    ])
  })
})

describe('GET /event-types/:id', () => {
  it('находит тип встречи по id', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app).get(`/event-types/${eventTypes[0].id}`)

    expect(response.status).toBe(200)
    expect(response.body.title).toBe('Демо-звонок')
  })

  it('на несуществующий id отвечает 404 в формате контракта', async () => {
    const { app } = await buildApp()
    const response = await request(app).get('/event-types/нет-такого')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'event_type_not_found', message: expect.any(String) })
  })
})

describe('GET /event-types/:id/slots', () => {
  it('отдаёт слоты на 14 дней вперёд', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app).get(`/event-types/${eventTypes[0].id}/slots`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(10 * 18)
    expect(response.body[0]).toEqual({
      start: '2026-09-07T09:00:00.000Z',
      end: '2026-09-07T09:30:00.000Z',
    })
  })

  it('на несуществующий тип встречи отвечает 404', async () => {
    const { app } = await buildApp()
    const response = await request(app).get('/event-types/нет/slots')

    expect(response.status).toBe(404)
  })
})

describe('POST /bookings', () => {
  it('создаёт запись и возвращает 201 с телом брони', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app)
      .post('/bookings')
      .send(bookingBody({ eventTypeId: eventTypes[0].id, notes: 'Первый раз' }))

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      eventTypeId: eventTypes[0].id,
      eventTypeTitle: 'Демо-звонок',
      start: '2026-09-07T09:30:00.000Z',
      end: '2026-09-07T10:00:00.000Z',
      guestName: 'Сергей',
      notes: 'Первый раз',
    })
  })

  it('не кладёт notes в ответ, если гость их не прислал', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app)
      .post('/bookings')
      .send(bookingBody({ eventTypeId: eventTypes[0].id }))

    expect(response.body).not.toHaveProperty('notes')
  })

  it('на занятое время отвечает 409', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const body = bookingBody({ eventTypeId: eventTypes[0].id })

    await request(app).post('/bookings').send(body)
    const second = await request(app).post('/bookings').send(body)

    expect(second.status).toBe(409)
    expect(second.body.error).toBe('slot_unavailable')
  })

  it('занятость глобальная: чужой тип встречи тоже блокирует время', async () => {
    // Ключевое правило контракта — на пересекающееся время нельзя две записи,
    // даже если это разные типы встреч.
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall, consultation] })
    const [demo, consult] = eventTypes

    const first = await request(app)
      .post('/bookings')
      .send(bookingBody({ eventTypeId: consult.id, start: '2026-09-07T09:30:00Z' }))
    expect(first.status).toBe(201)

    // Часовая консультация 09:30–10:30 накрывает получасовое демо в 10:00.
    const second = await request(app)
      .post('/bookings')
      .send(bookingBody({ eventTypeId: demo.id, start: '2026-09-07T10:00:00Z' }))

    expect(second.status).toBe(409)
  })

  it('после брони слот исчезает из списка свободных', async () => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    await request(app).post('/bookings').send(bookingBody({ eventTypeId: eventTypes[0].id }))

    const slots = await request(app).get(`/event-types/${eventTypes[0].id}/slots`)
    const starts = slots.body.map((slot) => slot.start)

    expect(starts).not.toContain('2026-09-07T09:30:00.000Z')
    expect(starts).toContain('2026-09-07T09:00:00.000Z')
  })

  it('на несуществующий тип встречи отвечает 404, а не 400', async () => {
    const { app } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app).post('/bookings').send(bookingBody({ eventTypeId: 'нет' }))

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('event_type_not_found')
  })

  const invalid = [
    ['время мимо получасовой сетки', { start: '2026-09-07T09:15:00Z' }],
    ['время вне рабочего дня', { start: '2026-09-07T20:00:00Z' }],
    ['время в выходной', { start: '2026-09-12T10:00:00Z' }],
    ['время за окном в 14 дней', { start: '2026-09-28T10:00:00Z' }],
    ['время в прошлом', { start: '2026-09-04T10:00:00Z' }],
    ['start не дата', { start: 'завтра' }],
    ['пустое имя', { guestName: '   ' }],
    ['email без собаки', { guestEmail: 'guest.example.com' }],
  ]

  it.each(invalid)('на %s отвечает 400', async (_name, overrides) => {
    const { app, eventTypes } = await buildApp({ eventTypes: [demoCall] })
    const response = await request(app)
      .post('/bookings')
      .send(bookingBody({ eventTypeId: eventTypes[0].id, ...overrides }))

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
  })
})
