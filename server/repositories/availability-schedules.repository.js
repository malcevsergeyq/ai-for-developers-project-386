import { availabilityScheduleInUse } from '../errors.js';

const SCHEDULE_COLUMNS = 'id, name, timezone';
const RULE_COLUMNS = 'availability_schedule_id, weekday, start_time, end_time';

/** Отказ Postgres по внешнему ключу: `foreign_key_violation`. */
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Правила лежат отдельной таблицей, а контракт отдаёт расписание вместе с ними.
 * Догрузка одним запросом на всю выборку, а не по запросу на расписание: список
 * из N расписаний иначе превращается в N+1 обращений к базе.
 */
const attachRules = async (executor, scheduleRows) => {
  if (scheduleRows.length === 0) return [];

  const { rows } = await executor.query(
    `SELECT ${RULE_COLUMNS} FROM schedule_rules
     WHERE availability_schedule_id = ANY($1::int[])
     ORDER BY weekday, start_time`,
    [scheduleRows.map((row) => row.id)],
  );

  const byScheduleId = new Map(scheduleRows.map((row) => [row.id, []]));
  for (const rule of rows) {
    byScheduleId.get(rule.availability_schedule_id).push(rule);
  }

  return scheduleRows.map((row) => ({ ...row, rules: byScheduleId.get(row.id) }));
};

/**
 * Многострочная вставка одним запросом: правил у расписания до нескольких десятков,
 * и делать на каждое отдельный round-trip внутри транзакции незачем.
 */
const insertRules = async (client, scheduleId, rules) => {
  if (rules.length === 0) return;

  const placeholders = rules.map(
    (_rule, index) => `($1, $${index * 3 + 2}, $${index * 3 + 3}, $${index * 3 + 4})`,
  );
  const params = rules.flatMap((rule) => [rule.weekday, rule.startTime, rule.endTime]);

  await client.query(
    `INSERT INTO schedule_rules (availability_schedule_id, weekday, start_time, end_time)
     VALUES ${placeholders.join(', ')}`,
    [scheduleId, ...params],
  );
};

/**
 * Расписание и его правила меняются только вместе, поэтому запись идёт в транзакции:
 * иначе сбой на вставке правил оставил бы расписание без окон доступности.
 */
const inTransaction = async (pool, work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const createAvailabilitySchedulesRepository = (pool) => ({
  async findAll() {
    const { rows } = await pool.query(
      `SELECT ${SCHEDULE_COLUMNS} FROM availability_schedules ORDER BY id`,
    );
    return attachRules(pool, rows);
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${SCHEDULE_COLUMNS} FROM availability_schedules WHERE id = $1`,
      [id],
    );
    const [row] = await attachRules(pool, rows);
    return row ?? null;
  },

  async create({ name, timezone, rules }) {
    return inTransaction(pool, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO availability_schedules (name, timezone)
         VALUES ($1, $2) RETURNING ${SCHEDULE_COLUMNS}`,
        [name, timezone],
      );
      await insertRules(client, rows[0].id, rules);
      // Правила читаются обратно, а не собираются из входа: порядок и формат времени
      // в ответе тогда те же, что и при последующих чтениях.
      const [created] = await attachRules(client, rows);
      return created;
    });
  },

  /**
   * Возвращает `null`, если расписания нет, — «не найдено» решает сервис.
   * `rules === undefined` означает «правила не трогаем», `rules: []` — «стереть все».
   */
  async update(id, { name, timezone, rules }) {
    return inTransaction(pool, async (client) => {
      // FOR UPDATE держит строку до конца транзакции: параллельный PATCH не сможет
      // вклиниться между заменой правил и чтением результата.
      const existing = await client.query(
        `SELECT ${SCHEDULE_COLUMNS} FROM availability_schedules WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (existing.rows.length === 0) return null;

      const { rows } = await client.query(
        `UPDATE availability_schedules
         SET name = COALESCE($2, name), timezone = COALESCE($3, timezone)
         WHERE id = $1 RETURNING ${SCHEDULE_COLUMNS}`,
        [id, name ?? null, timezone ?? null],
      );

      if (rules !== undefined) {
        await client.query('DELETE FROM schedule_rules WHERE availability_schedule_id = $1', [id]);
        await insertRules(client, id, rules);
      }

      const [updated] = await attachRules(client, rows);
      return updated;
    });
  },

  /**
   * Проверка «есть ли связанные типы событий» отдельным SELECT была бы гонкой:
   * между проверкой и удалением тип события может появиться. Поэтому удаление просто
   * пробуется, а отказ внешнего ключа переводится в ошибку контракта. Перевод живёт
   * в репозитории, потому что код `23503` — деталь драйвера, и выше ей делать нечего.
   */
  async remove(id) {
    try {
      const { rowCount } = await pool.query('DELETE FROM availability_schedules WHERE id = $1', [
        id,
      ]);
      return rowCount > 0;
    } catch (err) {
      if (err.code === FOREIGN_KEY_VIOLATION) throw availabilityScheduleInUse();
      throw err;
    }
  },
});
