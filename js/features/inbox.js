// Inbox / event history. Every important progression change writes exactly one record with a stable id.
// Events are written INSIDE the same commit as the change they describe, so the Inbox can never
// claim something happened that was rolled back.
import { nid } from '../utils/ids.js';

export const MAX_EVENTS = 3000;
export const CATEGORIES = [
  { id: 'all', label: 'All' }, { id: 'progress', label: 'Progress' }, { id: 'reward', label: 'Rewards' },
  { id: 'penalty', label: 'Penalties' }, { id: 'finance', label: 'Finance' }, { id: 'market', label: 'Market' }, { id: 'quest', label: 'Quests' },
];

/**
 * @param ev {id?, cat, type, title, text, amount?, unit?, meta?}
 * @returns the event, or null if an event with the same id already exists (dedupe).
 */
export function addEvent(s, ctx, ev) {
  const id = ev.id || nid(s, 'ev');
  if (ev.id && s.inbox.events.some((e) => e.id === id)) return null;
  const rec = { id, at: ctx.now, cat: ev.cat, type: ev.type, title: ev.title, text: ev.text || '', amount: ev.amount ?? null, unit: ev.unit || null, quest: ev.quest || null, meta: ev.meta || null };
  s.inbox.events.push(rec);
  if (s.inbox.events.length > MAX_EVENTS) s.inbox.events.splice(0, s.inbox.events.length - MAX_EVENTS);
  return rec;
}
export function unreadCount(s) { return s.inbox.events.filter((e) => e.at > s.inbox.readAt).length; }
export function markAllRead(s, ctx) { s.inbox.readAt = ctx.now; }
export function listEvents(s, cat = 'all') {
  const list = cat === 'all' ? s.inbox.events : s.inbox.events.filter((e) => e.cat === cat);
  return list.slice().reverse();
}
