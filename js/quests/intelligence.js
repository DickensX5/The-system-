// INTELLIGENCE QUEST - see FORMULAS.md. 140 XP per level, max level 100.
// Standard daily = 20 XP (3 verified questions). One custom quest at a time (5-30 XP, focus timer + written takeaway).
// Daily quest XP cap = 40. Never deducts XP. Pause available for sickness/emergencies.
import { rule, RuleError, cleanText, wordCount } from '../utils/validation.js';
import { awardXp } from '../engine/xp-engine.js';
import { addCurrency } from '../engine/reward-engine.js';
import { createPenalty, resolvePenalty, activePenalty, tierForXp } from '../engine/penalty-engine.js';
import { addEvent } from '../features/inbox.js';
import { dailyQuestions, penaltyChallenge, checkAnswer } from '../data/intelligence-bank.js';
import { dateKey, DAY, MIN, SEC } from '../utils/dates.js';
import { nid } from '../utils/ids.js';

export const INT = { STANDARD_XP: 20, CUSTOM_MIN: 5, CUSTOM_MAX: 30, DAILY_CAP: 40, MAX_DAYS: 14, PAUSE_MAX_DAYS: 7, PAUSE_COOLDOWN_DAYS: 14, WRONG_LOCK_MS: 30 * SEC, MIN_MINUTES_PER_5XP: 15 };
export const CATEGORIES = ['Logic and reasoning', 'Learning and comprehension', 'Strategy and decision-making', 'Technical intelligence', 'Reflection and critical thinking'];
export const customMinutes = (xp) => (xp / 5) * INT.MIN_MINUTES_PER_5XP;      // 5 XP=15 min ... 30 XP=90 min
export const xpToday = (s, date) => s.int.xpDay[date] || 0;
export const capRemaining = (s, date) => Math.max(0, INT.DAILY_CAP - xpToday(s, date));

function grantQuestXp(s, ctx, amount) {
  const date = dateKey(ctx.now);
  const got = awardXp(s, ctx, 'intelligence', amount, { cap: capRemaining(s, date) });
  s.int.xpDay[date] = xpToday(s, date) + got;
  return got;
}

// ------------------------------------------------------------------------ standard daily quest
export function dailyState(s, date) { return s.int.daily[date] || { solved: {}, wrong: {}, lock: {}, done: false }; }
export function dailyView(s, date) { return { questions: dailyQuestions(date), state: dailyState(s, date) }; }
export function answerDaily(s, ctx, { qid, answer }) {
  const date = dateKey(ctx.now);
  const qs = dailyQuestions(date); const q = qs.find((x) => x.id === qid);
  rule(q, 'That question is not part of today\'s quest.');
  const st = (s.int.daily[date] = s.int.daily[date] || { solved: {}, wrong: {}, lock: {}, done: false });
  rule(!st.done, 'Today\'s quest is already complete.', 'duplicate');
  rule(!st.solved[qid], 'You already solved that one.');
  rule(!(st.lock[qid] > ctx.now), `Wait ${Math.ceil((st.lock[qid] - ctx.now) / 1000)}s before trying that question again.`, 'locked');
  rule(answer !== '' && answer != null, 'Enter an answer.');
  if (!checkAnswer(q, answer)) {
    st.wrong[qid] = (st.wrong[qid] || 0) + 1; st.lock[qid] = ctx.now + INT.WRONG_LOCK_MS;
    return { correct: false };
  }
  st.solved[qid] = true;
  let got = 0;
  if (qs.every((x) => st.solved[x.id])) {
    st.done = true; st.doneAt = ctx.now;                       // flag before awarding
    got = grantQuestXp(s, ctx, INT.STANDARD_XP);
    addCurrency(s, 'gold', 20);
    addEvent(s, ctx, { id: `ev-int-daily-${date}`, cat: 'quest', type: 'quest-complete', title: 'Daily quest complete', text: `All three questions solved. +${got} XP, +20 Gold.`, amount: got, unit: 'XP', quest: 'intelligence' });
  }
  return { correct: true, explain: q.explain, xp: got, allDone: st.done };
}

// ------------------------------------------------------------------------ custom quest
export const isPaused = (s, now) => !!(s.int.pause && s.int.pause.until > now);
export const focusMs = (a, now) => a.focusMs + (a.since ? Math.max(0, now - a.since) : 0);
export function createCustom(s, ctx, { title, category, objective, xp, days }) {
  rule(!s.int.custom.active, 'You already have an active custom quest. Finish it (or let it expire) first. Only one at a time.', 'stack');
  rule(!activePenalty(s, 'intelligence'), 'Clear your penalty challenge first.');
  title = cleanText(title, 60); objective = cleanText(objective, 240);
  rule(title.length >= 3, 'Give the quest a name (3+ characters).');
  rule(objective.length >= 15, 'Describe a clear objective (15+ characters) so completion can be judged.');
  rule(CATEGORIES.includes(category), 'Choose a category.');
  rule(Number.isInteger(xp) && xp >= INT.CUSTOM_MIN && xp <= INT.CUSTOM_MAX && xp % 5 === 0, `XP must be ${INT.CUSTOM_MIN}-${INT.CUSTOM_MAX} in steps of 5 (max 30 per single quest).`);
  rule(Number.isInteger(days) && days >= 1 && days <= INT.MAX_DAYS, `Deadline must be 1-${INT.MAX_DAYS} days.`);
  const id = nid(s, 'iq');
  s.int.custom.active = { id, title, category, objective, xp, createdAt: ctx.now, deadlineAt: ctx.now + days * DAY, focusMs: 0, since: null, minutes: customMinutes(xp) };
  addEvent(s, ctx, { id: `ev-${id}-new`, cat: 'quest', type: 'quest-new', title: `Custom quest: ${title}`, text: `${category}. ${xp} XP, ${customMinutes(xp)} minutes of focus plus a written takeaway.`, quest: 'intelligence' });
}
export function focusStart(s, ctx) { const a = need(s); rule(!a.since, 'Focus timer already running.'); a.since = ctx.now; }
export function focusPause(s, ctx) { const a = need(s); rule(a.since, 'Focus timer is not running.'); a.focusMs += Math.max(0, ctx.now - a.since); a.since = null; }
function need(s) { const a = s.int.custom.active; rule(a, 'No active custom quest.'); return a; }
export function completeCustom(s, ctx, { takeaway }) {
  const a = need(s);
  rule(ctx.now < a.deadlineAt, 'This quest has expired.', 'expired');
  const ms = focusMs(a, ctx.now);
  rule(ms >= a.minutes * MIN, `Focus time needed: ${a.minutes} min. Logged: ${Math.floor(ms / MIN)} min.`, 'focus');
  takeaway = cleanText(takeaway, 600);
  rule(wordCount(takeaway) >= 8, 'Write your takeaway in at least 8 words: what did you learn or decide?');
  rule(capRemaining(s, dateKey(ctx.now)) > 0, `Today's Intelligence quest XP cap (${INT.DAILY_CAP}) is reached. Complete it tomorrow if the deadline allows.`, 'cap');
  s.int.custom.active = null;                                    // clear first -> a second tap finds no active quest
  const got = grantQuestXp(s, ctx, a.xp);
  addCurrency(s, 'gold', got);
  s.int.custom.history.push({ id: a.id, title: a.title, status: 'done', xp: got, at: ctx.now });
  addEvent(s, ctx, { id: `ev-${a.id}-done`, cat: 'quest', type: 'quest-complete', title: `Custom quest complete: ${a.title}`, text: `+${got} XP${got < a.xp ? ` (daily cap reduced it from ${a.xp})` : ''}, +${got} Gold.`, amount: got, unit: 'XP', quest: 'intelligence' });
  return got;
}
/** Only an unstarted quest created in the last 10 minutes may be cancelled (typo protection). */
export function cancelCustom(s, ctx) {
  const a = need(s);
  rule(a.focusMs === 0 && !a.since && ctx.now - a.createdAt <= 10 * MIN, 'A quest can only be cancelled within 10 minutes if you have not started it.');
  s.int.custom.active = null;
}

// ------------------------------------------------------------------------ pause (sickness / emergency)
export function startPause(s, ctx, { days }) {
  rule(Number.isInteger(days) && days >= 1 && days <= INT.PAUSE_MAX_DAYS, `A pause lasts 1-${INT.PAUSE_MAX_DAYS} days.`);
  rule(!isPaused(s, ctx.now), 'A pause is already active.');
  rule(ctx.now - s.int.lastPauseEnd >= INT.PAUSE_COOLDOWN_DAYS * DAY, `Pauses are limited: wait ${INT.PAUSE_COOLDOWN_DAYS} days after the last pause ended.`, 'limit');
  const ms = days * DAY;
  s.int.pause = { from: ctx.now, until: ctx.now + ms }; s.int.lastPauseEnd = ctx.now + ms;
  // Shift deadlines so being unwell never costs you the quest or a penalty challenge.
  if (s.int.custom.active) s.int.custom.active.deadlineAt += ms;
  const p = activePenalty(s, 'intelligence'); if (p) p.deadline += ms;
  addEvent(s, ctx, { cat: 'quest', type: 'pause', title: 'Intelligence paused', text: `Paused for ${days} day(s). Deadlines moved later by the same amount. Rest well.`, quest: 'intelligence' });
}

// ------------------------------------------------------------------------ expiry & penalty challenge
export function tick(s, ctx) {
  let changed = false;
  const a = s.int.custom.active;
  if (a && ctx.now >= a.deadlineAt) {
    s.int.custom.active = null;
    s.int.custom.history.push({ id: a.id, title: a.title, status: 'expired', xp: 0, at: ctx.now });
    addEvent(s, ctx, { id: `ev-${a.id}-expired`, cat: 'quest', type: 'quest-expired', title: `Quest expired: ${a.title}`, text: 'The deadline passed. No XP was deducted.', quest: 'intelligence' });
    createPenalty(s, ctx, { quest: 'intelligence', tier: tierForXp(a.xp), causeId: a.id, causeName: a.title });
    changed = true;
  }
  if (s.int.pause && s.int.pause.until <= ctx.now) { s.int.pause = null; changed = true; }
  return changed;
}
export const challengeFor = (p) => penaltyChallenge(p.tier, p.id);
export function submitPenalty(s, ctx, { id, answers = {}, text = '' }) {
  const p = s.penalties[id]; rule(p && p.status === 'active' && p.quest === 'intelligence', 'That penalty is not active.');
  rule(ctx.now < p.deadline, 'The deadline has passed.', 'expired');
  const ch = challengeFor(p);
  const correct = ch.questions.filter((q) => checkAnswer(q, answers[q.id])).length;
  if (correct < ch.pass) { p.attempts += 1; p.lastAttemptAt = ctx.now; return { ok: false, correct, need: ch.pass }; }
  rule(wordCount(cleanText(text, 1500)) >= ch.explainWords, `Write your explanation in at least ${ch.explainWords} words.`);
  resolvePenalty(s, ctx, id);
  return { ok: true, correct, need: ch.pass };
}
