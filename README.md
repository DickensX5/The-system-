# THE SYSTEM

An offline-first progression PWA: four quests (**Financial, Physique, Intelligence, Romance**) feed one overall level (1–100) with ranks, titles, level-up rewards, lootboxes, a market, XP Summoning, penalties and an arcade. Vanilla HTML/CSS/JS, **no dependencies, no build step, no network needed after the first load**. All data stays on the device (IndexedDB).

Start here: **DEPLOY.md** (how to run/install) · **FORMULAS.md** (every rule with worked examples) · **TEST-REPORT.md** (what was verified, and what was not).

```
index.html  manifest.webmanifest  sw.js
css/        tokens, base, layout, components, animations, dashboard, quests, market
icons/      icon-sprite.svg            (44 UI icons as one sprite)
assets/     branding/ (logo, app icons, maskable, apple-touch, splash mark)  favicon/ (svg, png, ico)
js/
  app.js                 boot, shell, router, banners, service-worker registration
  state/                 store (atomic commits), persistence (IndexedDB → localStorage → memory), migrations
  engine/                xp, progression (overall level), title, reward, penalty, transaction engines
  quests/                financial, physique, intelligence, romance (pure logic, no DOM)
  data/                  titles, rewards (108 items), market, question bank, romance content
  features/              inbox, gallery, mini-games (chess, checkers, sudoku, sliding, tic-tac-toe, cube)
  views/                 one file per screen      ui/ dom toolkit + router      utils/
tests/       unit tests (node --test) and browser tests (tests/e2e, Playwright)
tools/       make_icons.py (Pillow) · gen_precache.py
```

## Design guarantees
* **Atomic changes.** Every action runs on a copy, then saves, then swaps in. If a rule fails or storage fails, *nothing* changes and you see the exact reason. Rapid double-taps are serialised and each reward/transaction has a one-time id.
* **Honest limits.** Penalties never deduct quest XP; the Financial penalty is an in-app accounting deduction (never real money); balance and XP never go negative.
* **Your data is not in the app cache**, so updating the app never touches progress.

## Known limitations
* No cloud sync or cross-device transfer except manual JSON export/import (photos are not exported).
* If the browser clears site data (or you uninstall/clear storage), progress is gone. Use *Settings → Export*.
* Chess has no threefold-repetition / fifty-move draw rule. A separate "savings" pool in Financial is not implemented (single recorded balance).
* Quest completion for real-life actions (workouts reps, romance actions, money earned) is self-reported; the app enforces consistency, caps and timers, not truth.
