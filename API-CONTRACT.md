# API-контракт «Календарь звонков»

Design First: этот файл — источник истины для фронта и бэка. Изменения в контракте вносятся сюда явно, а не выводятся из кода одной из сторон.

## Конвенции

- JSON; ошибки `{ error: "machine_code", message: "русское описание" }`
- Нераспознанный JSON в теле запроса → `400 invalid_json` (общий ответ для всех эндпоинтов с телом)
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
| POST | `/api/public/event-types/:slug/bookings` | `{ date, startTime, name, email, phone?, note? }` → `201` (booking + `token`) \| `400` \| `404` \| `409 slot_taken` \| `409 email_already_booked` |
| GET | `/api/public/bookings/:id` | `?token=...` → `200` (booking) \| `404 booking_not_found` (несуществующий id ИЛИ неверный token — один и тот же ответ) |
| POST | `/api/public/bookings/:id/cancel` | `{ token }` → `200` \| `404 booking_not_found` (та же логика) |

### Админ (владелец)

| Метод | Путь | Тело / Ответы |
|---|---|---|
| GET / POST | `/api/admin/event-types` | |
| GET / PATCH / DELETE | `/api/admin/event-types/:id` | |
| GET | `/api/admin/availability-schedules` | — → `200` (массив AvailabilitySchedule, по возрастанию `id`; пустой список — `[]`) |
| POST | `/api/admin/availability-schedules` | `{ name, timezone, rules }` → `201` (AvailabilitySchedule) \| `400 validation_error` |
| GET | `/api/admin/availability-schedules/:id` | — → `200` (AvailabilitySchedule) \| `404 availability_schedule_not_found` |
| PATCH | `/api/admin/availability-schedules/:id` | `{ name?, timezone?, rules? }` → `200` (AvailabilitySchedule) \| `400 validation_error` \| `404 availability_schedule_not_found` |
| DELETE | `/api/admin/availability-schedules/:id` | — → `204` (без тела) \| `404 availability_schedule_not_found` \| `409 availability_schedule_in_use` |
| GET | `/api/admin/bookings` | |
| GET | `/api/admin/bookings/:id` | |
| PATCH | `/api/admin/bookings/:id/status` | |
| POST | `/api/admin/bookings/:id/cancel` | |

#### Расписания доступности — тела и валидация

- **POST** — `name`, `timezone`, `rules` обязательны все три. `PATCH` — частичный: любое подмножество тех же полей, но не пустое тело (`400`).
- Неизвестное поле в теле → `400 validation_error` (защита от опечатки в имени поля, которая иначе тихо не применится).
- `name` — непустая строка, сохраняется без окружающих пробелов.
- `timezone` — IANA-имя зоны (`Europe/Moscow`, `UTC`), которое понимает `Intl`. Числовой offset (`+03:00`) — не значение таймзоны.
- `rules` — массив; **пустой массив допустим** и означает расписание без окон доступности (слотов не будет). В `PATCH` переданный `rules` заменяет весь набор правил целиком, а не дополняет его.
- Правило: `weekday` — целое `1..7`, `startTime`/`endTime` — `HH:MM` в диапазоне `00:00..23:59`, `startTime < endTime`.
- Два правила одного `weekday` не должны пересекаться по времени (`400`) — иначе генерация слотов выдала бы дубли. Стык впритык (`09:00–13:00` и `13:00–18:00`) пересечением не считается.
- В ответе правила отсортированы по `weekday`, затем по `startTime`; собственного `id` у правила в DTO нет — набор правил адресуется только через расписание.
- `id` в пути, не являющийся целым положительным числом, → `404 availability_schedule_not_found` (несуществующая запись, а не ошибка запроса).

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
11. `DELETE /admin/event-types/:id` и `DELETE /admin/availability-schedules/:id` — запрещены (`409`), пока есть связанные записи (брони на типе события; типы событий на расписании). Коды: `event_type_in_use` и `availability_schedule_in_use`. Для «убрать из публичного доступа» — `PATCH hidden: true`, не `DELETE`.
12. Один email — не больше одной активной брони (`pending`/`confirmed`) на календарную дату, **по всем типам событий сразу**: клиент не может в один день записаться и на демо-звонок, и на консультацию. Повторная попытка → `409 email_already_booked`. Email сравнивается без учёта регистра (`Ivan@mail.ru` и `ivan@mail.ru` — один клиент). Отменённая бронь ограничение не занимает: после `cancel` клиент может записаться на этот день заново. Держится партиальным уникальным индексом `bookings_active_email_day_uniq`, не проверкой в коде, — `SELECT` перед `INSERT` оставляет окно для гонки (то же соображение, что и в правиле 1).
