/**
 * Заглушка репозитория, повторяющая семантику SQL: фильтр `hidden = false` применяется
 * при выборке, а не после неё. Если бы заглушка фильтровала иначе, чем запрос,
 * тесты проверяли бы не то поведение, которое будет в проде.
 */
export const createFakeEventTypesRepository = (rows = []) => ({
  async findAllPublic() {
    return rows.filter((row) => row.hidden === false);
  },
  async findPublicBySlug(slug) {
    return rows.find((row) => row.slug === slug && row.hidden === false) ?? null;
  },
});

export const dbRow = (overrides = {}) => ({
  id: 1,
  title: 'Демо-звонок',
  description: 'Знакомство и разбор задачи',
  slug: 'demo-call',
  duration_minutes: 30,
  location: 'https://meet.google.com/xxx',
  availability_schedule_id: 3,
  hidden: false,
  ...overrides,
});
