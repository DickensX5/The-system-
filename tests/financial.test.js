import test from 'node:test';
import assert from 'node:assert/strict';
import { mkStore, rejects, at } from './helpers.js';
import * as F from '../js/quests/financial.js';
import { questLevel, getXp } from '../js/engine/xp-engine.js';
import { isEligible } from '../js/engine/title-engine.js';

const D = (d) => `2026-10-${String(d).padStart(2, '0')}`;
test('worked examples: receive 6,000 / reach 36,000 / spend 6,000 / penalty 6,000', async () => {
  const { store, S } = await mkStore(at(2026, 10, 12));
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 6000 }));
  assert.equal(F.balance(S()), 6000); assert.equal(getXp(S(), 'financial'), 1); assert.equal(questLevel(S(), 'financial'), 1);
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 30000 }));
  assert.equal(F.balance(S()), 36000); assert.equal(getXp(S(), 'financial'), 6); assert.equal(questLevel(S(), 'financial'), 2);
  await store.commit('e', (s, c) => F.addExpense(s, c, { amount: 6000 }));
  assert.equal(F.balance(S()), 30000); assert.equal(F.lifetimeIncome(S()), 36000);     // history preserved
  assert.equal(getXp(S(), 'financial'), 5); assert.equal(questLevel(S(), 'financial'), 1);   // level DROPS
  assert.equal(F.totalExpenses(S()), 6000);
});
test('income, balance, expenses stay distinct; starting balance is not income; overspend rejected', async () => {
  const { store, S } = await mkStore();
  await store.commit('s', (s, c) => F.setStartingBalance(s, c, 50000));
  assert.equal(F.balance(S()), 50000); assert.equal(F.lifetimeIncome(S()), 0); assert.equal(F.startingBalance(S()), 50000);
  await rejects(store.commit('s', (s, c) => F.setStartingBalance(s, c, 1000)), 'already exists');
  await rejects(store.commit('e', (s, c) => F.addExpense(s, c, { amount: 50001 })), 'Not enough');
  await rejects(store.commit('i', (s, c) => F.addIncome(s, c, { amount: -5 })), 'whole number');
  await rejects(store.commit('i', (s, c) => F.addIncome(s, c, { amount: 10.5 })), 'whole number');
  assert.equal(S().fin.tx.length, 1);
});
test('TSh 500,000 title milestone and tracking continues above it', async () => {
  const { store, S, ov } = await mkStore();
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 499999 }));
  assert.equal(isEligible(S(), 'fin_half_million', ov()), false);
  assert.equal(isEligible(S(), 'fin_first_earner', ov()), true);                       // > 50,000
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 1 }));
  assert.equal(isEligible(S(), 'fin_half_million', ov()), true);
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 700000 }));
  assert.equal(F.balance(S()), 1200000); assert.equal(F.lifetimeIncome(S()), 1200000);
});
test('title reverts when balance falls; ever-unlocked history kept', async () => {
  const { store, S, ov } = await mkStore();
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 36000 * 5 }));           // level 6 -> Money Keeper (L5)
  assert.ok(S().titles.unlocked.fin_l5);
  await store.commit('q', (s, c) => { s.titles.equipped = 'fin_l5'; });
  await store.commit('e', (s, c) => F.addExpense(s, c, { amount: 36000 * 4 }));        // level 2
  assert.equal(isEligible(S(), 'fin_l5', ov()), false);
  assert.ok(S().titles.unlocked.fin_l5, 'history kept');
  assert.notEqual(S().titles.equipped, 'fin_l5');
});
test('missed workday -> one pending penalty; rest days exempt; no duplicates', async () => {
  const { store, S, clock } = await mkStore(at(2026, 10, 12));   // Monday
  await store.commit('s', (s, c) => { F.setStartingBalance(s, c, 36000); F.saveSettings(s, c, { expected: 6000, workdays: [1, 2, 3, 4, 5], trackStart: D(12) }); });
  // Tue-Sun pass with Sat/Sun being rest days (not in workdays)
  clock.t = at(2026, 10, 19, 9);
  await store.commit('tick', (s, c) => F.tick(s, c));
  const pend = F.pendingPenalties(S()).map((p) => p.date);
  assert.deepEqual(pend, [D(12), D(13), D(14), D(15), D(16)]);            // Mon..Fri, weekend skipped
  const n = Object.keys(S().fin.penalties).length;
  await store.commit('tick', (s, c) => F.tick(s, c));                      // again -> idempotent
  assert.equal(Object.keys(S().fin.penalties).length, n);
});
test('penalty deducts 6,000 (36,000 -> 30,000), logs once, cannot be applied twice', async () => {
  const { store, S, clock } = await mkStore(at(2026, 10, 12));
  await store.commit('s', (s, c) => { F.setStartingBalance(s, c, 36000); F.saveSettings(s, c, { expected: 6000, workdays: [1], trackStart: D(12) }); });
  clock.t = at(2026, 10, 13, 8);
  await store.commit('t', (s, c) => F.tick(s, c));
  assert.ok(F.lockedBy(S()));
  await store.commit('a', (s, c) => F.applyPenalty(s, c, D(12)));
  assert.equal(F.balance(S()), 30000);
  await rejects(store.commit('a', (s, c) => F.applyPenalty(s, c, D(12))), 'no pending');
  assert.equal(F.balance(S()), 30000);
  assert.equal(S().inbox.events.filter((e) => e.id === `ev-pen-fin-${D(12)}-applied`).length, 1);
  assert.equal(F.lifetimeIncome(S()), 0);
});
test('insufficient balance: penalty stays pending, balance never negative, tab not locked', async () => {
  const { store, S, clock } = await mkStore(at(2026, 10, 12));
  await store.commit('s', (s, c) => { F.setStartingBalance(s, c, 4000); F.saveSettings(s, c, { expected: 6000, workdays: [1], trackStart: D(12) }); });
  clock.t = at(2026, 10, 13, 8);
  await store.commit('t', (s, c) => F.tick(s, c));
  assert.equal(F.lockedBy(S()), null); assert.ok(F.insufficientPending(S()));
  await rejects(store.commit('a', (s, c) => F.applyPenalty(s, c, D(12))), 'stays pending');
  assert.equal(F.balance(S()), 4000);
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 10000, date: D(13) }));    // balance now enough
  assert.ok(F.lockedBy(S()));
});
test('accepted explanation clears the day with no deduction; limit enforced', async () => {
  const { store, S, clock } = await mkStore(at(2026, 10, 12));
  await store.commit('s', (s, c) => { F.setStartingBalance(s, c, 36000); F.saveSettings(s, c, { expected: 6000, workdays: [1], trackStart: D(12) }); });
  clock.t = at(2026, 10, 13, 8);
  await store.commit('t', (s, c) => F.tick(s, c));
  await rejects(store.commit('x', (s, c) => F.acceptExplanation(s, c, { date: D(12), reason: 'Sick or injured', text: 'short' })), '15+');
  await store.commit('x', (s, c) => F.acceptExplanation(s, c, { date: D(12), reason: 'Sick or injured', text: 'I had a fever all day long.' }));
  assert.equal(F.balance(S()), 36000); assert.equal(F.pendingPenalties(S()).length, 0);
  clock.t = at(2026, 10, 20, 8);
  await store.commit('t', (s, c) => F.tick(s, c));
  assert.equal(F.pendingPenalties(S()).length, 1);                                 // 13th? (only Mondays) -> 19th
});
test('income recorded for a missed day clears pending penalty; "explanation" alone is not income', async () => {
  const { store, S, clock } = await mkStore(at(2026, 10, 12));
  await store.commit('s', (s, c) => { F.saveSettings(s, c, { expected: 6000, workdays: [1], trackStart: D(12) }); });
  clock.t = at(2026, 10, 13, 8);
  await store.commit('t', (s, c) => F.tick(s, c));
  assert.equal(F.pendingPenalties(S()).length, 1);
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 6000, date: D(12) }));
  assert.equal(F.pendingPenalties(S()).length, 0);
});
test('void within 24h keeps history, rejects if it would make balance negative', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('i', (s, c) => F.addIncome(s, c, { amount: 10000 }));
  const id = S().fin.tx[0].id;
  await store.commit('e', (s, c) => F.addExpense(s, c, { amount: 9000 }));
  await rejects(store.commit('v', (s, c) => F.voidTx(s, c, id)), 'negative');
  assert.equal(F.balance(S()), 1000); assert.equal(S().fin.tx[0].voided, false);
  clock.t += 25 * 3600e3;
  await rejects(store.commit('v', (s, c) => F.voidTx(s, c, S().fin.tx[1].id)), '24 hours');
});
