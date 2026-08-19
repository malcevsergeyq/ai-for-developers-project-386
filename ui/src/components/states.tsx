import { Button } from '@/components/ui/button'

/** Заглушка на время загрузки — держит высоту, чтобы страница не прыгала. */
export function Loading({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

/**
 * Ошибка API. Показываем `message` из контракта как есть: бэкенд обязан
 * присылать человекочитаемый текст, дублировать его на фронте — рассинхрон.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-5 text-sm"
    >
      <p className="font-medium text-destructive">Не получилось загрузить данные</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  )
}

/** Пустой список — отдельное состояние, а не «ничего не показали». */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
