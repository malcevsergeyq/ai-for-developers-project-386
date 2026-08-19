/**
 * Адреса e2e-прогона.
 *
 * По умолчанию Playwright сам поднимает бэкенд и превью собранного фронта на портах,
 * которые специально не совпадают с дев-серверами — чтобы прогон не цеплялся к процессу,
 * с которым в этот момент работает человек.
 *
 * Если задан `E2E_BASE_URL`, серверы не поднимаются, а сценарии идут против уже
 * работающего приложения: контейнера или задеплоенного сервиса. Там фронт и API живут
 * на одном origin, поэтому адрес один на оба.
 */
const external = process.env.E2E_BASE_URL

export const API_PORT = 3101
export const WEB_PORT = 4173

export const IS_EXTERNAL = Boolean(external)
export const API_URL = external ?? `http://127.0.0.1:${API_PORT}`
export const WEB_URL = external ?? `http://127.0.0.1:${WEB_PORT}`
