import { Router } from 'express';

/**
 * Роут занимается только HTTP: разбирает параметры и отдаёт коды.
 * Решение «показывать или нет» принимает сервис.
 */
export const createPublicEventTypesRouter = (eventTypesService) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json(await eventTypesService.listPublic());
    } catch (err) {
      next(err);
    }
  });

  router.get('/:slug', async (req, res, next) => {
    try {
      res.json(await eventTypesService.getPublicBySlug(req.params.slug));
    } catch (err) {
      next(err);
    }
  });

  return router;
};
