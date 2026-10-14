// XP ENGINE - the only place XP changes. Quest levels, XP awards, summoning (XP transfers).
import { RuleError, rule, posInt } from '../utils/validation.js';
import { addEvent } from '../features/inbox.js';
import { nid } from '../utils/ids.js';
import { HOUR, dateKey } from '../utils/dates.js';
import { eligibleXp, FIN } from '../quests/financial.js';

export const QUESTS = ['financial', 'physique', 'intelligence', 'romance'];
export const QUEST_NAMES = { financial: 'Financial', physique: 'Physique', intelligence: 'Intelligence', romance: 'Romance' };
// per = XP per level, max = highest level. Max total XP = per * max.
export const QUEST_RULES = {
  financial: { per: FIN.XP_PER_LEVEL, max: FIN.MAX_LEVEL },   // 6 XP (= TSh 36,000) per level, level 50 cap
  physique: { per: 56, max: 50 },                              // 56 XP = seven full workouts
  intelligence: { per: 140, max: 100 },                        // 140 XP = seven standard daily quests
  romance: { per: 100, max: 50 },                              // not specified by the brief: documented choice
};
export const maxXp = (q) => QUEST_RULES[q].per * QUEST_RULES[q].max;

export function getXp(s, q) { return q === 'financial' ? eligibleXp(s) : s.xp[q]; }
/** XP clamped to the quest's maximum. */
export const cappedXp = (s, q) => Math.min(getXp(s, q), maxXp(q));
export function levelFromXp(q, xp) { const r = QUEST_RULES[q]; return Math.min(r.max, 1 + Math.floor(Math.max(0, xp) / r.per)); }
export const questLevel = (s, q) => levelFromXp(q, getXp(s, q));
export function questProgress(s, q) {
  const r = QUEST_RULES[q]; const xp = cappedXp(s, q); const level = levelFromXp(q, xp);
  const maxed = xp >= maxXp(q);
  const into = maxed ? r.per : xp - (level - 1) * r.per;
  return { xp, level, into, need: r.per, pct: (into / r.per) * 100, maxed, totalMax: maxXp(q) };
}

/**
 * Award quest XP. `limit` caps awards per day (see daily caps). Returns the amount ACTUALLY awarded (may be < requested).
 * Financial XP is derived from balance and cannot be awarded.
 */
export function awardXp(s, ctx, q, amount, { cap = Infinity } = {}) {
  rule(q !== 'financial', 'Financial XP comes from your recorded balance and cannot be awarded directly.');
  rule(Number.isInteger(amount) && amount >= 0, 'XP award must be a whole number.');
  const room = maxXp(q) - s.xp[q];
  const got = Math.max(0, Math.min(amount, room, cap));
  s.xp[q] += got;
  return got;
}
/** Used only by summoning. Throws instead of going negative. */
function deductXp(s, q, amount) {
  rule(getXp(s, q) >= amount, `${QUEST_NAMES[q]} only has ${getXp(s, q)} XP available.`, 'xp');
  if (q === 'financial') s.fin.xpOut += amount; else s.xp[q] -= amount;
}

/* ---------------------------------------------------------------------------------------------
 * XP SUMMONING
 *  - Unlocks at overall level 5, and one more unlock (charge) at every further 5-level milestone.
 *  - One transfer spends one unlock charge.
 *  - At most 250 XP per ROLLING 24 hours: sum of transfers whose timestamp is within the last 24h.
 *  - Only Romance can receive. Financial / Physique / Intelligence may send. The source loses exactly what Romance gains.
 * ------------------------------------------------------------------------------------------- */
export const SUMMON = { CAP: 250, WINDOW: 24 * HOUR, FIRST: 5, STEP: 5, RECEIVERS: ['romance'], SENDERS: ['financial', 'physique', 'intelligence'] };

export const summonMilestonesReached = (overall) => (overall >= SUMMON.FIRST ? Math.floor(overall / SUMMON.STEP) : 0);
export const summonCharges = (s, overall) => Math.max(0, summonMilestonesReached(overall) - s.summon.used);
export const nextSummonMilestone = (overall) => (overall < SUMMON.FIRST ? SUMMON.FIRST : (Math.floor(overall / SUMMON.STEP) + 1) * SUMMON.STEP);
export function summonUsedInWindow(s, now) { return s.summon.log.filter((t) => t.at > now - SUMMON.WINDOW && t.at <= now).reduce((a, t) => a + t.amount, 0); }
export const summonRemaining = (s, now) => Math.max(0, SUMMON.CAP - summonUsedInWindow(s, now));
/** When some allowance comes back (oldest transfer in the window + 24h), or null if the full allowance is free. */
export function summonRegainAt(s, now) {
  const inWin = s.summon.log.filter((t) => t.at > now - SUMMON.WINDOW && t.at <= now).sort((a, b) => a.at - b.at);
  return inWin.length ? inWin[0].at + SUMMON.WINDOW : null;
}

/** overall = current overall level (passed in to keep this module free of cycles). */
export function summonXp(s, ctx, { from, to, amount, requestId }, overall) {
  rule(typeof requestId === 'string' && requestId.length >= 6, 'Missing request id.');
  if (s.summon.requests[requestId]) throw new RuleError('That transfer was already completed.', 'duplicate');
  rule(SUMMON.SENDERS.includes(from), `${QUEST_NAMES[from] || 'That quest'} cannot send XP.`);
  rule(SUMMON.RECEIVERS.includes(to), `${QUEST_NAMES[to] || 'That quest'} cannot receive summoned XP. Only Romance can.`);
  rule(from !== to, 'Source and destination must differ.');
  posInt(amount, 'Transfer amount');
  rule(overall >= SUMMON.FIRST, `XP Summoning unlocks at overall level ${SUMMON.FIRST}.`, 'locked');
  rule(summonCharges(s, overall) > 0, `No summoning unlock available. The next one arrives at overall level ${nextSummonMilestone(overall)}.`, 'locked');
  const remaining = summonRemaining(s, ctx.now);
  rule(amount <= remaining, `Only ${remaining} XP of the 250 XP rolling 24-hour allowance is left.`, 'cap');
  rule(amount <= getXp(s, from), `${QUEST_NAMES[from]} only has ${getXp(s, from)} XP.`, 'xp');
  rule(amount <= maxXp(to) - s.xp[to], `Romance can only receive ${maxXp(to) - s.xp[to]} more XP (its maximum).`, 'full');
  const fromBefore = getXp(s, from), toBefore = s.xp[to];
  deductXp(s, from, amount);
  s.xp[to] += amount;                                   // exact same amount: nothing created, nothing lost
  s.summon.used += 1;
  const id = nid(s, 'sm');
  s.summon.log.push({ id, at: ctx.now, from, to, amount });
  s.summon.requests[requestId] = id;
  const ids = Object.keys(s.summon.requests); if (ids.length > 200) delete s.summon.requests[ids[0]];
  addEvent(s, ctx, { id: `ev-${id}`, cat: 'progress', type: 'summon', title: 'XP Summoning', text: `${QUEST_NAMES[from]} (${fromBefore} → ${fromBefore - amount} XP) sent ${amount} XP to ${QUEST_NAMES[to]} (${toBefore} → ${toBefore + amount} XP).`, amount, unit: 'XP', quest: to, meta: { from, to } });
  return { id, amount };
}

/** Item-XP (tiny, capped). Used by consumables in the reward engine. Returns actual XP granted. */
export const ITEM_XP_DAILY_CAP = 30;
export function awardItemXp(s, ctx, q, amount) {
  const key = `${dateKey(ctx.now)}:${q}`;
  const used = s.itemXp[key] || 0;
  const got = awardXp(s, ctx, q, amount, { cap: ITEM_XP_DAILY_CAP - used });
  s.itemXp[key] = used + got;
  return got;
}
