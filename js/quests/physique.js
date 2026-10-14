// PHYSIQUE QUEST - see FORMULAS.md. 4 exercises x 2 XP = 8 XP per complete day; 56 XP per level; max level 50.
// No penalties, no XP loss, no custom quests. Missed days change nothing.
import { rule, RuleError } from '../utils/validation.js';
import { awardXp, getXp, questLevel } from '../engine/xp-engine.js';
import { addCurrency } from '../engine/reward-engine.js';
import { addEvent } from '../features/inbox.js';
import { dateKey } from '../utils/dates.js';

export const EXERCISES = [
  { id: 'pushups', name: 'Push-ups', kind: 'reps', unit: 'reps' },
  { id: 'crunches', name: 'Crunches', kind: 'reps', unit: 'reps' },
  { id: 'climbers', name: 'Mountain climbers', kind: 'time', unit: 'sec' },
  { id: 'jacks', name: 'Jumping jacks', kind: 'time', unit: 'sec' },
];
export const PHY = { XP_PER_EXERCISE: 2, FULL_WORKOUT_XP: 8, FULL_WORKOUT_GOLD: 12 };
/** Target for an exercise at a level. tier = floor(level/3): L1-2 -> 0, L3-5 -> 1 ... L48-50 -> 16. */
export function targetFor(exId, level) {
  const tier = Math.floor(level / 3);
  if (exId === 'pushups' || exId === 'crunches') return 20 + 10 * tier;
  if (exId === 'climbers') return 15 + 10 * tier;
  if (exId === 'jacks') return 60 + 10 * tier;
  throw new RuleError('Unknown exercise.');
}
export function fmtTarget(exId, level) {
  const t = targetFor(exId, level);
  if (exId === 'jacks') return `${Math.floor(t / 60)} min${t % 60 ? ` ${t % 60} sec` : ''}`;
  return exId === 'climbers' ? `${t} sec` : `${t} reps`;
}
export const exOf = (id) => EXERCISES.find((e) => e.id === id);

export function dayRec(s, date) { return s.phy.days[date] || null; }
function ensureDay(s, date) {
  if (!s.phy.days[date]) s.phy.days[date] = { level: questLevel(s, 'physique'), done: {}, awarded: {}, timer: {}, full: false };
  return s.phy.days[date];
}
export function dayView(s, date) {
  const rec = dayRec(s, date); const level = rec ? rec.level : questLevel(s, 'physique');
  return EXERCISES.map((e) => ({ ...e, target: targetFor(e.id, level), done: rec?.done[e.id] || 0, complete: !!rec?.awarded[e.id], running: rec?.timer[e.id]?.since || null }));
}

function complete(s, ctx, date, rec, ex) {
  if (rec.awarded[ex.id]) return 0;
  rec.awarded[ex.id] = true;                                    // flag FIRST: a second call can never award again
  const got = awardXp(s, ctx, 'physique', PHY.XP_PER_EXERCISE);
  addEvent(s, ctx, { id: `ev-phy-${date}-${ex.id}`, cat: 'quest', type: 'quest-complete', title: `${ex.name} complete`, text: `${fmtTarget(ex.id, rec.level)} done. +${got} XP.`, amount: got, unit: 'XP', quest: 'physique' });
  if (EXERCISES.every((e) => rec.awarded[e.id]) && !rec.full) {
    rec.full = true; addCurrency(s, 'gold', PHY.FULL_WORKOUT_GOLD);
    addEvent(s, ctx, { id: `ev-phy-${date}-full`, cat: 'quest', type: 'quest-complete', title: 'Full workout complete', text: `All four exercises done today: ${PHY.FULL_WORKOUT_XP} XP and ${PHY.FULL_WORKOUT_GOLD} Gold in total. Well done.`, amount: PHY.FULL_WORKOUT_XP, unit: 'XP', quest: 'physique' });
  }
  return got;
}

/** Log a set of reps for push-ups / crunches. */
export function logReps(s, ctx, { ex, reps }) {
  const e = exOf(ex); rule(e && e.kind === 'reps', 'That exercise is timed. Use the timer.');
  rule(Number.isInteger(reps) && reps >= 1 && reps <= 500, 'Enter a whole number of reps from 1 to 500.');
  const date = dateKey(ctx.now); const rec = ensureDay(s, date);
  const target = targetFor(ex, rec.level);
  rule(!rec.awarded[ex], `${e.name} is already complete today.`, 'duplicate');
  rec.done[ex] = Math.min(target, (rec.done[ex] || 0) + reps);  // never counts beyond the target
  if (rec.done[ex] >= target) complete(s, ctx, date, rec, e);
  return rec.done[ex];
}
export function undoLastReps() { throw new RuleError('Logged sets cannot be undone.'); }

/** Timed exercises: seconds come ONLY from a running timer (timestamps), never from typing a number. */
export function startTimer(s, ctx, { ex }) {
  const e = exOf(ex); rule(e && e.kind === 'time', 'That exercise counts reps.');
  const date = dateKey(ctx.now); const rec = ensureDay(s, date);
  rule(!rec.awarded[ex], `${e.name} is already complete today.`, 'duplicate');
  rule(!rec.timer[ex]?.since, 'The timer is already running.');
  rec.timer[ex] = { since: ctx.now };
}
export function stopTimer(s, ctx, { ex }) {
  const e = exOf(ex); rule(e && e.kind === 'time', 'That exercise counts reps.');
  const date = dateKey(ctx.now); const rec = ensureDay(s, date);
  const t = rec.timer[ex]; rule(t?.since, 'The timer is not running.');
  const target = targetFor(ex, rec.level);
  const secs = Math.floor((ctx.now - t.since) / 1000);
  delete rec.timer[ex];
  // A segment far longer than the target means the app was left running, not exercising: it earns nothing.
  // (Returned, not thrown: a thrown error would roll the commit back and the stuck timer would stay.)
  if (secs > target * 1.5 + 30) return { discarded: true, message: 'That timer ran far longer than the target, so it earned nothing. Start it when you actually begin.' };
  rec.done[ex] = Math.min(target, (rec.done[ex] || 0) + secs);
  if (rec.done[ex] >= target) complete(s, ctx, date, rec, e);
  return { discarded: false, done: rec.done[ex] };
}
export const xpTotal = (s) => getXp(s, 'physique');
