import { useCallback, useEffect, useState } from 'react'
import type { DependencyList } from 'react'

type ApiState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  refetch: () => void
}

/**
 * Загрузка данных из API: состояние загрузки, текст ошибки из `{ error, message }`
 * контракта и ручная перезагрузка. Ответ отброшенного запроса игнорируется,
 * чтобы гонка не перезаписала свежие данные устаревшими.
 */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const refetch = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    load()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Неизвестная ошибка')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return { data, error, loading, refetch }
}
