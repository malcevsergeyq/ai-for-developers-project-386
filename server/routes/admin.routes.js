import { Router } from 'express'

/**
 * Админский контур владельца календаря. Авторизации нет — вынесена ТЗ за скоуп проекта,
 * профиль владельца один и заранее задан.
 */
export const createAdminRouter = ({ eventTypesService, bookingsService, now }) => {
  const router = Router()

  router.get('/event-types', async (req, res, next) => {
    try {
      res.json(await eventTypesService.list())
    } catch (err) {
      next(err)
    }
  })

  router.post('/event-types', async (req, res, next) => {
    try {
      res.status(201).json(await eventTypesService.create(req.body))
    } catch (err) {
      next(err)
    }
  })

  router.get('/bookings', async (req, res, next) => {
    try {
      res.json(await bookingsService.listUpcoming(now()))
    } catch (err) {
      next(err)
    }
  })

  return router
}
