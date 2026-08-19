import { describe, expect, it } from 'vitest'

import {
  fitsWorkday,
  isValidStart,
  listGridStarts,
  overlaps,
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
} from '../time.js'

/** Понедельник, 07:00 UTC — до начала рабочего дня, чтобы день был доступен целиком. */
const MONDAY_EARLY = new Date('2026-09-07T07:00:00Z')

describe('overlaps', () => {
  it('считает пересечением наложение интервалов', () => {
    expect(overlaps(10, 20, 15, 25)).toBe(true)
  })

  it('не считает пересечением стык впритык', () => {
    // Иначе соседние слоты объявляли бы друг друга занятыми.
    expect(overlaps(10, 20, 20, 30)).toBe(false)
  })
})

describe('listGridStarts', () => {
  const starts = listGridStarts(MONDAY_EARLY)

  it('не выдаёт выходных', () => {
    const weekend = starts.filter((start) => [0, 6].includes(start.getUTCDay()))
    expect(weekend).toEqual([])
  })

  it('держится рабочих часов', () => {
    const outside = starts.filter(
      (start) => start.getUTCHours() < WORKDAY_START_HOUR || start.getUTCHours() >= WORKDAY_END_HOUR,
    )
    expect(outside).toEqual([])
  })

  it('идёт шагом в 30 минут', () => {
    const offGrid = starts.filter((start) => ![0, 30].includes(start.getUTCMinutes()))
    expect(offGrid).toEqual([])
  })

  it('за две недели даёт 10 рабочих дней по 18 слотов', () => {
    expect(starts).toHaveLength(10 * 18)
  })

  it('не возвращает прошедшее время', () => {
    // Полдень понедельника: слоты до 12:00 этого дня должны исчезнуть.
    const noon = new Date('2026-09-07T12:00:00Z')
    const fromNoon = listGridStarts(noon)
    expect(fromNoon[0].toISOString()).toBe('2026-09-07T12:00:00.000Z')
  })
})

describe('fitsWorkday', () => {
  it('пускает встречу, которая заканчивается ровно в 18:00', () => {
    expect(fitsWorkday(new Date('2026-09-07T17:00:00Z'), 60)).toBe(true)
  })

  it('не пускает встречу, вылезающую за рабочий день', () => {
    expect(fitsWorkday(new Date('2026-09-07T17:30:00Z'), 60)).toBe(false)
  })
})

describe('isValidStart', () => {
  const cases = [
    ['валидный старт на сетке', '2026-09-07T09:30:00Z', 30, true],
    ['мимо сетки', '2026-09-07T09:15:00Z', 30, false],
    ['до начала рабочего дня', '2026-09-07T08:30:00Z', 30, false],
    ['после конца рабочего дня', '2026-09-07T18:00:00Z', 30, false],
    ['в выходной', '2026-09-12T10:00:00Z', 30, false],
    ['в прошлом', '2026-09-04T10:00:00Z', 30, false],
    ['за пределами окна в 14 дней', '2026-09-28T10:00:00Z', 30, false],
    ['не помещается в рабочий день', '2026-09-07T17:30:00Z', 60, false],
  ]

  it.each(cases)('%s', (_name, iso, duration, expected) => {
    expect(isValidStart(new Date(iso), duration, MONDAY_EARLY)).toBe(expected)
  })
})
