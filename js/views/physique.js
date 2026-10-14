import { h, ico, bar, chip, kv, live, guarded, toast, field } from '../ui/dom.js';
import * as P from '../quests/physique.js';
import { questProgress } from '../engine/xp-engine.js';
import { dateKey, addDays, eachDay } from '../utils/dates.js';
import { galleryView } from '../features/gallery.js';
import { mmss } from '../utils/formatting.js';

const repInput = {};
export default function physique(A) {
  const S = A.S(), now = A.now(), today = dateKey(now);
  const p = questProgress(S, 'physique'), view = P.dayView(S, today), done = view.filter((e) => e.complete).length;
  const exCards = view.map((e) => {
    const reps = e.kind === 'reps';
    const inp = reps ? h('input', { type: 'number', inputMode: 'numeric', min: 1, max: 500, value: repInput[e.id] ?? 10, 'aria-label': `Reps for ${e.name}`, oninput: (ev) => { repInput[e.id] = ev.target.value; } }) : null;
    const log = (n) => guarded(async () => { const r = await A.act('reps', (s, c) => P.logReps(s, c, { ex: e.id, reps: n ?? Number(inp.value) })); if (r.ok && r.value >= e.target) toast(`${e.name} complete. +${P.PHY.XP_PER_EXERCISE} XP`, 'good'); });
    const remaining = Math.max(0, e.target - e.done);
    return h('div', { class: `card ex${e.complete ? ' done' : ''}` },
      h('div', { class: 'head' }, h('b', null, e.name), e.complete ? chip('Done +2 XP', 'r-uncommon') : chip(reps ? `${e.done}/${e.target} reps` : `${mmss(e.done)}/${mmss(e.target)}`)),
      bar('physique', (e.done / e.target) * 100),
      e.complete ? h('div', { class: 'hint ok' }, ico('check'), ' Complete for today') : reps
        ? h('div', { class: 'row' }, h('div', { style: { width: '90px' } }, inp), h('button', { class: 'btn primary grow', onclick: log() }, 'Log set'), h('button', { class: 'btn', onclick: log(remaining) }, `All ${remaining}`))
        : e.running ? h('div', { class: 'row' }, h('div', { class: 'grow timer-big', style: { fontSize: '28px' } }, live(() => mmss((A.now() - e.running) / 1000))), h('button', { class: 'btn danger', onclick: guarded(async () => { const r = await A.act('timer', (s, c) => P.stopTimer(s, c, { ex: e.id })); if (r.ok && r.value.discarded) toast(r.value.message, 'error', 7000); else if (r.ok && r.value.done >= e.target) toast(`${e.name} complete. +${P.PHY.XP_PER_EXERCISE} XP`, 'good'); }) }, ico('pause'), 'Stop & log'))
          : h('button', { class: 'btn primary', onclick: guarded(() => A.act('timer', (s, c) => P.startTimer(s, c, { ex: e.id }))) }, ico('play'), `Start timer (${mmss(e.target - e.done)} left)`));
  });
  const days = eachDay(addDays(today, -13), today).map((d) => { const r = S.phy.days[d]; const n = r ? Object.keys(r.awarded).length : 0; return h('div', { title: `${d}: ${n}/4`, style: { flex: 1, height: '30px', borderRadius: '6px', background: n === 4 ? 'var(--physique)' : n ? 'rgba(255,106,43,.35)' : 'var(--panel2)', border: '1px solid var(--line)' } }); });
  return h('div', { class: 'stack rise' },
    h('div', { class: 'card cut accent-physique stack' },
      h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'label' }, 'Physique'), h('div', { class: 'big' }, p.maxed ? 'MAX' : 'Level ' + p.level)), h('div', { class: 'mono', style: { textAlign: 'right' } }, `${p.xp.toLocaleString()} XP`, h('div', { class: 'hint' }, `${p.into}/${p.need} this level`))),
      bar('physique', p.pct, true),
      h('div', { class: 'hint' }, `Each exercise is 2 XP, a full workout is 8 XP. 56 XP per level. Level ${p.level} targets: ${view.map((e) => e.id === 'jacks' ? `${Math.floor(e.target / 60)}m${e.target % 60 ? e.target % 60 + 's' : ''}` : e.target).join(' / ')}.`)),
    h('div', { class: 'row spread' }, h('h2', null, `Today · ${done}/4`), h('span', { class: 'hint' }, 'No penalties here, ever')),
    ...exCards,
    h('div', { class: 'card stack' }, h('h3', null, 'Last 14 days'), h('div', { class: 'row', style: { gap: '4px' } }, days), h('p', { class: 'hint' }, 'Orange = full workout. A gap is just a gap: missing a day never costs XP.')),
    h('div', { class: 'card' }, galleryView(A, 'physique', { title: 'Progress photos', hint: 'Stored only on this device. Compressed to save space.' })));
}
