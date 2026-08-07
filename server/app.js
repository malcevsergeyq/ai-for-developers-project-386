import express from 'express';
import cors from 'cors';

import { HttpError } from './errors.js';
import { createEventTypesService } from './services/event-types.service.js';
import { createPublicEventTypesRouter } from './routes/public/event-types.routes.js';

/**
 * Репозитории приходят снаружи — это позволяет тестам работать без поднятого Postgres
 * и не превращает `createApp` в точку, знающую про драйвер БД.
 *
 * CORS нужен явно: фронт и бэк живут на разных origin (раздельный деплой),
 * без него рабочий эндпоинт просто не доедет до SPA.
 */
export const createApp = ({ eventTypesRepository }) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const eventTypesService = createEventTypesService(eventTypesRepository);
  app.use('/api/public/event-types', createPublicEventTypesRouter(eventTypesService));

  // Обработчик ошибок один на всё приложение: тело и статус физически не могут разойтись
  // между обработчиками, а наружу не утекает текст ошибки БД.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.error, message: err.message });
    }
    return res.status(500).json({ error: 'internal_error', message: 'Внутренняя ошибка сервера' });
  });

  return app;
};
