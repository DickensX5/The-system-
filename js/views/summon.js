import { h, ico, chip, field, confirmSheet, guarded, toast, live } from '../ui/dom.js';
import { QUEST_NAMES, getXp, levelFromXp, maxXp, SUMMON, summonXp, summonCharges, summonRemaining, summonRegainAt, nextSummonMilestone, summonMilestonesReached } from '../engine/xp-engine.js';
import { formatCountdown } from '../utils/dates.js';

let from = 'physique', amount = '';
export default function summon(A) {
  const S = A.S(), now = A.now(), ov = A.ov();
  const charges = summonCharges(S, ov), remain = summonRemaining(S, now), regain = summonRegainAt(S, now);
  const have = getXp(S, from), room = maxXp('romance') - S.xp.romance;
  const maxAmt = Math.max(0, Math.min(have, remain, room));
  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && n <= maxAmt && charges > 0;
  const input = h('input', { type: 'number', inputMode: 'numeric', min: 1, max: maxAmt, value: amount, placeholder: `1 – ${maxAmt}`, 'aria-label': 'XP to send', oninput: (e) => { amount = e.target.value; A.render(); setTimeout(() => document.querySelector('#sm-amt')?.focus(), 0); } });
  input.id = 'sm-amt';
  const preview = valid ? h('div', { class: 'summon-vis' },
    h('div', { class: 'node' }, h('b', null, `${have} → ${have - n}`), h('span', { class: 'hint' }, `${QUEST_NAMES[from]} XP · LV ${levelFromXp(from, have)} → ${levelFromXp(from, have - n)}`)), ico('next'),
    h('div', { class: 'node' }, h('b', null, `${S.xp.romance} → ${S.xp.romance + n}`), h('span', { class: 'hint' }, `Romance XP · LV ${levelFromXp('romance', S.xp.romance)} → ${levelFromXp('romance', S.xp.romance + n)}`))) : null;
  const send = guarded(async () => {
    const dropsLevel = levelFromXp(from, have - n) < levelFromXp(from, have);
    const ok = await confirmSheet({ title: 'Summon XP?', body: [`Send ${n} XP from ${QUEST_NAMES[from]} to Romance. ${QUEST_NAMES[from]} loses exactly ${n} XP and Romance gains exactly ${n} XP.`, dropsLevel ? `${QUEST_NAMES[from]} will fall to level ${levelFromXp(from, have - n)}. This cannot be undone.` : 'This cannot be undone.', 'It uses one summoning unlock.'], confirmText: `Send ${n} XP` });
    if (!ok) return;
    const requestId = 'rq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const r = await A.act('summon', (s, c) => summonXp(s, c, { from, to: 'romance', amount: n, requestId }, A.ov()));
    if (r.ok) { amount = ''; toast(`Summoned ${n} XP to Romance.`, 'good'); }
  });
  return h('div', { class: 'stack rise' },
    h('div', { class: 'card cut accent-romance stack' },
      h('div', { class: 'grid3' },
        h('div', { class: 'stat' }, h('b', null, charges), h('span', null, 'Unlocks')),
        h('div', { class: 'stat' }, h('b', null, remain), h('span', null, 'XP allowed now')),
        h('div', { class: 'stat' }, h('b', null, ov < SUMMON.FIRST ? SUMMON.FIRST : nextSummonMilestone(ov)), h('span', null, 'Next unlock LV'))),
      regain ? h('div', { class: 'hint' }, ico('clock'), ' Allowance starts returning in ', live(() => formatCountdown(regain - A.now()), 'countdown')) : h('div', { class: 'hint' }, 'The full 250 XP allowance is available.'),
      ov < SUMMON.FIRST ? h('div', { class: 'banner warn', style: { margin: 0 } }, ico('lock'), `XP Summoning unlocks at overall level ${SUMMON.FIRST}. You are level ${ov}.`) : null),
    h('div', { class: 'card stack' },
      h('h3', null, 'Send XP to Romance'),
      field('From', h('select', { onchange: (e) => { from = e.target.value; amount = ''; A.render(); } }, SUMMON.SENDERS.map((q) => h('option', { value: q, selected: q === from }, `${QUEST_NAMES[q]} (${getXp(S, q)} XP available)`)))),
      field('Amount', input, `You can send up to ${maxAmt} XP right now.`),
      h('div', { class: 'row wrap' }, [10, 25, 50, 100].filter((x) => x <= maxAmt).map((x) => h('button', { class: 'btn small', onclick: () => { amount = String(x); A.render(); } }, x)), maxAmt > 0 ? h('button', { class: 'btn small', onclick: () => { amount = String(maxAmt); A.render(); } }, `Max ${maxAmt}`) : null),
      preview,
      h('button', { class: 'btn primary block', disabled: !valid, onclick: send }, ico('swap'), valid ? `Send ${n} XP` : 'Send XP')),
    h('div', { class: 'card' }, h('h3', null, 'The rules'), h('ul', { class: 'muted', style: { paddingLeft: '18px', margin: '8px 0 0' } },
      h('li', null, `Unlocks at overall level ${SUMMON.FIRST}, and again at every ${SUMMON.STEP} levels after (5, 10, 15 …). Each transfer spends one unlock.`),
      h('li', null, `At most ${SUMMON.CAP} XP per rolling 24 hours (the last 24 hours, not a calendar day).`),
      h('li', null, 'Only Romance can receive. Financial, Physique and Intelligence can send.'),
      h('li', null, 'The sender loses exactly what Romance gains. XP never goes below zero.'),
      h('li', null, 'Every transfer is recorded in the Inbox.'))),
    S.summon.log.length ? h('div', { class: 'card' }, h('h3', null, 'Recent transfers'), ...S.summon.log.slice(-5).reverse().map((t) => h('div', { class: 'kv' }, h('span', null, `${QUEST_NAMES[t.from]} → Romance`), h('span', { class: 'mono' }, `${t.amount} XP`)))) : null);
}
