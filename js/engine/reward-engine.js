// REWARD ENGINE: level-up grants (claim once), inventory, lootboxes, consumables, emblem equip.
// Rarity is only visual metadata. Nothing here can raise a level, grant a title or create unlimited XP.
import { CATALOG, ITEM_BY_ID, currencyOf } from '../data/rewards.js';
import { QUESTS, QUEST_NAMES, questLevel, cappedXp, maxXp, awardItemXp, ITEM_XP_DAILY_CAP } from './xp-engine.js';
import { addEvent } from '../features/inbox.js';
import { RuleError, rule } from '../utils/validation.js';
import { secureRandom } from '../utils/rng.js';
import { rarityIndex } from '../utils/formatting.js';

// ---------------------------------------------------------------- currency & inventory helpers
export function addCurrency(s, cur, n) { rule(Number.isInteger(n) && n >= 0, 'Bad currency amount.'); s.currency[cur] += n; }
export function spendCurrency(s, cur, n) { rule(Number.isInteger(n) && n >= 0, 'Bad amount.'); rule(s.currency[cur] >= n, `Not enough ${cur === 'hearts' ? 'Heart Coins' : 'Gold'}.`, 'funds'); s.currency[cur] -= n; }
export const owned = (s, id) => s.inv.items[id]?.count || 0;
export const hasFeature = (s, f) => CATALOG.some((i) => i.feature === f && owned(s, i.id) > 0);
export function itemUnlocked(s, item) {
  if (questLevel(s, item.quest) < item.unlock) return false;
  if (item.needsMaxed && cappedXp(s, item.quest) < maxXp(item.quest)) return false;
  return true;
}
/** Adds an item respecting its duplicate rule. Returns {converted:amount|0}. */
export function addItem(s, ctx, id, n = 1) {
  const item = ITEM_BY_ID[id]; rule(item, 'Unknown item.');
  const cur = s.inv.items[id];
  if (cur && cur.count > 0 && item.dup === 'convert') {
    const amount = Math.floor(item.value / 2);
    addCurrency(s, currencyOf(item), amount);
    return { converted: amount, currency: currencyOf(item) };
  }
  if (cur) cur.count += n; else s.inv.items[id] = { count: n, at: ctx.now };
  return { converted: 0 };
}
export function removeItem(s, id, n = 1) {
  const cur = s.inv.items[id]; rule(cur && cur.count >= n, 'You do not have that item.');
  cur.count -= n;
  if (cur.count === 0) { delete s.inv.items[id]; if (s.inv.emblem === id) s.inv.emblem = null; }
}

// ---------------------------------------------------------------- level-up grants
const BOX_RULES = {
  physique: (l) => (l % 10 === 0 ? 'phy_warriors-chest' : l % 2 === 0 ? 'phy_iron-crate' : null),
  intelligence: (l) => (l % 25 === 0 ? 'int_strategists-crate' : l % 10 === 0 ? 'int_memory-vault' : l % 5 === 0 ? 'int_scholars-cache' : l % 2 === 0 ? 'int_logic-chest' : null),
  financial: (l) => (l % 15 === 0 ? 'fin_treasury-box' : l % 5 === 0 ? 'fin_ledger-cache' : null),
  romance: (l) => (l % 10 === 0 ? 'rom_royal-lootbox' : l % 2 === 0 ? 'rom_charm-chest' : null),
};
export const grantId = (q, l) => `lvl:${q}:${l}`;
/** Creates a grant for every level ever reached (idempotent; never re-creates, never duplicates). */
export function syncGrants(s) {
  for (const q of QUESTS) for (let l = 2; l <= s.maxLevel[q]; l++) {
    const id = grantId(q, l);
    if (s.grants[id]) continue;
    s.grants[id] = { id, quest: q, level: l, currency: q === 'romance' ? 'hearts' : 'gold', amount: 10 * l, box: BOX_RULES[q](l), claimed: false, claimedAt: null };
  }
}
export const unclaimedGrants = (s) => Object.values(s.grants).filter((g) => !g.claimed).sort((a, b) => a.level - b.level);
export function claimGrant(s, ctx, id) {
  const g = s.grants[id];
  rule(g, 'That reward does not exist.');
  rule(!g.claimed, 'That reward was already claimed.', 'duplicate');
  g.claimed = true; g.claimedAt = ctx.now;
  addCurrency(s, g.currency, g.amount);
  if (g.box) addItem(s, ctx, g.box, 1);
  const box = g.box ? ITEM_BY_ID[g.box] : null;
  addEvent(s, ctx, { id: `ev-claim-${id}`, cat: 'reward', type: 'claim', title: `Reward claimed: ${QUEST_NAMES[g.quest]} level ${g.level}`, text: `+${g.amount} ${g.currency === 'hearts' ? 'Heart Coins' : 'Gold'}${box ? ` and a ${box.name}` : ''}.`, amount: g.amount, unit: g.currency === 'hearts' ? 'HC' : 'G', quest: g.quest });
  return g;
}

// ---------------------------------------------------------------- lootboxes
/** Items a box can drop: same quest, unlocked, not a box/key. */
export function boxPool(s, box) {
  return CATALOG.filter((i) => i.quest === box.box.quest && i.kind !== 'lootbox' && i.kind !== 'key' && itemUnlocked(s, i));
}
/** Odds actually in effect (renormalised to rarities that have something to drop). Used by the UI and FORMULAS.md. */
export function boxOdds(s, box) {
  const pool = boxPool(s, box); const out = [];
  let total = 0;
  for (const [r, w] of Object.entries(box.box.weights)) if (pool.some((i) => i.rarity === r)) { total += w; out.push({ rarity: r, w }); }
  return out.map((o) => ({ rarity: o.rarity, pct: (o.w / total) * 100, count: pool.filter((i) => i.rarity === o.rarity).length })).sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity));
}
export function openLootbox(s, ctx, { boxId, openId }, rnd = secureRandom) {
  rule(typeof openId === 'string' && openId.length >= 6, 'Missing opening id.');
  if (s.inv.opened[openId]) throw new RuleError('That lootbox was already opened.', 'duplicate');
  const box = ITEM_BY_ID[boxId]; rule(box && box.kind === 'lootbox', 'That is not a lootbox.');
  rule(owned(s, boxId) > 0, 'You do not have that lootbox.');
  if (box.needsKey) rule(owned(s, box.needsKey) > 0, `This box needs a ${ITEM_BY_ID[box.needsKey].name}.`, 'key');
  const pool = boxPool(s, box);
  rule(pool.length > 0, 'Nothing can drop from this box yet.');
  // consume first, inside the same atomic commit
  removeItem(s, boxId, 1);
  if (box.needsKey) removeItem(s, box.needsKey, 1);
  const odds = boxOdds(s, box);
  let roll = rnd() * odds.reduce((a, o) => a + o.pct, 0), rarity = odds[odds.length - 1].rarity;
  for (const o of odds) { if (roll < o.pct) { rarity = o.rarity; break; } roll -= o.pct; }
  const cands = pool.filter((i) => i.rarity === rarity);
  const item = cands[Math.min(cands.length - 1, Math.floor(rnd() * cands.length))];
  const res = addItem(s, ctx, item.id, 1);
  const [g0, g1] = box.box.gold; const gold = g0 + Math.floor(rnd() * (g1 - g0 + 1));
  addCurrency(s, 'gold', gold);
  let hearts = 0;
  if (box.box.hearts) { const [h0, h1] = box.box.hearts; hearts = h0 + Math.floor(rnd() * (h1 - h0 + 1)); addCurrency(s, 'hearts', hearts); }
  s.inv.opened[openId] = ctx.now;
  const keys = Object.keys(s.inv.opened); if (keys.length > 300) delete s.inv.opened[keys[0]];
  addEvent(s, ctx, { id: `ev-open-${openId}`, cat: 'reward', type: 'lootbox', title: `Opened ${box.name}`, text: `${item.name} (${item.rarity})${res.converted ? ` - duplicate converted to ${res.converted} ${res.currency === 'hearts' ? 'Heart Coins' : 'Gold'}` : ''}. +${gold} Gold${hearts ? `, +${hearts} Heart Coins` : ''}.`, quest: box.quest, meta: { itemId: item.id, rarity } });
  return { item, rarity, converted: res.converted, currency: res.currency, gold, hearts };
}

// ---------------------------------------------------------------- consumables & cosmetics
export function useItem(s, ctx, { itemId, useId }) {
  rule(typeof useId === 'string' && useId.length >= 6, 'Missing use id.');
  if (s.inv.opened[useId]) throw new RuleError('That item was already used.', 'duplicate');
  const item = ITEM_BY_ID[itemId]; rule(item && item.binding === 'consumable' && !['lootbox', 'key'].includes(item.kind), 'That item cannot be used.');
  rule(owned(s, itemId) > 0, 'You do not have that item.');
  let text = '';
  if (item.effect?.xp) {
    const got = awardItemXp(s, ctx, 'romance', item.effect.xp);
    rule(got > 0, `Item XP is capped at ${ITEM_XP_DAILY_CAP} per day. Try again tomorrow. The item was not used.`, 'cap');
    text = `+${got} Romance XP (item XP is capped at ${ITEM_XP_DAILY_CAP}/day).`;
  } else if (item.currency?.hearts) { addCurrency(s, 'hearts', item.currency.hearts); text = `+${item.currency.hearts} Heart Coins.`; } else throw new RuleError('That item has no use.');
  removeItem(s, itemId, 1);
  s.inv.opened[useId] = ctx.now;
  addEvent(s, ctx, { id: `ev-use-${useId}`, cat: 'reward', type: 'use', title: `Used ${item.name}`, text, quest: item.quest });
  return text;
}
export function equipEmblem(s, ctx, itemId) {
  if (itemId === null) { s.inv.emblem = null; return; }
  const item = ITEM_BY_ID[itemId]; rule(item && item.kind === 'emblem', 'Only emblems and frames can be equipped.');
  rule(owned(s, itemId) > 0, 'You do not own that emblem.');
  s.inv.emblem = itemId;
  addEvent(s, ctx, { cat: 'reward', type: 'equip', title: 'Emblem equipped', text: item.name, quest: item.quest });
}
export { currencyOf };
