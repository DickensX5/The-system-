// Title tables. Titles are EARNED ONLY by rules (levels / balance milestones). Items can never grant a title.
export const BANDS = [
  { id: 'band_unawakened', name: 'Unawakened', from: 1, to: 20 },
  { id: 'band_lone_wolf', name: 'Lone Wolf', from: 21, to: 40 },
  { id: 'band_alpha', name: 'Alpha', from: 41, to: 60 },
  { id: 'band_sigma', name: 'Sigma', from: 61, to: 80 },
  { id: 'band_soul_monarch', name: 'Soul Monarch', from: 81, to: 100 },
];

const rar = (lvl) => (lvl >= 50 ? 'mythic' : lvl >= 35 ? 'legendary' : lvl >= 20 ? 'epic' : lvl >= 10 ? 'rare' : lvl >= 5 ? 'uncommon' : 'common');
const ladder = (quest, pre, rows) => rows.map(([lvl, name]) => ({ id: `${pre}_l${lvl}`, name, quest, level: lvl, rarity: rar(lvl), kind: 'level' }));

export const QUEST_TITLES = {
  financial: [
    // First Earner: first eligible milestone above TSh 50,000 (balance based, see FORMULAS.md)
    { id: 'fin_first_earner', name: 'First Earner', quest: 'financial', balance: 50000, rarity: 'common', kind: 'balance' },
    ...ladder('financial', 'fin', [[5, 'The Money Keeper'], [10, 'The Disciplined Saver'], [15, 'The Budget Strategist'], [20, 'The Wealth Builder'],
      [25, 'The Money Maker'], [30, 'The Capital Guardian'], [35, 'The Financial Strategist'], [40, 'The Wealth Architect'],
      [45, 'The Prosperity Keeper'], [50, 'THE FINANCIAL STABILIZER']]),
    // The TSh 500,000 milestone is kept as its own balance title; tracking continues beyond it.
    { id: 'fin_half_million', name: 'The Half-Million Holder', quest: 'financial', balance: 500000, rarity: 'epic', kind: 'balance' },
  ],
  physique: ladder('physique', 'phy', [[5, 'Rookie Fighter'], [10, 'Relentless Fighter'], [15, 'Steel Resolve'], [20, 'Unbreakable Spirit'],
    [25, 'Iron Will'], [30, 'Battle-Hardened Warrior'], [35, 'Apex Warrior'], [40, 'Immortal Physique'], [45, 'Legendary Athlete'], [50, 'THE UNSTOPPABLE']]),
  intelligence: ladder('intelligence', 'int', [[1, 'The Awakening Mind'], [20, 'The Pattern Seeker'], [40, 'The Logical Strategist'],
    [60, 'The Analytical Mind'], [80, 'The Master Thinker'], [100, 'The Mastermind']]),
  // The spec lists no Romance titles; these are original, respectful, level-based additions.
  romance: ladder('romance', 'rom', [[1, 'The Quiet Heart'], [5, 'Gentle Presence'], [10, 'Honest Charm'], [15, 'Respectful Flame'], [20, 'The Gentleman'],
    [25, 'Velvet Confidence'], [30, 'Rose Sovereign'], [35, 'Heartbound'], [40, 'Crown of Devotion'], [50, 'The Eternal Heart']]),
};
export const ALL_QUEST_TITLES = Object.values(QUEST_TITLES).flat();
export const TITLE_BY_ID = Object.fromEntries([...ALL_QUEST_TITLES, ...BANDS.map((b) => ({ ...b, quest: 'overall', kind: 'band', rarity: 'common' }))].map((t) => [t.id, t]));
