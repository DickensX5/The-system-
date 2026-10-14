import { h, ico, bar, chip, kv, field, tabs, empty, live, countdown, guarded, toast, confirmSheet } from '../ui/dom.js';
import * as I from '../quests/intelligence.js';
import { questProgress } from '../engine/xp-engine.js';
import { activePenalty } from '../engine/penalty-engine.js';
import { penaltyScreen } from './shared.js';
import { dateKey, formatCountdown, formatDateTime, MIN } from '../utils/dates.js';
import { wordCount } from '../utils/validation.js';

let tab = 'daily';
const draft = { title: '', category: I.CATEGORIES[0], objective: '', xp: 10, days: 3 };

function dailyTab(A) {
  const S = A.S(), now = A.now(), date = dateKey(now);
  const { questions, state } = I.dailyView(S, date);
  const solvedN = questions.filter((q) => state.solved[q.id]).length;
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h3', null, 'Daily quest'), state.done ? chip('Complete +20 XP', 'r-uncommon') : chip(`${solvedN}/3 solved`)),
      h('p', { class: 'hint' }, 'Solve all three questions correctly to earn 20 XP. A wrong answer locks that question for 30 seconds. Progress is saved as you go.')),
    ...questions.map((q, i) => {
      const solved = !!state.solved[q.id], lock = state.lock[q.id] > now ? state.lock[q.id] : 0;
      let val = '';
      const submit = (ans) => guarded(async () => {
        const r = await A.act('answer', (s, c) => I.answerDaily(s, c, { qid: q.id, answer: ans ?? val }));
        if (!r.ok) return;
        if (r.value.correct) toast(r.value.allDone ? `Daily quest complete! +${r.value.xp} XP` : 'Correct. ' + r.value.explain, 'good');
        else toast('Not quite. Wait 30 seconds, then think it through again.', 'error');
      });
      return h('div', { class: `card question${solved ? ' solved' : ''}` },
        h('div', { class: 'row spread' }, chip(q.cat), solved ? chip('Solved', 'r-uncommon') : null),
        q.passage ? h('div', { class: 'passage' }, q.passage) : null,
        h('b', null, `${i + 1}. ${q.prompt}`),
        solved ? h('div', { class: 'hint ok' }, ico('check'), ' ', q.explain)
          : lock ? h('div', { class: 'hint warn' }, ico('clock'), ' Try again in ', live(() => Math.max(0, Math.ceil((lock - A.now()) / 1000)) + 's'), h('button', { class: 'btn small', style: { marginLeft: '8px' }, onclick: () => A.render() }, 'Refresh'))
            : q.type === 'choice' ? h('div', { class: 'opts' }, q.options.map((o, oi) => h('button', { class: 'opt', onclick: submit(oi) }, o)))
              : h('div', { class: 'row' }, h('input', { type: 'number', inputMode: 'numeric', placeholder: 'Your answer', 'aria-label': `Answer ${i + 1}`, oninput: (e) => { val = e.target.value; } }), h('button', { class: 'btn primary', onclick: submit() }, 'Check')),
        state.wrong[q.id] && !solved ? h('div', { class: 'hint' }, `Wrong attempts: ${state.wrong[q.id]}`) : null);
    }));
}

function focusBar(A, a, need) {
  const b = bar('intelligence', 0);
  const i = b.firstChild; b.setAttribute('data-tick', '1');
  b._tick = () => { i.style.width = Math.min(100, (I.focusMs(a, A.now()) / need) * 100) + '%'; };
  setTimeout(() => b._tick(), 50); return b;
}
function customTab(A) {
  const S = A.S(), now = A.now(), a = S.int.custom.active;
  if (!a) {
    const set = (k) => (e) => { draft[k] = ['xp', 'days'].includes(k) ? Number(e.target.value) : e.target.value; };
    return h('div', { class: 'card stack' }, h('h3', null, 'New custom quest'),
      h('p', { class: 'hint' }, 'One at a time. You commit to a focus session and write a takeaway. If the deadline passes, a penalty challenge starts (no XP is ever deducted).'),
      field('Name', h('input', { type: 'text', maxLength: 60, value: draft.title, placeholder: 'e.g. Learn how recursion works', oninput: set('title') })),
      field('Category', h('select', { onchange: set('category') }, I.CATEGORIES.map((c) => h('option', { selected: c === draft.category }, c)))),
      field('Objective', h('textarea', { maxLength: 240, placeholder: 'What exactly will you do or understand?', oninput: set('objective') }, draft.objective)),
      h('div', { class: 'grid2' },
        field('XP reward', h('select', { onchange: set('xp') }, [5, 10, 15, 20, 25, 30].map((x) => h('option', { value: x, selected: x === draft.xp }, `${x} XP · ${I.customMinutes(x)} min focus`))), 'Max 30 per quest. 40 XP/day cap overall.'),
        field('Deadline', h('select', { onchange: set('days') }, [1, 2, 3, 5, 7, 14].map((d) => h('option', { value: d, selected: d === draft.days }, `${d} day${d > 1 ? 's' : ''}`))))),
      h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('custom', (s, c) => I.createCustom(s, c, draft)); if (r.ok) { draft.title = ''; draft.objective = ''; toast('Quest started.', 'good'); } }) }, ico('plus'), 'Start quest'));
  }
  const elapsed = () => I.focusMs(a, A.now());
  const need = a.minutes * MIN;
  let take = '';
  const counter = h('span', { class: 'hint' }, '0 / 8 words');
  return h('div', { class: 'card cut accent-intelligence stack' },
    h('div', { class: 'row spread' }, h('h3', null, a.title), chip(`${a.xp} XP`, 'r-rare')), h('div', { class: 'row wrap' }, chip(a.category)),
    h('p', { class: 'muted' }, a.objective),
    h('div', { class: 'kv' }, h('span', null, 'Time left'), countdown(a.deadlineAt, A.now)),
    h('div', { class: 'label' }, 'Focus session'),
    focusBar(A, a, need),
    h('div', { class: 'row spread' }, h('div', { class: 'timer-big', style: { fontSize: '30px' } }, live(() => `${String(Math.floor(elapsed() / MIN)).padStart(2, '0')}:${String(Math.floor((elapsed() % MIN) / 1000)).padStart(2, '0')}`, 'mono')), h('span', { class: 'hint' }, `needs ${a.minutes} min`)),
    a.since ? h('button', { class: 'btn', onclick: guarded(() => A.act('focus', (s, c) => I.focusPause(s, c))) }, ico('pause'), 'Pause focus') : h('button', { class: 'btn primary', onclick: guarded(() => A.act('focus', (s, c) => I.focusStart(s, c))) }, ico('play'), elapsed() ? 'Resume focus' : 'Start focus'),
    field('Takeaway (8+ words)', h('textarea', { placeholder: 'What did you learn or decide?', oninput: (e) => { take = e.target.value; counter.textContent = `${wordCount(take)} / 8 words`; } }), null), counter,
    h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('complete', (s, c) => I.completeCustom(s, c, { takeaway: take })); if (r.ok) toast(`Quest complete. +${r.value} XP`, 'good'); }) }, ico('check'), 'Complete quest'),
    a.focusMs === 0 && !a.since && now - a.createdAt <= 10 * MIN ? h('button', { class: 'btn small ghost', onclick: () => A.act('cancel', (s, c) => I.cancelCustom(s, c)) }, 'Cancel (typo within 10 min)') : null);
}

function moreTab(A) {
  const S = A.S(), now = A.now();
  const paused = I.isPaused(S, now);
  const hist = S.int.custom.history.slice().reverse();
  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' }, h('h3', null, 'Pause for sickness or an emergency'),
      h('p', { class: 'muted' }, paused ? `Paused until ${formatDateTime(S.int.pause.until)}. Deadlines were moved later by the same amount. Rest well.` : 'A pause moves your quest and penalty deadlines later. 1 to 7 days, then a 14-day gap before the next pause.'),
      !paused ? h('div', { class: 'row wrap' }, [1, 3, 7].map((d) => h('button', { class: 'btn', onclick: async () => { if (await confirmSheet({ title: `Pause for ${d} day(s)?`, body: 'All Intelligence deadlines move later by the same time.', confirmText: 'Pause' })) A.act('pause', (s, c) => I.startPause(s, c, { days: d })); } }, `${d} day${d > 1 ? 's' : ''}`))) : null),
    h('div', { class: 'card' }, h('h3', null, 'Custom quest history'), hist.length ? h('div', { class: 'list' }, hist.map((q) => h('div', { class: 'li' }, h('div', { class: `ic q-intelligence` }, ico(q.status === 'done' ? 'check' : 'clock')), h('div', { class: 'grow' }, h('b', null, q.title), h('div', { class: 'hint' }, formatDateTime(q.at))), h('div', { class: `mono ${q.status === 'done' ? 'ok' : 'bad'}` }, q.status === 'done' ? `+${q.xp} XP` : 'expired')))) : empty('book', 'No custom quests yet')));
}

export default function intelligence(A) {
  const S = A.S(), p = questProgress(S, 'intelligence'), date = dateKey(A.now()), pen = activePenalty(S, 'intelligence');
  const head = h('div', { class: 'card cut accent-intelligence stack' },
    h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'label' }, 'Intelligence'), h('div', { class: 'big' }, p.maxed ? 'MAX' : 'Level ' + p.level)), h('div', { class: 'mono', style: { textAlign: 'right' } }, `${p.xp.toLocaleString()} XP`, h('div', { class: 'hint' }, `${p.into}/${p.need}`))),
    bar('intelligence', p.pct, true), h('div', { class: 'hint' }, `Today's quest XP: ${I.xpToday(S, date)}/${I.INT.DAILY_CAP}${I.isPaused(S, A.now()) ? ' · Paused' : ''}`));
  if (pen) return h('div', { class: 'stack rise' }, head, penaltyScreen(A, pen, I, 'intelligence'));
  const body = { daily: dailyTab, custom: customTab, more: moreTab }[tab](A);
  return h('div', { class: 'stack rise' }, head, tabs([['daily', 'Daily'], ['custom', 'Custom quest'], ['more', 'Pause & history']], tab, (t) => { tab = t; A.render(); }), body);
}
