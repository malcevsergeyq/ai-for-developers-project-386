import { describe, it, expect } from 'vitest';

import { toAvailabilityScheduleDto } from '../mappers/availability-schedule.mapper.js';
import { dbScheduleRow, dbRuleRow } from './helpers/fake-availability-schedules-repository.js';

// Через HTTP видно только то, что попало в ответ. Отдельный тест ловит рассинхрон имён
// напрямую: разъехавшееся поле даёт `undefined`, а не ошибку.
describe('toAvailabilityScheduleDto', () => {
  it('переводит правила в поля контракта', () => {
    const dto = toAvailabilityScheduleDto(dbScheduleRow({
      rules: [dbRuleRow({ weekday: 2, start_time: '09:00:00', end_time: '13:00:00' })],
    }));

    expect(dto.rules).toEqual([{ weekday: 2, startTime: '09:00', endTime: '13:00' }]);
  });

  // Postgres отдаёт `time` как `HH:MM:SS`; контракт требует `HH:MM`.
  it('обрезает секунды, которые приходят из типа time', () => {
    const dto = toAvailabilityScheduleDto(dbScheduleRow({
      rules: [dbRuleRow({ start_time: '09:30:00', end_time: '18:00:00' })],
    }));

    expect(dto.rules[0].startTime).toBe('09:30');
    expect(dto.rules[0].endTime).toBe('18:00');
  });

  it('не тащит в правило id и внешний ключ', () => {
    const dto = toAvailabilityScheduleDto(dbScheduleRow({
      rules: [{ ...dbRuleRow(), id: 42 }],
    }));

    expect(Object.keys(dto.rules[0]).sort()).toEqual(['endTime', 'startTime', 'weekday']);
  });

  it('отдаёт ровно поля DTO расписания, без лишних колонок', () => {
    const dto = toAvailabilityScheduleDto({ ...dbScheduleRow(), created_at: '2026-08-09' });

    expect(Object.keys(dto).sort()).toEqual(['id', 'name', 'rules', 'timezone']);
  });

  it('расписание без правил даёт пустой массив, а не undefined', () => {
    const dto = toAvailabilityScheduleDto({ id: 1, name: 'Пусто', timezone: 'UTC' });

    expect(dto.rules).toEqual([]);
  });
});
