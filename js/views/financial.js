import { h, ico, bar, chip, empty, field, tabs, kv, openSheet, guarded, toast, confirmSheet } from '../ui/dom.js';
import * as F from '../quests/financial.js';
import { questProgress } from '../engine/xp-engine.js';
import { ALL_QUEST_TITLES } from '../data/titles.js';
import { isEligible } from '../engine/title-engine.js';
import { dateKey, addDays, monthDays, weekday, WEEKDAYS, MONTHS, formatDateTime, parseKey } from '../utils/dates.js';
import { fmtTSh, fmtInt } from '../utils/formatting.js';

let tab = 'overview', cal = null;
const num = (v) => (v === '' || v == null ? NaN : Number(v));

function entrySheet(A, kind, presetDate) {
  const today = dateKey(A.now());
  const amt = h('input', { type: 'number', inputMode: 'numeric', min: 1, step: 1, placeholder: 'TSh', 'aria-label': 'Amount in TSh' });
  const date = h('input', { type: 'date', value: presetDate || today, min: addDays(today, -F.FIN.MAX_BACKDATE_DAYS), max: today });
  const note = h('input', { type: 'text', maxLength: 120, placeholder: kind === 'income' ? 'Where did it come from?' : 'What was it for?' });
  openSheet((s) => s.set(h('h2', null, kind === 'income' ? 'Record income' : 'Record spending'),
    h('div', { class: 'stack' }, field('Amount (TSh)', amt, kind === 'income' ? 'Only money you actually received counts as income.' : `You have ${fmtTSh(F.balance(A.S()))} recorded.`), field('Date', date, 'Up to 7 days back.'), field('Note (optional)', note)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: guarded(async () => {
      const a = num(amt.value);
      const r = await A.act(kind, (st, c) => (kind === 'income' ? F.addIncome : F.addExpense)(st, c, { amount: a, date: date.value, note: note.value }));
      if (r.ok) { toast(kind === 'income' ? 'Income recorded.' : 'Spending recorded.', 'good'); s.close(); }
    }) }, 'Save'))));
}
function startSheet(A) {
  const amt = h('input', { type: 'number', inputMode: 'numeric', min: 1, placeholder: 'TSh' });
  openSheet((s) => s.set(h('h2', null, 'Starting balance'), h('p', { class: 'muted' }, 'The money you already have today. It is saved as an initial entry, not as earned income, and can be set once.'), field('Amount (TSh)', amt),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('start', (st, c) => F.setStartingBalance(st, c, num(amt.value))); if (r.ok) s.close(); }) }, 'Save'))));
}
function explainSheet(A, date) {
  const reason = h('select', null, F.EXPLANATION_REASONS.map((r) => h('option', { value: r }, r)));
  const text = h('textarea', { placeholder: 'What happened? (a sentence or two)', maxLength: 300 });
  const used = F.explanationsInLast30(A.S(), A.now()), lim = A.S().fin.settings.explainLimit;
  openSheet((s) => s.set(h('h2', null, 'Explain the missed day'), h('p', { class: 'muted' }, `${date}. An accepted explanation clears this day with no deduction. You have used ${used} of ${lim} in the last 30 days.`), h('div', { class: 'stack' }, field('Reason', reason), field('Details', text)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('explain', (st, c) => F.acceptExplanation(st, c, { date, reason: reason.value, text: text.value })); if (r.ok) { toast('Explanation accepted. No deduction.', 'good'); s.close(); } }) }, 'Submit'))));
}

function lockScreen(A, p) {
  const S = A.S();
  const apply = guarded(async () => { const r = await A.act('penalty', (s, c) => F.applyPenalty(s, c, p.date)); if (r.ok) toast(`TSh ${p.amount.toLocaleString()} deducted from your recorded balance.`, 'error'); });
  return h('div', { class: 'stack rise' },
    h('div', { class: 'lockscreen stack' }, ico('lock'), h('h1', null, 'Financial tab locked'),
      h('p', null, `No income was recorded for ${p.date} and no explanation was accepted.`),
      h('p', { class: 'muted' }, `This is an in-app accounting deduction of ${fmtTSh(p.amount)}: your recorded balance goes ${fmtTSh(F.balance(S))} → ${fmtTSh(F.balance(S) - p.amount)}. No real money is moved.`),
      h('button', { class: 'btn danger block', onclick: apply }, `Apply ${fmtTSh(p.amount)} deduction`),
      h('button', { class: 'btn block', onclick: () => explainSheet(A, p.date) }, 'I have an explanation'),
      h('button', { class: 'btn block', onclick: () => entrySheet(A, 'income', p.date) }, `I earned money on ${p.date}: record income`)),
    F.pendingPenalties(S).length > 1 ? h('p', { class: 'hint' }, `${F.pendingPenalties(S).length - 1} more pending day(s) will follow after this one.`) : null);
}

function overview(A) {
  const S = A.S(), p = questProgress(S, 'financial'), st = S.fin.settings, bal = F.balance(S);
  const nextBal = p.maxed ? null : (S.fin.xpOut + p.level * 6) * 6000;
  const next = ALL_QUEST_TITLES.filter((t) => t.quest === 'financial' && !isEligible(S, t.id, A.ov())).sort((a, b) => (a.level || 99) - (b.level || 99))[0];
  const pend = F.insufficientPending(S);
  return h('div', { class: 'stack' },
    st.trackStart == null ? h('div', { class: 'banner info', style: { margin: 0 } }, ico('info'), h('div', { class: 'grow' }, 'Set your earning schedule so missed earning days can be tracked.'), h('button', { class: 'btn small', onclick: () => { tab = 'settings'; A.render(); } }, 'Set up')) : null,
    pend ? h('div', { class: 'banner warn', style: { margin: 0 } }, ico('warn'), `A TSh ${F.FIN.PENALTY.toLocaleString()} penalty for ${pend.date} is pending, but your balance (${fmtTSh(bal)}) is too low to deduct it. It stays pending until enough balance is recorded. Balance never goes below zero.`) : null,
    h('div', { class: 'card cut accent-financial stack' },
      h('div', { class: 'label' }, 'Recorded balance'), h('div', { class: 'big mono' }, fmtTSh(bal)),
      h('div', { class: 'row spread' }, h('b', null, `Level ${p.level}${p.maxed ? ' · MAX' : ''}`), h('span', { class: 'hint' }, `${p.xp} XP · ${p.into}/${p.need} to next`)), bar('financial', p.pct, true),
      nextBal ? h('div', { class: 'hint' }, `Need ${fmtTSh(Math.max(0, nextBal - bal))} more balance for level ${p.level + 1}. (TSh 6,000 = 1 XP · TSh 36,000 = 1 level)`) : h('div', { class: 'hint' }, 'Maximum level. Tracking continues.'),
      h('div', { class: 'grid2' }, h('button', { class: 'btn primary', onclick: () => entrySheet(A, 'income') }, ico('plus'), 'Income'), h('button', { class: 'btn', onclick: () => entrySheet(A, 'expense') }, ico('x'), 'Spending')),
      F.startingBalance(S) === 0 && !S.fin.tx.some((t) => t.type === 'start') ? h('button', { class: 'btn small ghost', onclick: () => startSheet(A) }, 'Set starting balance') : null),
    h('div', { class: 'card' }, kv('Lifetime income', fmtTSh(F.lifetimeIncome(S))), kv('Total spending', fmtTSh(F.totalExpenses(S))), kv('Penalty deductions', fmtTSh(F.totalPenalties(S))), kv('Starting balance', fmtTSh(F.startingBalance(S))),
      h('p', { class: 'hint' }, 'Lifetime income is a record of what you earned; it never goes down when you spend. Your level follows the money you currently have.')),
    next ? h('div', { class: 'card' }, h('div', { class: 'label' }, 'Next title'), h('b', null, next.name), h('div', { class: 'hint' }, next.balance ? `Reach a recorded balance of ${fmtTSh(next.balance)}` : `Financial level ${next.level}`)) : null);
}

function calendar(A) {
  const S = A.S(), today = dateKey(A.now());
  if (!cal) { const d = parseKey(today); cal = { y: d.getFullYear(), m: d.getMonth() }; }
  const days = monthDays(cal.y, cal.m), lead = weekday(days[0]);
  const move = (d) => { cal.m += d; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } A.render(); };
  const cells = [...Array(lead).fill(null), ...days];
  return h('div', { class: 'stack' },
    h('div', { class: 'row spread' }, h('button', { class: 'icon-btn', 'aria-label': 'Previous month', onclick: () => move(-1) }, ico('back')), h('b', null, `${MONTHS[cal.m]} ${cal.y}`), h('button', { class: 'icon-btn', 'aria-label': 'Next month', onclick: () => move(1) }, ico('next'))),
    h('div', { class: 'cal' }, WEEKDAYS.map((d) => h('div', { class: 'dow' }, d[0])), cells.map((d) => { if (!d) return h('button', { class: 'blank', tabIndex: -1 }); const st = F.dayStatus(S, d, today); return h('button', { class: `s-${st}`, 'aria-label': `${d}: ${st}`, onclick: () => daySheet(A, d, st) }, d.slice(8).replace(/^0/, '')); })),
    h('div', { class: 'legend' }, [['#0b2a1d', 'Earned'], ['#0f1220', 'Rest'], ['#2a0f19', 'Missed'], ['#3a1220', 'Penalised'], ['#1a1a08', 'Explained']].map(([c, l]) => h('span', null, h('i', { style: { background: c, border: '1px solid #444' } }), l))),
    h('p', { class: 'hint' }, 'Tap a future day to mark it as a rest day. Rest days never cause a penalty.'));
}
function daySheet(A, date, st) {
  const S = A.S(), today = dateKey(A.now()), inc = F.incomeOn(S, date);
  openSheet((s) => s.set(h('h2', null, date), h('div', { class: 'stack' },
    kv('Status', st), kv('Income recorded', fmtTSh(inc)), kv('Expected', F.isWorkday(S, date) ? fmtTSh(S.fin.settings.expected) : 'Rest day'),
    S.fin.explanations[date] ? h('p', { class: 'muted' }, `Explained: ${S.fin.explanations[date].reason}`) : null,
    date >= today ? h('button', { class: 'btn', onclick: guarded(async () => { const r = await A.act('rest', (st2, c) => F.toggleRestDate(st2, c, date)); if (r.ok) s.close(); }) }, S.fin.settings.restDates.includes(date) ? 'Make this a workday again' : 'Mark as a rest day') : null,
    date <= today && date >= addDays(today, -7) ? h('button', { class: 'btn primary', onclick: () => { s.close(); entrySheet(A, 'income', date); } }, 'Record income for this day') : null,
    st === 'missed' && S.fin.penalties[date]?.status === 'pending' ? h('button', { class: 'btn', onclick: () => { s.close(); explainSheet(A, date); } }, 'Explain this day') : null)));
}
function history(A) {
  const S = A.S(), now = A.now();
  const tx = S.fin.tx.slice().reverse();
  if (!tx.length) return empty('financial', 'No entries yet', 'Record income or spending to begin.');
  const sign = { income: '+', start: '+', expense: '−', penalty: '−' };
  return h('div', { class: 'card list' }, tx.map((t) => h('div', { class: 'li', style: t.voided ? { opacity: .45 } : null },
    h('div', { class: `ic ${t.type === 'penalty' ? 'penalty' : 'q-financial'}` }, ico(t.type === 'penalty' ? 'warn' : 'financial')),
    h('div', { class: 'grow' }, h('b', { style: t.voided ? { textDecoration: 'line-through' } : null }, t.type === 'start' ? 'Starting balance' : t.type[0].toUpperCase() + t.type.slice(1)), h('div', { class: 'hint' }, `${t.date} · ${t.note}`), t.voided ? h('div', { class: 'hint' }, 'Voided') : null,
      !t.voided && t.type !== 'penalty' && now - t.at <= 864e5 ? h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmSheet({ title: 'Void this entry?', body: 'It stays in your history as voided.', danger: true, confirmText: 'Void' })) A.act('void', (s, c) => F.voidTx(s, c, t.id)); } }, 'Void (24h)') : null),
    h('div', { class: `mono ${sign[t.type] === '+' ? 'ok' : 'bad'}` }, `${sign[t.type]}${fmtInt(t.amount)}`))));
}
function settingsTab(A) {
  const S = A.S(), st = S.fin.settings, today = dateKey(A.now());
  const exp = h('input', { type: 'number', inputMode: 'numeric', value: st.expected, min: 1 });
  const chosen = new Set(st.workdays);
  const start = h('input', { type: 'date', value: st.trackStart || today, min: st.trackStart || undefined });
  const days = WEEKDAYS.map((d, i) => { const b = h('button', { class: 'tab', 'aria-selected': String(chosen.has(i)), onclick: () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); b.setAttribute('aria-selected', String(chosen.has(i))); } }, d); return b; });
  return h('div', { class: 'card stack' }, h('h3', null, 'Earning schedule'),
    field('Expected earning per workday (TSh)', exp, 'Shown as your daily target.'),
    field('Workdays', h('div', { class: 'row wrap' }, days), 'Days not selected are rest days (no penalty).'),
    field('Tracking starts on', start, st.trackStart ? 'It can only be moved forward, so past days are never newly penalised.' : 'Days before this date are never counted.'),
    h('div', { class: 'banner info', style: { margin: 0 } }, ico('info'), `If a workday ends with no income recorded and no accepted explanation, a TSh ${F.FIN.PENALTY.toLocaleString()} in-app deduction becomes pending.`),
    h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('fin-settings', (s, c) => F.saveSettings(s, c, { expected: num(exp.value), workdays: [...chosen], trackStart: start.value })); if (r.ok) toast('Schedule saved.', 'good'); }) }, 'Save schedule'));
}

export default function financial(A) {
  const lock = F.lockedBy(A.S());
  if (lock) return lockScreen(A, lock);
  const body = { overview, calendar, history, settings: settingsTab }[tab](A);
  return h('div', { class: 'stack rise' }, tabs([['overview', 'Overview'], ['calendar', 'Calendar'], ['history', 'History'], ['settings', 'Schedule']], tab, (t) => { tab = t; A.render(); }), body);
}
