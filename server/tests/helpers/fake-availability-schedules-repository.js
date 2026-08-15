import { availabilityScheduleInUse } from '../../errors.js';

/**
 * Заглушка повторяет семантику SQL, а не удобную для теста логику:
 * — время хранится как `HH:MM:SS` (тип `time` в Postgres отдаёт именно так),
 *   поэтому нормализация к `HH:MM` в маппере проверяется по-настоящему;
 * — правила отсортированы `weekday, start_time` — тем же ORDER BY, что и в запросе;
 * — удаление расписания, на которое ссылается тип события, отклоняется, как отклонит его
 *   внешний ключ без CASCADE;
 * — правила удаляются вместе с расписанием (ON DELETE CASCADE).
 *
 * Заглушка, фильтрующая или сортирующая иначе, чем запрос, проверяла бы не то поведение,
 * которое поедет в прод.
 */
export const createFakeAvailabilitySchedulesRepository = (
  schedules = [],
  { usedScheduleIds = [] } = {},
) => {
  const store = schedules.map((schedule) => ({ ...schedule, rules: [...(schedule.rules ?? [])] }));
  const linked = new Set(usedScheduleIds);
  let nextId = Math.max(0, ...store.map((schedule) => schedule.id)) + 1;

  const sortRules = (rules) =>
    [...rules].sort((a, b) =>
      a.weekday - b.weekday || String(a.start_time).localeCompare(String(b.start_time)));

  const read = (schedule) => ({ ...schedule, rules: sortRules(schedule.rules) });

  const toDbRules = (scheduleId, rules) =>
    rules.map((rule) => dbRuleRow({
      availability_schedule_id: scheduleId,
      weekday: rule.weekday,
      start_time: `${rule.startTime}:00`,
      end_time: `${rule.endTime}:00`,
    }));

  return {
    async findAll() {
      return [...store].sort((a, b) => a.id - b.id).map(read);
    },

    async findById(id) {
      const schedule = store.find((row) => row.id === id);
      return schedule ? read(schedule) : null;
    },

    async create({ name, timezone, rules }) {
      const schedule = { id: nextId, name, timezone, rules: toDbRules(nextId, rules) };
      nextId += 1;
      store.push(schedule);
      return read(schedule);
    },

    async update(id, { name, timezone, rules }) {
      const schedule = store.find((row) => row.id === id);
      if (!schedule) return null;

      if (name !== undefined) schedule.name = name;
      if (timezone !== undefined) schedule.timezone = timezone;
      if (rules !== undefined) schedule.rules = toDbRules(id, rules);

      return read(schedule);
    },

    async remove(id) {
      const index = store.findIndex((row) => row.id === id);
      if (index === -1) return false;
      if (linked.has(id)) throw availabilityScheduleInUse();
      store.splice(index, 1);
      return true;
    },
  };
};

export const dbRuleRow = (overrides = {}) => ({
  availability_schedule_id: 3,
  weekday: 1,
  start_time: '09:00:00',
  end_time: '18:00:00',
  ...overrides,
});

export const dbScheduleRow = (overrides = {}) => ({
  id: 3,
  name: 'Рабочая неделя',
  timezone: 'Europe/Moscow',
  rules: [dbRuleRow()],
  ...overrides,
});
