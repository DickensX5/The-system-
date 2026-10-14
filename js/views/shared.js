// Pieces shared by several screens.
import { h, ico, chip, bar, KIND_ICON, openSheet, guarded, field, live, countdown, toast } from '../ui/dom.js';
import { ITEM_BY_ID, currencyOf } from '../data/rewards.js';
import { buyPrice, sellPrice } from '../data/market.js';
import { cap } from '../utils/formatting.js';
import { checkAnswer } from '../data/intelligence-bank.js';
import { wordCount } from '../utils/validation.js';
import { TIER_LABEL } from '../engine/penalty-engine.js';
import { questLevel, QUEST_NAMES } from '../engine/xp-engine.js';

export const QMETA = {
  financial: { name: 'Financial', icon: 'financial', color: 'var(--financial)', blurb: 'Money you actually keep' },
  physique: { name: 'Physique', icon: 'physique', color: 'var(--physique)', blurb: 'Daily training' },
  intelligence: { name: 'Intelligence', icon: 'intelligence', color: 'var(--intelligence)', blurb: 'Sharpen your mind' },
  romance: { name: 'Romance', icon: 'romance', color: 'var(--romance)', blurb: 'Respect, charm, connection' },
};
export const curLabel = (c) => (c === 'hearts' ? 'Heart Coins' : 'Gold');
export const curIcon = (c) => ico(c === 'hearts' ? 'heart-fill' : 'financial');
export const rarityChip = (r) => chip(cap(r), 'r-' + r);

export function itemCard(A, item, { qty = null, locked = false, onClick = null, sub = null } = {}) {
  return h('button', { class: `item r-${item.rarity}${locked ? ' locked' : ''}`, onclick: onClick, 'aria-label': item.name },
    h('div', { class: 'gem' }, ico(KIND_ICON[item.kind] || 'gem')),
    qty != null && qty > 1 ? h('span', { class: 'qty' }, '×' + qty) : null,
    h('div', { class: 'name' }, item.name),
    h('div', { class: 'row wrap' }, rarityChip(item.rarity), chip(cap(item.kind))),
    sub, locked ? h('div', { class: 'hint' }, ico('lock'), ` ${QUEST_NAMES[item.quest]} level ${item.unlock}`) : null);
}
export function itemFacts(A, item) {
  const S = A.S();
  return [
    h('p', { class: 'muted' }, item.desc),
    h('div', { class: 'row wrap' }, rarityChip(item.rarity), chip(cap(item.kind)), chip(cap(item.binding)), chip(QUEST_NAMES[item.quest])),
    h('div', { class: 'kv' }, h('span', null, 'Unlocks at'), h('span', { class: 'mono' }, `${QUEST_NAMES[item.quest]} level ${item.unlock}${item.needsMaxed ? ' (fully cleared)' : ''}`)),
    item.binding === 'sellable' ? h('div', { class: 'kv' }, h('span', null, 'Sell value'), h('span', { class: 'mono' }, `${sellPrice(item)} ${curLabel(currencyOf(item))}`)) : null,
    item.binding === 'bound' ? h('p', { class: 'hint' }, 'Bound: cannot be sold or traded.') : null,
    item.binding === 'consumable' ? h('p', { class: 'hint' }, 'Consumable: used up when opened or used.') : null,
    item.dup === 'convert' ? h('p', { class: 'hint' }, 'Unique: a duplicate is converted into currency, never a second copy.') : null,
  ];
}

/** Penalty challenge form used by Intelligence and Romance. `mod` supplies challengeFor + submitPenalty. */
export function penaltyScreen(A, pen, mod, quest) {
  const ch = mod.challengeFor(pen);
  const answers = {};
  const text = h('textarea', { placeholder: 'Write here…', 'aria-label': 'Written answer' });
  const need = ch.explainWords ?? ch.reflectionWords ?? 0;
  const counter = h('div', { class: 'hint' }, `0 / ${need} words`);
  text.addEventListener('input', () => { counter.textContent = `${wordCount(text.value)} / ${need} words`; });
  const qEls = ch.questions.map((q) => h('div', { class: 'question' },
    h('div', null, h('b', null, q.prompt)),
    q.type === 'choice' ? h('div', { class: 'opts' }, q.options.map((o, i) => h('button', { class: 'opt', onclick: (e) => { answers[q.id] = i; [...e.currentTarget.parentNode.children].forEach((x) => x.classList.remove('right')); e.currentTarget.classList.add('right'); } }, o)))
      : h('input', { type: 'number', inputMode: 'numeric', placeholder: 'Your answer', 'aria-label': 'Answer', oninput: (e) => { answers[q.id] = e.target.value; } })));
  const submit = guarded(async () => {
    const r = await A.act('penalty', (s, c) => mod.submitPenalty(s, c, { id: pen.id, answers, text: text.value }));
    if (r.ok && r.value.ok) toast('Penalty cleared. No loss.', 'good');
    else if (r.ok) toast(`Not enough correct answers (${r.value.correct}/${r.value.need}). Try again before the deadline.`, 'error');
  });
  return h('div', { class: quest === 'romance' ? 'dungeon stack' : 'card stack', style: quest === 'intelligence' ? { borderColor: '#7a2038' } : null },
    h('div', { class: 'row' }, ico('lock'), h('h3', null, `${TIER_LABEL[pen.tier]} penalty: ${quest === 'romance' ? 'Penalty Dungeon' : 'Challenge'}`)),
    h('p', { class: 'muted' }, `"${pen.cause}" expired. Only the ${QUEST_NAMES[quest]} tab is locked. No XP is ever deducted. If the timer runs out, a Savage penalty removes an eligible item or title (recoverable in Market > Lost & Found).`),
    h('div', { class: 'timer-big' }, countdown(pen.deadline)),
    h('p', null, ch.intro),
    ch.topic ? h('div', { class: 'passage' }, ch.topic) : null,
    ...qEls,
    need ? h('div', { class: 'field' }, h('label', null, ch.prompt ? 'Reflection' : 'Explain your reasoning'), ch.prompt ? h('p', { class: 'hint' }, ch.prompt) : null, text, counter) : null,
    h('button', { class: 'btn primary block', onclick: submit }, 'Submit challenge'));
}
export const levelOf = (S, q) => questLevel(S, q);
