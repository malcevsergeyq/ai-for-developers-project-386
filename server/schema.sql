-- Схема «Календаря звонков» под контракт spec/main.tsp.
-- Накатывается вручную: npm run db:init (нужен DATABASE_URL).
-- Механизма миграций нет — правка схемы на уже накатанной базе требует ALTER TABLE руками.
--
-- ВНИМАНИЕ: этот файл ни разу не исполнялся против живой базы. Postgres в проекте
-- пока не поднят, тесты идут на хранилище в памяти и корректность SQL не подтверждают.

CREATE TABLE event_types (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description      text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  -- Кратность 30 держит схема, а не только код: сетка стартов в контракте получасовая,
  -- и длительность 45 минут ломала бы её молча.
  duration_minutes integer NOT NULL CHECK (
    duration_minutes BETWEEN 30 AND 240 AND duration_minutes % 30 = 0
  ),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- REFERENCES без CASCADE: удалить тип встречи, на который есть брони, база не даст.
  event_type_id uuid NOT NULL REFERENCES event_types (id),
  start_at      timestamptz NOT NULL,
  end_at        timestamptz NOT NULL,
  guest_name    text NOT NULL CHECK (char_length(guest_name) BETWEEN 1 AND 100),
  guest_email   text NOT NULL CHECK (char_length(guest_email) BETWEEN 3 AND 320),
  notes         text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_end_after_start CHECK (end_at > start_at),

  -- Ключевое ограничение проекта: занятость глобальная по времени, независимо от типа
  -- встречи. Пересечение интервалов обычным UNIQUE не выразить — нужен EXCLUDE по
  -- диапазону. Полуинтервал '[)' делает стык 10:00–10:30 и 10:30–11:00 непересекающимся.
  --
  -- Почему на уровне базы, а не проверкой в коде: SELECT перед INSERT оставляет окно
  -- для гонки между процессами бэка. Нарушение приходит как SQLSTATE 23P01 и
  -- переводится в 409 slot_unavailable в repositories/postgres.js.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
);

-- Список владельца всегда фильтрует «предстоящие» по start_at.
CREATE INDEX bookings_start_at_idx ON bookings (start_at);
