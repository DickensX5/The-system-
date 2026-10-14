// ROMANCE QUEST - nested mini-app. 100 XP per level, max level 50 (the brief gives no numbers: documented choice).
// Custom quests only (max 3 active), deadlines persisted as timestamps, heart completion control, penalty dungeon.
// Romance is the ONLY quest that can receive XP Summoning.
import { rule, cleanText, wordCount } from '../utils/validation.js';
import { awardXp } from '../engine/xp-engine.js';
import { addCurrency } from '../engine/reward-engine.js';
import { createPenalty, resolvePenalty, activePenalty, tierForXp } from '../engine/penalty-engine.js';
import { addEvent } from '../features/inbox.js';
import { checkQuestText, romancePenaltyChallenge } from '../data/romance-data.js';
import { checkAnswer } from '../data/intelligence-bank.js';
import { dateKey, DAY, MIN } from '../utils/dates.js';
import { nid } from '../utils/ids.js';

export const ROM = { MAX_ACTIVE: 3, MIN_XP: 5, MAX_XP: 30, DAILY_CAP: 60, MIN_AGE: 10 * MIN, MAX_DAYS: 14 };
export const xpToday = (s, date) => s.rom.xpDay[date] || 0;
export const capRemaining = (s, date) => Math.max(0, ROM.DAILY_CAP - xpToday(s, date));
export const activeQuests = (s) => s.rom.quests.filter((q) => q.status === 'active');
/** 'active' | 'done' | 'expired' (state derived from stored timestamps, never from an open screen) */
export const questState = (q, now) => (q.status === 'active' && now >= q.deadlineAt ? 'expired' : q.status);

export function createQuest(s, ctx, { name, objective, xp, days }) {
  rule(!activePenalty(s, 'romance'), 'Clear the penalty challenge first.');
  rule(activeQuests(s).length < ROM.MAX_ACTIVE, `You can have at most ${ROM.MAX_ACTIVE} active quests.`, 'stack');
  name = cleanText(name, 60); objective = cleanText(objective, 240);
  rule(name.length >= 3, 'Give the quest a name (3+ characters).');
  rule(objective.length >= 15, 'Describe what you will do (15+ characters).');
  const bad = checkQuestText(`${name} ${objective}`); rule(!bad, bad || '', 'unsafe');
  rule(Number.isInteger(xp) && xp >= ROM.MIN_XP && xp <= ROM.MAX_XP && xp % 5 === 0, `XP must be ${ROM.MIN_XP}-${ROM.MAX_XP} in steps of 5.`);
  rule(Number.isInteger(days) && days >= 1 && days <= ROM.MAX_DAYS, `Deadline must be 1-${ROM.MAX_DAYS} days.`);
  rule(!s.rom.quests.some((q) => q.status === 'active' && q.name.toLowerCase() === name.toLowerCase()), 'You already have an active quest with that name.');
  const id = nid(s, 'rq');
  s.rom.quests.push({ id, name, objective, xp, createdAt: ctx.now, deadlineAt: ctx.now + days * DAY, status: 'active' });
  addEvent(s, ctx, { id: `ev-${id}-new`, cat: 'quest', type: 'quest-new', title: `Romance quest: ${name}`, text: `${xp} XP. Deadline in ${days} day(s).`, quest: 'romance' });
  return id;
}
/** Heart tap. Needs: respectful confirmation + a short reflection + minimum time since creation (anti-farming). */
export function completeQuest(s, ctx, { id, respectful, reflection }) {
  const q = s.rom.quests.find((x) => x.id === id);
  rule(q, 'Quest not found.');
  rule(q.status === 'active', q.status === 'done' ? 'Already completed.' : 'This quest is no longer active.', 'duplicate');
  rule(ctx.now < q.deadlineAt, 'This quest has expired.', 'expired');
  rule(respectful === true, 'Confirm that you acted respectfully and without pressure.');
  reflection = cleanText(reflection, 500);
  rule(wordCount(reflection) >= 6, 'Write a short reflection (6+ words): what did you do and how did it go?');
  rule(ctx.now - q.createdAt >= ROM.MIN_AGE, 'Real actions take time. Come back after 10 minutes from creating the quest.', 'too-soon');
  rule(capRemaining(s, dateKey(ctx.now)) > 0, `Today's Romance quest XP cap (${ROM.DAILY_CAP}) is reached. Come back tomorrow.`, 'cap');
  q.status = 'done'; q.doneAt = ctx.now;                         // flag first
  const date = dateKey(ctx.now);
  const got = awardXp(s, ctx, 'romance', q.xp, { cap: capRemaining(s, date) });
  s.rom.xpDay[date] = xpToday(s, date) + got;
  addCurrency(s, 'hearts', got);
  addEvent(s, ctx, { id: `ev-${id}-done`, cat: 'quest', type: 'quest-complete', title: `Romance quest complete: ${q.name}`, text: `+${got} XP, +${got} Heart Coins.`, amount: got, unit: 'XP', quest: 'romance' });
  return got;
}
export function tick(s, ctx) {
  let changed = false;
  for (const q of s.rom.quests) {
    if (q.status === 'active' && ctx.now >= q.deadlineAt) {
      q.status = 'expired'; q.expiredAt = ctx.now; changed = true;
      addEvent(s, ctx, { id: `ev-${q.id}-expired`, cat: 'quest', type: 'quest-expired', title: `Quest expired: ${q.name}`, text: 'The deadline passed. No XP was deducted.', quest: 'romance' });
      createPenalty(s, ctx, { quest: 'romance', tier: tierForXp(q.xp), causeId: q.id, causeName: q.name });
    }
  }
  return changed;
}
export const challengeFor = (p) => romancePenaltyChallenge(p.tier, p.id);
export function submitPenalty(s, ctx, { id, answers = {}, text = '' }) {
  const p = s.penalties[id]; rule(p && p.status === 'active' && p.quest === 'romance', 'That penalty is not active.');
  rule(ctx.now < p.deadline, 'The deadline has passed.', 'expired');
  const ch = challengeFor(p);
  const correct = ch.questions.filter((q) => checkAnswer(q, answers[q.id])).length;
  if (correct < ch.pass) { p.attempts += 1; p.lastAttemptAt = ctx.now; return { ok: false, correct, need: ch.pass }; }
  text = cleanText(text, 1500);
  rule(wordCount(text) >= ch.reflectionWords, `Write your reflection in at least ${ch.reflectionWords} words.`);
  const bad = checkQuestText(text); rule(!bad, bad || '');
  resolvePenalty(s, ctx, id);
  return { ok: true, correct, need: ch.pass };
}
