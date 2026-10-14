import { h, ico, chip, tabs, empty, openSheet, guarded, toast, confirmSheet, bar, kv } from '../ui/dom.js';
import { CATALOG, ITEM_BY_ID, currencyOf } from '../data/rewards.js';
import { claimGrant, unclaimedGrants, openLootbox, useItem, equipEmblem, owned, boxOdds, itemUnlocked } from '../engine/reward-engine.js';
import { equipTitle, isEligible, equippedTitle, currentRankTitle } from '../engine/title-engine.js';
import { BANDS, ALL_QUEST_TITLES, QUEST_TITLES } from '../data/titles.js';
import { QUEST_NAMES, ITEM_XP_DAILY_CAP } from '../engine/xp-engine.js';
import { itemCard, itemFacts, rarityChip, curLabel, QMETA } from './shared.js';
import { fmtTSh, cap } from '../utils/formatting.js';
import { KIND_ICON } from '../ui/dom.js';

let tab = 'claim', invFilter = 'all';
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function openItemSheet(A, item) {
  const S = A.S(), n = owned(S, item.id);
  openSheet((sh) => {
    const actions = [];
    if (item.kind === 'lootbox' && n > 0) actions.push(h('button', { class: 'btn primary', onclick: () => { sh.close(); openBox(A, item); } }, ico('chest'), 'Open'));
    if (item.binding === 'consumable' && item.kind !== 'lootbox' && item.kind !== 'key' && n > 0 && (item.effect || item.currency)) actions.push(h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('use', (s, c) => useItem(s, c, { itemId: item.id, useId: uid('use') })); if (r.ok) { toast(r.value, 'good'); sh.close(); } }) }, ico('bolt'), 'Use'));
    if (item.kind === 'emblem' && n > 0) actions.push(S.inv.emblem === item.id ? h('button', { class: 'btn', onclick: guarded(async () => { await A.act('equip', (s, c) => equipEmblem(s, c, null)); sh.close(); }) }, 'Unequip') : h('button', { class: 'btn primary', onclick: guarded(async () => { const r = await A.act('equip', (s, c) => equipEmblem(s, c, item.id)); if (r.ok) sh.close(); }) }, ico('badge'), 'Equip emblem'));
    sh.set(h('div', { class: 'reveal' }, h('div', { class: `gem item r-${item.rarity}`, style: { display: 'grid' } }, ico(KIND_ICON[item.kind] || 'gem'))), h('h2', { style: { textAlign: 'center', textTransform: 'none', letterSpacing: 0, color: 'var(--text)', fontSize: '19px' } }, item.name),
      h('div', { class: 'stack', style: { marginTop: '10px' } }, ...itemFacts(A, item), n ? h('div', { class: 'kv' }, h('span', null, 'You own'), h('span', { class: 'mono' }, '×' + n)) : h('p', { class: 'hint' }, 'You do not own this yet.'),
        item.kind === 'lootbox' ? oddsBlock(A, item) : null, item.needsKey ? h('p', { class: 'hint' }, `Needs: ${ITEM_BY_ID[item.needsKey].name} (owned ${owned(S, item.needsKey)})`) : null),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => sh.close() }, 'Close'), ...actions));
  });
}
function oddsBlock(A, box) {
  const odds = boxOdds(A.S(), box);
  return h('div', { class: 'card' }, h('div', { class: 'label' }, 'Drop odds (items you have unlocked)'), ...odds.map((o) => h('div', { class: 'kv' }, rarityChip(o.rarity), h('span', { class: 'mono' }, `${o.pct.toFixed(1)}% · ${o.count} item${o.count > 1 ? 's' : ''}`))), h('p', { class: 'hint' }, `Plus ${box.box.gold[0]}–${box.box.gold[1]} Gold${box.box.hearts ? ` and ${box.box.hearts[0]}–${box.box.hearts[1]} Heart Coins` : ''} every time. Duplicates of unique items convert into currency.`));
}
function openBox(A, box) {
  if (box.needsKey && !owned(A.S(), box.needsKey)) { toast(`You need a ${ITEM_BY_ID[box.needsKey].name} to open this.`, 'error'); return; }
  const openId = uid('open');
  const sh = openSheet((s) => s.set(h('div', { class: 'reveal' }, h('div', { class: 'gem opening' }, ico('chest')), h('p', { class: 'muted' }, 'Opening…'))));
  setTimeout(async () => {
    const r = await A.act('open', (s, c) => openLootbox(s, c, { boxId: box.id, openId }));
    if (!r.ok) { sh.close(); return; }
    const { item, rarity, converted, currency, gold, hearts } = r.value;
    sh.set(h('div', { class: 'reveal' }, h('div', { class: `gem item r-${rarity}`, style: { display: 'grid' } }, ico(KIND_ICON[item.kind] || 'gem')), h('div', null, rarityChip(rarity)), h('h2', { style: { color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontSize: '20px', marginTop: '8px' } }, item.name), h('p', { class: 'muted' }, item.desc),
      converted ? h('p', { class: 'warn' }, `Duplicate: converted into ${converted} ${curLabel(currency)}.`) : h('p', { class: 'ok' }, 'Added to your inventory.'), h('p', { class: 'hint' }, `+${gold} Gold${hearts ? `, +${hearts} Heart Coins` : ''}`)),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => sh.close() }, 'Nice')));
  }, 700);
}

function claimTab(A) {
  const S = A.S(), list = unclaimedGrants(S);
  const claimAll = guarded(async () => { for (const g of list) { const r = await A.act('claim', (s, c) => claimGrant(s, c, g.id)); if (!r.ok) break; } });
  return h('div', { class: 'stack' }, list.length ? [
    h('div', { class: 'row spread' }, h('h2', null, `${list.length} to claim`), list.length > 1 ? h('button', { class: 'btn small primary', onclick: claimAll }, 'Claim all') : null),
    h('div', { class: 'card list' }, list.map((g) => { const box = g.box ? ITEM_BY_ID[g.box] : null; return h('div', { class: 'li' }, h('div', { class: `ic q-${g.quest}` }, ico(QMETA[g.quest].icon)), h('div', { class: 'grow' }, h('b', null, `${QUEST_NAMES[g.quest]} level ${g.level}`), h('div', { class: 'hint' }, `${g.amount} ${curLabel(g.currency)}${box ? ` + ${box.name}` : ''}`)), h('button', { class: 'btn small primary', onclick: guarded(() => A.act('claim', (s, c) => claimGrant(s, c, g.id))) }, 'Claim')); })),
  ] : empty('gift', 'Nothing to claim', 'Every quest level you reach earns a one-time reward.'),
  h('p', { class: 'hint' }, 'Rewards are earned by levels and quests only. Rarity never changes your level, XP or titles.'));
}
function inventoryTab(A) {
  const S = A.S();
  const kinds = ['all', 'lootbox', 'emblem', 'collectible', 'key', 'consumable', 'certificate'];
  const have = Object.keys(S.inv.items).map((id) => ITEM_BY_ID[id]).filter((i) => i && (invFilter === 'all' || i.kind === invFilter)).sort((a, b) => a.quest.localeCompare(b.quest) || a.name.localeCompare(b.name));
  return h('div', { class: 'stack' }, tabs(kinds.map((k) => [k, k === 'all' ? 'All' : cap(k) + 's']), invFilter, (k) => { invFilter = k; A.render(); }),
    have.length ? h('div', { class: 'items' }, have.map((i) => itemCard(A, i, { qty: owned(S, i.id), sub: S.inv.emblem === i.id ? chip('Equipped') : null, onClick: () => openItemSheet(A, i) }))) : empty('chest', 'Nothing here yet', 'Claim level rewards and open lootboxes to fill your inventory.'),
    S.inv.lost.length ? h('div', { class: 'banner warn', style: { margin: 0 } }, ico('warn'), `${S.inv.lost.length} item(s)/title(s) were lost to a Savage penalty. Recover them in Market > Lost & Found.`) : null);
}
function titlesTab(A) {
  const S = A.S(), ov = A.ov(), eq = equippedTitle(S, ov), rank = currentRankTitle(ov);
  const row = (t, req) => { const ok = isEligible(S, t.id, ov), on = S.titles.equipped === t.id; return h('div', { class: 'li', style: !ok ? { opacity: .55 } : null }, h('div', { class: `ic ${t.quest ? 'q-' + t.quest : ''}` }, ico(ok ? 'trophy' : 'lock')), h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'hint' }, S.titles.revoked[t.id] ? 'Removed by a Savage penalty. Recover it in Lost & Found.' : req)), ok ? (on ? chip('Equipped') : h('button', { class: 'btn small', onclick: guarded(() => A.act('title', (s, c) => equipTitle(s, c, t.id, A.ov()))) }, 'Equip')) : null); };
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('div', { class: 'label' }, 'Current rank'), h('div', { class: 'big' }, rank.name), h('div', { class: 'hint' }, `Overall levels ${rank.from}–${rank.to}. Equipped title: ${eq ? eq.name : 'none (rank shown)'}`), eq ? h('button', { class: 'btn small ghost', onclick: () => A.act('title', (s, c) => equipTitle(s, c, null, A.ov())) }, 'Unequip') : null),
    h('div', { class: 'card list' }, h('h3', null, 'Ranks'), BANDS.map((b) => row({ id: b.id, name: b.name, quest: null }, `Overall level ${b.from}+`))),
    ...Object.entries(QUEST_TITLES).map(([q, list]) => h('div', { class: 'card list' }, h('h3', null, QUEST_NAMES[q]), list.map((t) => row(t, t.balance ? `Recorded balance of ${fmtTSh(t.balance)}` : `${QUEST_NAMES[q]} level ${t.level}${t.level >= (q === 'intelligence' ? 100 : 50) ? ' (fully cleared)' : ''}`)))),
    h('p', { class: 'hint' }, 'Titles are earned only by levels and balance milestones. Items can never unlock a title.'));
}
function codexTab(A) {
  const S = A.S();
  return h('div', { class: 'stack' }, h('p', { class: 'muted' }, `All ${CATALOG.length} collectibles. Locked items show what unlocks them.`), ...['physique', 'intelligence', 'financial', 'romance'].map((q) => h('div', { class: 'stack' }, h('h2', null, QUEST_NAMES[q]), h('div', { class: 'items' }, CATALOG.filter((i) => i.quest === q).map((i) => itemCard(A, i, { qty: owned(S, i.id), locked: !itemUnlocked(S, i) && !owned(S, i.id), onClick: () => openItemSheet(A, i) }))))));
}
export default function rewards(A) {
  const body = { claim: claimTab, inventory: inventoryTab, titles: titlesTab, codex: codexTab }[tab](A);
  return h('div', { class: 'stack rise' }, tabs([['claim', 'Claim'], ['inventory', 'Inventory'], ['titles', 'Titles'], ['codex', 'Codex']], tab, (t) => { tab = t; A.render(); }), body, h('a', { class: 'btn block', href: '#/arcade' }, ico('game'), 'Arcade (mini-games)'));
}
