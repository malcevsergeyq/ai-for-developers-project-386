import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api } from '@/api/client'
import type { Booking, Slot } from '@/api/client'
import { EmptyState, ErrorState, Loading } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/useApi'
import { dayKey, formatDateTime, formatDay, formatDuration, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Day = { key: string; label: string; slots: Slot[] }

export default function BookingPage() {
  const { eventTypeId = '' } = useParams()

  const eventType = useApi(() => api.getEventType(eventTypeId), [eventTypeId])
  const slots = useApi(() => api.listSlots(eventTypeId), [eventTypeId])

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const days = useMemo<Day[]>(() => {
    const groups = new Map<string, Slot[]>()
    for (const slot of slots.data ?? []) {
      const key = dayKey(slot.start)
      const existing = groups.get(key)
      if (existing) existing.push(slot)
      else groups.set(key, [slot])
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      label: formatDay(items[0].start),
      slots: items,
    }))
  }, [slots.data])

  // Первый день со свободным временем выбирается сам, а если выбранный день
  // опустел после перезагрузки слотов — берём ближайший свободный. Это вывод
  // из данных, а не состояние: держать его в useEffect значило бы лишний рендер.
  const activeDayKey =
    selectedDayKey && days.some((day) => day.key === selectedDayKey)
      ? selectedDayKey
      : (days[0]?.key ?? null)

  const selectedDay = days.find((day) => day.key === activeDayKey) ?? null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedSlot) return

    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.createBooking({
        eventTypeId,
        start: selectedSlot.start,
        guestName,
        guestEmail,
        notes: notes.trim() === '' ? undefined : notes,
      })
      setBooking(created)
    } catch (cause) {
      // 409 — единственная ошибка, после которой список слотов заведомо устарел.
      if (cause instanceof ApiError && cause.code === 'slot_unavailable') {
        setFormError('Это время только что заняли. Выберите другое — список уже обновлён.')
        setSelectedSlot(null)
        slots.refetch()
      } else {
        setFormError(cause instanceof Error ? cause.message : 'Не удалось создать запись')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (eventType.loading) return <Loading label="Загружаем встречу…" />
  if (eventType.error) return <ErrorState message={eventType.error} onRetry={eventType.refetch} />
  if (!eventType.data) return null

  if (booking) {
    return (
      <section className="mx-auto max-w-lg text-center">
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-6 py-10">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Запись подтверждена</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{booking.eventTypeTitle}</h1>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDateTime(booking.start)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            до {formatTime(booking.end)} · {booking.guestName} · {booking.guestEmail}
          </p>
        </div>
        <Link to="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
          Вернуться к видам встреч
        </Link>
      </section>
    )
  }

  return (
    <section>
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Все виды встреч
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{eventType.data.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDuration(eventType.data.durationMinutes)}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{eventType.data.description}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="text-sm font-medium">Свободное время</h2>

          {slots.loading && <div className="mt-4"><Loading label="Считаем свободные слоты…" /></div>}

          {!slots.loading && slots.error && (
            <div className="mt-4">
              <ErrorState message={slots.error} onRetry={slots.refetch} />
            </div>
          )}

          {!slots.loading && !slots.error && days.length === 0 && (
            <div className="mt-4">
              <EmptyState
                title="Свободного времени нет"
                hint="Все слоты на ближайшие две недели уже заняты."
              />
            </div>
          )}

          {days.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      setSelectedDayKey(day.key)
                      setSelectedSlot(null)
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      day.key === activeDayKey
                        ? 'border-foreground bg-foreground text-background'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>

              {selectedDay && (
                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selectedDay.slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(slot)
                        setFormError(null)
                      }}
                      aria-pressed={slot.start === selectedSlot?.start}
                      className={`rounded-md border py-2 text-sm tabular-nums transition-colors ${
                        slot.start === selectedSlot?.start
                          ? 'border-foreground bg-foreground text-background'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="rounded-lg border p-5">
          <h2 className="text-sm font-medium">Ваши данные</h2>

          {!selectedSlot && (
            <p className="mt-3 text-sm text-muted-foreground">
              Выберите свободное время слева — здесь появится форма записи.
            </p>
          )}

          {selectedSlot && (
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <p className="rounded-md bg-muted px-3 py-2 text-sm tabular-nums">
                {formatDateTime(selectedSlot.start)} — {formatTime(selectedSlot.end)}
              </p>

              <div className="space-y-2">
                <Label htmlFor="guestName">Имя</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Комментарий (необязательно)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Записываем…' : 'Записаться'}
              </Button>
            </form>
          )}
        </aside>
      </div>
    </section>
  )
}
