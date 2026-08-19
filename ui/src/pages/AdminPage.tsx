import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '@/api/client'
import { EmptyState, ErrorState, Loading } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApi } from '@/hooks/useApi'
import { formatDateTime, formatDuration, formatTime } from '@/lib/format'

/** Длительность кратна шагу сетки в 30 минут — это правило контракта, не UI. */
const DURATIONS = [30, 60, 90, 120]

export default function AdminPage() {
  const eventTypes = useApi(() => api.listAdminEventTypes(), [])
  const bookings = useApi(() => api.listAdminBookings(), [])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await api.createEventType({ title, description, durationMinutes })
      setTitle('')
      setDescription('')
      setDurationMinutes(30)
      eventTypes.refetch()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Не удалось создать тип встречи')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Календарь владельца</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Опубликуйте форматы встреч — гости увидят их на публичной странице и смогут записаться.
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-[320px_1fr]">
        <form className="space-y-4 rounded-lg border p-5" onSubmit={handleSubmit}>
          <h2 className="text-sm font-medium">Новый тип встречи</h2>

          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={100}
              placeholder="Демо-звонок"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Короткий разговор для знакомства с продуктом"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Длительность</Label>
            <select
              id="durationMinutes"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Создаём…' : 'Создать'}
          </Button>
        </form>

        <div>
          <h2 className="text-sm font-medium">Опубликованные типы встреч</h2>

          <div className="mt-4">
            {eventTypes.loading && <Loading />}

            {!eventTypes.loading && eventTypes.error && (
              <ErrorState message={eventTypes.error} onRetry={eventTypes.refetch} />
            )}

            {!eventTypes.loading && !eventTypes.error && eventTypes.data?.length === 0 && (
              <EmptyState title="Типов встреч пока нет" hint="Создайте первый в форме слева." />
            )}

            {eventTypes.data && eventTypes.data.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {eventTypes.data.map((eventType) => (
                  <li key={eventType.id} className="flex items-baseline justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-medium">{eventType.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{eventType.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDuration(eventType.durationMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Предстоящие встречи</h2>

        <div className="mt-4">
          {bookings.loading && <Loading />}

          {!bookings.loading && bookings.error && (
            <ErrorState message={bookings.error} onRetry={bookings.refetch} />
          )}

          {!bookings.loading && !bookings.error && bookings.data?.length === 0 && (
            <EmptyState
              title="Встреч пока нет"
              hint="Здесь появятся записи гостей по всем типам встреч."
            />
          )}

          {bookings.data && bookings.data.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {bookings.data.map((booking) => (
                <li key={booking.id} className="grid gap-1 p-4 sm:grid-cols-[220px_1fr]">
                  <p className="text-sm font-medium tabular-nums">
                    {formatDateTime(booking.start)} — {formatTime(booking.end)}
                  </p>
                  <div>
                    <p className="text-sm">{booking.eventTypeTitle}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {booking.guestName} · {booking.guestEmail}
                    </p>
                    {booking.notes && (
                      <p className="mt-1 text-sm text-muted-foreground">{booking.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
