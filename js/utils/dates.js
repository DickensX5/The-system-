// Date helpers. All "days" are LOCAL calendar days, keyed as YYYY-MM-DD.
// Timers are always computed from stored timestamps (ms since epoch), never from
// "time the app has been open", so they survive reloads and device restarts.
export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Local YYYY-MM-DD for a timestamp. */
export function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Local midnight Date of a YYYY-MM-DD key. */
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
export function isDateKey(k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && dateKey(parseKey(k).getTime()) === k; }
/** Add n calendar days (DST-safe because it goes through the Date constructor). */
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d.getTime());
}
/** 0 = Sunday ... 6 = Saturday */
export function weekday(key) { return parseKey(key).getDay(); }
/** Inclusive list of keys from a to b. */
export function eachDay(a, b) {
  const out = [];
  for (let k = a, i = 0; k <= b && i < 4000; k = addDays(k, 1), i++) out.push(k);
  return out;
}
export function startOfDayMs(key) { return parseKey(key).getTime(); }
export function monthDays(year, month0) {
  const n = new Date(year, month0 + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${year}-${pad(month0 + 1)}-${pad(i + 1)}`);
}

/** Split a duration in ms into d/h/m/s (never negative). */
export function countdownParts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
/** DD:HH:MM:SS */
export function formatCountdown(ms) {
  const { d, h, m, s } = countdownParts(ms);
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
}
export function formatDateTime(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function formatTimeAgo(ms, now) {
  const diff = Math.max(0, now - ms);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
