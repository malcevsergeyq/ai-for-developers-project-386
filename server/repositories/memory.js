import { randomUUID } from 'node:crypto'

import { eventTypeNotFound, slotUnavailable } from '../errors.js'
import { overlaps } from '../time.js'

/**
 * Хранилище в памяти. Нужно не только для тестов: ТЗ прямо разрешает обходиться им,
 * и без базы приложение обязано работать — проверка Hexlet собирает только Dockerfile
 * и запускает контейнер, `DATABASE_URL` там никто не подставит.
 *
 * Интерфейс дословно совпадает с `postgres.js`, поэтому подмена одного другим
 * не видна ни сервисам, ни роутам.
 */
export const createMemoryRepositories = () => {
  const eventTypes = new Map()
  const bookings = []

  const withTitle = (booking) => ({
    ...booking,
    eventTypeTitle: eventTypes.get(booking.eventTypeId)?.title ?? '',
  })

  return {
    eventTypes: {
      async list() {
        return [...eventTypes.values()].sort((a, b) => a.createdAt - b.createdAt)
      },

      async findById(id) {
        return eventTypes.get(id) ?? null
      },

      async create({ title, description, durationMinutes }) {
        const eventType = {
          id: randomUUID(),
          title,
          description,
          durationMinutes,
          createdAt: new Date(),
        }
        eventTypes.set(eventType.id, eventType)
        return eventType
      },

      async count() {
        return eventTypes.size
      },
    },

    bookings: {
      async listFrom(from) {
        return bookings
          .filter((booking) => booking.startAt >= from)
          .sort((a, b) => a.startAt - b.startAt)
          .map(withTitle)
      },

      async listInRange(from, to) {
        return bookings
          .filter((booking) =>
            overlaps(booking.startAt.getTime(), booking.endAt.getTime(), from.getTime(), to.getTime()),
          )
          .map(withTitle)
      },

      /**
       * Проверка занятости и вставка идут подряд без единого `await` — в этом и есть
       * защита от гонки: Node однопоточен, между ними никто не вклинится. В Postgres
       * такой трюк не работает (несколько процессов), там ту же роль играет
       * exclusion-ограничение в схеме.
       */
      async create({ eventTypeId, startAt, endAt, guestName, guestEmail, notes }) {
        const eventType = eventTypes.get(eventTypeId)
        if (!eventType) throw eventTypeNotFound()

        const conflict = bookings.some((booking) =>
          overlaps(booking.startAt.getTime(), booking.endAt.getTime(), startAt.getTime(), endAt.getTime()),
        )
        if (conflict) throw slotUnavailable()

        const booking = {
          id: randomUUID(),
          eventTypeId,
          startAt,
          endAt,
          guestName,
          guestEmail,
          notes: notes ?? null,
          createdAt: new Date(),
        }
        bookings.push(booking)
        return withTitle(booking)
      },
    },
  }
}
