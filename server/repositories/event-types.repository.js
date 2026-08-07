const PUBLIC_COLUMNS = `
  id, title, description, slug, duration_minutes, location,
  availability_schedule_id, hidden
`;

/**
 * Репозиторий держит SQL и только SQL: ни правил доступа, ни формата ответа.
 * Принимает пул снаружи, чтобы тесты могли подставить свой источник данных.
 */
export const createEventTypesRepository = (pool) => ({
  async findAllPublic() {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM event_types WHERE hidden = false ORDER BY id`,
    );
    return rows;
  },

  /**
   * Фильтр `hidden = false` живёт прямо в запросе, а не в проверке после выборки:
   * тогда скрытый тип события неотличим от несуществующего на уровне данных,
   * а не только на уровне ответа.
   */
  async findPublicBySlug(slug) {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM event_types WHERE slug = $1 AND hidden = false`,
      [slug],
    );
    return rows[0] ?? null;
  },
});
