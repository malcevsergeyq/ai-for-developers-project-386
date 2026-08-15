/**
 * Ошибки API в формате контракта: { error: "machine_code", message: "русское описание" }.
 * `error` читает фронт, `message` читает человек.
 */
export class HttpError extends Error {
  constructor(status, error, message) {
    super(message);
    this.status = status;
    this.error = error;
  }
}

export const eventTypeNotFound = () =>
  new HttpError(404, 'event_type_not_found', 'Тип события не найден');

export const availabilityScheduleNotFound = () =>
  new HttpError(404, 'availability_schedule_not_found', 'Расписание доступности не найдено');

/**
 * Удаление расписания, на которое ссылаются типы событий, запрещает сама БД
 * (`REFERENCES` без `CASCADE`). Здесь только перевод отказа в код контракта.
 */
export const availabilityScheduleInUse = () =>
  new HttpError(
    409,
    'availability_schedule_in_use',
    'Расписание используется типами событий и не может быть удалено',
  );

/**
 * Правило 12 контракта: один email — одна активная бронь на дату, по всем типам событий.
 * Источник отказа — партиальный уникальный индекс `bookings_active_email_day_uniq`.
 * Он даёт тот же `23505`, что и `bookings_active_slot_uniq` (`slot_taken`), поэтому
 * при вставке брони две ошибки различаются по имени ограничения (`err.constraint`),
 * а не по коду SQLSTATE.
 */
export const emailAlreadyBooked = () =>
  new HttpError(
    409,
    'email_already_booked',
    'На этот email уже есть активная бронь на выбранный день',
  );

export const validationError = (message) => new HttpError(400, 'validation_error', message);

export const invalidJson = () =>
  new HttpError(400, 'invalid_json', 'Тело запроса не является корректным JSON');
