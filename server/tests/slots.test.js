import { describe, expect, it } from 'vitest'

import { generateSlots } from '../services/slots.js'

const MONDAY_EARLY = new Date('2026-09-07T07:00:00Z')

const booking = (startIso, endIso) => ({ startAt: new Date(startIso), endAt: new Date(endIso) })

const startsOf = (slots) =>
  slots
    .filter((slot) => slot.start.toISOString().startsWith('2026-09-07'))
    .map((slot) => slot.start.toISOString().slice(11, 16))

describe('generateSlots', () => {
  it('без броней отдаёт весь рабочий день получасовой сеткой', () => {
    const slots = generateSlots({ durationMinutes: 30, bookings: [], now: MONDAY_EARLY })
    expect(startsOf(slots).slice(0, 3)).toEqual(['09:00', '09:30', '10:00'])
    expect(startsOf(slots)).toHaveLength(18)
  })

  it('убирает занятый слот', () => {
    const slots = generateSlots({
      durationMinutes: 30,
      bookings: [booking('2026-09-07T09:30:00Z', '2026-09-07T10:00:00Z')],
      now: MONDAY_EARLY,
    })
    expect(startsOf(slots)).not.toContain('09:30')
    expect(startsOf(slots)).toContain('09:00')
  })

  it('часовая бронь закрывает два получасовых старта', () => {
    const slots = generateSlots({
      durationMinutes: 30,
      bookings: [booking('2026-09-07T09:30:00Z', '2026-09-07T10:30:00Z')],
      now: MONDAY_EARLY,
    })
    expect(startsOf(slots)).not.toContain('09:30')
    expect(startsOf(slots)).not.toContain('10:00')
    expect(startsOf(slots)).toContain('10:30')
  })

  it('для часовой встречи закрывает и предыдущий старт — она бы наложилась', () => {
    // Ключевое место контракта: занятость проверяется пересечением интервалов,
    // а не совпадением точки старта.
    const slots = generateSlots({
      durationMinutes: 60,
      bookings: [booking('2026-09-07T09:30:00Z', '2026-09-07T10:00:00Z')],
      now: MONDAY_EARLY,
    })
    expect(startsOf(slots)).not.toContain('09:00')
    expect(startsOf(slots)).not.toContain('09:30')
    expect(startsOf(slots)).toContain('10:00')
  })

  it('часовая встреча не предлагается на 17:30 — не помещается в рабочий день', () => {
    const slots = generateSlots({ durationMinutes: 60, bookings: [], now: MONDAY_EARLY })
    expect(startsOf(slots)).not.toContain('17:30')
    expect(startsOf(slots)).toContain('17:00')
  })

  it('конец слота считается от длительности типа встречи', () => {
    const slots = generateSlots({ durationMinutes: 90, bookings: [], now: MONDAY_EARLY })
    expect(slots[0].end.toISOString()).toBe('2026-09-07T10:30:00.000Z')
  })
})
