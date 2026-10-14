# THE SYSTEM — formulas, rules and worked examples

Everything below is implemented in `js/engine/*` and `js/quests/*` and covered by `tests/*.test.js`.

## Quest levels
`level = min(maxLevel, 1 + floor(xp / xpPerLevel))`

| Quest | XP per level | Max level | Total XP to clear |
|---|---|---|---|
| Financial | 6 (= TSh 36,000) | 50 | 300 (= TSh 1,800,000) |
| Physique | 56 | 50 | 2,800 (350 full workouts × 8 XP) |
| Intelligence | 140 | 100 | 14,000 (700 daily quests × 20 XP) |
| Romance | 100 *(my choice, spec gave none)* | 50 | 5,000 |

The **final-level title** of a quest (THE UNSTOPPABLE, THE FINANCIAL STABILIZER, The Mastermind, The Eternal Heart) needs the quest *fully cleared* (all XP), not just reaching the last level.

## Overall level (1–100)
```
S      = ¼ × ( finXp/300 + phyXp/2800 + intXp/14000 + romXp/5000 )        0 ≤ S ≤ 1
level  = 1 + floor( 99 × S )
```
Exact integer arithmetic over the common denominator 840,000 (no floating-point error).
Un-started quests count as 0. Level 100 needs **all four quests maxed**.
Example: Physique 560 XP (20 %) + Intelligence 2,800 XP (20 %) → S = ¼(0.2+0.2) = 0.10 → level 1 + floor(9.9) = **10**.

Rank bands: 1–20 Unawakened · 21–40 Lone Wolf · 41–60 Alpha · 61–80 Sigma · 81–100 Soul Monarch.

## Financial
```
balance      = starting balance + income − spending − applied penalties     (never below 0)
grossXp      = floor(balance / 6,000)
eligible XP  = max(0, grossXp − XP you summoned away)
level        = min(50, 1 + floor(eligibleXp / 6))
```
* Receive 6,000 → balance 6,000 → 1 XP · level 1.
* Reach 36,000 → 6 XP → **level 2**. Spend 6,000 → 30,000 → 5 XP → **level 1 again** (lifetime income stays 36,000).
* Starting balance is an *initial entry*: it counts toward balance, **not** toward lifetime income.
* Missed workday (no income on that date, no accepted explanation, not a rest day) → one pending penalty per date.
  Applying it deducts **TSh 6,000** (e.g. 36,000 → 30,000). In-app accounting only. If balance < 6,000 it stays pending and the tab is not locked (so you can record income). Max 4 accepted explanations per rolling 30 days.
* Titles: *First Earner* = balance ≥ TSh 50,000 · *The Half-Million Holder* = balance ≥ TSh 500,000 · ladder titles by level (5, 10 … 50).
  **Spec conflict resolved:** the brief associates THE FINANCIAL STABILIZER with TSh 500,000 *and* level 50, but 36,000 TSh/level makes level 50 = TSh 1,764,000. I kept your explicit conversion and gave the 500,000 mark its own title. Change `js/data/titles.js` if you prefer otherwise.

## Physique
* 4 exercises/day × **2 XP** = 8 XP. Targets by `tier = floor(level/3)`: push-ups & crunches `20+10·tier` reps · mountain climbers `15+10·tier` s · jumping jacks `60+10·tier` s (L48–50 → 180 / 180 / 175 s / 220 s).
* The day's target is fixed at the first log of the day. Timed exercises count only a running timer; a timer left running far past the target earns nothing.
* No penalties, no XP loss, no custom quests.

## Intelligence
* Daily standard quest: 3 verified questions → **20 XP** once/day.
* One custom quest at a time: 5–30 XP (steps of 5), focus time = XP/5 × 15 min, written takeaway ≥ 8 words, deadline 1–14 days.
* **Daily quest-XP cap: 40.** Pause: 1–7 days, 14-day gap between pauses; deadlines move later.
* Expiry → penalty by XP: ≤10 minor (24 h) · ≤20 intermediate (48 h) · >20 severe (72 h). Challenge answers are verified in code.

## Romance
* Custom quests only (max 3 active), 5–30 XP, daily cap 60 XP, heart completion needs a respectful-conduct confirmation + reflection + 10 minutes since creation.
* Expiry → Penalty Dungeon: minor 4 h · intermediate 6 h · severe 8 h. Quest text is screened (no pressure/tracking/manipulation/spending).

## Savage penalties
Triggered only when a penalty deadline passes. Removes only things that **exist and are eligible**: Intelligence — one reward item, else one title; Romance — one title **and** one item. Never XP. Everything is recoverable in *Market → Lost & Found* (items 2× sell value, titles 50–1,600 by rarity).

## XP Summoning
* Unlocks at overall level 5, plus one more unlock at each 5-level milestone (5, 10, 15 …). **One transfer spends one unlock** *(my reading of "unlock again at each milestone")*.
* **≤ 250 XP per rolling 24 h.** Only Romance receives; Financial/Physique/Intelligence send. Sender loses exactly what Romance gains; never below 0.

## Rewards & currency
* Gold and Heart Coins are app-only and separate from XP. Every level reached creates one claimable reward (`lvl:quest:N`, claimable once).
* 108 catalog items. Rarity is cosmetic. Item XP (Romance XP Shard/Booster/Capsule/Core) is capped at **30 XP/day** and only feeds Romance. No item grants a title.
* Duplicate unique items convert into half their sell value; stackables stack.
