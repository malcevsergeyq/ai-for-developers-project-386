# API-контракт «Календарь звонков»

Design First: этот файл — источник истины для фронта и бэка. Изменения в контракте вносятся сюда явно, а не выводятся из кода одной из сторон.

## Конвенции

- JSON; ошибки `{ error: "machine_code", message: "русское описание" }`
- Даты `YYYY-MM-DD`, время `HH:MM` — строки, в таймзоне `AvailabilitySchedule.timezone` (IANA, напр. `Europe/Moscow`); клиент не передаёт offset
- `durationMinutes` — число; слот — интервал `[startTime, startTime+durationMinutes)`
- Два контура: публичный (запись клиентов, без авторизации) и админский (`/admin/*`, авторизация вне скоупа контракта)
- Публичные эндпоинты адресуются по `slug` (с фильтром `hidden:false`), админские — по `id`

## Сущности (DTO)

```
// EventType
{ "id": 1, "title": "Демо-звонок", "description": "...",
  "slug": "demo-call", "durationMinutes": 30,
  "location": "https://meet.google.com/xxx",
  "availabilityScheduleId": 3, "hidden": false }

// AvailabilitySchedule
{ "id": 3, "name": "Рабочая неделя", "timezone": "Europe/Moscow",
  "rules": [ { "weekday": 1, "startTime": "09:00", "endTime": "18:00" },
             { "weekday": 2, "startTime": "09:00", "endTime": "13:00" } ] }
// weekday: 1=Пн … 7=Вс

// Booking (ответ на создание и на GET по token)
{ "id": 10, "eventTypeId": 1, "date": "2026-08-10",
  "startTime": "10:00", "endTime": "10:30",
  "name": "Иван", "email": "i@mail.ru", "phone": "+7999...", "note": null,
  "status": "pending", "token": "a1b2c3d4..." }
  // status: pending | confirmed | cancelled | completed

// Booking (в админских ответах — без token)
{ "id": 10, "eventTypeId": 1, "date": "2026-08-10",
  "startTime": "10:00", "endTime": "10:30",
  "name": "Иван", "email": "i@mail.ru", "phone": "+7999...", "note": null,
  "status": "pending" }
```

## Эндпоинты

### Публичные (клиент)

| Метод | Путь | Тело / Query |
|---|---|---|
| GET | `/api/public/event-types` | — → `200` (массив EventType, только `hidden:false`; пустой список — `[]`) |
| GET | `/api/public/event-types/:slug` | — → `200` (EventType) \| `404 event_type_not_found` (несуществующий slug ИЛИ `hidden:true` — один и тот же ответ) |
| GET | `/api/public/event-types/:slug/slots` | `?date=YYYY-MM-DD` |
| POST | `/api/public/event-types/:slug/bookings` | `{ date, startTime, name, email, phone?, note? }` → `201` (booking + `token`) \| `400` \| `404` \| `409 slot_taken` |
| GET | `/api/public/bookings/:id` | `?token=...` → `200` (booking) \| `404 booking_not_found` (несуществующий id ИЛИ неверный token — один и тот же ответ) |
| POST | `/api/public/bookings/:id/cancel` | `{ token }` → `200` \| `404 booking_not_found` (та же логика) |

### Админ (владелец)

| Метод | Путь |
|---|---|
| GET / POST | `/api/admin/event-types` |
| GET / PATCH / DELETE | `/api/admin/event-types/:id` |
| GET / POST | `/api/admin/availability-schedules` |
| GET / PATCH / DELETE | `/api/admin/availability-schedules/:id` |
| GET | `/api/admin/bookings` |
| GET | `/api/admin/bookings/:id` |
| PATCH | `/api/admin/bookings/:id/status` |
| POST | `/api/admin/bookings/:id/cancel` |

## Ключевые правила

1. Занятость слота — пересечение интервалов: `[S, S+durB)` и `[T, T+dur)`; уникальность `(eventTypeId, date, startTime)` + `status IN ('pending','confirmed')` на уровне БД, гонка → `409`. Генерация слотов и валидация `POST` — через одну функцию пересечения.
2. Слот = интервал `startTime..endTime`, `endTime` возвращается и хранится явно (не только `startTime`).
3. Отмена — мягкая (`status='cancelled'`), слот снова свободен.
4. Часовой пояс живёт в расписании; все слоты — в его IANA-таймзоне.
5. `hidden` — только фильтр публичности; админ видит все. На публичных эндпоинтах скрытый тип события неотличим от несуществующего: оба дают `404 event_type_not_found` (та же логика, что и правило 7 для броней — перебор `slug` не должен выдавать, что скрыто).
6. Доступ клиента к своей брони — `token` (непрозрачный, выдаётся один раз при создании), не email; единый механизм для чтения и отмены.
7. Несуществующий `id` и неверный `token` на публичных `bookings`-эндпоинтах → одинаковый `404 booking_not_found` (анти-оракул против перебора id).
8. `token` не отдаётся в админских ответах о брони.
9. `completed` — выставляется вручную админом (без шедулера).
10. `pending → confirmed` — вручную владельцем через `PATCH /admin/bookings/:id/status`.
11. `DELETE /admin/event-types/:id` и `DELETE /admin/availability-schedules/:id` — запрещены (`409`), пока есть связанные записи (брони на типе события; типы событий на расписании). Для «убрать из публичного доступа» — `PATCH hidden: true`, не `DELETE`.
