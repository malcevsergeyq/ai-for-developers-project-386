import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { createApp } from '../app.js';
import { createFakeEventTypesRepository, dbRow } from './helpers/fake-event-types-repository.js';

const appWith = (rows) =>
  createApp({ eventTypesRepository: createFakeEventTypesRepository(rows) });

// Состав полей берётся из контракта, а не из текущего кода: если реализация начнёт отдавать
// лишнее поле, тест должен это поймать — иначе фронт получит то, чего не ждёт.
const CONTRACT_FIELDS = [
  'id', 'title', 'description', 'slug',
  'durationMinutes', 'location', 'availabilityScheduleId', 'hidden',
];

describe('GET /api/public/event-types', () => {
  describe('happy path', () => {
    it('отдаёт список публичных типов событий', async () => {
      const app = appWith([
        dbRow({ id: 1, slug: 'demo-call' }),
        dbRow({ id: 2, slug: 'intro', title: 'Знакомство' }),
      ]);

      const res = await request(app).get('/api/public/event-types');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((e) => e.slug)).toEqual(['demo-call', 'intro']);
    });

    it('отдаёт ровно поля DTO из контракта, без лишних', async () => {
      const app = appWith([dbRow()]);

      const res = await request(app).get('/api/public/event-types');

      expect(Object.keys(res.body[0]).sort()).toEqual([...CONTRACT_FIELDS].sort());
    });

    it('пустой список — это пустой массив, а не ошибка', async () => {
      const res = await request(appWith([])).get('/api/public/event-types');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('правила публичности', () => {
    it('скрытые типы событий в список не попадают', async () => {
      const app = appWith([
        dbRow({ id: 1, slug: 'visible' }),
        dbRow({ id: 2, slug: 'secret', hidden: true }),
      ]);

      const res = await request(app).get('/api/public/event-types');

      expect(res.body.map((e) => e.slug)).toEqual(['visible']);
    });
  });
});

describe('GET /api/public/event-types/:slug', () => {
  describe('happy path', () => {
    it('отдаёт тип события по slug', async () => {
      const app = appWith([dbRow({ slug: 'demo-call', title: 'Демо-звонок' })]);

      const res = await request(app).get('/api/public/event-types/demo-call');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Демо-звонок');
      expect(Object.keys(res.body).sort()).toEqual([...CONTRACT_FIELDS].sort());
    });

    it('переводит snake_case базы в camelCase контракта', async () => {
      const app = appWith([dbRow({ duration_minutes: 45, availability_schedule_id: 7 })]);

      const res = await request(app).get('/api/public/event-types/demo-call');

      expect(res.body.durationMinutes).toBe(45);
      expect(res.body.availabilityScheduleId).toBe(7);
      expect(res.body).not.toHaveProperty('duration_minutes');
    });
  });

  describe('ошибки', () => {
    it('несуществующий slug → 404 event_type_not_found', async () => {
      const res = await request(appWith([dbRow()])).get('/api/public/event-types/no-such-slug');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('event_type_not_found');
    });

    it('ошибка отдаётся в формате { error, message }', async () => {
      const res = await request(appWith([])).get('/api/public/event-types/whatever');

      expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('граничные случаи', () => {
    // Тот же приём, что и с бронями (правило 7 контракта): скрытый тип события не должен
    // отличаться в ответе от несуществующего, иначе перебором slug'ов видно, что скрыто.
    it('скрытый и несуществующий slug дают неотличимые ответы', async () => {
      const app = appWith([dbRow({ slug: 'secret', hidden: true })]);

      const hidden = await request(app).get('/api/public/event-types/secret');
      const missing = await request(app).get('/api/public/event-types/never-existed');

      expect(hidden.status).toBe(missing.status);
      expect(hidden.body).toEqual(missing.body);
    });

    it('slug с спецсимволами не ломает обработчик', async () => {
      const res = await request(appWith([dbRow()])).get('/api/public/event-types/%20');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('event_type_not_found');
    });
  });
});
