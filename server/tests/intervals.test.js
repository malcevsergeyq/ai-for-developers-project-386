import { describe, it, expect } from 'vitest';

import { isTimeString, toMinutes, overlaps } from '../services/intervals.js';

// Эту функцию переиспользуют правила расписания, генерация слотов и создание брони.
// Ошибка здесь тихо расходится по трём местам сразу, поэтому проверяется отдельно.
describe('overlaps', () => {
  it('стык впритык пересечением не считается', () => {
    expect(overlaps(9 * 60, 13 * 60, 13 * 60, 18 * 60)).toBe(false);
  });

  it('частичное наложение — пересечение', () => {
    expect(overlaps(9 * 60, 14 * 60, 13 * 60, 18 * 60)).toBe(true);
  });

  it('вложенный интервал — пересечение', () => {
    expect(overlaps(10 * 60, 11 * 60, 9 * 60, 18 * 60)).toBe(true);
  });

  it('порядок аргументов не меняет результат', () => {
    expect(overlaps(9 * 60, 14 * 60, 13 * 60, 18 * 60))
      .toBe(overlaps(13 * 60, 18 * 60, 9 * 60, 14 * 60));
  });

  it('непересекающиеся интервалы с зазором', () => {
    expect(overlaps(9 * 60, 10 * 60, 11 * 60, 12 * 60)).toBe(false);
  });
});

describe('toMinutes', () => {
  it('переводит HH:MM в минуты от полуночи', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });
});

describe('isTimeString', () => {
  it.each(['00:00', '09:05', '23:59'])('принимает %s', (value) => {
    expect(isTimeString(value)).toBe(true);
  });

  it.each(['9:00', '09:60', '24:00', '09:00:00', '', '0900', null, 900])(
    'отклоняет %s',
    (value) => {
      expect(isTimeString(value)).toBe(false);
    },
  );
});
