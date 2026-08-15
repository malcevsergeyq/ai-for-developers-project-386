CREATE TABLE availability_schedules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL
);

CREATE TABLE schedule_rules (
  id serial PRIMARY KEY,
  availability_schedule_id integer NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (start_time < end_time)
);

-- FK-колонка сама по себе не индексируется: по ней идут и выборка правил расписания,
-- и каскадное удаление при DELETE расписания.
CREATE INDEX schedule_rules_schedule_id_idx ON schedule_rules (availability_schedule_id);

CREATE TABLE event_types (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  location text,
  availability_schedule_id integer NOT NULL REFERENCES availability_schedules(id),
  hidden boolean NOT NULL DEFAULT false
);

CREATE TABLE bookings (
  id serial PRIMARY KEY,
  event_type_id integer NOT NULL REFERENCES event_types(id),
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX bookings_active_slot_uniq
  ON bookings (event_type_id, date, start_time)
  WHERE status IN ('pending','confirmed');
