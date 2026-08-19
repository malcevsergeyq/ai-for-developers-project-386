# Запись на звонок

Упрощённый сервис бронирования времени по мотивам [Cal.com](https://cal.com/).
Владелец календаря публикует типы встреч, гость выбирает свободный слот и записывается
без регистрации. Финальный проект модуля 1 курса Hexlet «ИИ для разработчиков».

**Приложение опубликовано:** _ссылка появится после деплоя_

### Hexlet tests and linter status:
[![Actions Status](https://github.com/malcevsergeyq/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/malcevsergeyq/ai-for-developers-project-386/actions)
[![ci](https://github.com/malcevsergeyq/ai-for-developers-project-386/actions/workflows/ci.yml/badge.svg)](https://github.com/malcevsergeyq/ai-for-developers-project-386/actions/workflows/ci.yml)

## Как устроено

Проект сделан по подходу **Design First**: сначала зафиксирован API-контракт, затем по нему
независимо реализованы фронтенд и бэкенд.

| Часть | Стек | Где |
|---|---|---|
| Контракт | TypeSpec → OpenAPI | [`spec/main.tsp`](./spec/main.tsp) |
| Бэкенд | Node + Express | [`server/`](./server) |
| Фронтенд | React + TypeScript + Vite + shadcn/ui | [`ui/`](./ui) |
| e2e | Playwright | [`e2e/`](./e2e) |

Источник истины — `spec/main.tsp`. `spec/openapi.yaml` генерируется из него, а типы фронта
(`ui/src/api/schema.d.ts`) генерируются из спецификации: расхождение с контрактом ловит
компилятор, а не пользователь. CI отдельным шагом проверяет, что сгенерированное не разошлось
с исходником.

**Правила предметной области:** слоты нарезаются по получасовой сетке в рабочие часы
09:00–18:00 UTC по будням, окно записи — 14 дней. Занятость глобальная: на пересекающееся
время нельзя создать две записи, даже если это разные типы встреч.

## Запуск

```bash
docker build -t calendar-booking .
docker run --rm -p 3000:3000 -e PORT=3000 calendar-booking
```

Приложение слушает порт из переменной `PORT`. Открыть: `http://localhost:3000`.

### Разработка без Docker

```bash
npm install && npm start          # API на :3000
cd ui && npm install && npm run dev   # фронт на :5173
```

## Хранилище

Хранилище выбирается по переменной `DATABASE_URL`: если она задана — PostgreSQL
(`server/schema.sql`), если нет — хранилище в памяти. Второй режим не запасной, а основной
для проверки и демо: данные сбрасываются при перезапуске, что допускает задание.

> **Внимание.** Ветка PostgreSQL написана, но ни разу не исполнялась против живой базы —
> см. «Открытые вопросы» в [`PLAN.md`](./PLAN.md). Задавать `DATABASE_URL` на деплое нельзя,
> пока схема не накатана и не проверена хотя бы раз.

## Команды

| Команда | Что делает |
|---|---|
| `npm start` | сервер на `PORT` |
| `npm test` | юнит-тесты бэкенда (Vitest + supertest) |
| `npm run test:e2e` | сценарии в браузере (Playwright), серверы поднимает сам |
| `npm run lint` | ESLint |
| `npm run spec:build` | перегенерировать `spec/openapi.yaml` из `spec/main.tsp` |
| `npm run mock` | мок бэкенда по контракту (Prism) на `:4010` |

Прогнать те же сценарии против уже работающего приложения — контейнера или задеплоенного
сервиса: `E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e`. Серверы при этом не поднимаются.

Что проверяют e2e-сценарии и почему именно они — в [`e2e/SCENARIOS.md`](./e2e/SCENARIOS.md).
Соглашения проекта для людей и агентов — в [`AGENTS.md`](./AGENTS.md).
