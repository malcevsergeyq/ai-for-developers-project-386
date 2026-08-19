import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { EmptyState, ErrorState, Loading } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { useApi } from '@/hooks/useApi'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function EventTypesPage() {
  const { data, error, loading, refetch } = useApi(() => api.listEventTypes(), [])

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Виды встреч</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Выберите формат — дальше откроется календарь со свободным временем на ближайшие две недели.
      </p>

      <div className="mt-8">
        {loading && <Loading label="Загружаем виды встреч…" />}

        {!loading && error && <ErrorState message={error} onRetry={refetch} />}

        {!loading && !error && data?.length === 0 && (
          <EmptyState
            title="Пока нет ни одного вида встречи"
            hint="Владелец календаря ещё не опубликовал форматы звонков."
          />
        )}

        {!loading && !error && data && data.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.map((eventType) => (
              <li
                key={eventType.id}
                className="flex flex-col rounded-lg border p-5 transition-shadow hover:shadow-sm"
              >
                <h2 className="font-medium">{eventType.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDuration(eventType.durationMinutes)}
                </p>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{eventType.description}</p>
                <Link
                  to={`/book/${eventType.id}`}
                  className={cn(buttonVariants(), 'mt-5 self-start')}
                >
                  Выбрать время
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
