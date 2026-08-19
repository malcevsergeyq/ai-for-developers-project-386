/**
 * Арифметика окна записи. Все константы собраны здесь, потому что одни и те же правила
 * нужны в двух местах: генерация свободных слотов и проверка чужого `start` при создании
 * брони. Две независимые реализации разъехались бы на первой правке рабочих часов.
 *
 * Всё считается в UTC — таймзон в приложении нет, это решение контракта.
 */

export const MINUTE_MS = 60_000
export const DAY_MS = 24 * 60 * MINUTE_MS

/** Шаг сетки стартов. */
export const SLOT_STEP_MINUTES = 30

/** Окно записи: столько дней вперёд от текущего момента. */
export const WINDOW_DAYS = 14

/** Рабочие часы владельца, UTC. Полуинтервал: 18:00 — это конец последней встречи. */
export const WORKDAY_START_HOUR = 9
export const WORKDAY_END_HOUR = 18

const WORKDAY_START_MINUTES = WORKDAY_START_HOUR * 60
const WORKDAY_END_MINUTES = WORKDAY_END_HOUR * 60

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE_MS)

/**
 * Полуинтервалы `[start, end)`: встреча 10:00–10:30 и встреча 10:30–11:00 не пересекаются,
 * иначе соседние слоты объявляли бы друг друга занятыми.
 */
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd

const isWeekend = (date) => date.getUTCDay() === 0 || date.getUTCDay() === 6

const minutesOfDay = (date) => date.getUTCHours() * 60 + date.getUTCMinutes()

/** Конец окна записи — `WINDOW_DAYS` суток от переданного момента. */
export const windowEnd = (from) => new Date(from.getTime() + WINDOW_DAYS * DAY_MS)

/**
 * Все старты сетки внутри окна: будни, рабочие часы, шаг 30 минут, начиная с `from`.
 * Прошедшее время не возвращается — записаться на вчера нельзя.
 */
export const listGridStarts = (from) => {
  const limit = windowEnd(from)
  const firstDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const starts = []

  // WINDOW_DAYS + 1 суток: окно отсчитывается от момента, а не от полуночи,
  // поэтому его хвост попадает на следующий календарный день.
  for (let dayOffset = 0; dayOffset <= WINDOW_DAYS; dayOffset += 1) {
    const day = new Date(firstDay + dayOffset * DAY_MS)
    if (isWeekend(day)) continue

    for (
      let minutes = WORKDAY_START_MINUTES;
      minutes < WORKDAY_END_MINUTES;
      minutes += SLOT_STEP_MINUTES
    ) {
      const start = new Date(day.getTime() + minutes * MINUTE_MS)
      if (start < from) continue
      if (start > limit) return starts
      starts.push(start)
    }
  }

  return starts
}

/** Встреча целиком помещается в рабочий день: 17:30 + 60 минут уже не помещается. */
export const fitsWorkday = (start, durationMinutes) =>
  minutesOfDay(start) + durationMinutes <= WORKDAY_END_MINUTES

/**
 * Момент попадает на сетку и в окно записи. Проверка нужна отдельно от генерации слотов:
 * клиент присылает `start` сам, и «мимо сетки» — это ошибка запроса (400),
 * а не занятость (409).
 */
export const isValidStart = (start, durationMinutes, from) => {
  if (Number.isNaN(start.getTime())) return false
  if (start < from || start > windowEnd(from)) return false
  if (isWeekend(start)) return false
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) return false

  const minutes = minutesOfDay(start)
  if (minutes < WORKDAY_START_MINUTES || minutes >= WORKDAY_END_MINUTES) return false
  if (minutes % SLOT_STEP_MINUTES !== 0) return false

  return fitsWorkday(start, durationMinutes)
}
