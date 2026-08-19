import { eventTypeNotFound, slotUnavailable } from '../errors.js'

/**
 * Репозиторий держит SQL и только SQL: ни правил предметной области, ни формата ответа.
 * Наружу отдаёт доменные объекты с `Date` — ровно те же, что и `memory.js`,
 * поэтому snake_case базы дальше репозитория не уходит.
 *
 * ВНИМАНИЕ: этот код ни разу не исполнялся против живой базы (Postgres в проекте
 * пока не поднят). Тесты идут на in-memory-хранилище и корректность SQL не подтверждают.
 */

const EVENT_TYPE_COLUMNS = 'id, title, description, duration_minutes, created_at'

const toEventType = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  durationMinutes: row.duration_minutes,
  createdAt: row.created_at,
})

const toBooking = (row) => ({
  id: row.id,
  eventTypeId: row.event_type_id,
  eventTypeTitle: row.event_type_title,
  startAt: row.start_at,
  endAt: row.end_at,
  guestName: row.guest_name,
  guestEmail: row.guest_email,
  notes: row.notes,
  createdAt: row.created_at,
})

const BOOKING_SELECT = `
  SELECT b.id, b.event_type_id, e.title AS event_type_title,
         b.start_at, b.end_at, b.guest_name, b.guest_email, b.notes, b.created_at
  FROM bookings b
  JOIN event_types e ON e.id = b.event_type_id
`

export const createPostgresRepositories = (pool) => ({
  eventTypes: {
    async list() {
      const { rows } = await pool.query(
        `SELECT ${EVENT_TYPE_COLUMNS} FROM event_types ORDER BY created_at`,
      )
      return rows.map(toEventType)
    },

    async findById(id) {
      // Приведение к тексту вместо `= $1::uuid`: клиент присылает произвольную строку,
      // и невалидный uuid должен дать 404, а не ошибку типа Postgres (22P02 → 500).
      const { rows } = await pool.query(
        `SELECT ${EVENT_TYPE_COLUMNS} FROM event_types WHERE id::text = $1`,
        [id],
      )
      return rows[0] ? toEventType(rows[0]) : null
    },

    async create({ title, description, durationMinutes }) {
      const { rows } = await pool.query(
        `INSERT INTO event_types (title, description, duration_minutes)
         VALUES ($1, $2, $3)
         RETURNING ${EVENT_TYPE_COLUMNS}`,
        [title, description, durationMinutes],
      )
      return toEventType(rows[0])
    },

    async count() {
      const { rows } = await pool.query('SELECT count(*)::int AS count FROM event_types')
      return rows[0].count
    },
  },

  bookings: {
    async listFrom(from) {
      const { rows } = await pool.query(
        `${BOOKING_SELECT} WHERE b.start_at >= $1 ORDER BY b.start_at`,
        [from],
      )
      return rows.map(toBooking)
    },

    async listInRange(from, to) {
      const { rows } = await pool.query(
        `${BOOKING_SELECT}
         WHERE tstzrange(b.start_at, b.end_at, '[)') && tstzrange($1, $2, '[)')
         ORDER BY b.start_at`,
        [from, to],
      )
      return rows.map(toBooking)
    },

    /**
     * Занятость держит сама СУБД: exclusion-ограничение `bookings_no_overlap` отвергает
     * пересекающиеся интервалы. Проверка `SELECT` перед `INSERT` оставила бы окно для гонки
     * между двумя процессами бэка — в отличие от in-memory, здесь однопоточность Node не спасает.
     */
    async create({ eventTypeId, startAt, endAt, guestName, guestEmail, notes }) {
      try {
        const { rows } = await pool.query(
          `WITH inserted AS (
             INSERT INTO bookings (event_type_id, start_at, end_at, guest_name, guest_email, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *
           )
           SELECT i.id, i.event_type_id, e.title AS event_type_title,
                  i.start_at, i.end_at, i.guest_name, i.guest_email, i.notes, i.created_at
           FROM inserted i
           JOIN event_types e ON e.id = i.event_type_id`,
          [eventTypeId, startAt, endAt, guestName, guestEmail, notes ?? null],
        )
        return toBooking(rows[0])
      } catch (cause) {
        // 23P01 — exclusion_violation: интервал пересёкся с уже существующей бронью.
        if (cause.code === '23P01') throw slotUnavailable()
        // 23503 — foreign_key_violation: тип встречи удалили между проверкой и вставкой.
        // 22P02 — invalid_text_representation: клиент прислал не-uuid в `eventTypeId`.
        if (cause.code === '23503' || cause.code === '22P02') throw eventTypeNotFound()
        throw cause
      }
    },
  },
})
