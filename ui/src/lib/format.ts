/**
 * Всё время в контракте — UTC. Показываем его тоже в UTC:
 * приложение однозначно в одной зоне, и e2e-тесты не зависят от машины.
 */
const UTC = 'UTC'

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  timeZone: UTC,
})

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: UTC,
})

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: UTC,
})

/** «пн, 24 августа» */
export const formatDay = (iso: string) => dayFormatter.format(new Date(iso))

/** «09:30» */
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso))

/** «24 августа, 09:30» */
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso))

/** Ключ календарного дня в UTC — по нему группируем слоты. */
export const dayKey = (iso: string) => iso.slice(0, 10)

/** «30 минут» / «1 час 30 минут» */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} ч`)
  if (rest > 0) parts.push(`${rest} мин`)
  return parts.join(' ')
}
