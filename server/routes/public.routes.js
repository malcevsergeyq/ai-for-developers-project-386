import { Router } from 'express'

/**
 * Публичный контур: гость без регистрации. Роут занимается только HTTP —
 * разбирает параметры, отдаёт коды; решения принимают сервисы.
 *
 * `now` приходит фабрикой, чтобы тесты могли зафиксировать момент времени.
 */
export const createPublicRouter = ({ eventTypesService, bookingsService, now }) => {
  const router = Router()

  router.get('/event-types', async (req, res, next) => {
    try {
      res.json(await eventTypesService.list())
    } catch (err) {
      next(err)
    }
  })

  router.get('/event-types/:id', async (req, res, next) => {
    try {
      res.json(await eventTypesService.getById(req.params.id))
    } catch (err) {
      next(err)
    }
  })

  router.get('/event-types/:id/slots', async (req, res, next) => {
    try {
      res.json(await eventTypesService.listSlots(req.params.id, now()))
    } catch (err) {
      next(err)
    }
  })

  router.post('/bookings', async (req, res, next) => {
    try {
      res.status(201).json(await bookingsService.create(req.body, now()))
    } catch (err) {
      next(err)
    }
  })

  return router
}
