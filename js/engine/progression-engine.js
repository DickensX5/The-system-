// OVERALL LEVEL ENGINE + reconcile (level-ups, grants, title sync, due timers).
//
// Overall level (exact integer arithmetic, deterministic):
//   each quest contributes  xp_q / maxXp_q   (0..1), equally weighted (1/4 each)
//   S = (1/4) * sum(xp_q / maxXp_q)
//   level = 1 + floor(99 * S)           -> 1..100  (100 only when ALL four quests are fully maxed)
// To avoid floating-point error the sum is evaluated over the common denominator 210,000.
import { QUESTS, maxXp, cappedXp, questLevel, QUEST_NAMES } from './xp-engine.js';
import { BANDS } from '../data/titles.js';
import { addEvent } from '../features/inbox.js';
import { syncTitles } from './title-engine.js';
import { syncGrants } from './reward-engine.js';
import { tickPenalties } from './penalty-engine.js';
import { tick as finTick } from '../quests/financial.js';
import { tick as intTick } from '../quests/intelligence.js';
import { tick as romTick } from '../quests/romance.js';

export const OVERALL_MAX = 100;
const LCM = 210000;                                  // lcm(300, 2800, 14000, 5000)
const DEN = 4 * LCM;                                 // 840,000

/** Integer numerator N such that S = N / 840,000. */
export function overallNumerator(s) {
  return QUESTS.reduce((n, q) => n + cappedXp(s, q) * (LCM / maxXp(q)), 0);
}
export function overallLevelFromNumerator(N) { return Math.min(OVERALL_MAX, Math.max(1, 1 + Math.floor((99 * N) / DEN))); }
export function overallLevel(s) { return overallLevelFromNumerator(overallNumerator(s)); }
/** Smallest numerator that reaches level L (L>=2): ceil((L-1)*DEN/99). */
const needFor = (L) => Math.ceil(((L - 1) * DEN) / 99);
export function overallProgress(s) {
  const N = overallNumerator(s); const level = overallLevelFromNumerator(N);
  if (level >= OVERALL_MAX) return { level, pct: 100, maxed: true, N };
  const lo = level === 1 ? 0 : needFor(level), hi = needFor(level + 1);
  return { level, pct: Math.max(0, Math.min(100, ((N - lo) / (hi - lo)) * 100)), maxed: false, N };
}
export function bandFor(level) { return BANDS.find((b) => level >= b.from && level <= b.to) || BANDS[0]; }

/** Run inside every commit: deterministic fix-ups that must hold after ANY change. */
export function finalize(s, ctx) {
  dueWork(s, ctx);
  // 1) level-ups (one-time, based on peak level)
  for (const q of QUESTS) {
    const lv = questLevel(s, q);
    if (lv > s.maxLevel[q]) {
      for (let l = s.maxLevel[q] + 1; l <= lv; l++) {
        addEvent(s, ctx, { id: `ev-lvl-${q}-${l}`, cat: 'progress', type: 'level-up', title: `${QUEST_NAMES[q]} level ${l}`, text: `${QUEST_NAMES[q]} reached level ${l}. A reward is waiting to be claimed.`, amount: l, unit: 'LV', quest: q });
      }
      s.maxLevel[q] = lv;
    }
  }
  syncGrants(s);
  const ov = overallLevel(s);
  if (ov > s.maxLevel.overall) {
    addEvent(s, ctx, { id: `ev-lvl-overall-${ov}`, cat: 'progress', type: 'level-up', title: `Overall level ${ov}`, text: `Your overall level rose to ${ov}.`, amount: ov, unit: 'LV' });
    s.maxLevel.overall = ov;
  }
  const band = bandFor(ov);
  const bandIdx = (id) => BANDS.findIndex((b) => b.id === id);
  if (bandIdx(band.id) > bandIdx(s.maxLevel.band)) {
    addEvent(s, ctx, { id: `ev-band-${band.id}`, cat: 'progress', type: 'title-unlock', title: `Rank: ${band.name}`, text: `You entered the ${band.name} rank (levels ${band.from}-${band.to}).` });
    s.maxLevel.band = band.id;
  }
  // 2) titles (unlock + validate equipped)
  syncTitles(s, ctx, ov);
}

/** Timers, deadlines, penalties: idempotent, runs on every commit and on app start/resume. */
export function dueWork(s, ctx) {
  let changed = false;
  changed = finTick(s, ctx) || changed;
  changed = intTick(s, ctx) || changed;
  changed = romTick(s, ctx) || changed;
  changed = tickPenalties(s, ctx) || changed;
  return changed;
}
