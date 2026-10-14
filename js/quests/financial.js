// FINANCIAL QUEST - pure logic. See FORMULAS.md for the full formula and worked examples.
//
//   balance      = startingBalance + income - expenses - appliedPenalties        (never below 0)
//   grossXp      = floor(balance / 6000)                    (TSh 6,000 = 1 XP; TSh 36,000 = 6 XP)
//   eligible XP  = max(0, grossXp - xpSummonedOut)
//   level        = min(50, 1 + floor(eligibleXp / 6))       (6 XP = TSh 36,000 per level)
//
// Lifetime income is tracked separately and is never reduced by spending.
import { RuleError, rule, posInt, cleanText, isInt } from '../utils/validation.js';
import { addEvent } from '../features/inbox.js';
import { nid } from '../utils/ids.js';
import { dateKey, addDays, weekday, eachDay, isDateKey, DAY } from '../utils/dates.js';
import { fmtTSh } from '../utils/formatting.js';

export const FIN = { TSH_PER_XP: 6000, XP_PER_LEVEL: 6, MAX_LEVEL: 50, PENALTY: 6000, MAX_BACKDATE_DAYS: 7, MAX_ENTRY: 1e9 };

// ---- money math (all from the immutable-ish transaction list) --------------------------------
const live = (s) => s.fin.tx.filter((t) => !t.voided);
export function balance(s) {
  let b = 0;
  for (const t of live(s)) b += t.type === 'start' || t.type === 'income' ? t.amount : -t.amount;
  return b;
}
export const lifetimeIncome = (s) => live(s).filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
export const totalExpenses = (s) => live(s).filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
export const totalPenalties = (s) => live(s).filter((t) => t.type === 'penalty').reduce((a, t) => a + t.amount, 0);
export const startingBalance = (s) => live(s).filter((t) => t.type === 'start').reduce((a, t) => a + t.amount, 0);
export const grossXp = (s) => Math.floor(Math.max(0, balance(s)) / FIN.TSH_PER_XP);
export const eligibleXp = (s) => Math.max(0, grossXp(s) - s.fin.xpOut);

// ---- calendar ---------------------------------------------------------------------------------
export function isWorkday(s, date) {
  const st = s.fin.settings;
  if (st.restDates.includes(date)) return false;               // explicit rest day always wins
  return st.workdays.includes(weekday(date));
}
export const incomeOn = (s, date) => live(s).filter((t) => t.type === 'income' && t.date === date).reduce((a, t) => a + t.amount, 0);
export function dayStatus(s, date, today) {
  if (s.fin.settings.trackStart == null || date < s.fin.settings.trackStart) return 'untracked';
  if (!isWorkday(s, date)) return 'rest';
  if (incomeOn(s, date) > 0) return 'earned';
  const ex = s.fin.explanations[date];
  if (ex) return 'explained';
  const pen = s.fin.penalties[date];
  if (pen) return pen.status === 'applied' ? 'penalized' : 'missed';
  return date < today ? 'missed' : date === today ? 'today' : 'upcoming';
}

// ---- settings -----------------------------------------------------------------------------------
export function saveSettings(s, ctx, { expected, workdays, trackStart }) {
  posInt(expected, 'Expected earning');
  rule(Array.isArray(workdays) && workdays.every((d) => isInt(d) && d >= 0 && d <= 6), 'Workdays are invalid.');
  const st = s.fin.settings;
  st.expected = expected; st.workdays = [...new Set(workdays)].sort();
  if (trackStart != null) {
    rule(isDateKey(trackStart), 'Start date is invalid.');
    // Moving the start date EARLIER could suddenly create penalties for past days, so only forward moves or the first set are allowed.
    rule(st.trackStart == null || trackStart >= st.trackStart, 'The tracking start date can only be moved forward, so past days are never newly penalised.');
    st.trackStart = trackStart;
  }
  if (st.trackStart == null) st.trackStart = dateKey(ctx.now);
}
export function toggleRestDate(s, ctx, date) {
  rule(isDateKey(date), 'Invalid date.');
  const today = dateKey(ctx.now);
  rule(date >= today, 'Rest days can only be set for today or future days. Past days are already settled.');
  const i = s.fin.settings.restDates.indexOf(date);
  if (i >= 0) s.fin.settings.restDates.splice(i, 1); else s.fin.settings.restDates.push(date);
  s.fin.settings.restDates.sort();
  return i < 0;
}

// ---- transactions -------------------------------------------------------------------------------
function pushTx(s, ctx, t) {
  const tx = { id: nid(s, 'fx'), at: ctx.now, date: t.date || dateKey(ctx.now), type: t.type, amount: t.amount, note: cleanText(t.note, 120), voided: false };
  s.fin.tx.push(tx);
  return tx;
}
function ensureTracking(s, ctx) { if (s.fin.settings.trackStart == null) s.fin.settings.trackStart = dateKey(ctx.now); }

/** One-time opening balance. Recorded as an INITIAL ENTRY, never as earned income. */
export function setStartingBalance(s, ctx, amount) {
  rule(typeof amount === 'number' && Number.isInteger(amount) && amount >= 0 && amount <= FIN.MAX_ENTRY, 'Starting balance must be a whole number, zero or more.');
  rule(!s.fin.tx.some((t) => t.type === 'start' && !t.voided), 'A starting balance already exists. Void it first if it was a mistake.');
  if (amount === 0) throw new RuleError('Enter an amount above zero, or skip the starting balance.');
  const tx = pushTx(s, ctx, { type: 'start', amount, note: 'Initial entry (not earned income)' });
  ensureTracking(s, ctx);
  addEvent(s, ctx, { id: `ev-${tx.id}`, cat: 'finance', type: 'start-balance', title: 'Starting balance recorded', text: 'Initial entry. It counts toward balance, not toward lifetime income.', amount, unit: 'TSh', quest: 'financial' });
  return tx;
}

/** Money actually received. A note or an explanation is NOT income. */
export function addIncome(s, ctx, { amount, date, note }) {
  posInt(amount, 'Income'); rule(amount <= FIN.MAX_ENTRY, 'Amount is too large.');
  date = date || dateKey(ctx.now);
  checkDate(ctx, date);
  const tx = pushTx(s, ctx, { type: 'income', amount, date, note: note || 'Income received' });
  ensureTracking(s, ctx);
  addEvent(s, ctx, { id: `ev-${tx.id}`, cat: 'finance', type: 'income', title: 'Income recorded', text: tx.note, amount, unit: 'TSh', quest: 'financial', meta: { date } });
  resolvePendingByIncome(s, ctx, date);
  return tx;
}
export function addExpense(s, ctx, { amount, date, note }) {
  posInt(amount, 'Expense'); rule(amount <= FIN.MAX_ENTRY, 'Amount is too large.');
  date = date || dateKey(ctx.now);
  checkDate(ctx, date);
  rule(amount <= balance(s), `Not enough recorded balance. You have ${fmtTSh(balance(s))}. Record the income or a starting balance first.`, 'balance');
  const tx = pushTx(s, ctx, { type: 'expense', amount, date, note: note || 'Spending' });
  addEvent(s, ctx, { id: `ev-${tx.id}`, cat: 'finance', type: 'expense', title: 'Expense recorded', text: tx.note, amount, unit: 'TSh', quest: 'financial', meta: { date } });
  return tx;
}
function checkDate(ctx, date) {
  rule(isDateKey(date), 'Date is invalid.');
  const today = dateKey(ctx.now);
  rule(date <= today, 'Entries cannot be dated in the future.');
  rule(date >= addDays(today, -FIN.MAX_BACKDATE_DAYS), `Entries can be back-dated by at most ${FIN.MAX_BACKDATE_DAYS} days.`);
}
/** Void a mistaken entry within 24h. History is kept (struck through); balance can never go below zero. */
export function voidTx(s, ctx, id) {
  const t = s.fin.tx.find((x) => x.id === id);
  rule(t && !t.voided, 'That entry cannot be voided.');
  rule(t.type !== 'penalty', 'Penalty deductions cannot be voided.');
  rule(ctx.now - t.at <= DAY, 'Entries can only be voided within 24 hours.');
  t.voided = true; t.voidedAt = ctx.now;
  if (balance(s) < 0) { t.voided = false; delete t.voidedAt; throw new RuleError('Voiding this would make your balance negative because of later spending.'); }
  addEvent(s, ctx, { id: `ev-void-${t.id}`, cat: 'finance', type: 'void', title: 'Entry voided', text: `${t.type} of ${fmtTSh(t.amount)} was voided.`, amount: t.amount, unit: 'TSh', quest: 'financial' });
}

// ---- missed earning days & penalties ----------------------------------------------------------
export const PENALTY_ID = (date) => `pen-fin-${date}`;
export function explanationsInLast30(s, now) {
  const cutoff = now - 30 * DAY;
  return Object.values(s.fin.explanations).filter((e) => e.at >= cutoff).length;
}
/** Day-by-day scan. Idempotent: a missed day creates AT MOST ONE penalty record (keyed by date). */
export function scanMissedDays(s, ctx) {
  const st = s.fin.settings;
  if (st.trackStart == null) return false;
  const today = dateKey(ctx.now);
  let changed = false;
  for (const date of eachDay(st.trackStart, addDays(today, -1))) {
    if (s.fin.penalties[date] || s.fin.explanations[date]) continue;
    if (!isWorkday(s, date)) continue;                 // rest days are exempt
    if (incomeOn(s, date) > 0) continue;
    s.fin.penalties[date] = { id: PENALTY_ID(date), date, amount: FIN.PENALTY, status: 'pending', createdAt: ctx.now, appliedAt: null };
    addEvent(s, ctx, { id: `ev-${PENALTY_ID(date)}-created`, cat: 'penalty', type: 'fin-penalty-pending', title: 'Missed earning day', text: `No income recorded for ${date}. A TSh ${FIN.PENALTY.toLocaleString()} in-app deduction is pending.`, amount: FIN.PENALTY, unit: 'TSh', quest: 'financial', meta: { date, status: 'pending' } });
    changed = true;
  }
  return changed;
}
export const pendingPenalties = (s) => Object.values(s.fin.penalties).filter((p) => p.status === 'pending').sort((a, b) => (a.date < b.date ? -1 : 1));
/** Locked = a pending penalty exists AND it can actually be paid from the recorded balance. */
export function lockedBy(s) { const p = pendingPenalties(s)[0]; return p && balance(s) >= p.amount ? p : null; }
export function insufficientPending(s) { const p = pendingPenalties(s)[0]; return p && balance(s) < p.amount ? p : null; }

/** In-app accounting deduction only. Never implies real money moved. */
export function applyPenalty(s, ctx, date) {
  const p = s.fin.penalties[date];
  rule(p && p.status === 'pending', 'There is no pending penalty for that day.');
  rule(balance(s) >= p.amount, `Your recorded balance (${fmtTSh(balance(s))}) is below the TSh ${p.amount.toLocaleString()} deduction. It stays pending until enough balance is recorded. Balance never goes negative.`, 'balance');
  const before = balance(s);
  const tx = pushTx(s, ctx, { type: 'penalty', amount: p.amount, date: dateKey(ctx.now), note: `Missed earning day ${date}` });
  p.status = 'applied'; p.appliedAt = ctx.now; p.txId = tx.id;
  addEvent(s, ctx, { id: `ev-${p.id}-applied`, cat: 'penalty', type: 'fin-penalty-applied', title: 'Penalty deduction applied', text: `Missed day ${date}. In-app deduction only: balance ${fmtTSh(before)} → ${fmtTSh(before - p.amount)}. No real money was moved.`, amount: p.amount, unit: 'TSh', quest: 'financial', meta: { date, status: 'applied' } });
  return tx;
}
/** An accepted explanation clears the day with no penalty. Limited to prevent abuse. */
export const EXPLANATION_REASONS = ['Sick or injured', 'Family emergency', 'No work was available', 'Travel or transport problem', 'Other (explain)'];
export function acceptExplanation(s, ctx, { date, reason, text }) {
  const p = s.fin.penalties[date];
  rule(p && p.status === 'pending', 'That day has no pending penalty to explain.');
  text = cleanText(text, 300);
  rule(EXPLANATION_REASONS.includes(reason), 'Choose a reason.');
  rule(text.length >= 15, 'Write at least a short sentence (15+ characters) explaining what happened.');
  const used = explanationsInLast30(s, ctx.now);
  rule(used < s.fin.settings.explainLimit, `You have used ${used} of ${s.fin.settings.explainLimit} accepted explanations in the last 30 days.`, 'limit');
  s.fin.explanations[date] = { id: nid(s, 'fe'), at: ctx.now, date, reason, text };
  p.status = 'cleared'; p.clearedAt = ctx.now; p.clearedBy = 'explanation';
  addEvent(s, ctx, { id: `ev-${p.id}-explained`, cat: 'penalty', type: 'fin-penalty-cleared', title: 'Explanation accepted', text: `${date}: ${reason}. No deduction.`, quest: 'financial', meta: { date, status: 'cleared' } });
}
function resolvePendingByIncome(s, ctx, date) {
  const p = s.fin.penalties[date];
  if (p && p.status === 'pending' && incomeOn(s, date) > 0) {
    p.status = 'cleared'; p.clearedAt = ctx.now; p.clearedBy = 'income';
    addEvent(s, ctx, { id: `ev-${p.id}-income`, cat: 'penalty', type: 'fin-penalty-cleared', title: 'Penalty cleared by income', text: `Income was recorded for ${date}, so the pending deduction was removed.`, quest: 'financial', meta: { date, status: 'cleared' } });
  }
}

export function tick(s, ctx) { return scanMissedDays(s, ctx); }
