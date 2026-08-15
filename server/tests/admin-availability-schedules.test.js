import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { createApp } from '../app.js';
import { createFakeEventTypesRepository } from './helpers/fake-event-types-repository.js';
import {
  createFakeAvailabilitySchedulesRepository,
  dbScheduleRow,
  dbRuleRow,
} from './helpers/fake-availability-schedules-repository.js';

const appWith = (schedules = [], options) =>
  createApp({
    eventTypesRepository: createFakeEventTypesRepository([]),
    availabilitySchedulesRepository: createFakeAvailabilitySchedulesRepository(schedules, options),
  });

const BASE = '/api/admin/availability-schedules';

// Состав полей берётся из контракта, а не из текущего кода: лишнее поле в ответе
// тест обязан поймать, иначе фронт получит то, чего не ждёт.
const CONTRACT_FIELDS = ['id', 'name', 'timezone', 'rules'];

const validPayload = (overrides = {}) => ({
  name: 'Рабочая неделя',
  timezone: 'Europe/Moscow',
  rules: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
  ...overrides,
});

describe('GET /api/admin/availability-schedules', () => {
  describe('happy path', () => {
    it('отдаёт список расписаний с правилами', async () => {
      const app = appWith([
        dbScheduleRow({ id: 1, name: 'Рабочая неделя' }),
        dbScheduleRow({ id: 2, name: 'Выходные', rules: [] }),
      ]);

      const res = await request(app).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body.map((s) => s.name)).toEqual(['Рабочая неделя', 'Выходные']);
      expect(res.body[0].rules).toEqual([{ weekday: 1, startTime: '09:00', endTime: '18:00' }]);
    });

    it('отдаёт ровно поля DTO из контракта, без лишних', async () => {
      const res = await request(appWith([dbScheduleRow()])).get(BASE);

      expect(Object.keys(res.body[0]).sort()).toEqual([...CONTRACT_FIELDS].sort());
    });

    it('пустой список — это пустой массив, а не ошибка', async () => {
      const res = await request(appWith([])).get(BASE);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('граничные случаи', () => {
    // Админский контур видит всё: фильтра публичности у расписаний нет в принципе.
    it('правила приходят отсортированными по weekday и времени', async () => {
      const app = appWith([dbScheduleRow({
        rules: [
          dbRuleRow({ weekday: 2, start_time: '09:00:00', end_time: '13:00:00' }),
          dbRuleRow({ weekday: 1, start_time: '14:00:00', end_time: '18:00:00' }),
          dbRuleRow({ weekday: 1, start_time: '09:00:00', end_time: '13:00:00' }),
        ],
      })]);

      const res = await request(app).get(BASE);

      expect(res.body[0].rules).toEqual([
        { weekday: 1, startTime: '09:00', endTime: '13:00' },
        { weekday: 1, startTime: '14:00', endTime: '18:00' },
        { weekday: 2, startTime: '09:00', endTime: '13:00' },
      ]);
    });
  });
});

describe('GET /api/admin/availability-schedules/:id', () => {
  describe('happy path', () => {
    it('отдаёт расписание по id', async () => {
      const res = await request(appWith([dbScheduleRow({ id: 3 })])).get(`${BASE}/3`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(3);
      expect(Object.keys(res.body).sort()).toEqual([...CONTRACT_FIELDS].sort());
    });
  });

  describe('ошибки', () => {
    it('несуществующий id → 404 availability_schedule_not_found', async () => {
      const res = await request(appWith([dbScheduleRow({ id: 3 })])).get(`${BASE}/999`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('availability_schedule_not_found');
    });

    it('ошибка отдаётся в формате { error, message }', async () => {
      const res = await request(appWith([])).get(`${BASE}/1`);

      expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('граничные случаи', () => {
    it('нечисловой id — это не существующая запись, а не 500', async () => {
      const res = await request(appWith([dbScheduleRow()])).get(`${BASE}/abc`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('availability_schedule_not_found');
    });

    it('id вида 3abc не считается расписанием №3', async () => {
      const res = await request(appWith([dbScheduleRow({ id: 3 })])).get(`${BASE}/3abc`);

      expect(res.status).toBe(404);
    });
  });
});

describe('POST /api/admin/availability-schedules', () => {
  describe('happy path', () => {
    it('создаёт расписание и отдаёт 201 с DTO контракта', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload());

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual([...CONTRACT_FIELDS].sort());
      expect(res.body.name).toBe('Рабочая неделя');
      expect(res.body.rules).toEqual([{ weekday: 1, startTime: '09:00', endTime: '18:00' }]);
    });

    it('созданное расписание сразу читается по своему id', async () => {
      const app = appWith([]);

      const created = await request(app).post(BASE).send(validPayload());
      const read = await request(app).get(`${BASE}/${created.body.id}`);

      expect(read.status).toBe(200);
      expect(read.body).toEqual(created.body);
    });

    it('срезает окружающие пробелы у name', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({ name: '  Неделя  ' }));

      expect(res.body.name).toBe('Неделя');
    });
  });

  describe('ошибки', () => {
    it.each([
      ['без name', { timezone: 'UTC', rules: [] }],
      ['без timezone', { name: 'X', rules: [] }],
      ['без rules', { name: 'X', timezone: 'UTC' }],
    ])('%s → 400 validation_error', async (_case, body) => {
      const res = await request(appWith([])).post(BASE).send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it.each([
      ['пустой name', validPayload({ name: '   ' })],
      ['name не строка', validPayload({ name: 42 })],
      ['неизвестная таймзона', validPayload({ timezone: 'Europe/Atlantis' })],
      ['offset вместо IANA-имени', validPayload({ timezone: '+03:00' })],
      ['rules не массив', validPayload({ rules: {} })],
      ['weekday вне 1..7', validPayload({ rules: [{ weekday: 0, startTime: '09:00', endTime: '10:00' }] })],
      ['weekday дробный', validPayload({ rules: [{ weekday: 1.5, startTime: '09:00', endTime: '10:00' }] })],
      ['время с секундами', validPayload({ rules: [{ weekday: 1, startTime: '09:00:00', endTime: '10:00' }] })],
      ['несуществующее время', validPayload({ rules: [{ weekday: 1, startTime: '25:00', endTime: '26:00' }] })],
      ['startTime === endTime', validPayload({ rules: [{ weekday: 1, startTime: '09:00', endTime: '09:00' }] })],
      ['startTime позже endTime', validPayload({ rules: [{ weekday: 1, startTime: '18:00', endTime: '09:00' }] })],
      ['лишнее поле в правиле', validPayload({ rules: [{ weekday: 1, startTime: '09:00', endTime: '10:00', id: 7 }] })],
    ])('%s → 400 validation_error', async (_case, body) => {
      const res = await request(appWith([])).post(BASE).send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('неизвестное поле в теле → 400, а не молчаливое игнорирование', async () => {
      const res = await request(appWith([]))
        .post(BASE)
        .send({ ...validPayload(), timeZone: 'UTC' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('timeZone');
    });

    it('битый JSON → 400 invalid_json, а не 500', async () => {
      const res = await request(appWith([]))
        .post(BASE)
        .set('Content-Type', 'application/json')
        .send('{ "name": ');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_json');
    });
  });

  describe('граничные случаи', () => {
    // Пустой набор правил — легальное промежуточное состояние: расписание есть, окон нет.
    it('пустой rules допустим и означает расписание без окон', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({ rules: [] }));

      expect(res.status).toBe(201);
      expect(res.body.rules).toEqual([]);
    });

    it('соседние окна впритык пересечением не считаются', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({
        rules: [
          { weekday: 1, startTime: '09:00', endTime: '13:00' },
          { weekday: 1, startTime: '13:00', endTime: '18:00' },
        ],
      }));

      expect(res.status).toBe(201);
      expect(res.body.rules).toHaveLength(2);
    });

    it('пересекающиеся окна одного дня → 400', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({
        rules: [
          { weekday: 1, startTime: '09:00', endTime: '14:00' },
          { weekday: 1, startTime: '13:00', endTime: '18:00' },
        ],
      }));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('одинаковые интервалы в разные дни недели не пересекаются', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({
        rules: [
          { weekday: 1, startTime: '09:00', endTime: '18:00' },
          { weekday: 2, startTime: '09:00', endTime: '18:00' },
        ],
      }));

      expect(res.status).toBe(201);
    });

    it('правила в ответе отсортированы независимо от порядка в запросе', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({
        rules: [
          { weekday: 3, startTime: '10:00', endTime: '11:00' },
          { weekday: 1, startTime: '14:00', endTime: '15:00' },
          { weekday: 1, startTime: '09:00', endTime: '10:00' },
        ],
      }));

      expect(res.body.rules.map((r) => [r.weekday, r.startTime])).toEqual([
        [1, '09:00'], [1, '14:00'], [3, '10:00'],
      ]);
    });

    it('границы суток 00:00 и 23:59 допустимы', async () => {
      const res = await request(appWith([])).post(BASE).send(validPayload({
        rules: [{ weekday: 7, startTime: '00:00', endTime: '23:59' }],
      }));

      expect(res.status).toBe(201);
    });
  });
});

describe('PATCH /api/admin/availability-schedules/:id', () => {
  describe('happy path', () => {
    it('меняет только переданное поле', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })]);

      const res = await request(app).patch(`${BASE}/3`).send({ name: 'Новое имя' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Новое имя');
      expect(res.body.timezone).toBe('Europe/Moscow');
      expect(res.body.rules).toEqual([{ weekday: 1, startTime: '09:00', endTime: '18:00' }]);
    });

    it('переданный rules заменяет весь набор правил, а не дополняет его', async () => {
      const app = appWith([dbScheduleRow({
        id: 3,
        rules: [
          dbRuleRow({ weekday: 1 }),
          dbRuleRow({ weekday: 2 }),
        ],
      })]);

      const res = await request(app)
        .patch(`${BASE}/3`)
        .send({ rules: [{ weekday: 5, startTime: '10:00', endTime: '12:00' }] });

      expect(res.body.rules).toEqual([{ weekday: 5, startTime: '10:00', endTime: '12:00' }]);
    });

    it('пустой rules стирает все окна доступности', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })]);

      const res = await request(app).patch(`${BASE}/3`).send({ rules: [] });

      expect(res.status).toBe(200);
      expect(res.body.rules).toEqual([]);
    });
  });

  describe('ошибки', () => {
    it('несуществующий id → 404 availability_schedule_not_found', async () => {
      const res = await request(appWith([])).patch(`${BASE}/999`).send({ name: 'X' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('availability_schedule_not_found');
    });

    it('пустое тело → 400 validation_error', async () => {
      const res = await request(appWith([dbScheduleRow({ id: 3 })])).patch(`${BASE}/3`).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('невалидное правило → 400 validation_error', async () => {
      const res = await request(appWith([dbScheduleRow({ id: 3 })]))
        .patch(`${BASE}/3`)
        .send({ rules: [{ weekday: 8, startTime: '09:00', endTime: '10:00' }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  describe('граничные случаи', () => {
    it('изменения видны при следующем чтении', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })]);

      await request(app).patch(`${BASE}/3`).send({ timezone: 'Asia/Tbilisi' });
      const res = await request(app).get(`${BASE}/3`);

      expect(res.body.timezone).toBe('Asia/Tbilisi');
    });

    it('невалидное тело не применяется частично', async () => {
      const app = appWith([dbScheduleRow({ id: 3, name: 'Рабочая неделя' })]);

      await request(app)
        .patch(`${BASE}/3`)
        .send({ name: 'Новое имя', timezone: 'Europe/Atlantis' });
      const res = await request(app).get(`${BASE}/3`);

      expect(res.body.name).toBe('Рабочая неделя');
    });
  });
});

describe('DELETE /api/admin/availability-schedules/:id', () => {
  describe('happy path', () => {
    it('удаляет расписание и отдаёт 204 без тела', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })]);

      const res = await request(app).delete(`${BASE}/3`);

      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
      expect((await request(app).get(`${BASE}/3`)).status).toBe(404);
    });
  });

  describe('ошибки', () => {
    it('несуществующий id → 404 availability_schedule_not_found', async () => {
      const res = await request(appWith([])).delete(`${BASE}/999`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('availability_schedule_not_found');
    });

    // Правило 11 контракта: удаление запрещено, пока на расписании висят типы событий.
    it('расписание, занятое типом события → 409 availability_schedule_in_use', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })], { usedScheduleIds: [3] });

      const res = await request(app).delete(`${BASE}/3`);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('availability_schedule_in_use');
    });
  });

  describe('граничные случаи', () => {
    it('отказ по 409 не удаляет расписание', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })], { usedScheduleIds: [3] });

      await request(app).delete(`${BASE}/3`);

      expect((await request(app).get(`${BASE}/3`)).status).toBe(200);
    });

    it('повторное удаление → 404, а не 204', async () => {
      const app = appWith([dbScheduleRow({ id: 3 })]);

      await request(app).delete(`${BASE}/3`);
      const res = await request(app).delete(`${BASE}/3`);

      expect(res.status).toBe(404);
    });
  });
});
