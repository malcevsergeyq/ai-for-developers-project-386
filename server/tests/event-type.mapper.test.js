import { describe, it, expect } from 'vitest';

import { toEventTypeDto } from '../mappers/event-type.mapper.js';
import { dbRow } from './helpers/fake-event-types-repository.js';

// Через HTTP видно только то, что попало в ответ. Отдельный тест маппера ловит рассинхрон
// имён напрямую: разъехавшееся поле даёт `undefined`, а не ошибку, и через эндпоинт
// такую потерю легко не заметить.
describe('toEventTypeDto', () => {
  it('переименовывает поля базы в имена контракта', () => {
    const dto = toEventTypeDto(dbRow({ duration_minutes: 30, availability_schedule_id: 3 }));

    expect(dto.durationMinutes).toBe(30);
    expect(dto.availabilityScheduleId).toBe(3);
  });

  it('не пропускает наружу поля с именами базы', () => {
    const dto = toEventTypeDto(dbRow());

    expect(dto).not.toHaveProperty('duration_minutes');
    expect(dto).not.toHaveProperty('availability_schedule_id');
  });

  it('не тащит в DTO колонки, которых нет в контракте', () => {
    const dto = toEventTypeDto({ ...dbRow(), created_at: '2026-08-07T10:00:00Z', internal_note: 'x' });

    expect(Object.keys(dto).sort()).toEqual([
      'availabilityScheduleId', 'description', 'durationMinutes',
      'hidden', 'id', 'location', 'slug', 'title',
    ]);
  });

  it('сохраняет null в необязательных полях, а не подменяет пустой строкой', () => {
    const dto = toEventTypeDto(dbRow({ description: null, location: null }));

    expect(dto.description).toBeNull();
    expect(dto.location).toBeNull();
  });

  it('не возвращает один и тот же объект для разных строк', () => {
    const first = toEventTypeDto(dbRow({ id: 1, slug: 'demo-call' }));
    const second = toEventTypeDto(dbRow({ id: 2, slug: 'intro' }));

    expect(first).not.toBe(second);
    expect(first.slug).toBe('demo-call');
    expect(second.slug).toBe('intro');
  });
});
