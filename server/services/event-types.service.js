import { eventTypeNotFound } from '../errors.js'
import { toEventTypeDto, toSlotDto } from '../mappers/dto.js'
import { SLOT_STEP_MINUTES, windowEnd } from '../time.js'
import { generateSlots } from './slots.js'
import { requireDuration, requireObject, requireText } from './validation.js'

/** Границы длительности из контракта (`spec/main.tsp`, модель `EventTypeCreate`). */
const MIN_DURATION_MINUTES = 30
const MAX_DURATION_MINUTES = 240

/**
 * Слой правил предметной области. Роуты знают только про HTTP, репозитории — только
 * про хранилище; всё, что между, живёт здесь.
 *
 * `now` подаётся аргументом, а не берётся из `Date.now()` внутри: слоты зависят от времени,
 * и тест, привязанный к моменту прогона, начал бы падать в выходные.
 */
export const createEventTypesService = ({ eventTypes, bookings }) => ({
  async list() {
    const rows = await eventTypes.list()
    return rows.map(toEventTypeDto)
  },

  async getById(id) {
    const eventType = await eventTypes.findById(id)
    if (!eventType) throw eventTypeNotFound()
    return toEventTypeDto(eventType)
  },

  async create(body) {
    const payload = requireObject(body)
    const eventType = await eventTypes.create({
      title: requireText(payload.title, { field: 'title', max: 100 }),
      description: requireText(payload.description, { field: 'description', min: 0, max: 1000 }),
      durationMinutes: requireDuration(payload.durationMinutes, {
        field: 'durationMinutes',
        step: SLOT_STEP_MINUTES,
        min: MIN_DURATION_MINUTES,
        max: MAX_DURATION_MINUTES,
      }),
    })
    return toEventTypeDto(eventType)
  },

  /**
   * Занятость глобальная, поэтому берём брони всего окна, а не только этого типа встречи:
   * часовая консультация в 09:30 закрывает и получасовое демо в 09:00, и в 10:00.
   */
  async listSlots(id, now) {
    const eventType = await eventTypes.findById(id)
    if (!eventType) throw eventTypeNotFound()

    const booked = await bookings.listInRange(now, windowEnd(now))
    const slots = generateSlots({
      durationMinutes: eventType.durationMinutes,
      bookings: booked,
      now,
    })
    return slots.map(toSlotDto)
  },
})
