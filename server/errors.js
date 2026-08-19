/**
 * Ошибки API в формате контракта: `{ error: "machine_code", message: "русское описание" }`.
 * `error` читает фронт, `message` читает человек.
 *
 * Коды сверены со `spec/main.tsp`: любой новый код сначала попадает в контракт,
 * потом сюда, иначе фронт получит строку, которой нет в его типах.
 */
export class HttpError extends Error {
  constructor(status, error, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.error = error
  }
}

export const validationFailed = (message) => new HttpError(400, 'validation_failed', message)

export const eventTypeNotFound = () =>
  new HttpError(404, 'event_type_not_found', 'Тип встречи не найден')

/**
 * Пересечение с существующей бронью — в том числе бронью другого типа встречи:
 * занятость по контракту глобальная, а не в рамках одного типа.
 */
export const slotUnavailable = () =>
  new HttpError(409, 'slot_unavailable', 'Это время уже занято, выберите другой слот')

/** Путь, которого нет в контракте. Отвечаем тем же телом, а не HTML-страницей Express. */
export const routeNotFound = () => new HttpError(404, 'not_found', 'Такого эндпоинта нет')
