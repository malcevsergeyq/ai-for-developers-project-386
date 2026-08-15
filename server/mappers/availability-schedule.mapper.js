/**
 * snake_case базы → camelCase контракта для AvailabilitySchedule.
 * Как и у типов событий, преобразование живёт только здесь: разъехавшееся имя даёт
 * не ошибку, а тихий `undefined` в ответе.
 */

/**
 * Postgres отдаёт колонку `time` строкой `HH:MM:SS`, а контракт требует `HH:MM`.
 * Обрезка живёт в маппере, а не в SQL: тогда формат времени в ответе задаётся одним местом,
 * а не повторяется в каждом запросе через `to_char`.
 */
const toHhMm = (value) => String(value).slice(0, 5);

/**
 * У правила нет собственного `id` в контракте: набор правил адресуется только через
 * расписание и заменяется целиком, поэтому идентификатор строки наружу не выходит.
 */
const toScheduleRuleDto = (row) => ({
  weekday: row.weekday,
  startTime: toHhMm(row.start_time),
  endTime: toHhMm(row.end_time),
});

export const toAvailabilityScheduleDto = (row) => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  rules: (row.rules ?? []).map(toScheduleRuleDto),
});
