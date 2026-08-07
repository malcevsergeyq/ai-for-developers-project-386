import { eventTypeNotFound } from '../errors.js';
import { toEventTypeDto } from '../mappers/event-type.mapper.js';

/**
 * Слой правил предметной области. Для типов событий правило пока одно — публично видно
 * только `hidden: false`, — но слой существует с первого эндпоинта, чтобы следующим правилам
 * (пересечение интервалов, переходы статусов) было куда лечь без переноса кода между слоями.
 */
export const createEventTypesService = (eventTypesRepository) => ({
  async listPublic() {
    const rows = await eventTypesRepository.findAllPublic();
    return rows.map(toEventTypeDto);
  },

  async getPublicBySlug(slug) {
    const row = await eventTypesRepository.findPublicBySlug(slug);
    if (!row) throw eventTypeNotFound();
    return toEventTypeDto(row);
  },
});
