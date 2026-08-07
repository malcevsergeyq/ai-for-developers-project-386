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
