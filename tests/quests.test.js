import test from 'node:test';
import assert from 'node:assert/strict';
import { mkStore, rejects, at } from './helpers.js';
import * as P from '../js/quests/physique.js';
import * as I from '../js/quests/intelligence.js';
import * as R from '../js/quests/romance.js';
import * as M from '../js/engine/transaction-engine.js';
import { addItem, owned } from '../js/engine/reward-engine.js';
import { dailyQuestions, penaltyChallenge } from '../js/data/intelligence-bank.js';
import { activePenalty, restoreCost } from '../js/engine/penalty-engine.js';
import { dateKey, HOUR, DAY, MIN } from '../js/utils/dates.js';
import { checkQuestText } from '../js/data/romance-data.js';
import { NO_CHANGE } from '../js/state/store.js';

test('physique: each exercise awards 2 XP once; full workout = 8 XP; extra logging cannot re-award', async () => {
  const { store, S } = await mkStore();
  await store.commit('l', (s, c) => P.logReps(s, c, { ex: 'pushups', reps: 10 }));
  assert.equal(S().xp.physique, 0);
  await store.commit('l', (s, c) => P.logReps(s, c, { ex: 'pushups', reps: 10 }));
  assert.equal(S().xp.physique, 2);
  await rejects(store.commit('l', (s, c) => P.logReps(s, c, { ex: 'pushups', reps: 10 })), 'already complete');
  await store.commit('l', (s, c) => P.logReps(s, c, { ex: 'crunches', reps: 500 }));        // overshoot counts only to target
  assert.equal(S().xp.physique, 4);
  await rejects(store.commit('l', (s, c) => P.logReps(s, c, { ex: 'pushups', reps: 0 })), 'whole number');
  await rejects(store.commit('l', (s, c) => P.logReps(s, c, { ex: 'climbers', reps: 5 })), 'timed');
});
test('physique: timers use timestamps; forgotten timer earns nothing; full workout gives 8 XP + gold once', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('l', (s, c) => { P.logReps(s, c, { ex: 'pushups', reps: 20 }); P.logReps(s, c, { ex: 'crunches', reps: 20 }); });
  await store.commit('t', (s, c) => P.startTimer(s, c, { ex: 'climbers' }));
  clock.t += 15 * 1000;
  await store.commit('t', (s, c) => P.stopTimer(s, c, { ex: 'climbers' }));
  await store.commit('t', (s, c) => P.startTimer(s, c, { ex: 'jacks' }));
  clock.t += 3 * HOUR;                                                                      // app left open for 3 hours
  const dr = await store.commit('t', (s, c) => P.stopTimer(s, c, { ex: 'jacks' }));
  assert.equal(dr.discarded, true);
  assert.equal(S().xp.physique, 6);
  await store.commit('t', (s, c) => P.startTimer(s, c, { ex: 'jacks' }));
  clock.t += 60 * 1000;
  await store.commit('t', (s, c) => P.stopTimer(s, c, { ex: 'jacks' }));
  assert.equal(S().xp.physique, 8); assert.equal(S().currency.gold >= 12, true);
  const g = S().currency.gold;
  await rejects(store.commit('t', (s, c) => P.startTimer(s, c, { ex: 'jacks' })), 'already complete');
  assert.equal(S().currency.gold, g);
  assert.equal(S().inbox.events.filter((e) => e.id.endsWith('-full')).length, 1);
});
test('physique: level target is locked for the day (no moving goalposts mid-day)', async () => {
  const { store, S } = await mkStore();
  await store.commit('x', (s) => { s.xp.physique = 56 * 2 - 2; });                          // level 2, 2 XP short of 3
  await store.commit('l', (s, c) => P.logReps(s, c, { ex: 'pushups', reps: 20 }));          // completes at the day's target (20)
  assert.equal(S().phy.days[dateKey(S().updatedAt)].level, 2);
  await store.commit('l', (s, c) => P.logReps(s, c, { ex: 'crunches', reps: 20 }));
  assert.equal(S().xp.physique, 56 * 2 - 2 + 4);
});
test('intelligence daily: needs ALL verified answers; wrong answer locks; XP once; deterministic', async () => {
  const { store, S, clock } = await mkStore();
  const qs = dailyQuestions(dateKey(clock.t));
  const ans = (q) => (q.type === 'choice' ? q.options.length - 1 === q.answer ? 0 : q.answer : q.answer);
  const wrong = (q) => (q.type === 'choice' ? (q.answer + 1) % q.options.length : q.answer + 1);
  const r = await store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[0].id, answer: wrong(qs[0]) }));
  assert.equal(r.correct, false);
  await rejects(store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[0].id, answer: qs[0].answer })), 'Wait');
  clock.t += 31000;
  await store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[0].id, answer: qs[0].answer }));
  assert.equal(S().xp.intelligence, 0);                                                     // not done yet
  await store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[1].id, answer: qs[1].answer }));
  const last = await store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[2].id, answer: qs[2].answer }));
  assert.equal(last.xp, 20); assert.equal(S().xp.intelligence, 20);
  await rejects(store.commit('a', (s, c) => I.answerDaily(s, c, { qid: qs[2].id, answer: qs[2].answer })), 'already complete');
  assert.equal(S().xp.intelligence, 20);
  assert.deepEqual(dailyQuestions(dateKey(clock.t)).map((q) => q.prompt), qs.map((q) => q.prompt));
});
test('intelligence custom: one at a time, 5-30 XP in steps, focus + takeaway required, daily cap 40', async () => {
  const { store, S, clock } = await mkStore();
  const mk = (o = {}) => ({ title: 'Learn sorting', category: 'Technical intelligence', objective: 'Study bubble sort and merge sort', xp: 30, days: 3, ...o });
  await rejects(store.commit('c', (s, c) => I.createCustom(s, c, mk({ xp: 35 }))), 'max 30');
  await rejects(store.commit('c', (s, c) => I.createCustom(s, c, mk({ xp: 7 }))), 'steps of 5');
  await rejects(store.commit('c', (s, c) => I.createCustom(s, c, mk({ objective: 'x' }))), '15+');
  await store.commit('c', (s, c) => I.createCustom(s, c, mk()));
  await rejects(store.commit('c', (s, c) => I.createCustom(s, c, mk({ title: 'Another' }))), 'one at a time');
  await rejects(store.commit('d', (s, c) => I.completeCustom(s, c, { takeaway: 'I learned a lot about sorting algorithms today' })), 'Focus time');
  await store.commit('f', (s, c) => I.focusStart(s, c));
  clock.t += 90 * MIN;
  await rejects(store.commit('d', (s, c) => I.completeCustom(s, c, { takeaway: 'too short' })), '8 words');
  const got = await store.commit('d', (s, c) => I.completeCustom(s, c, { takeaway: 'I learned the trade-offs between bubble sort and merge sort clearly' }));
  assert.equal(got, 30); assert.equal(S().int.custom.active, null);
  await rejects(store.commit('d', (s, c) => I.completeCustom(s, c, { takeaway: 'I learned the trade-offs between bubble sort and merge sort clearly' })), 'No active');
  // daily cap: 30 already today -> a 20-XP quest only yields 10
  await store.commit('c', (s, c) => I.createCustom(s, c, mk({ title: 'Second quest', xp: 20 })));
  await store.commit('f', (s, c) => I.focusStart(s, c)); clock.t += 60 * MIN;
  const g2 = await store.commit('d', (s, c) => I.completeCustom(s, c, { takeaway: 'Second round: practised recursion patterns with several examples' }));
  assert.equal(g2, 10); assert.equal(S().xp.intelligence, 40);
});
test('intelligence expiry -> penalty by tier, locks only Intelligence, once; completion in time clears; deadline -> Savage; recoverable', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('a', (s, c) => { addItem(s, c, 'int_logic-scroll', 1); addItem(s, c, 'int_memory-crystal', 1); addItem(s, c, 'phy_iron-will-emblem', 1); });
  await store.commit('c', (s, c) => I.createCustom(s, c, { title: 'Hard quest', category: 'Logic and reasoning', objective: 'Solve twenty logic puzzles carefully', xp: 25, days: 1 }));
  clock.t += DAY + 1;
  await store.commit('t', (s, c) => I.tick(s, c));
  const pen = activePenalty(S(), 'intelligence');
  assert.equal(pen.tier, 'severe'); assert.equal(pen.deadline - pen.createdAt, 72 * HOUR);
  assert.equal(activePenalty(S(), 'romance'), null);                       // only the affected quest
  const n = Object.keys(S().penalties).length;
  await store.commit('t', (s, c) => I.tick(s, c) || NO_CHANGE);
  assert.equal(Object.keys(S().penalties).length, n);                       // no duplicate penalty
  assert.equal(S().xp.intelligence, 0);                                     // never deducts XP
  clock.t = pen.deadline + 1;                                               // deadline missed -> Savage once
  await store.commit('t', (s, c) => I.tick(s, c));
  const p2 = S().penalties[pen.id];
  assert.equal(p2.status, 'savage'); assert.equal(p2.lost.length, 1);
  assert.equal(p2.lost[0].refId, 'int_logic-scroll');                       // lowest-rarity intelligence item, nothing else touched
  assert.equal(owned(S(), 'phy_iron-will-emblem'), 1); assert.equal(owned(S(), 'int_memory-crystal'), 1);
  assert.equal(S().xp.intelligence, 0);
  await store.commit('t', (s, c) => I.tick(s, c) || NO_CHANGE);
  assert.equal(S().inv.lost.length, 1);                                    // not repeated
  // recover from Lost & Found
  const cost = restoreCost(S().inv.lost[0]);
  await store.commit('g', (s) => { s.currency.gold = cost; });
  await store.commit('r', (s, c) => M.restoreLost(s, c, { lostId: S().inv.lost[0].id, txId: 'tx-restore-1' }));
  assert.equal(owned(S(), 'int_logic-scroll'), 1); assert.equal(S().inv.lost.length, 0); assert.equal(S().currency.gold, 0);
});
test('intelligence penalty challenge completes in time with verified answers', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('c', (s, c) => I.createCustom(s, c, { title: 'Easy quest', category: 'Logic and reasoning', objective: 'Do a few easy logic puzzles', xp: 5, days: 1 }));
  clock.t += DAY + 1; await store.commit('t', (s, c) => I.tick(s, c));
  const pen = activePenalty(S(), 'intelligence'); assert.equal(pen.tier, 'minor');
  const ch = I.challengeFor(pen); const q = ch.questions[0];
  const bad = await store.commit('s', (s, c) => I.submitPenalty(s, c, { id: pen.id, answers: { [q.id]: q.type === 'choice' ? (q.answer + 1) % q.options.length : q.answer + 1 } }));
  assert.equal(bad.ok, false); assert.ok(activePenalty(S(), 'intelligence'));
  const ok = await store.commit('s', (s, c) => I.submitPenalty(s, c, { id: pen.id, answers: { [q.id]: q.answer } }));
  assert.equal(ok.ok, true); assert.equal(activePenalty(S(), 'intelligence'), null);
  clock.t = pen.deadline + 10; await store.commit('t', (s, c) => I.tick(s, c) || NO_CHANGE);
  assert.equal(S().penalties[pen.id].status, 'completed');                  // never escalates after completion
});
test('intelligence pause: 1-7 days, cooldown, deadlines move later', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('c', (s, c) => I.createCustom(s, c, { title: 'Study quest', category: 'Technical intelligence', objective: 'Read a chapter on networking', xp: 10, days: 2 }));
  const d0 = S().int.custom.active.deadlineAt;
  await rejects(store.commit('p', (s, c) => I.startPause(s, c, { days: 8 })), '1-7');
  await store.commit('p', (s, c) => I.startPause(s, c, { days: 3 }));
  assert.equal(S().int.custom.active.deadlineAt, d0 + 3 * DAY);
  clock.t += 3 * DAY + 1; await store.commit('t', (s, c) => I.tick(s, c));
  await rejects(store.commit('p', (s, c) => I.startPause(s, c, { days: 1 })), 'limited');
});
test('romance: safe text enforced, max 3 active, 10-min wait, reflection, heart completes once, caps', async () => {
  const { store, S, clock } = await mkStore();
  assert.ok(checkQuestText('follow her home and keep texting until she answers'));
  assert.ok(checkQuestText('buy flowers for her'));
  assert.equal(checkQuestText('Ask a friend how they are and listen to the answer'), null);
  const mk = (n, o = {}) => ({ name: 'Quest ' + n, objective: 'Listen well in a friendly chat with a friend', xp: 10, days: 3, ...o });
  await rejects(store.commit('c', (s, c) => R.createQuest(s, c, mk(1, { objective: 'Keep messaging her until she says yes please' }))), 'pressure');
  for (let i = 1; i <= 3; i++) await store.commit('c', (s, c) => R.createQuest(s, c, mk(i)));
  await rejects(store.commit('c', (s, c) => R.createQuest(s, c, mk(4))), 'at most 3');
  const id = S().rom.quests[0].id;
  await rejects(store.commit('h', (s, c) => R.completeQuest(s, c, { id, respectful: true, reflection: 'I listened and it went well today' })), 'Real actions');
  clock.t += 11 * MIN;
  await rejects(store.commit('h', (s, c) => R.completeQuest(s, c, { id, respectful: false, reflection: 'I listened and it went well today' })), 'Confirm');
  await rejects(store.commit('h', (s, c) => R.completeQuest(s, c, { id, respectful: true, reflection: 'ok' })), '6+ words');
  await store.commit('h', (s, c) => R.completeQuest(s, c, { id, respectful: true, reflection: 'I listened and it went well today' }));
  assert.equal(S().xp.romance, 10); assert.equal(S().currency.hearts >= 10, true);
  await rejects(store.commit('h', (s, c) => R.completeQuest(s, c, { id, respectful: true, reflection: 'I listened and it went well today' })), 'Already completed');
  assert.equal(S().xp.romance, 10);
});
test('romance expiry -> dungeon timer persists; deadline missed -> Savage removes title AND item, recoverable', async () => {
  const { store, S, clock } = await mkStore();
  await store.commit('x', (s, c) => { s.xp.romance = 500; addItem(s, c, 'rom_rose-token', 1); });   // level 6: titles L1 + L5
  await store.commit('c', (s, c) => R.createQuest(s, c, { name: 'Big quest', objective: 'Host a friendly group hangout with new people', xp: 20, days: 1 }));
  clock.t += DAY + 5;
  await store.commit('t', (s, c) => R.tick(s, c));
  const pen = activePenalty(S(), 'romance'); assert.equal(pen.tier, 'intermediate'); assert.equal(pen.deadline - pen.createdAt, 6 * HOUR);
  assert.equal(S().xp.romance, 500);
  clock.t = pen.deadline + 1; await store.commit('t', (s, c) => R.tick(s, c));
  const p = S().penalties[pen.id]; assert.equal(p.status, 'savage');
  assert.deepEqual(p.lost.map((l) => l.kind).sort(), ['item', 'title']);
  assert.equal(S().xp.romance, 500);
  assert.equal(S().inv.lost.length, 2);
});
test('market: buy/sell atomic, no negative currency, bound/consumable not sellable, double submit ignored, locked items', async () => {
  const { store, S } = await mkStore();
  await rejects(store.commit('b', (s, c) => M.buy(s, c, { itemId: 'phy_iron-crate', txId: 'tx-000001' })), 'Not enough');
  await store.commit('g', (s) => { s.currency.gold = 100; });
  await store.commit('b', (s, c) => M.buy(s, c, { itemId: 'phy_iron-crate', txId: 'tx-000002' }));
  assert.equal(S().currency.gold, 70); assert.equal(owned(S(), 'phy_iron-crate'), 1);
  await rejects(store.commit('b', (s, c) => M.buy(s, c, { itemId: 'phy_iron-crate', txId: 'tx-000002' })), 'already completed');
  assert.equal(S().currency.gold, 70);
  await rejects(store.commit('b', (s, c) => M.buy(s, c, { itemId: 'phy_apex-warrior-emblem', txId: 'tx-000003' })), 'Locked');
  await rejects(store.commit('s', (s, c) => M.sell(s, c, { itemId: 'phy_iron-crate', txId: 'tx-000004' })), 'Consumables');
  await store.commit('a', (s, c) => addItem(s, c, 'phy_training-journal', 1));
  await store.commit('s', (s, c) => M.sell(s, c, { itemId: 'phy_training-journal', txId: 'tx-000005' }));
  assert.equal(S().currency.gold, 80); assert.equal(owned(S(), 'phy_training-journal'), 0);
  await rejects(store.commit('s', (s, c) => M.sell(s, c, { itemId: 'phy_training-journal', txId: 'tx-000006' })), 'do not own');
  assert.equal(S().market.txs.length, 2);
});
test('market: rare exchange needs Royal Invitation; trade-up needs 3 same quest+rarity', async () => {
  const { store, S } = await mkStore();
  await store.commit('x', (s, c) => { s.xp.romance = 100 * 20; addItem(s, c, 'rom_charm-fragment', 5); });
  await rejects(store.commit('e', (s, c) => M.exchange(s, c, { offerId: 'x-key', txId: 'tx-ex0001' })), 'Royal Invitation');
  await store.commit('x', (s, c) => addItem(s, c, 'rom_royal-invitation', 1));
  await store.commit('e', (s, c) => M.exchange(s, c, { offerId: 'x-key', txId: 'tx-ex0002' }));
  assert.equal(owned(S(), 'rom_lootbox-key'), 1); assert.equal(owned(S(), 'rom_charm-fragment'), 0);
  await store.commit('x', (s, c) => { addItem(s, c, 'phy_training-journal', 1); addItem(s, c, 'phy_sweatbound-wristband', 1); });
  await rejects(store.commit('t', (s, c) => M.tradeUp(s, c, { itemIds: ['phy_training-journal', 'phy_sweatbound-wristband', 'rom_rose-token'], txId: 'tx-tr0001' })), 'share a quest');
});
test('storage failure: commit rejects honestly and state is unchanged; double-tap race serialised', async () => {
  const { store, S, adapter } = await mkStore();
  await store.commit('g', (s) => { s.currency.gold = 5; });
  adapter.failNext = true;
  await rejects(store.commit('g', (s) => { s.currency.gold = 999; }), 'Simulated');
  assert.equal(S().currency.gold, 5);
  await store.commit('a', (s, c) => addItem(s, c, 'phy_iron-crate', 1));
  const open = () => store.commit('o', async (s, c) => (await import('../js/engine/reward-engine.js')).openLootbox(s, c, { boxId: 'phy_iron-crate', openId: 'open-race01' }));
  // synchronous fn variant for race: two commits queued back to back
  const { openLootbox } = await import('../js/engine/reward-engine.js');
  const a = store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'phy_iron-crate', openId: 'open-race02' }));
  const b = store.commit('o', (s, c) => openLootbox(s, c, { boxId: 'phy_iron-crate', openId: 'open-race02' }));
  const out = await Promise.allSettled([a, b]);
  assert.deepEqual(out.map((o) => o.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(owned(S(), 'phy_iron-crate'), 0);
});
test('persistence round trip, migration defaults, corrupt data is backed up not wiped', async () => {
  const { store, S, adapter } = await mkStore();
  await store.commit('g', (s) => { s.currency.gold = 42; s.xp.physique = 56; });
  const { Store } = await import('../js/state/store.js');
  const { finalize } = await import('../js/engine/progression-engine.js');
  const s2 = new Store({ adapter, finalize }); await s2.init();
  assert.equal(s2.state.currency.gold, 42); assert.equal(s2.state.xp.physique, 56);
  await adapter.putRaw('state', '{not json');
  const s3 = new Store({ adapter, finalize }); await s3.init();
  assert.ok(s3.loadNote); assert.equal(s3.state.currency.gold, 0);
  assert.ok([...adapter.kv.keys()].some((k) => k.startsWith('corrupt-')));
  await adapter.putRaw('state', JSON.stringify({ schema: 999 }));
  const s4 = new Store({ adapter, finalize }); await s4.init(); assert.ok(s4.loadNote.includes('newer'));
});
