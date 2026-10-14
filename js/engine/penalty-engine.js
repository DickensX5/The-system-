// PENALTY ENGINE (Intelligence + Romance). Financial penalties live in quests/financial.js.
// Rules: one penalty per cause id (no duplicates), persisted deadlines, lock only the affected quest tab,
// never deduct XP, Savage only removes things that EXIST and are eligible, and every loss is recoverable
// in the Market's Lost & Found. Everything is recorded in the Inbox with exact details.
import { ITEM_BY_ID } from '../data/rewards.js';
import { ALL_QUEST_TITLES, TITLE_BY_ID } from '../data/titles.js';
import { QUEST_NAMES } from './xp-engine.js';
import { addEvent } from '../features/inbox.js';
import { removeItem } from './reward-engine.js';
import { isEligible } from './title-engine.js';
import { nid } from '../utils/ids.js';
import { HOUR } from '../utils/dates.js';
import { rule } from '../utils/validation.js';
import { rarityIndex } from '../utils/formatting.js';

export const TIERS = ['minor', 'intermediate', 'severe'];
export const TIER_LABEL = { minor: 'Minor', intermediate: 'Intermediate', severe: 'Severe', savage: 'Savage' };
// challenge time limits (hours). Romance dungeon is shorter (4h minor), Intelligence gives more room.
export const TIER_HOURS = { intelligence: { minor: 24, intermediate: 48, severe: 72 }, romance: { minor: 4, intermediate: 6, severe: 8 } };
export function tierForXp(xp) { return xp <= 10 ? 'minor' : xp <= 20 ? 'intermediate' : 'severe'; }

export const activePenalty = (s, quest) => Object.values(s.penalties).find((p) => p.quest === quest && p.status === 'active') || null;
export const isLocked = (s, quest) => !!activePenalty(s, quest);

/** Returns the new penalty, or null if one already exists for this cause or the quest already has an active penalty. */
export function createPenalty(s, ctx, { quest, tier, causeId, causeName }) {
  const id = `pen-${causeId}`;
  if (s.penalties[id]) return null;                                  // never twice for the same cause
  const existing = activePenalty(s, quest);
  if (existing) {                                                    // avoid pile-ups: fold into the active one
    addEvent(s, ctx, { id: `ev-${id}-folded`, cat: 'penalty', type: 'penalty-folded', title: 'Penalty already active', text: `"${causeName}" expired while a ${QUEST_NAMES[quest]} penalty is active. No extra penalty was added.`, quest });
    s.penalties[id] = { id, quest, tier, status: 'folded', createdAt: ctx.now, cause: causeName };
    return null;
  }
  const hours = TIER_HOURS[quest][tier];
  const pen = { id, quest, tier, status: 'active', createdAt: ctx.now, deadline: ctx.now + hours * HOUR, cause: causeName, attempts: 0, lastAttemptAt: 0 };
  s.penalties[id] = pen;
  addEvent(s, ctx, { id: `ev-${id}-start`, cat: 'penalty', type: 'penalty-start', title: `${TIER_LABEL[tier]} penalty: ${QUEST_NAMES[quest]}`, text: `"${causeName}" expired. Finish the ${TIER_LABEL[tier].toLowerCase()} challenge within ${hours}h. Only the ${QUEST_NAMES[quest]} tab is locked.`, quest, meta: { tier, deadline: pen.deadline } });
  return pen;
}
export function resolvePenalty(s, ctx, id, note) {
  const p = s.penalties[id]; rule(p && p.status === 'active', 'That penalty is not active.');
  p.status = 'completed'; p.completedAt = ctx.now;
  addEvent(s, ctx, { id: `ev-${id}-done`, cat: 'penalty', type: 'penalty-resolved', title: `Penalty cleared: ${QUEST_NAMES[p.quest]}`, text: note || `${TIER_LABEL[p.tier]} challenge completed in time. No loss.`, quest: p.quest });
}

/** Deadline passed -> Savage consequences, exactly once. */
export function tickPenalties(s, ctx) {
  let changed = false;
  for (const p of Object.values(s.penalties)) {
    if (p.status === 'active' && ctx.now >= p.deadline) { applySavage(s, ctx, p); changed = true; }
  }
  return changed;
}

const NOT_LOSABLE = new Set(['lootbox', 'key', 'currency', 'certificate']);
export function eligibleLossItem(s, quest) {
  const c = Object.keys(s.inv.items).map((id) => ITEM_BY_ID[id]).filter((i) => i && i.quest === quest && i.binding === 'sellable' && !NOT_LOSABLE.has(i.kind) && s.inv.emblem !== i.id && s.inv.items[i.id].count > 0);
  c.sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity) || s.inv.items[a.id].at - s.inv.items[b.id].at);
  return c[0] || null;
}
export function eligibleLossTitle(s, quest) {
  const earned = ALL_QUEST_TITLES.filter((t) => t.quest === quest && t.kind === 'level' && isEligible(s, t.id, 0));
  if (earned.length < 2) return null;                                // never strip someone's only title in a quest
  earned.sort((a, b) => a.level - b.level);
  return earned[0];
}
const TITLE_RESTORE = { common: 50, uncommon: 100, rare: 200, epic: 400, legendary: 800, mythic: 1600 };
export const restoreCost = (rec) => (rec.kind === 'item' ? ITEM_BY_ID[rec.refId].value * 2 : TITLE_RESTORE[TITLE_BY_ID[rec.refId].rarity]);

export function applySavage(s, ctx, p) {
  p.status = 'savage'; p.savageAt = ctx.now;
  const lost = [];
  const takeItem = () => { const it = eligibleLossItem(s, p.quest); if (!it) return; removeItem(s, it.id, 1); lost.push({ kind: 'item', refId: it.id, name: it.name }); };
  const takeTitle = () => {
    const t = eligibleLossTitle(s, p.quest); if (!t) return;
    s.titles.revoked[t.id] = { at: ctx.now, penaltyId: p.id };
    lost.push({ kind: 'title', refId: t.id, name: t.name });
  };
  if (p.quest === 'romance') { takeTitle(); takeItem(); }            // "an eligible title AND one eligible loot item"
  else { takeItem(); if (!lost.length) takeTitle(); }                // "a title OR a reward"
  for (const l of lost) s.inv.lost.push({ id: nid(s, 'lo'), ...l, quest: p.quest, at: ctx.now, penaltyId: p.id });
  p.lost = lost;
  addEvent(s, ctx, {
    id: `ev-${p.id}-savage`, cat: 'penalty', type: 'penalty-savage', title: `Savage penalty: ${QUEST_NAMES[p.quest]}`,
    text: lost.length ? `Deadline missed. Removed: ${lost.map((l) => `${l.name} (${l.kind})`).join(', ')}. Recoverable in Market > Lost & Found. No XP was deducted.`
      : 'Deadline missed, but there was nothing eligible to remove. No XP was deducted.', quest: p.quest, meta: { lost },
  });
  if (lost.length) addEvent(s, ctx, { id: `ev-${p.id}-loss`, cat: 'penalty', type: 'loss', title: 'Loss recorded', text: lost.map((l) => `${l.name} (${l.kind}) removed because "${p.cause}" was not resolved in time.`).join(' '), quest: p.quest });
}
