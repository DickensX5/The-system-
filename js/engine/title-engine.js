// TITLE ENGINE. Titles are earned ONLY by rules. Loot items can never grant or equip a title.
//  - "ever unlocked" (history) is kept in titles.unlocked and never deleted.
//  - "currently eligible" is recomputed from live levels / balance (Financial can fall).
//  - Only one title is equipped; if it stops being eligible it reverts to the best eligible title of the same quest.
import { ALL_QUEST_TITLES, TITLE_BY_ID, BANDS } from '../data/titles.js';
import { questLevel, cappedXp, maxXp, QUEST_RULES } from './xp-engine.js';
import { balance } from '../quests/financial.js';
import { addEvent } from '../features/inbox.js';
import { RuleError, rule } from '../utils/validation.js';

export function titleMet(s, t) {
  if (t.kind === 'balance') return balance(s) >= t.balance;
  const lv = questLevel(s, t.quest);
  // The FINAL level title needs the quest fully cleared (e.g. Physique 2,800 XP), not merely reaching the last level.
  if (t.level >= QUEST_RULES[t.quest].max) return lv >= t.level && cappedXp(s, t.quest) >= maxXp(t.quest);
  return lv >= t.level;
}
/** Currently eligible = rule met AND not revoked by a Savage penalty. */
export function isEligible(s, id, overall) {
  const t = TITLE_BY_ID[id]; if (!t) return false;
  if (s.titles.revoked[id]) return false;
  if (t.kind === 'band') return overall >= t.from;   // lower ranks stay earned
  return titleMet(s, t);
}
export function eligibleTitles(s, overall) {
  const out = [];
  for (const b of BANDS) if (isEligible(s, b.id, overall)) out.push(TITLE_BY_ID[b.id]);
  for (const t of ALL_QUEST_TITLES) if (isEligible(s, t.id, overall)) out.push(t);
  return out;
}
export function currentRankTitle(overall) { return BANDS.find((b) => overall >= b.from && overall <= b.to) || BANDS[0]; }
export function equippedTitle(s, overall) { const id = s.titles.equipped; return id && isEligible(s, id, overall) ? TITLE_BY_ID[id] : null; }

/** Unlock newly-eligible titles and repair the equipped title. Runs inside finalize. */
export function syncTitles(s, ctx, overall) {
  for (const t of [...BANDS.map((b) => TITLE_BY_ID[b.id]), ...ALL_QUEST_TITLES]) {
    if (t.kind === 'band') continue;                     // rank bands are announced as ranks, not equip-unlocks
    if (!s.titles.unlocked[t.id] && isEligible(s, t.id, overall)) {
      s.titles.unlocked[t.id] = { at: ctx.now };
      addEvent(s, ctx, { id: `ev-title-${t.id}`, cat: 'progress', type: 'title-unlock', title: `Title unlocked: ${t.name}`, text: `You earned the ${t.name} title.`, quest: t.quest });
    }
  }
  const eq = s.titles.equipped;
  if (eq && !isEligible(s, eq, overall)) {
    const old = TITLE_BY_ID[eq];
    // best remaining eligible title from the same quest, else fall back to the rank title (null)
    const same = ALL_QUEST_TITLES.filter((t) => t.quest === old?.quest && isEligible(s, t.id, overall)).sort((a, b) => (b.level || 0) - (a.level || 0) || (b.balance || 0) - (a.balance || 0));
    s.titles.equipped = same[0]?.id ?? null;
    addEvent(s, ctx, { cat: 'progress', type: 'title-change', title: 'Equipped title changed', text: `${old?.name || 'Your title'} is no longer eligible. ${same[0] ? `Now equipped: ${same[0].name}.` : 'Your rank title is shown instead.'}`, quest: old?.quest });
  }
}

export function equipTitle(s, ctx, id, overall) {
  if (id === null) { s.titles.equipped = null; addEvent(s, ctx, { cat: 'progress', type: 'title-change', title: 'Title unequipped', text: 'Your rank title is shown.' }); return; }
  rule(TITLE_BY_ID[id], 'Unknown title.');
  rule(isEligible(s, id, overall), 'You have not earned that title (or it is currently not eligible).', 'title');
  if (s.titles.equipped === id) return;
  s.titles.equipped = id;
  addEvent(s, ctx, { cat: 'progress', type: 'title-equip', title: 'Title equipped', text: `Equipped: ${TITLE_BY_ID[id].name}.`, quest: TITLE_BY_ID[id].quest });
}
export { RuleError };
