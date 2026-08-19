/**
 * Единственное место, где доменный объект превращается в тело ответа по контракту.
 * Репозитории (и Postgres, и in-memory) отдают одинаковые доменные объекты с `Date`,
 * а строки ISO появляются только здесь — иначе форматирование расползётся по слоям
 * и разъедется между двумя реализациями хранилища.
 */

export const toEventTypeDto = (eventType) => ({
  id: eventType.id,
  title: eventType.title,
  description: eventType.description,
  durationMinutes: eventType.durationMinutes,
})

export const toBookingDto = (booking) => {
  const dto = {
    id: booking.id,
    eventTypeId: booking.eventTypeId,
    eventTypeTitle: booking.eventTypeTitle,
    start: booking.startAt.toISOString(),
    end: booking.endAt.toISOString(),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    createdAt: booking.createdAt.toISOString(),
  }

  // `notes` в контракте необязательное: пустое значение не отдаём вовсе,
  // а не превращаем в null — фронт типизирован спекой и null не ждёт.
  if (booking.notes) dto.notes = booking.notes

  return dto
}

export const toSlotDto = (slot) => ({
  start: slot.start.toISOString(),
  end: slot.end.toISOString(),
})
