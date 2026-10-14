// TRANSACTION ENGINE: every market action is validated here, applied to a draft and recorded in the same
// atomic commit (currency, inventory AND transaction record change together, or nothing changes).
import { ITEM_BY_ID, CATALOG, currencyOf } from '../data/rewards.js';
import { buyPrice, sellPrice, isShopItem, EXCHANGE, EXCHANGE_PASS } from '../data/market.js';
import { addItem, removeItem, owned, spendCurrency, addCurrency, itemUnlocked } from './reward-engine.js';
import { restoreCost } from './penalty-engine.js';
import { TITLE_BY_ID } from '../data/titles.js';
import { addEvent } from '../features/inbox.js';
import { RuleError, rule } from '../utils/validation.js';
import { nid } from '../utils/ids.js';
import { RARITIES, rarityIndex } from '../utils/formatting.js';
import { secureRandom } from '../utils/rng.js';

function once(s, txId) {
  rule(typeof txId === 'string' && txId.length >= 6, 'Missing transaction id.');
  if (s.market.exchanged[txId]) throw new RuleError('That transaction was already completed.', 'duplicate');
  s.market.exchanged[txId] = 1;
  const ks = Object.keys(s.market.exchanged); if (ks.length > 400) delete s.market.exchanged[ks[0]];
}
function record(s, ctx, t) {
  const rec = { id: nid(s, 'mt'), at: ctx.now, ...t };
  s.market.txs.push(rec);
  addEvent(s, ctx, { id: `ev-${rec.id}`, cat: 'market', type: t.type, title: t.title, text: t.text, amount: t.amount ?? null, unit: t.currency ? (t.currency === 'hearts' ? 'HC' : 'G') : null, quest: t.quest || null });
  return rec;
}
const cname = (c) => (c === 'hearts' ? 'Heart Coins' : 'Gold');

export function buy(s, ctx, { itemId, qty = 1, txId }) {
  const item = ITEM_BY_ID[itemId]; rule(item && isShopItem(item), 'That item is not sold here.');
  rule(Number.isInteger(qty) && qty >= 1 && qty <= 99, 'Quantity must be 1-99.');
  rule(itemUnlocked(s, item), `Locked: reach ${item.quest} level ${item.unlock} to buy this.`, 'locked');
  if (item.dup === 'convert') { rule(qty === 1, 'Unique collectibles can be bought one at a time.'); rule(owned(s, itemId) === 0, 'You already own this collectible.', 'owned'); }
  once(s, txId);
  const cur = currencyOf(item), cost = buyPrice(item) * qty;
  spendCurrency(s, cur, cost);
  addItem(s, ctx, itemId, qty);
  return record(s, ctx, { type: 'buy', scope: item.quest, itemId, qty, currency: cur, amount: cost, title: `Bought ${item.name}${qty > 1 ? ` ×${qty}` : ''}`, text: `Paid ${cost} ${cname(cur)}.`, quest: item.quest });
}
export function sell(s, ctx, { itemId, qty = 1, txId }) {
  const item = ITEM_BY_ID[itemId]; rule(item, 'Unknown item.');
  rule(item.binding === 'sellable', item.binding === 'bound' ? 'Bound items cannot be sold.' : 'Consumables cannot be sold. Use them instead.', 'bound');
  rule(Number.isInteger(qty) && qty >= 1, 'Quantity must be at least 1.');
  rule(owned(s, itemId) >= qty, 'You do not own that many.');
  if (s.inv.emblem === itemId && owned(s, itemId) === qty) throw new RuleError('Unequip this emblem before selling it.');
  once(s, txId);
  const cur = currencyOf(item), gain = sellPrice(item) * qty;
  removeItem(s, itemId, qty); addCurrency(s, cur, gain);
  return record(s, ctx, { type: 'sell', scope: item.quest, itemId, qty, currency: cur, amount: gain, title: `Sold ${item.name}${qty > 1 ? ` ×${qty}` : ''}`, text: `Received ${gain} ${cname(cur)}.`, quest: item.quest });
}
/** Trading Hall: three sellable items of the SAME quest and rarity -> one random item of the next rarity. */
export function tradeUp(s, ctx, { itemIds, txId }, rnd = secureRandom) {
  rule(Array.isArray(itemIds) && itemIds.length === 3, 'Choose exactly three items.');
  const items = itemIds.map((id) => ITEM_BY_ID[id]); rule(items.every(Boolean), 'Unknown item.');
  rule(items.every((i) => i.binding === 'sellable'), 'Only sellable items can be traded.');
  rule(items.every((i) => i.quest === items[0].quest && i.rarity === items[0].rarity), 'All three items must share a quest and rarity.');
  const need = {}; for (const id of itemIds) need[id] = (need[id] || 0) + 1;
  for (const [id, n] of Object.entries(need)) { rule(owned(s, id) >= n, 'You do not own those items.'); if (s.inv.emblem === id && owned(s, id) === n) throw new RuleError('Unequip the emblem before trading it.'); }
  const next = RARITIES[rarityIndex(items[0].rarity) + 1]; rule(next, 'Mythic items cannot be traded up.');
  const pool = CATALOG.filter((i) => i.quest === items[0].quest && i.rarity === next && !['lootbox', 'key', 'currency', 'certificate'].includes(i.kind) && i.binding !== 'consumable' && itemUnlocked(s, i));
  rule(pool.length, 'Nothing of the next rarity is unlocked yet for that quest.');
  once(s, txId);
  for (const [id, n] of Object.entries(need)) removeItem(s, id, n);
  const got = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  const res = addItem(s, ctx, got.id, 1);
  return record(s, ctx, { type: 'trade', scope: items[0].quest, itemId: got.id, qty: 1, currency: null, amount: 0, title: `Trade-up: ${got.name}`, text: `Traded 3 ${items[0].rarity} items for ${got.name} (${next})${res.converted ? `, duplicate converted to ${res.converted} ${cname(res.currency)}` : ''}.`, quest: items[0].quest });
}
/** Rare Exchange: fixed recipes, needs a Royal Invitation (kept). */
export function exchange(s, ctx, { offerId, txId }) {
  const o = EXCHANGE.find((x) => x.id === offerId); rule(o, 'Unknown offer.');
  rule(owned(s, EXCHANGE_PASS) > 0, 'The Rare Exchange needs a Royal Invitation in your inventory.', 'locked');
  for (const g of o.give) rule(owned(s, g.id) >= g.n, `You need ${g.n} × ${ITEM_BY_ID[g.id].name}.`);
  const out = ITEM_BY_ID[o.get.id];
  rule(itemUnlocked(s, out), `Locked: reach Romance level ${out.unlock}.`, 'locked');
  if (out.dup === 'convert') rule(owned(s, out.id) === 0, 'You already own that collectible.', 'owned');
  once(s, txId);
  for (const g of o.give) removeItem(s, g.id, g.n);
  addItem(s, ctx, o.get.id, o.get.n);
  return record(s, ctx, { type: 'exchange', scope: 'romance', itemId: out.id, qty: o.get.n, currency: null, amount: 0, title: `Exchanged for ${out.name}`, text: `Gave ${o.give.map((g) => `${g.n}× ${ITEM_BY_ID[g.id].name}`).join(', ')}.`, quest: 'romance' });
}
/** Lost & Found: buy back something a Savage penalty removed. */
export function restoreLost(s, ctx, { lostId, txId }) {
  const i = s.inv.lost.findIndex((l) => l.id === lostId); rule(i >= 0, 'That record no longer exists.');
  const rec = s.inv.lost[i]; const cost = restoreCost(rec);
  const cur = rec.quest === 'romance' ? 'hearts' : 'gold';
  once(s, txId); spendCurrency(s, cur, cost);
  if (rec.kind === 'item') addItem(s, ctx, rec.refId, 1); else delete s.titles.revoked[rec.refId];
  s.inv.lost.splice(i, 1);
  return record(s, ctx, { type: 'restore', scope: rec.quest, itemId: rec.refId, qty: 1, currency: cur, amount: cost, title: `Recovered ${rec.name}`, text: `Paid ${cost} ${cname(cur)} from Lost & Found.`, quest: rec.quest });
}
export function toggleWishlist(s, itemId) {
  rule(ITEM_BY_ID[itemId], 'Unknown item.');
  const i = s.market.wishlist.indexOf(itemId);
  if (i >= 0) { s.market.wishlist.splice(i, 1); return false; }
  rule(s.market.wishlist.length < 100, 'The wishlist is full (100).');
  s.market.wishlist.push(itemId); return true;
}
export { TITLE_BY_ID };
