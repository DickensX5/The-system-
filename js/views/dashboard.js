import { h, ico, bar, chip, live } from '../ui/dom.js';
import { QMETA, curIcon } from './shared.js';
import { QUESTS, questProgress, summonCharges, summonRemaining, nextSummonMilestone, SUMMON, summonUsedInWindow } from '../engine/xp-engine.js';
import { overallProgress, bandFor } from '../engine/progression-engine.js';
import { equippedTitle } from '../engine/title-engine.js';
import { unclaimedGrants } from '../engine/reward-engine.js';
import { unreadCount } from '../features/inbox.js';
import { ITEM_BY_ID } from '../data/rewards.js';
import { activePenalty } from '../engine/penalty-engine.js';
import * as F from '../quests/financial.js';
import { dayView } from '../quests/physique.js';
import { dailyState, isPaused } from '../quests/intelligence.js';
import { activeQuests } from '../quests/romance.js';
import { dateKey } from '../utils/dates.js';
import { fmtTSh } from '../utils/formatting.js';

export default function dashboard(A) {
  const S = A.S(), now = A.now(), today = dateKey(now);
  const ov = overallProgress(S), band = bandFor(ov.level), eq = equippedTitle(S, ov.level);
  const emblem = S.inv.emblem ? ITEM_BY_ID[S.inv.emblem] : null;
  const claims = unclaimedGrants(S).length;

  const status = {
    financial: () => { const lk = F.lockedBy(S); if (lk) return { t: 'Penalty: tab locked', bad: true }; if (F.insufficientPending(S)) return { t: 'Penalty pending', warn: true }; const st = F.dayStatus(S, today, today); return { t: st === 'earned' ? 'Income recorded today' : st === 'rest' ? 'Rest day' : st === 'untracked' ? 'Set up tracking' : 'Earning day: no income yet', ok: st === 'earned' }; },
    physique: () => { const v = dayView(S, today); const n = v.filter((e) => e.complete).length; return { t: `Today: ${n}/4 exercises`, ok: n === 4 }; },
    intelligence: () => { if (activePenalty(S, 'intelligence')) return { t: 'Penalty: tab locked', bad: true }; if (isPaused(S, now)) return { t: 'Paused', warn: true }; const d = dailyState(S, today); return { t: d.done ? 'Daily quest done' : 'Daily quest waiting', ok: d.done }; },
    romance: () => { if (activePenalty(S, 'romance')) return { t: 'Penalty dungeon active', bad: true }; const n = activeQuests(S).length; return { t: n ? `${n} active quest${n > 1 ? 's' : ''}` : 'No active quests' }; },
  };
  const qcards = QUESTS.map((q) => {
    const p = questProgress(S, q), st = status[q](), m = QMETA[q];
    return h('a', { class: `card cut questcard accent-${q}`, 'data-q': q, href: `#/q/${q}` },
      h('div', { class: 'head' }, ico(m.icon), h('b', null, m.name), h('span', { class: 'grow' }), h('span', { class: 'lv' }, p.maxed ? 'MAX' : p.level)),
      bar(q, p.pct),
      h('div', { class: 'row spread hint' }, h('span', null, q === 'financial' ? `${p.xp} XP · ${fmtTSh(F.balance(S))}` : `${p.xp.toLocaleString()} XP`), h('span', null, p.maxed ? 'Cleared' : `${p.into}/${p.need}`)),
      h('div', { class: `hint ${st.bad ? 'bad' : st.ok ? 'ok' : st.warn ? 'warn' : ''}` }, st.bad ? ico('lock') : null, ' ', st.t));
  });

  const charges = summonCharges(S, ov.level), remain = summonRemaining(S, now);
  return h('div', { class: 'stack rise' },
    h('div', { class: 'card cut glow' },
      h('div', { class: 'hero' },
        h('div', { class: 'emblem' }, ico(emblem ? 'badge' : 'shield'), h('span', { class: 'lvl' }, 'LV ' + ov.level)),
        h('div', { class: 'grow' },
          h('div', { class: 'rank' }, band.name),
          h('div', { class: 'name' }, eq ? eq.name : band.name),
          h('div', { class: 'hint' }, eq ? 'Equipped title' : 'Rank title', emblem ? ` · ${emblem.name}` : ''))),
      h('div', { style: { marginTop: '12px' } }, bar('', ov.pct, true)),
      h('div', { class: 'row spread hint', style: { marginTop: '6px' } }, h('span', null, ov.maxed ? 'Level 100: Soul Monarch' : `Overall level ${ov.level} → ${ov.level + 1}`), h('span', null, `${Math.floor(ov.pct)}%`))),
    claims ? h('a', { class: 'claimbar', href: '#/rewards' }, ico('gift'), h('div', { class: 'grow' }, h('b', null, `${claims} reward${claims > 1 ? 's' : ''} to claim`), h('div', { class: 'hint' }, 'Level-up rewards are waiting')), ico('next')) : null,
    h('div', { class: 'grid3' },
      h('div', { class: 'stat' }, h('b', null, S.currency.gold.toLocaleString()), h('span', null, 'Gold')),
      h('div', { class: 'stat' }, h('b', null, S.currency.hearts.toLocaleString()), h('span', null, 'Heart Coins')),
      h('a', { class: 'stat', href: '#/inbox', style: { textDecoration: 'none', color: 'inherit' } }, h('b', null, unreadCount(S)), h('span', null, 'Unread'))),
    h('h2', null, 'Quests'),
    h('div', { class: 'grid2' }, qcards),
    h('a', { class: 'card cut questcard', href: '#/summon' },
      h('div', { class: 'head' }, ico('swap'), h('b', null, 'XP Summoning'), h('span', { class: 'grow' }), charges ? chip(`${charges} unlock${charges > 1 ? 's' : ''}`, 'r-epic') : chip('Locked')),
      h('div', { class: 'hint' }, ov.level < SUMMON.FIRST ? `Unlocks at overall level ${SUMMON.FIRST} (you are level ${ov.level}).` : `${remain} of ${SUMMON.CAP} XP left in the rolling 24h window. Next unlock at level ${nextSummonMilestone(ov.level)}.`)),
    h('div', { class: 'grid2' },
      h('a', { class: 'btn', href: '#/arcade' }, ico('game'), 'Arcade'),
      h('a', { class: 'btn', href: '#/market' }, ico('store'), 'Market')));
}
