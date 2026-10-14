// Reward / collectible catalog. Every item: stable id, name, description, category(kind), rarity, source quest,
// binding (sellable | bound | consumable), unlock level in its quest, duplicate rule.
//
// dup: 'stack'   -> duplicates add to a count (consumables, keys, boxes)
//      'convert' -> a unique collectible; a duplicate is converted into currency (half sell value)
// IMPORTANT: no item grants a title or an unlimited amount of XP. XP items only grant tiny, daily-capped XP
// to ROMANCE (see reward-engine ITEM_XP_DAILY_CAP).
import { slug } from '../utils/formatting.js';

export const SELL_VALUE = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 400, mythic: 1000 };
const UNLOCK_BY_RARITY = { common: 1, uncommon: 3, rare: 8, epic: 15, legendary: 25, mythic: 40 };
const PREFIX = { financial: 'fin', physique: 'phy', intelligence: 'int', romance: 'rom' };

// row: [name, rarity, kind, binding, unlockLevel|null(default by rarity), description, extra]
function build(quest, rows) {
  return rows.map(([name, rarity, kind, binding, unlock, desc, extra = {}]) => ({
    id: `${PREFIX[quest]}_${slug(name)}`, name, quest, rarity, kind, binding,
    unlock: unlock ?? UNLOCK_BY_RARITY[rarity],
    dup: kind === 'lootbox' || kind === 'key' || binding === 'consumable' ? 'stack' : 'convert',
    desc, value: SELL_VALUE[rarity], source: 'Quest rewards & lootboxes', ...extra,
  }));
}

const PHYSIQUE = build('physique', [
  ['Iron Will Emblem', 'common', 'emblem', 'sellable', 1, 'A plain iron badge for showing up. Equip it on your dashboard.'],
  ['Sweatbound Wristband', 'common', 'collectible', 'sellable', 1, 'Soaked through, still on. A reminder that effort leaves a mark.'],
  ['Rookie Fighter Title', 'common', 'certificate', 'bound', 5, 'Certificate commemorating the Rookie Fighter title (Physique level 5). It does not grant the title; levels do.'],
  ['Training Journal', 'common', 'collectible', 'sellable', 1, 'Pages for the days you moved. Missing a day never costs you anything here.'],
  ['Silver Muscle Crest', 'uncommon', 'emblem', 'sellable', 5, 'A silver crest struck from repetitions.'],
  ['Stamina Keeper Badge', 'uncommon', 'emblem', 'sellable', 5, 'Awarded to those who finish sets they started.'],
  ["Warrior's Headband", 'uncommon', 'collectible', 'sellable', 8, 'A cloth band worn in the last round of any workout.'],
  ['Discipline Scroll', 'uncommon', 'collectible', 'sellable', 8, 'A scroll of one line: "Again."'],
  ['Iron Body Frame', 'rare', 'emblem', 'sellable', 12, 'A steel frame for your dashboard emblem.'],
  ['Relentless Fighter Title', 'rare', 'certificate', 'bound', 10, 'Certificate commemorating the Relentless Fighter title (Physique level 10).'],
  ['Phoenix Training Emblem', 'rare', 'emblem', 'sellable', 14, 'An ember-bright emblem for those who restart without shame.'],
  ["Champion's Wristband", 'rare', 'collectible', 'sellable', 16, 'Plain on the outside, scuffed on the inside.'],
  ['Steel Resolve Title', 'epic', 'certificate', 'bound', 15, 'Certificate commemorating the Steel Resolve title (Physique level 15).'],
  ['Battle-Hardened Crest', 'epic', 'emblem', 'sellable', 30, 'A crest scarred by many training seasons.'],
  ["Titan's Training Frame", 'epic', 'emblem', 'sellable', 25, 'A heavy frame, forged from forgotten plateaus.'],
  ['Unbreakable Spirit Title', 'epic', 'certificate', 'bound', 20, 'Certificate commemorating the Unbreakable Spirit title (Physique level 20).'],
  ['Apex Warrior Emblem', 'legendary', 'emblem', 'sellable', 35, 'The emblem of someone who outlasts the plan.'],
  ['Immortal Physique Title', 'legendary', 'certificate', 'bound', 40, 'Certificate commemorating the Immortal Physique title (Physique level 40).'],
  ['Legendary Athlete Crest', 'mythic', 'emblem', 'sellable', 45, 'A mythic crest, earned over hundreds of workouts.'],
  ['THE UNSTOPPABLE Title Frame', 'mythic', 'emblem', 'bound', 50, 'A bound frame for THE UNSTOPPABLE title. Unlocks only after Physique level 50 is fully cleared.', { needsMaxed: true }],
  ['Iron Crate', 'common', 'lootbox', 'consumable', 1, 'A dented crate. Opens to one Physique reward.', { box: { quest: 'physique', weights: { common: 70, uncommon: 24, rare: 6 }, gold: [10, 25] } }],
  ["Warrior's Chest", 'rare', 'lootbox', 'consumable', 8, 'A sturdier chest with better odds.', { box: { quest: 'physique', weights: { common: 35, uncommon: 35, rare: 20, epic: 8, legendary: 2 }, gold: [30, 70] } }],
]);

const INTEL = build('intelligence', [
  ['Logic Scroll', 'common', 'collectible', 'sellable', 1, 'A scroll of syllogisms. The first rule: check the premises.'],
  ['Memory Crystal', 'uncommon', 'collectible', 'sellable', 3, 'A crystal that hums when you recall something correctly.'],
  ["Scholar's Badge", 'common', 'emblem', 'sellable', 1, 'A modest badge for steady study.'],
  ['Focus Token', 'common', 'collectible', 'sellable', 1, 'A coin you hold while working. Cosmetic only.'],
  ['Knowledge Chest', 'rare', 'collectible', 'sellable', 10, 'Lined with notes, bookmarked at the hard parts.'],
  ['Insight Fragment', 'uncommon', 'collectible', 'sellable', 5, 'A shard of understanding, still sharp at the edges.'],
  ['Mastery Seal', 'epic', 'emblem', 'sellable', 25, 'A wax seal pressed after something finally clicked.'],
  ['Strategy Codex', 'epic', 'collectible', 'bound', 20, 'A bound codex. Unlocks the Hard computer opponent in Chess.', { feature: 'chess_hard' }],
  ['Rare Puzzle Key', 'rare', 'key', 'consumable', 12, 'Required to open a Mastery Box.'],
  ['100% Theory Relic', 'legendary', 'collectible', 'sellable', 40, 'A relic from a perfect score on a hard problem set.'],
  ['Pattern Prism', 'uncommon', 'collectible', 'sellable', 6, 'Splits a pattern into the parts that repeat.'],
  ['Cipher Wheel', 'rare', 'collectible', 'sellable', 14, 'Turns slowly, decodes patiently.'],
  ['Axiom Tablet', 'rare', 'collectible', 'sellable', 18, 'Engraved with one thing assumed true.'],
  ["Debugger's Lens", 'epic', 'emblem', 'sellable', 28, 'Shows exactly where the reasoning broke.'],
  ['Quantum Quill', 'legendary', 'collectible', 'sellable', 45, 'Writes two answers until you observe the right one.'],
  ["Oracle's Notebook", 'mythic', 'collectible', 'sellable', 70, 'Filled with questions rather than answers.'],
  ['Expert Grid Sigil', 'epic', 'collectible', 'bound', 30, 'A bound sigil. Unlocks Expert difficulty in Sudoku.', { feature: 'sudoku_expert' }],
  ['Reasoning Compass', 'common', 'collectible', 'sellable', 1, 'Always points toward the next question worth asking.'],
  ['Logic Chest', 'common', 'lootbox', 'consumable', 1, 'A tidy chest of Intelligence rewards.', { box: { quest: 'intelligence', weights: { common: 65, uncommon: 28, rare: 7 }, gold: [10, 25] } }],
  ["Scholar's Cache", 'uncommon', 'lootbox', 'consumable', 5, 'A scholar\'s stash.', { box: { quest: 'intelligence', weights: { common: 45, uncommon: 35, rare: 17, epic: 3 }, gold: [20, 45] } }],
  ['Memory Vault', 'rare', 'lootbox', 'consumable', 12, 'Opens only when you remember it exists.', { box: { quest: 'intelligence', weights: { common: 30, uncommon: 35, rare: 25, epic: 9, legendary: 1 }, gold: [30, 70] } }],
  ["Strategist's Crate", 'epic', 'lootbox', 'consumable', 25, 'Packed with well-considered trade-offs.', { box: { quest: 'intelligence', weights: { uncommon: 30, rare: 40, epic: 24, legendary: 6 }, gold: [60, 120] } }],
  ['Mastery Box', 'epic', 'lootbox', 'consumable', 35, 'Requires a Rare Puzzle Key.', { needsKey: 'int_rare-puzzle-key', box: { quest: 'intelligence', weights: { rare: 40, epic: 35, legendary: 20, mythic: 5 }, gold: [100, 220] } }],
  ['Theory Vault', 'legendary', 'lootbox', 'consumable', 50, 'Deep storage for the best of Intelligence rewards.', { box: { quest: 'intelligence', weights: { epic: 50, legendary: 38, mythic: 12 }, gold: [200, 400] } }],
]);

const FIN = build('financial', [
  ['Coin Pouch', 'common', 'collectible', 'sellable', 1, 'A small pouch. The first coin is the heaviest.'],
  ['Ledger Page', 'common', 'collectible', 'sellable', 1, 'A single page of honest numbers.'],
  ['Savings Seal', 'uncommon', 'emblem', 'sellable', 3, 'Stamped on money you decided to keep.'],
  ['Budget Compass', 'uncommon', 'collectible', 'sellable', 4, 'Needle always points at the plan.'],
  ["Merchant's Ring", 'rare', 'emblem', 'sellable', 8, 'A ring for steady earners.'],
  ['Iron Vault Key', 'rare', 'key', 'consumable', 10, 'Required to open a Treasury Box.'],
  ['Golden Abacus', 'epic', 'collectible', 'sellable', 15, 'Beads of gold, each one counted.'],
  ['Fortune Crest', 'epic', 'emblem', 'sellable', 20, 'A crest for those who outlast the lean weeks.'],
  ['Stabilizer Emblem', 'legendary', 'emblem', 'sellable', 30, 'The sign of stable ground under your feet.'],
  ['Treasury Seal', 'mythic', 'emblem', 'bound', 45, 'A bound seal for the very top of the Financial path.'],
  ['Ledger Cache', 'common', 'lootbox', 'consumable', 1, 'A tidy cache of Financial rewards.', { box: { quest: 'financial', weights: { common: 65, uncommon: 27, rare: 8 }, gold: [10, 30] } }],
  ['Treasury Box', 'epic', 'lootbox', 'consumable', 15, 'Requires an Iron Vault Key.', { needsKey: 'fin_iron-vault-key', box: { quest: 'financial', weights: { rare: 40, epic: 38, legendary: 18, mythic: 4 }, gold: [100, 250] } }],
]);

// Romance: 50 reward concepts from the spec. XP-flavoured items grant only small, daily-capped Romance XP.
const ROM = build('romance', [
  ['Rose Token', 'common', 'collectible', 'sellable', 1, 'A small red token. Kindness costs nothing.'],
  ['Sweet Message Scroll', 'common', 'collectible', 'sellable', 1, 'A scroll with space for one honest, pressure-free line.'],
  ['Charm Fragment', 'common', 'collectible', 'sellable', 1, 'A chip of charm. Collect several.'],
  ['Heart Coin', 'common', 'currency', 'consumable', 1, 'A coin worth 10 Heart Coins in the Romance market.', { currency: { hearts: 10 } }],
  ['Little Victory Badge', 'common', 'emblem', 'sellable', 1, 'For small brave steps.'],
  ['Kindness Note', 'common', 'collectible', 'sellable', 1, 'A reminder that warmth is a skill.'],
  ['Romance XP Shard', 'common', 'consumable', 'consumable', 1, 'Use for +5 Romance XP. Counts toward the daily item-XP cap (30).', { effect: { xp: 5 }, shop: false }],
  ['Lootbox Key', 'uncommon', 'key', 'consumable', 3, 'Required to open a Royal Lootbox.'],
  ['Memory Card', 'uncommon', 'collectible', 'sellable', 3, 'A card holding a moment you handled well.'],
  ['Gentleman Emblem', 'uncommon', 'emblem', 'sellable', 3, 'Manners, patience and respect, in one emblem.'],
  ['Silver Heart', 'uncommon', 'collectible', 'sellable', 3, 'A heart cast in silver.'],
  ['Flirty Phrase Collection', 'uncommon', 'collectible', 'sellable', 3, 'Light, playful lines to practise. Always read the room and respect any answer.'],
  ['Charm Chest', 'uncommon', 'lootbox', 'consumable', 3, 'A chest of Romance rewards.', { box: { quest: 'romance', weights: { common: 55, uncommon: 33, rare: 10, epic: 2 }, gold: [10, 30], hearts: [10, 30] } }],
  ['XP Booster Fragment', 'uncommon', 'consumable', 'consumable', 3, 'Use for +8 Romance XP. Counts toward the daily item-XP cap (30).', { effect: { xp: 8 }, shop: false }],
  ['Romance Journal Page', 'uncommon', 'collectible', 'sellable', 3, 'A page for reflecting on what felt natural.'],
  ['Confidence Crest', 'uncommon', 'emblem', 'sellable', 3, 'Quiet confidence, worn lightly.'],
  ['Golden Rose Petal', 'rare', 'collectible', 'sellable', 8, 'One gold petal, easy to lose, worth keeping.'],
  ['Mystery Envelope', 'rare', 'collectible', 'sellable', 8, 'Sealed. Stays sealed. That is the point.'],
  ['Conversation Practice Card', 'rare', 'collectible', 'sellable', 8, 'Prompts for relaxed, two-sided conversation.'],
  ['Streak Keeper', 'rare', 'collectible', 'sellable', 8, 'A ribbon for steady, low-pressure effort.'],
  ['Heart Crystal', 'rare', 'collectible', 'sellable', 8, 'A crystal that glows when you listen well.'],
  ['Silver Crown', 'rare', 'emblem', 'sellable', 8, 'A silver crown for your dashboard emblem.'],
  ['Secret Scroll', 'rare', 'collectible', 'sellable', 8, 'It says: "Be interested, not interesting."'],
  ['Royal Invitation', 'rare', 'collectible', 'sellable', 8, 'An invitation to the Rare Exchange.'],
  ['Romance XP Capsule', 'rare', 'consumable', 'consumable', 8, 'Use for +15 Romance XP. Counts toward the daily item-XP cap (30).', { effect: { xp: 15 }, shop: false }],
  ['Starlight Frame', 'rare', 'emblem', 'sellable', 8, 'A frame that catches faint light.'],
  ['Golden Heart Key', 'epic', 'key', 'consumable', 15, 'Required to open a Sovereign Lootbox.'],
  ['Echo of Kindness', 'epic', 'collectible', 'sellable', 15, 'The sound of a kind thing, still ringing.'],
  ['Moonlit Rose', 'epic', 'collectible', 'sellable', 15, 'A rose that only opens at night.'],
  ['Rare Title Fragment', 'epic', 'collectible', 'sellable', 15, 'A fragment of a title. Cannot unlock titles; only levels do.'],
  ['Heartbound Crown', 'epic', 'emblem', 'sellable', 15, 'A crown tied to the Heartbound title. Cosmetic.'],
  ["Master's Scroll", 'epic', 'collectible', 'sellable', 15, 'A long scroll about patience.'],
  ['Royal Lootbox', 'epic', 'lootbox', 'consumable', 15, 'Requires a Lootbox Key.', { needsKey: 'rom_lootbox-key', box: { quest: 'romance', weights: { uncommon: 25, rare: 40, epic: 28, legendary: 7 }, gold: [30, 80], hearts: [40, 90] } }],
  ['Phoenix Heart', 'epic', 'collectible', 'sellable', 15, 'A heart that rises after every setback.'],
  ['Golden Gentleman Badge', 'epic', 'emblem', 'sellable', 15, 'A badge for consistent, respectful conduct.'],
  ['XP Summoning Seal', 'epic', 'collectible', 'bound', 15, 'A bound keepsake. It has NO mechanical effect: it cannot bypass the 250 XP cap, unlock milestones or any restriction.'],
  ['Velvet Frame', 'epic', 'emblem', 'sellable', 15, 'Deep crimson velvet around your emblem.'],
  ['Archive Expansion', 'epic', 'collectible', 'bound', 15, 'A bound token: the screenshot archive may hold more items (see Romance collection).', { feature: 'archive_plus' }],
  ['Celestial Rose', 'legendary', 'collectible', 'sellable', 25, 'A rose from somewhere far above.'],
  ['Title Unlock Scroll', 'legendary', 'collectible', 'sellable', 25, 'Cannot unlock any title. It is a rare Exchange token only.'],
  ['Eternal Rose', 'legendary', 'collectible', 'sellable', 25, 'A rose that does not wilt.'],
  ['Heart Sovereign Crest', 'legendary', 'emblem', 'sellable', 25, 'A crest of heart-ruled kingdoms.'],
  ['Mythic Heart Crystal', 'mythic', 'collectible', 'sellable', 40, 'A crystal with a slow heartbeat.'],
  ['Legendary Archive', 'mythic', 'collectible', 'sellable', 40, 'A shelf of the best moments, read and respected.'],
  ['Crown of Devotion', 'mythic', 'emblem', 'sellable', 40, 'A mythic crown for your dashboard emblem.'],
  ['Eternal Title Frame', 'mythic', 'emblem', 'sellable', 40, 'An eternal frame. Cosmetic only.'],
  ['Sovereign Lootbox', 'mythic', 'lootbox', 'consumable', 40, 'Requires a Golden Heart Key.', { needsKey: 'rom_golden-heart-key', box: { quest: 'romance', weights: { rare: 30, epic: 40, legendary: 24, mythic: 6 }, gold: [100, 250], hearts: [120, 300] } }],
  ['Celestial XP Core', 'mythic', 'consumable', 'consumable', 40, 'Use for +20 Romance XP. Counts toward the daily item-XP cap (30).', { effect: { xp: 20 }, shop: false }],
  ['Heart of the System', 'mythic', 'emblem', 'sellable', 40, 'The core of the Romance path. Cosmetic.'],
  ['Eternal Heart Sovereign Relic', 'mythic', 'collectible', 'sellable', 40, 'The rarest Romance relic. Cosmetic.'],
]);

export const CATALOG = [...PHYSIQUE, ...INTEL, ...FIN, ...ROM];
export const ITEM_BY_ID = Object.fromEntries(CATALOG.map((i) => [i.id, i]));
export const currencyOf = (item) => (item.quest === 'romance' ? 'hearts' : 'gold');
