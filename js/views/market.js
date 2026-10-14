import { h, ico, chip, tabs, empty, openSheet, guarded, toast, confirmSheet, kv } from '../ui/dom.js';
import { CATALOG, ITEM_BY_ID, currencyOf } from '../data/rewards.js';
import { buyPrice, sellPrice, isShopItem, EXCHANGE, EXCHANGE_PASS } from '../data/market.js';
import * as M from '../engine/transaction-engine.js';
import { owned, itemUnlocked } from '../engine/reward-engine.js';
import { restoreCost } from '../engine/penalty-engine.js';
import { itemCard, curLabel, curIcon, rarityChip } from './shared.js';
import { openItemSheet } from './rewards.js';
import { RARITIES, rarityIndex, cap } from '../utils/formatting.js';
import { QUEST_NAMES } from '../engine/xp-engine.js';
import { formatDateTime } from '../utils/dates.js';

const state = { global: { tab: 'shop', pick: [] }, romance: { tab: 'shop', pick: [] } };
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const inScope = (scope, i) => (scope === 'romance' ? i.quest === 'romance' : i.quest !== 'romance');

function buySheet(A, item) {
  const S = A.S(), cur = currencyOf(item), price = buyPrice(item);
  const unique = item.dup === 'convert';
  let qty = 1;
  openSheet((sh) => {
    const total = h('b', { class: 'mono' }, `${price} ${curLabel(cur)}`);
    sh.set(h('h2', null, item.name), h('div', { class: 'stack' }, h('p', { class: 'muted' }, item.desc), h('div', { class: 'row wrap' }, rarityChip(item.rarity), chip(cap(item.kind))), kv('Price', `${price} ${curLabel(cur)}`), kv('You have', `${S.currency[cur].toLocaleString()} ${curLabel(cur)}`),
      !unique ? h('div', { class: 'field' }, h('label', null, 'Quantity'), h('input', { type: 'number', inputMode: 'numeric', min: 1, max: 99, value: 1, oninput: (e) => { qty = Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))); total.textContent = `${price * qty} ${curLabel(cur)}`; } })) : null, h('div', { class: 'kv' }, h('span', null, 'Total'), total)),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => sh.close() }, 'Cancel'), h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('buy', (s, c) => M.buy(s, c, { itemId: item.id, qty, txId: uid('tx') })); if (r.ok) { toast(`Bought ${item.name}${qty > 1 ? ' ×' + qty : ''}.`, 'good'); sh.close(); } }) }, 'Buy')));
  });
}
function shopTab(A, scope, boxes) {
  const S = A.S();
  const list = CATALOG.filter((i) => inScope(scope, i) && isShopItem(i) && (boxes ? ['lootbox', 'key'].includes(i.kind) : !['lootbox', 'key'].includes(i.kind))).sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity));
  const wl = S.market.wishlist;
  return h('div', { class: 'stack' }, h('p', { class: 'hint' }, `Prices in ${curLabel(scope === 'romance' ? 'hearts' : 'gold')}. Locked items need the quest level shown. Unique collectibles can be bought once.`),
    h('div', { class: 'items' }, list.map((i) => { const lock = !itemUnlocked(S, i), have = owned(S, i.id); return h('div', { class: 'stack', style: { gap: '4px' } }, itemCard(A, i, { qty: have, locked: lock, onClick: () => (lock ? openItemSheet(A, i) : buySheet(A, i)), sub: h('div', { class: 'price' }, curIcon(currencyOf(i)), ' ', buyPrice(i)) }),
      h('button', { class: 'btn small ghost', onclick: () => A.act('wish', (s) => M.toggleWishlist(s, i.id)) }, ico('star'), wl.includes(i.id) ? 'On wishlist' : 'Wishlist')); })));
}
function sellTab(A, scope) {
  const S = A.S();
  const have = Object.keys(S.inv.items).map((id) => ITEM_BY_ID[id]).filter((i) => i && inScope(scope, i) && i.binding === 'sellable');
  return h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Only sellable items can be sold. Bound items and consumables cannot.'),
    have.length ? h('div', { class: 'items' }, have.map((i) => itemCard(A, i, { qty: owned(S, i.id), sub: h('div', { class: 'price' }, curIcon(currencyOf(i)), ' +', sellPrice(i)), onClick: async () => { if (S.inv.emblem === i.id && owned(S, i.id) === 1) { toast('Unequip this emblem before selling it.', 'error'); return; } if (await confirmSheet({ title: `Sell ${i.name}?`, body: `You receive ${sellPrice(i)} ${curLabel(currencyOf(i))}.`, confirmText: 'Sell' })) A.act('sell', (s, c) => M.sell(s, c, { itemId: i.id, qty: 1, txId: uid('tx') })); } }))) : empty('chest', 'Nothing to sell'));
}
function tradeTab(A, scope) {
  const S = A.S(), st = state[scope];
  const have = Object.keys(S.inv.items).map((id) => ITEM_BY_ID[id]).filter((i) => i && inScope(scope, i) && i.binding === 'sellable' && !['lootbox', 'key', 'currency', 'certificate'].includes(i.kind));
  const counts = {}; st.pick.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  const doTrade = guarded(async () => { const r = await A.act('trade', (s, c) => M.tradeUp(s, c, { itemIds: st.pick, txId: uid('tx') })); if (r.ok) { st.pick = []; toast(r.value.text, 'good', 6000); } });
  return h('div', { class: 'stack' }, h('div', { class: 'card stack' }, h('h3', null, 'Trading Hall: trade up'), h('p', { class: 'muted' }, 'Give three sellable items of the same quest and rarity, get one random item of the next rarity.'),
    h('div', { class: 'row wrap' }, [0, 1, 2].map((i) => h('div', { class: 'chip' }, st.pick[i] ? ITEM_BY_ID[st.pick[i]].name : 'Empty slot'))),
    h('div', { class: 'row' }, h('button', { class: 'btn primary grow', disabled: st.pick.length !== 3, onclick: doTrade }, 'Trade'), h('button', { class: 'btn', onclick: () => { st.pick = []; A.render(); } }, 'Clear'))),
    have.length ? h('div', { class: 'items' }, have.map((i) => itemCard(A, i, { qty: owned(S, i.id) - (counts[i.id] || 0), onClick: () => { if (st.pick.length < 3 && owned(S, i.id) > (counts[i.id] || 0)) { st.pick.push(i.id); A.render(); } } }))) : empty('chest', 'No tradable items yet'));
}
function exchangeTab(A) {
  const S = A.S(), pass = owned(S, EXCHANGE_PASS) > 0;
  return h('div', { class: 'stack' }, pass ? h('p', { class: 'hint ok' }, ico('check'), ' Royal Invitation recognised. Welcome to the Rare Exchange.') : h('div', { class: 'banner warn', style: { margin: 0 } }, ico('lock'), `The Rare Exchange needs a Royal Invitation in your inventory (it is kept, not used up).`),
    EXCHANGE.map((o) => { const out = ITEM_BY_ID[o.get.id]; const can = pass && o.give.every((g) => owned(S, g.id) >= g.n) && (out.dup !== 'convert' || !owned(S, out.id)) && itemUnlocked(S, out);
      return h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('b', null, `${o.get.n}× ${out.name}`), rarityChip(out.rarity)), h('div', { class: 'hint' }, 'Give: ', o.give.map((g) => `${g.n}× ${ITEM_BY_ID[g.id].name} (have ${owned(S, g.id)})`).join(', ')), !itemUnlocked(S, out) ? h('div', { class: 'hint' }, ico('lock'), ` Romance level ${out.unlock}`) : null,
        h('button', { class: 'btn primary', disabled: !can, onclick: guarded(async () => { const r = await A.act('exchange', (s, c) => M.exchange(s, c, { offerId: o.id, txId: uid('tx') })); if (r.ok) toast(`Received ${out.name}.`, 'good'); }) }, 'Exchange')); }));
}
function lostTab(A, scope) {
  const S = A.S(), list = S.inv.lost.filter((l) => (scope === 'romance' ? l.quest === 'romance' : l.quest !== 'romance'));
  return h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Items and titles removed by a Savage penalty can be bought back here at any time.'), list.length ? h('div', { class: 'card list' }, list.map((l) => { const cur = l.quest === 'romance' ? 'hearts' : 'gold', cost = restoreCost(l); return h('div', { class: 'li' }, h('div', { class: 'ic penalty' }, ico(l.kind === 'title' ? 'trophy' : 'gem')), h('div', { class: 'grow' }, h('b', null, l.name), h('div', { class: 'hint' }, `${cap(l.kind)} · lost ${formatDateTime(l.at)}`)), h('button', { class: 'btn small primary', disabled: S.currency[cur] < cost, onclick: guarded(async () => { const r = await A.act('restore', (s, c) => M.restoreLost(s, c, { lostId: l.id, txId: uid('tx') })); if (r.ok) toast(`${l.name} recovered.`, 'good'); }) }, curIcon(cur), cost)); })) : empty('shield', 'Nothing lost', 'Good. Keep it that way.'));
}
function wishTab(A, scope) {
  const S = A.S(), list = S.market.wishlist.map((id) => ITEM_BY_ID[id]).filter((i) => i && inScope(scope, i));
  return list.length ? h('div', { class: 'items' }, list.map((i) => itemCard(A, i, { qty: owned(S, i.id), locked: !itemUnlocked(S, i), onClick: () => openItemSheet(A, i), sub: h('button', { class: 'btn small ghost', onclick: (e) => { e.stopPropagation(); A.act('wish', (s) => M.toggleWishlist(s, i.id)); } }, 'Remove') }))) : empty('star', 'Wishlist is empty', 'Tap "Wishlist" on any shop item.');
}
function recordsTab(A, scope) {
  const list = A.S().market.txs.filter((t) => inScope(scope, { quest: t.scope })).slice().reverse();
  return list.length ? h('div', { class: 'card list' }, list.slice(0, 80).map((t) => h('div', { class: 'li' }, h('div', { class: 'ic' }, ico('store')), h('div', { class: 'grow' }, h('b', null, t.title), h('div', { class: 'hint' }, `${t.text} · ${formatDateTime(t.at)}`)), t.amount ? h('div', { class: 'mono' }, `${t.type === 'sell' ? '+' : '−'}${t.amount}`) : null))) : empty('inbox', 'No transactions yet');
}
export default function market(A, route, scope = 'global') {
  const st = state[scope], rom = scope === 'romance';
  const items = rom ? [['shop', 'Item Shop'], ['boxes', 'Lootbox Counter'], ['sell', 'Sell'], ['trade', 'Trading Hall'], ['exchange', 'Rare Exchange'], ['lost', 'Lost & Found'], ['wish', 'Wishlist'], ['records', 'Records']]
    : [['shop', 'Item Shop'], ['boxes', 'Lootboxes'], ['sell', 'Sell'], ['trade', 'Trade up'], ['lost', 'Lost & Found'], ['wish', 'Wishlist'], ['records', 'Records']];
  const body = { shop: () => shopTab(A, scope, false), boxes: () => shopTab(A, scope, true), sell: () => sellTab(A, scope), trade: () => tradeTab(A, scope), exchange: () => exchangeTab(A), lost: () => lostTab(A, scope), wish: () => wishTab(A, scope), records: () => recordsTab(A, scope) }[st.tab]();
  const cur = rom ? 'hearts' : 'gold';
  return h('div', { class: 'stack rise' }, h('div', { class: 'card row spread' }, h('div', null, h('div', { class: 'label' }, rom ? 'Romance market' : 'Market'), h('div', { class: 'big mono' }, curIcon(cur), ' ', A.S().currency[cur].toLocaleString())), h('span', { class: 'hint', style: { maxWidth: '45%', textAlign: 'right' } }, rom ? 'Heart Coins' : 'Gold: earned from quests, boxes and sales. Not real money.')),
    tabs(items, st.tab, (t) => { st.tab = t; A.render(); }), body);
}
