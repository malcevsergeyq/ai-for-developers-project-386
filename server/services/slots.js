import { addMinutes, fitsWorkday, listGridStarts, overlaps } from '../time.js'

/**
 * Свободные слоты не хранятся — их незачем хранить: окно записи скользит вместе
 * с текущим моментом, и любая сохранённая копия устареет к следующему запросу.
 *
 * Функция чистая: время подаётся аргументом, а не берётся из `Date.now()`. Иначе тест
 * на «занятый слот исчез из списка» пришлось бы привязывать к дате прогона.
 */
export const generateSlots = ({ durationMinutes, bookings, now }) =>
  listGridStarts(now)
    .filter((start) => fitsWorkday(start, durationMinutes))
    .map((start) => ({ start, end: addMinutes(start, durationMinutes) }))
    .filter(
      ({ start, end }) =>
        !bookings.some((booking) =>
          overlaps(
            start.getTime(),
            end.getTime(),
            booking.startAt.getTime(),
            booking.endAt.getTime(),
          ),
        ),
    )
