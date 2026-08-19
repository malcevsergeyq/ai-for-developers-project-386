import { eventTypeNotFound, validationFailed } from '../errors.js'
import { toBookingDto } from '../mappers/dto.js'
import { addMinutes, isValidStart } from '../time.js'
import { optionalText, requireEmail, requireInstant, requireObject, requireText } from './validation.js'

export const createBookingsService = ({ eventTypes, bookings }) => ({
  /** Список владельца: только предстоящие встречи, по всем типам сразу, по возрастанию времени. */
  async listUpcoming(now) {
    const rows = await bookings.listFrom(now)
    return rows.map(toBookingDto)
  },

  async create(body, now) {
    const payload = requireObject(body)

    const eventTypeId = requireText(payload.eventTypeId, { field: 'eventTypeId', max: 100 })
    const start = requireInstant(payload.start, { field: 'start' })
    const guestName = requireText(payload.guestName, { field: 'guestName', max: 100 })
    const guestEmail = requireEmail(payload.guestEmail, { field: 'guestEmail' })
    const notes = optionalText(payload.notes, { field: 'notes', max: 1000 })

    // 404 раньше 400 по `start`: несуществующий тип встречи нельзя проверить на сетку,
    // его длительность неизвестна.
    const eventType = await eventTypes.findById(eventTypeId)
    if (!eventType) throw eventTypeNotFound()

    // Мимо сетки или вне окна — это неверный запрос (400), а не занятость (409).
    // Разница важна фронту: на 409 он перезагружает слоты, на 400 — нет, смысла нет.
    if (!isValidStart(start, eventType.durationMinutes, now)) {
      throw validationFailed(
        'Поле «start» должно совпадать с началом свободного слота внутри окна записи',
      )
    }

    // Само пересечение проверяет хранилище: в памяти — синхронно перед вставкой,
    // в Postgres — exclusion-ограничением. Проверять здесь значило бы оставить окно для гонки.
    const booking = await bookings.create({
      eventTypeId,
      startAt: start,
      endAt: addMinutes(start, eventType.durationMinutes),
      guestName,
      guestEmail,
      notes,
    })

    return toBookingDto(booking)
  },
})
