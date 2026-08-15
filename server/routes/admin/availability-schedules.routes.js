import { Router } from 'express';

/**
 * Только HTTP: маршруты, коды ответов и передача тела дальше.
 * Что считать корректным расписанием и что значит «не найдено» — решает сервис.
 */
export const createAdminAvailabilitySchedulesRouter = (availabilitySchedulesService) => {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      res.json(await availabilitySchedulesService.list());
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      res.status(201).json(await availabilitySchedulesService.create(req.body));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      res.json(await availabilitySchedulesService.getById(req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      res.json(await availabilitySchedulesService.update(req.params.id, req.body));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await availabilitySchedulesService.remove(req.params.id);
      // 204: удалять больше нечего, отдавать в теле тоже нечего.
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
