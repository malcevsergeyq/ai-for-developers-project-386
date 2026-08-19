import "@typespec/http";

using TypeSpec.Http;

/**
 * «Календарь звонков» — упрощённый сервис бронирования времени по мотивам Cal.com.
 *
 * Роли (регистрации и авторизации в приложении нет):
 *   - Владелец календаря — один заранее заданный профиль, работает в админской части
 *     под префиксом `/admin`. Создаёт типы событий и смотрит список предстоящих встреч.
 *   - Гость — без аккаунта. Смотрит виды брони, выбирает свободный слот и записывается.
 *
 * Договорённости, общие для всего контракта:
 *   - Всё время — UTC, формат ISO 8601 (`2026-08-20T09:00:00Z`). Таймзон в приложении нет.
 *   - Идентификаторы — непрозрачные строки (UUID). Клиент не разбирает их и не считает
 *     порядковыми.
 *   - Окно записи — 14 дней от текущего момента.
 *   - Слоты нарезаются по сетке стартов с шагом 30 минут, в рабочие часы 09:00–18:00 UTC,
 *     только по будням (пн–пт).
 *   - Бронь занимает время `[start, start + durationMinutes)` выбранного типа события.
 *     Событие длиннее 30 минут блокирует несколько соседних стартов.
 *   - Занятость — глобальная: на пересекающееся время нельзя создать две записи,
 *     даже если это разные типы событий.
 *   - Любая ошибка возвращается телом `{ error, message }`: `error` — машиночитаемый код
 *     для клиента, `message` — человекочитаемое пояснение.
 *   - Ошибки, общие для всех путей и потому не описанные в каждой операции отдельно:
 *     `404 not_found` — пути нет в контракте (а не HTML-страница Express);
 *     `400 validation_failed` — тело не разобралось как JSON;
 *     `413 payload_too_large` — тело больше 32 КБ;
 *     `415 unsupported_media_type` — неподдерживаемая кодировка тела;
 *     `500 internal_error` — всё остальное. Форма тела у всех одна.
 */
@service(#{ title: "Календарь звонков" })
@server("http://localhost:3000", "Локальный запуск")
namespace CalendarBooking;

// ───────────────────────────── Сущности ─────────────────────────────

/** Тип встречи, который публикует владелец календаря. */
model EventType {
  /** Непрозрачный идентификатор (UUID). */
  id: string;

  /** Название, которое видит гость в списке видов брони. */
  @minLength(1)
  @maxLength(100)
  title: string;

  /** Описание встречи для страницы бронирования. */
  @maxLength(1000)
  description: string;

  /** Длительность встречи в минутах; кратна 30. */
  @minValue(30)
  @maxValue(240)
  durationMinutes: int32;
}

/** Тело запроса на создание типа события. */
model EventTypeCreate {
  @minLength(1)
  @maxLength(100)
  title: string;

  @maxLength(1000)
  description: string;

  /** Кратна 30: 30, 60, 90, 120. */
  @minValue(30)
  @maxValue(240)
  durationMinutes: int32;
}

/**
 * Свободный интервал под конкретный тип события.
 * Слоты не хранятся — они вычисляются на лету из окна записи и существующих броней.
 */
model Slot {
  /** Начало встречи, всегда попадает на сетку с шагом 30 минут. */
  start: utcDateTime;

  /** Конец встречи: `start + durationMinutes` типа события. */
  end: utcDateTime;
}

/** Запись гостя на звонок. */
model Booking {
  /** Непрозрачный идентификатор (UUID). */
  id: string;

  eventTypeId: string;

  /** Название типа события на момент чтения — чтобы список владельца не требовал второго запроса. */
  @minLength(1)
  @maxLength(100)
  eventTypeTitle: string;

  start: utcDateTime;

  end: utcDateTime;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  @format("email")
  guestEmail: string;

  /** Необязательный комментарий гостя. */
  notes?: string;

  createdAt: utcDateTime;
}

/** Тело запроса на создание брони. */
model BookingCreate {
  eventTypeId: string;

  /** Начало выбранного слота; должно совпадать со `start` одного из свободных слотов. */
  start: utcDateTime;

  @minLength(1)
  @maxLength(100)
  guestName: string;

  @format("email")
  guestEmail: string;

  @maxLength(1000)
  notes?: string;
}

// ───────────────────────────── Ошибки ─────────────────────────────

/** Тело запроса не прошло валидацию: не те типы, не та сетка, время вне окна записи. */
@error
model ValidationError {
  @statusCode statusCode: 400;

  error: "validation_failed";

  message: string;
}

/** Типа события с таким `id` не существует. */
@error
model EventTypeNotFound {
  @statusCode statusCode: 404;

  error: "event_type_not_found";

  message: string;
}

/**
 * Слот уже занят: запрошенный интервал пересекается с существующей бронью
 * (в том числе бронью другого типа события).
 */
@error
model SlotUnavailable {
  @statusCode statusCode: 409;

  error: "slot_unavailable";

  message: string;
}

// ─────────────────────── Публичная часть (гость) ───────────────────────

@route("/event-types")
@tag("Гость")
interface PublicEventTypes {
  /** Список видов брони на публичной странице. */
  @get
  list(): EventType[];

  /** Один тип события — для прямой ссылки на страницу бронирования. */
  @get
  read(@path id: string): EventType | EventTypeNotFound;

  /**
   * Свободные слоты выбранного типа события на 14 дней вперёд,
   * по возрастанию времени. Занятые интервалы уже исключены.
   */
  @route("{id}/slots")
  @get
  slots(@path id: string): Slot[] | EventTypeNotFound;
}

@route("/bookings")
@tag("Гость")
interface PublicBookings {
  /** Записаться на свободный слот. */
  @post
  create(@body booking: BookingCreate):
    | {
        @statusCode statusCode: 201;
        @body created: Booking;
      }
    | ValidationError
    | EventTypeNotFound
    | SlotUnavailable;
}

// ─────────────────── Админская часть (владелец календаря) ───────────────────

@route("/admin/event-types")
@tag("Владелец")
interface AdminEventTypes {
  /** Все типы событий владельца. */
  @get
  list(): EventType[];

  /** Создать тип события. */
  @post
  create(@body eventType: EventTypeCreate):
    | {
        @statusCode statusCode: 201;
        @body created: EventType;
      }
    | ValidationError;
}

@route("/admin/bookings")
@tag("Владелец")
interface AdminBookings {
  /**
   * Предстоящие встречи одним списком по всем типам событий,
   * по возрастанию времени начала. Прошедшие встречи не возвращаются.
   */
  @get
  list(): Booking[];
}
