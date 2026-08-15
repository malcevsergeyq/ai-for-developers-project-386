import { eventTypeNotFound } from '../errors.js';
import { toEventTypeDto } from '../mappers/event-type.mapper.js';

/**
 * Публичный список типов событий меняется редко, а фронт запрашивает его на каждой странице
 * бронирования. Короткий кэш снимает повторные обращения к базе, не заметно устаревая.
 */
const LIST_CACHE_TTL_MS = 30_000;

/**
 * Слой правил предметной области. Для типов событий правило пока одно — публично видно
 * только `hidden: false`, — но слой существует с первого эндпоинта, чтобы следующим правилам
 * (пересечение интервалов, переходы статусов) было куда лечь без переноса кода между слоями.
 */
export const createEventTypesService = (eventTypesRepository) => {
  let listCache = null;

  return {
    async listPublic() {
      if (listCache && Date.now() - listCache.storedAt < LIST_CACHE_TTL_MS) {
        return listCache.value;
      }

      const rows = await eventTypesRepository.findAllPublic();
      const value = rows.map(toEventTypeDto);
      listCache = { storedAt: Date.now(), value };
      return value;
    },

    async getPublicBySlug(slug) {
      const row = await eventTypesRepository.findPublicBySlug(slug);
      if (!row) throw eventTypeNotFound();
      return toEventTypeDto(row);
    },
  };
};
