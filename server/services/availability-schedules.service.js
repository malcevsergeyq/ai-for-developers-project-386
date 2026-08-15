import { availabilityScheduleNotFound, validationError } from '../errors.js';
import { toAvailabilityScheduleDto } from '../mappers/availability-schedule.mapper.js';
import { isTimeString, toMinutes, overlaps } from './intervals.js';

const ALLOWED_FIELDS = ['name', 'timezone', 'rules'];
const ALLOWED_RULE_FIELDS = ['weekday', 'startTime', 'endTime'];

/**
 * Идентификатор из пути. Всё, что не целое положительное число, — это не «плохой запрос»,
 * а обращение к записи, которой нет: одна ветка ответа вместо двух.
 */
const parseId = (raw) => {
  if (!/^[1-9]\d*$/.test(String(raw))) throw availabilityScheduleNotFound();
  return Number(raw);
};

const asObject = (body, what) => {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError(`${what} должно быть JSON-объектом`);
  }
  return body;
};

/**
 * Неизвестное поле — это почти всегда опечатка в имени. Молча проигнорировать её значит
 * отдать `200` на запрос, который ничего не изменил, — худший из возможных ответов.
 */
const rejectUnknownFields = (body, allowed, what) => {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw validationError(`${what}: неизвестные поля — ${unknown.join(', ')}`);
  }
};

const parseName = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError('Поле name должно быть непустой строкой');
  }
  return value.trim();
};

/**
 * `Intl` — единственный доступный здесь справочник зон, и он же будет считать слоты,
 * поэтому проверять имя чем-то другим смысла нет. Отдельная проверка формы отсекает
 * числовые offset'ы вроде `+03:00`: контракт требует именно IANA-имя, потому что offset
 * не знает про переход на летнее время.
 */
const IANA_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const parseTimezone = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError('Поле timezone должно быть непустой строкой');
  }
  const timezone = value.trim();

  if (!IANA_NAME_PATTERN.test(timezone)) {
    throw validationError(`Поле timezone должно быть IANA-именем зоны, получено: ${timezone}`);
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw validationError(`Неизвестная таймзона: ${timezone}`);
  }
  return timezone;
};

const parseRule = (raw, index) => {
  const rule = asObject(raw, `rules[${index}]`);
  rejectUnknownFields(rule, ALLOWED_RULE_FIELDS, `rules[${index}]`);

  const { weekday, startTime, endTime } = rule;

  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw validationError(`rules[${index}]: weekday — целое число от 1 (Пн) до 7 (Вс)`);
  }
  for (const [field, value] of [['startTime', startTime], ['endTime', endTime]]) {
    if (!isTimeString(value)) {
      throw validationError(`rules[${index}]: ${field} — время в формате HH:MM (00:00..23:59)`);
    }
  }
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    throw validationError(`rules[${index}]: startTime должен быть строго меньше endTime`);
  }

  return { weekday, startTime, endTime };
};

/**
 * Пересекающиеся окна одного дня недели дали бы дубли в генерации слотов, поэтому
 * отсекаются на входе. Сравнение — той же функцией, что и занятость слотов:
 * стык впритык (09:00–13:00 и 13:00–18:00) пересечением не считается.
 */
const assertNoOverlaps = (rules) => {
  const byWeekday = new Map();
  for (const rule of rules) {
    const sameDay = byWeekday.get(rule.weekday) ?? [];
    const conflict = sameDay.find((other) =>
      overlaps(
        toMinutes(rule.startTime),
        toMinutes(rule.endTime),
        toMinutes(other.startTime),
        toMinutes(other.endTime),
      ),
    );
    if (conflict) {
      throw validationError(
        `Правила одного дня недели (weekday ${rule.weekday}) пересекаются: `
        + `${conflict.startTime}–${conflict.endTime} и ${rule.startTime}–${rule.endTime}`,
      );
    }
    sameDay.push(rule);
    byWeekday.set(rule.weekday, sameDay);
  }
};

const parseRules = (value) => {
  if (!Array.isArray(value)) {
    throw validationError('Поле rules должно быть массивом');
  }
  const rules = value.map(parseRule);
  assertNoOverlaps(rules);
  // Порядок ответа задаёт контракт, а не порядок в теле запроса: тот же порядок,
  // в котором правила потом приходят из базы.
  return rules.sort((a, b) =>
    a.weekday - b.weekday || toMinutes(a.startTime) - toMinutes(b.startTime));
};

const parseCreatePayload = (body) => {
  const payload = asObject(body ?? {}, 'Тело запроса');
  rejectUnknownFields(payload, ALLOWED_FIELDS, 'Тело запроса');

  for (const field of ALLOWED_FIELDS) {
    if (payload[field] === undefined) throw validationError(`Поле ${field} обязательно`);
  }

  return {
    name: parseName(payload.name),
    timezone: parseTimezone(payload.timezone),
    rules: parseRules(payload.rules),
  };
};

/** PATCH частичный: применяется только то, что реально пришло в теле. */
const parseUpdatePayload = (body) => {
  const payload = asObject(body ?? {}, 'Тело запроса');
  rejectUnknownFields(payload, ALLOWED_FIELDS, 'Тело запроса');

  const provided = ALLOWED_FIELDS.filter((field) => payload[field] !== undefined);
  if (provided.length === 0) {
    throw validationError(`Тело запроса должно содержать хотя бы одно поле: ${ALLOWED_FIELDS.join(', ')}`);
  }

  const parsers = { name: parseName, timezone: parseTimezone, rules: parseRules };
  return Object.fromEntries(provided.map((field) => [field, parsers[field](payload[field])]));
};

/**
 * Правила предметной области для расписаний доступности: что считается корректным
 * набором окон и что значит «расписания нет». HTTP-слой об этом не знает.
 */
export const createAvailabilitySchedulesService = (availabilitySchedulesRepository) => ({
  async list() {
    const rows = await availabilitySchedulesRepository.findAll();
    return rows.map(toAvailabilityScheduleDto);
  },

  async getById(rawId) {
    const row = await availabilitySchedulesRepository.findById(parseId(rawId));
    if (!row) throw availabilityScheduleNotFound();
    return toAvailabilityScheduleDto(row);
  },

  async create(body) {
    const row = await availabilitySchedulesRepository.create(parseCreatePayload(body));
    return toAvailabilityScheduleDto(row);
  },

  async update(rawId, body) {
    const id = parseId(rawId);
    const row = await availabilitySchedulesRepository.update(id, parseUpdatePayload(body));
    if (!row) throw availabilityScheduleNotFound();
    return toAvailabilityScheduleDto(row);
  },

  async remove(rawId) {
    const removed = await availabilitySchedulesRepository.remove(parseId(rawId));
    if (!removed) throw availabilityScheduleNotFound();
  },
});
