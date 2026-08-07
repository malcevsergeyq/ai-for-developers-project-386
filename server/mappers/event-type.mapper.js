/**
 * Единственное место, где snake_case из БД превращается в camelCase контракта.
 * Держать преобразование здесь важно: если оно расползётся по обработчикам, разъехавшиеся
 * имена дадут не ошибку, а тихий `undefined` в ответе.
 */
export const toEventTypeDto = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  slug: row.slug,
  durationMinutes: row.duration_minutes,
  location: row.location,
  availabilityScheduleId: row.availability_schedule_id,
  hidden: row.hidden,
});
