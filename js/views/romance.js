import { h, ico, bar, chip, field, tabs, empty, countdown, guarded, toast, openSheet, live } from '../ui/dom.js';
import * as R from '../quests/romance.js';
import { questProgress } from '../engine/xp-engine.js';
import { activePenalty } from '../engine/penalty-engine.js';
import { penaltyScreen, itemCard } from './shared.js';
import { SUGGESTIONS } from '../data/romance-data.js';
import { CATALOG, ITEM_BY_ID } from '../data/rewards.js';
import { owned } from '../engine/reward-engine.js';
import { galleryView } from '../features/gallery.js';
import { openItemSheet } from './rewards.js';
import market from './market.js';
import { wordCount } from '../utils/validation.js';
import { dateKey, formatDateTime, MIN } from '../utils/dates.js';

let tab = 'quests';
const draft = { name: '', objective: '', xp: 10, days: 3 };

function completeSheet(A, q) {
  let ok = false, text = '';
  const count = h('span', { class: 'hint' }, '0 / 6 words');
  openSheet((s) => s.set(h('h2', null, q.name), h('p', { class: 'muted' }, q.objective),
    h('div', { class: 'stack' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { ok = e.target.checked; } }), h('span', null, 'I actually did this, respectfully and without pressure on anyone.')),
      field('Short reflection (6+ words)', h('textarea', { placeholder: 'What did you do and how did it go?', oninput: (e) => { text = e.target.value; count.textContent = `${wordCount(text)} / 6 words`; } })), count),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Not yet'), h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('rom-done', (st, c) => R.completeQuest(st, c, { id: q.id, respectful: ok, reflection: text })); if (r.ok) { toast(`Quest complete. +${r.value} XP`, 'good'); s.close(); } }) }, ico('heart-fill'), 'Complete'))));
}

function questsTab(A) {
  const S = A.S(), now = A.now(), act = R.activeQuests(S), recent = S.rom.quests.filter((q) => q.status !== 'active').slice(-6).reverse();
  const set = (k) => (e) => { draft[k] = ['xp', 'days'].includes(k) ? Number(e.target.value) : e.target.value; };
  return h('div', { class: 'stack' },
    h('div', { class: 'row spread' }, h('h2', null, `Active · ${act.length}/${R.ROM.MAX_ACTIVE}`), chip(`Today ${R.xpToday(S, dateKey(now))}/${R.ROM.DAILY_CAP} XP`)),
    act.length ? act.map((q) => h('div', { class: 'card accent-romance' }, h('div', { class: 'row' }, h('button', { class: 'heartbtn', 'aria-label': `Complete ${q.name}`, onclick: () => completeSheet(A, q) }, ico('heart-fill')),
      h('div', { class: 'grow' }, h('b', null, q.name), h('div', { class: 'muted', style: { fontSize: '13.5px' } }, q.objective), h('div', { class: 'row wrap hint' }, chip(`${q.xp} XP`, 'r-epic'), ico('clock'), countdown(q.deadlineAt, A.now)),
        now - q.createdAt < R.ROM.MIN_AGE ? h('div', { class: 'hint' }, 'You can complete it 10 minutes after creating it.') : null)))) : empty('romance', 'No active quests', 'Pick a suggestion below or write your own.'),
    R.activeQuests(S).length < R.ROM.MAX_ACTIVE ? h('div', { class: 'card stack' }, h('h3', null, 'New quest'),
      h('p', { class: 'hint' }, 'Quests must be respectful, free and low-pressure. Nothing that tracks, pressures or manipulates anyone, and nothing that costs money.'),
      h('details', null, h('summary', null, 'Suggestions'), h('div', { class: 'stack' }, SUGGESTIONS.map((s) => h('button', { class: 'opt', onclick: () => { Object.assign(draft, { name: s.name, objective: s.objective, xp: s.xp }); A.render(); } }, h('b', null, s.name), h('div', { class: 'hint' }, `${s.xp} XP · ${s.objective}`))))),
      field('Name', h('input', { type: 'text', maxLength: 60, value: draft.name, oninput: set('name') })), field('What will you do?', h('textarea', { maxLength: 240, oninput: set('objective') }, draft.objective)),
      h('div', { class: 'grid2' }, field('XP', h('select', { onchange: set('xp') }, [5, 10, 15, 20, 25, 30].map((x) => h('option', { value: x, selected: x === draft.xp }, `${x} XP`)))), field('Deadline', h('select', { onchange: set('days') }, [1, 2, 3, 5, 7, 14].map((d) => h('option', { value: d, selected: d === draft.days }, `${d} day${d > 1 ? 's' : ''}`))))),
      h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('rom-new', (s, c) => R.createQuest(s, c, draft)); if (r.ok) { Object.assign(draft, { name: '', objective: '' }); toast('Quest started.', 'good'); } }) }, ico('plus'), 'Start quest')) : null,
    recent.length ? h('div', { class: 'card' }, h('h3', null, 'Recent'), h('div', { class: 'list' }, recent.map((q) => h('div', { class: 'li' }, h('div', { class: `heartbtn ${q.status === 'done' ? 'done' : 'broken'}`, style: { width: '36px', height: '36px', borderWidth: '1px' } }, ico(q.status === 'done' ? 'heart-fill' : 'x')), h('div', { class: 'grow' }, h('b', null, q.name), h('div', { class: 'hint' }, q.status === 'done' ? `Completed ${formatDateTime(q.doneAt)}` : `Expired ${formatDateTime(q.expiredAt || q.deadlineAt)}`)))))) : null);
}
function collectionTab(A) {
  const S = A.S(), items = CATALOG.filter((i) => i.quest === 'romance'), have = items.filter((i) => owned(S, i.id) > 0);
  return h('div', { class: 'stack' }, h('div', { class: 'row spread' }, h('h2', null, 'Collection'), chip(`${have.length}/${items.length} found`)),
    have.length ? h('div', { class: 'items' }, have.map((i) => itemCard(A, i, { qty: owned(S, i.id), onClick: () => openItemSheet(A, i) }))) : empty('gem', 'Nothing collected yet', 'Rewards, lootboxes and the market add items here.'));
}
export default function romance(A) {
  const S = A.S(), p = questProgress(S, 'romance'), pen = activePenalty(S, 'romance');
  const head = h('div', { class: 'card cut accent-romance stack' }, h('div', { class: 'row spread' }, h('div', null, h('div', { class: 'label' }, 'Romance'), h('div', { class: 'big' }, p.maxed ? 'MAX' : 'Level ' + p.level)), h('div', { class: 'mono', style: { textAlign: 'right' } }, `${p.xp.toLocaleString()} XP`, h('div', { class: 'hint' }, `${p.into}/${p.need} · ${S.currency.hearts.toLocaleString()} HC`))), bar('romance', p.pct, true));
  if (pen) return h('div', { class: 'stack rise' }, head, penaltyScreen(A, pen, R, 'romance'));
  const body = { quests: questsTab, collection: collectionTab, market: (a) => market(a, { params: {} }, 'romance'), archive: (a) => h('div', { class: 'card' }, galleryView(a, 'romance', { title: 'Screenshot archive', hint: 'Only keep what you have the right to keep. Do not store other people\'s private information.' })) }[tab](A);
  return h('div', { class: 'stack rise' }, head, tabs([['quests', 'Quests'], ['collection', 'Collection'], ['market', 'Market'], ['archive', 'Archive']], tab, (t) => { tab = t; A.render(); }), body);
}
