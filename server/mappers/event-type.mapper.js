/**
 * Единственное место, где snake_case из БД превращается в camelCase контракта.
 * Держать преобразование здесь важно: если оно расползётся по обработчикам, разъехавшиеся
 * имена дадут не ошибку, а тихий `undefined` в ответе.
 */

/**
 * Необязательные поля контракта. Выборка не всегда тащит все колонки (частичные SELECT
 * в списках), а контракт требует, чтобы поля присутствовали всегда — с `null`, а не `undefined`.
 */
const OPTIONAL_DEFAULTS = {
  description: null,
  location: null,
};

const definedOnly = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

export const toEventTypeDto = (row) =>
  Object.assign({}, OPTIONAL_DEFAULTS, definedOnly({
    id: row.id,
    title: row.title,
    description: row.description,
    slug: row.slug,
    durationMinutes: row.duration_minutes,
    location: row.location,
    availabilityScheduleId: row.availability_schedule_id,
    hidden: row.hidden,
  }));
