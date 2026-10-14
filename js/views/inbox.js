import { h, ico, empty, tabs } from '../ui/dom.js';
import { CATEGORIES, listEvents, markAllRead } from '../features/inbox.js';
import { formatTimeAgo, formatDateTime } from '../utils/dates.js';

const ICONS = { 'level-up': 'bolt', 'title-unlock': 'trophy', 'title-change': 'trophy', 'title-equip': 'trophy', claim: 'gift', lootbox: 'chest', use: 'bolt', equip: 'badge', 'quest-complete': 'check', 'quest-new': 'plus', 'quest-expired': 'clock', pause: 'clock', income: 'financial', expense: 'financial', 'start-balance': 'financial', void: 'x', summon: 'swap', buy: 'store', sell: 'store', trade: 'store', exchange: 'store', restore: 'store' };
let cat = 'all', limit = 60;
export default function inbox(A) {
  const S = A.S(), now = A.now();
  const list = listEvents(S, cat);
  const unread = S.inbox.readAt;
  return h('div', { class: 'stack' },
    h('div', { class: 'row spread' }, h('h2', null, 'Event history'), h('button', { class: 'btn small', onclick: () => A.act('read', (s, c) => markAllRead(s, c)) }, ico('check'), 'Mark all read')),
    tabs(CATEGORIES.map((c) => [c.id, c.label]), cat, (id) => { cat = id; limit = 60; A.render(); }),
    list.length ? h('div', { class: 'card list' }, list.slice(0, limit).map((e) => h('div', { class: 'li', style: e.at > unread ? { background: 'rgba(123,109,255,.06)' } : null },
      h('div', { class: `ic ${e.cat === 'penalty' ? 'penalty' : e.quest ? 'q-' + e.quest : ''}` }, ico(e.cat === 'penalty' ? 'warn' : ICONS[e.type] || 'info')),
      h('div', { class: 'grow' }, h('b', null, e.title), e.text ? h('div', { class: 'muted', style: { fontSize: '13.5px' } }, e.text) : null,
        h('div', { class: 'hint', title: formatDateTime(e.at) }, formatTimeAgo(e.at, now), ' · ', formatDateTime(e.at))),
      e.amount != null && e.unit ? h('div', { class: 'mono', style: { whiteSpace: 'nowrap' } }, `${e.unit === 'LV' ? 'LV ' : ''}${Number(e.amount).toLocaleString()}${e.unit === 'LV' ? '' : ' ' + e.unit}`) : null)))
      : empty('inbox', 'Nothing here yet', 'Level-ups, rewards, penalties and transactions will be recorded here.'),
    list.length > limit ? h('button', { class: 'btn block', onclick: () => { limit += 60; A.render(); } }, 'Show older') : null);
}
