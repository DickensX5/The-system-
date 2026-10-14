import { h, ico, bar } from '../ui/dom.js';
import { QMETA } from './shared.js';
import { QUESTS, questProgress } from '../engine/xp-engine.js';

export default function questsList(A) {
  const S = A.S();
  return h('div', { class: 'stack rise' }, QUESTS.map((q) => {
    const p = questProgress(S, q), m = QMETA[q];
    return h('a', { class: `card cut questcard accent-${q}`, 'data-q': q, href: `#/q/${q}` },
      h('div', { class: 'head' }, ico(m.icon), h('div', { class: 'grow' }, h('b', null, m.name), h('div', { class: 'hint' }, m.blurb)), h('span', { class: 'lv' }, p.maxed ? 'MAX' : 'LV ' + p.level)),
      bar(q, p.pct, true), h('div', { class: 'hint' }, `${p.xp.toLocaleString()} / ${p.totalMax.toLocaleString()} XP`));
  }));
}
