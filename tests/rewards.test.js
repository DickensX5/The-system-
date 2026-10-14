import test from 'node:test';
import assert from 'node:assert/strict';
import { mkStore, rejects } from './helpers.js';
import { claimGrant, openLootbox, useItem, addItem, owned, unclaimedGrants, equipEmblem } from '../js/engine/reward-engine.js';
import { CATALOG, ITEM_BY_ID } from '../js/data/rewards.js';
import { ITEM_XP_DAILY_CAP } from '../js/engine/xp-engine.js';
import { ALL_QUEST_TITLES } from '../js/data/titles.js';

test('catalog: 60-120 unique items with required metadata, nothing grants titles', () => {
  assert.ok(CATALOG.length >= 60 && CATALOG.length <= 120);
  assert.equal(new Set(CATALOG.map((i) => i.id)).size, CATALOG.length);
  for (const i of CATALOG) { assert.ok(i.name && i.desc && i.rarity && i.kind && i.binding && i.quest && i.dup, i.id); assert.ok(!('grantsTitle' in i)); }
  assert.equal(CATALOG.filter((i) => i.quest === 'romance').length, 50);
});
test('level-up grants appear once and can be claimed exactly once', async () => {
  const { store, S } = await mkStore();
  await store.commit('x', (s) => { s.xp.physique = 56 * 3; });          // level 4 -> grants for 2,3,4
  assert.equal(unclaimedGrants(S()).length, 3);
  const g = unclaimedGrants(S())[0].id;
  await store.commit('c', (s, c) => claimGrant(s, c, g));
  const gold = S().currency.gold;
  await rejects(store.commit('c', (s, c) => claimGrant(s, c, g)), 'already claimed');
  assert.equal(S().currency.gold, gold);
  await store.commit('x', (s) => { s.xp.physique += 1; });               // re-finalize: no regrant
  assert.equal(unclaimedGrants(S()).length, 2);
  assert.equal(S().inbox.events.filter((e) => e.id === `ev-claim-${g}`).length, 1);
});
test('lootbox: one result, one event, no double open, consumes box (and key)', async () => {
  const { store, S } = await mkStore();
  await store.commit('g', (s, c) => { addItem(s, c, 'phy_iron-crate', 2); });
  const rnd = () => 0.1;
  const r = await store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'phy_iron-crate', openId: 'open-aaa111' }, rnd));
  assert.ok(r.item); assert.equal(owned(S(), 'phy_iron-crate'), 1);
  await rejects(store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'phy_iron-crate', openId: 'open-aaa111' }, rnd)), 'already opened');
  assert.equal(owned(S(), 'phy_iron-crate'), 1);
  assert.equal(S().inbox.events.filter((e) => e.type === 'lootbox').length, 1);
});
test('lootbox: key-gated box needs a key; failure leaves everything unchanged', async () => {
  const { store, S } = await mkStore();
  await store.commit('x', (s, c) => { s.xp.romance = 100 * 20; addItem(s, c, 'rom_royal-lootbox', 1); });
  const before = JSON.stringify(S().inv);
  await rejects(store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'rom_royal-lootbox', openId: 'open-key001' })), 'needs a');
  assert.equal(JSON.stringify(S().inv), before);
  await store.commit('k', (s, c) => addItem(s, c, 'rom_lootbox-key', 1));
  await store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'rom_royal-lootbox', openId: 'open-key002' }));
  assert.equal(owned(S(), 'rom_lootbox-key'), 0);
});
test('drops respect unlock levels (no rare item at level 1)', async () => {
  const { store, S } = await mkStore();
  await store.commit('g', (s, c) => addItem(s, c, 'phy_warriors-chest', 40));
  for (let n = 0; n < 40; n++) {
    const r = await store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'phy_warriors-chest', openId: 'open-lvl' + n + 'abc' }, Math.random));
    assert.ok(ITEM_BY_ID[r.item.id].unlock <= 1, r.item.id);
  }
});
test('duplicate unique collectible converts to currency, never a second copy', async () => {
  const { store, S } = await mkStore();
  await store.commit('a', (s, c) => addItem(s, c, 'phy_iron-will-emblem', 1));
  const gold = S().currency.gold;
  await store.commit('a', (s, c) => addItem(s, c, 'phy_iron-will-emblem', 1));
  assert.equal(owned(S(), 'phy_iron-will-emblem'), 1);
  assert.equal(S().currency.gold, gold + 5);
});
test('XP items obey the daily cap and cannot reach other quests or titles', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('a', (s, c) => { addItem(s, c, 'rom_romance-xp-capsule', 5); addItem(s, c, 'rom_romance-xp-shard', 1); });
  await store.commit('u', (s, c) => useItem(s, c, { itemId: 'rom_romance-xp-capsule', useId: 'use-000001' }));
  await store.commit('u', (s, c) => useItem(s, c, { itemId: 'rom_romance-xp-capsule', useId: 'use-000002' }));
  assert.equal(S().xp.romance, 30);
  await rejects(store.commit('u', (s, c) => useItem(s, c, { itemId: 'rom_romance-xp-shard', useId: 'use-000003' })), 'capped');
  assert.equal(owned(S(), 'rom_romance-xp-shard'), 1);                                // not consumed
  assert.equal(S().xp.physique + S().xp.intelligence, 0);
  clock.t += 25 * 3600e3;
  await store.commit('u', (s, c) => useItem(s, c, { itemId: 'rom_romance-xp-shard', useId: 'use-000004' }));
  assert.equal(S().xp.romance, 35);
  assert.equal(ITEM_XP_DAILY_CAP, 30);
});
test('XP Summoning Seal / Title Unlock Scroll have no mechanical effect on titles or XP', async () => {
  const { store, S } = await mkStore();
  await store.commit('noop', (s) => { s.seq += 0; });            // first finalize unlocks the level-1 titles
  const before = JSON.stringify([S().xp, S().titles]);
  await store.commit('a', (s, c) => { addItem(s, c, 'rom_xp-summoning-seal', 1); addItem(s, c, 'rom_title-unlock-scroll', 1); });
  assert.equal(JSON.stringify([S().xp, S().titles]), before);
  await rejects(store.commit('u', (s, c) => useItem(s, c, { itemId: 'rom_xp-summoning-seal', useId: 'use-seal001' })), 'cannot be used');
});
test('emblems: equip only owned emblems', async () => {
  const { store, S } = await mkStore();
  await rejects(store.commit('e', (s, c) => equipEmblem(s, c, 'phy_iron-will-emblem')), 'do not own');
  await store.commit('a', (s, c) => addItem(s, c, 'phy_iron-will-emblem', 1));
  await store.commit('e', (s, c) => equipEmblem(s, c, 'phy_iron-will-emblem'));
  assert.equal(S().inv.emblem, 'phy_iron-will-emblem');
  await rejects(store.commit('e', (s, c) => equipEmblem(s, c, 'phy_sweatbound-wristband')), 'Only emblems');
});

test('every level-up grant box (levels 2-100, all quests) refers to a real lootbox', async () => {
  const { store, S } = await mkStore();
  await store.commit('x', (s) => { s.maxLevel.physique = 100; s.maxLevel.intelligence = 100; s.maxLevel.financial = 100; s.maxLevel.romance = 100; });
  for (const g of Object.values(S().grants)) if (g.box) assert.equal(ITEM_BY_ID[g.box]?.kind, 'lootbox', g.id + ' -> ' + g.box);
  assert.ok(Object.values(S().grants).some((g) => g.box === 'phy_warriors-chest'));
});
