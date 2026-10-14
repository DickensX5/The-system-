import test from 'node:test';
import assert from 'node:assert/strict';
import { mkStore, rejects } from './helpers.js';
import { overallLevelFromNumerator, overallLevel, bandFor, overallNumerator } from '../js/engine/progression-engine.js';
import { levelFromXp, QUEST_RULES, maxXp, summonXp, SUMMON, summonCharges, summonRemaining, getXp } from '../js/engine/xp-engine.js';
import { createInitialState } from '../js/state/migrations.js';
import { equipTitle, isEligible } from '../js/engine/title-engine.js';
import { targetFor } from '../js/quests/physique.js';

test('quest levels: min, boundaries, max', () => {
  for (const q of ['financial', 'physique', 'intelligence', 'romance']) {
    const r = QUEST_RULES[q];
    assert.equal(levelFromXp(q, 0), 1);
    assert.equal(levelFromXp(q, r.per - 1), 1);
    assert.equal(levelFromXp(q, r.per), 2);
    assert.equal(levelFromXp(q, r.per + 1), 2);
    assert.equal(levelFromXp(q, maxXp(q)), r.max);
    assert.equal(levelFromXp(q, maxXp(q) * 10), r.max);
  }
  assert.equal(maxXp('physique'), 2800);   // 350 workouts x 8 XP
  assert.equal(maxXp('intelligence'), 14000);
});
test('overall level: 1..100, exact integer formula, never 0 or >100', () => {
  assert.equal(overallLevelFromNumerator(0), 1);
  assert.equal(overallLevelFromNumerator(840000), 100);
  assert.equal(overallLevelFromNumerator(1e9), 100);
  const s = createInitialState(0);
  assert.equal(overallLevel(s), 1);
  s.xp.physique = 2800; s.xp.intelligence = 14000; s.xp.romance = 5000;      // 3 quests maxed (financial 0)
  assert.equal(overallLevel(s), 1 + Math.floor((99 * 630000) / 840000));      // 75% -> 74
  s.fin.tx.push({ id: 'x', type: 'start', amount: 6000 * 300, date: '2026-01-01', at: 0 });  // financial maxed (300 XP)
  assert.equal(overallLevel(s), 100);
});
test('overall level: mixed progress worked example and rounding boundary', () => {
  const s = createInitialState(0);
  s.xp.physique = 560;            // 20% of 2800
  s.xp.intelligence = 2800;       // 20% of 14000
  // S = 0.25*(0.2+0.2) = 0.10 -> 1 + floor(9.9) = 10
  assert.equal(overallLevel(s), 10);
  // exact boundary: N for level 2 is ceil(840000/99)=8485
  assert.equal(overallLevelFromNumerator(8484), 1);
  assert.equal(overallLevelFromNumerator(8485), 2);
});
test('overall title-band boundaries', () => {
  const names = (l) => bandFor(l).name;
  assert.deepEqual([1, 20, 21, 40, 41, 60, 61, 80, 81, 100].map(names), ['Unawakened', 'Unawakened', 'Lone Wolf', 'Lone Wolf', 'Alpha', 'Alpha', 'Sigma', 'Sigma', 'Soul Monarch', 'Soul Monarch']);
});
test('overall level recalculates after progress AND after a financial decline', async () => {
  const { store, S, ov } = await mkStore();
  const { addIncome, addExpense } = await import('../js/quests/financial.js');
  await store.commit('inc', (s, c) => addIncome(s, c, { amount: 36000 * 20 }));
  const high = ov(); assert.ok(high > 1);
  await store.commit('exp', (s, c) => addExpense(s, c, { amount: 36000 * 15 }));
  assert.ok(ov() < high);
});
test('physique scaling every three levels (L1-2, 3-5, 6-8 ... 48-50)', () => {
  assert.deepEqual([1, 2].map((l) => targetFor('pushups', l)), [20, 20]);
  assert.deepEqual([3, 5].map((l) => targetFor('crunches', l)), [30, 30]);
  assert.equal(targetFor('climbers', 3), 25); assert.equal(targetFor('jacks', 3), 70);
  assert.equal(targetFor('pushups', 6), 40); assert.equal(targetFor('climbers', 6), 35); assert.equal(targetFor('jacks', 6), 80);
  assert.equal(targetFor('pushups', 48), 180); assert.equal(targetFor('pushups', 50), 180);
  assert.equal(targetFor('climbers', 48), 175); assert.equal(targetFor('jacks', 50), 220);
});
test('XP summoning: unlock milestones, cap, restrictions, exact arithmetic, no negatives, double-tap', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('seed', (s) => { s.xp.physique = 1000; s.xp.intelligence = 300; });
  const req = (o) => ({ from: 'physique', to: 'romance', amount: 10, requestId: 'req-' + Math.random(), ...o });
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req(), 4)), 'locked');                 // below level 5
  assert.equal(summonCharges(S(), 5), 1); assert.equal(summonCharges(S(), 9), 1); assert.equal(summonCharges(S(), 10), 2);
  const id = 'req-double';
  await store.commit('t', (s, c) => summonXp(s, c, req({ amount: 100, requestId: id }), 10));
  assert.equal(S().xp.physique, 900); assert.equal(S().xp.romance, 100);                           // exact
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ amount: 100, requestId: id }), 10)), 'duplicate');
  assert.equal(S().xp.physique, 900);
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ from: 'physique', to: 'physique' }), 15)), 'Only Romance');
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ to: 'intelligence' }), 15)), 'cannot receive');
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ from: 'romance' }), 15)), 'cannot send');
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ amount: 151 }), 15)), 'cap');   // 100 used of 250
  await store.commit('t', (s, c) => summonXp(s, c, req({ amount: 150 }), 15));
  assert.equal(summonRemaining(S(), clock.t), 0);
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ amount: 1 }), 20)), 'cap');
  clock.t += 24 * 3600e3 + 1;                                                                       // rolling window passes
  assert.equal(summonRemaining(S(), clock.t), 250);
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ from: 'intelligence', amount: 301 }), 25)), 'cap');
  await store.commit('t', (s, c) => summonXp(s, c, req({ from: 'intelligence', amount: 250 }), 25));
  assert.equal(S().xp.intelligence, 50);
  await rejects(store.commit('t', (s, c) => summonXp(s, c, req({ from: 'intelligence', amount: 100 }), 30)), 'cap'); // cap again (250 used)
  assert.ok(Object.values(S().xp).every((x) => x >= 0));
});
test('summoning from Financial reduces eligible Financial XP exactly, and never below zero', async () => {
  const { store, S } = await mkStore();
  const { addIncome } = await import('../js/quests/financial.js');
  await store.commit('i', (s, c) => addIncome(s, c, { amount: 60000 }));    // 10 XP
  assert.equal(getXp(S(), 'financial'), 10);
  await store.commit('t', (s, c) => summonXp(s, c, { from: 'financial', to: 'romance', amount: 4, requestId: 'req-fin-1' }, 5));
  assert.equal(getXp(S(), 'financial'), 6); assert.equal(S().xp.romance, 4);
  await rejects(store.commit('t', (s, c) => summonXp(s, c, { from: 'financial', to: 'romance', amount: 7, requestId: 'req-fin-2' }, 10)), 'only has');
});
test('titles: equip only if earned; fall back when no longer eligible', async () => {
  const { store, S, ov } = await mkStore();
  await rejects(store.commit('e', (s, c) => equipTitle(s, c, 'phy_l5', ov())), 'not earned');
  await store.commit('x', (s) => { s.xp.physique = 56 * 4; });               // level 5
  assert.ok(isEligible(S(), 'phy_l5', ov()));
  await store.commit('e', (s, c) => equipTitle(s, c, 'phy_l5', ov()));
  assert.equal(S().titles.equipped, 'phy_l5');
  assert.ok(S().titles.unlocked.phy_l5);
});
test('final-level title needs the quest fully cleared', () => {
  const s = createInitialState(0);
  s.xp.physique = 56 * 49;   // level 50 reached, not cleared
  assert.equal(isEligible(s, 'phy_l45', 100), true);
  assert.equal(isEligible(s, 'phy_l50', 100), false);
  s.xp.physique = 2800;
  assert.equal(isEligible(s, 'phy_l50', 100), true);
});
