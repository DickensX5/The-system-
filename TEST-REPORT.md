# TEST REPORT

Run date: 2026-10-14 · Node 22 · Chromium 141 (Playwright), 390×844 phone viewport.

## Automated unit tests: 52 / 52 passed (`node --test "tests/*.test.js"`)
| Area | What is proven |
|---|---|
| Levels | min/boundary/max for all four quests; Physique = 2,800 XP, Intelligence = 14,000 XP |
| Overall level | exact integer formula, 1..100 clamps, mixed-progress worked example, rounding boundary (8,484→1, 8,485→2), band edges 20/21/40/41/60/61/80/81, **falls when Financial balance falls** |
| Physique | targets for L1-2, 3-5, 6-8, 48-50 (180 / 175 s / 220 s); 2 XP once per exercise; 8 XP full workout once; timer left running earns nothing; day target locked |
| Financial | 6,000 / 36,000 / spend-6,000 examples; starting balance ≠ income; overspend rejected; 500,000 title; title reverts when balance falls; missed day → exactly one penalty, weekends exempt, idempotent; 36,000 → 30,000 deduction, not repeatable; insufficient balance stays pending; explanations (limit); income clears pending; 24 h void rules |
| Summoning | unlock milestones, 250 XP rolling window (reset after 24 h), Romance-only receiver, exact arithmetic, no negative XP, duplicate request blocked |
| Rewards | 108 unique items with required metadata; grants claimable once (double claim rejected); lootbox single result/event, key-gated boxes, level-gated drops over 40 random rolls; duplicate conversion; XP item cap 30/day; Seal/Scroll have no effect; **every level-up box id (levels 2-100) exists** |
| Penalties | tier by XP, persisted deadlines, only affected quest locked, no duplicate penalties, completion in time never escalates, Savage removes exactly what exists, never XP, recoverable from Lost & Found |
| Quests | Intelligence verified answers + 30 s lock, 40 XP daily cap (30 then 20 → 10), pause shifts deadlines, 14-day cooldown; Romance safe-text filter, max 3, 10-minute rule, reflection, completes once |
| Market / storage | atomic buy/sell, no negative currency, bound/consumable unsellable, duplicate tx ids ignored, Royal Invitation gate; **storage failure leaves state unchanged**, concurrent double open serialised, corrupt data backed up (not wiped), newer-schema refusal |
| Games | chess perft 20/400/8,902 and Kiwipete 48/2,039 (castling, en passant, promotion), mate & stalemate; checkers mandatory capture, multi-jump, kings; tic-tac-toe AI never loses (exhaustive); sliding scrambles always solvable; sudoku puzzles have exactly one solution; cube: 4×any move = identity, move+inverse, (R U R' U')⁶ = identity, scramble/undo |

Bugs found *by these tests* and fixed during the build: reward-box ids lost apostrophes (`warrior-s-chest`), a discarded timer was rolled back and stayed stuck, an infinite loop in `scramble` with a constant RNG.

## Browser tests (Playwright, real Chromium): 31 / 31 checks passed (`tests/e2e/`)
Service worker active · income → balance/level/celebration · overspend toast & no state change · **data survives reload** · Physique reps → 2 XP · double-tap Claim claims exactly once · lootbox opens once · Intelligence daily via the UI → 20 XP · **app boots with the network OFF** · JSON export · photo upload → IndexedDB blob → thumbnail · missed day locks Financial, deduction exactly TSh 6,000, no duplicates · XP Summoning moves exactly 40 XP · chess move + computer reply · sudoku generation · cube turns · erase refused without typing RESET · **no console errors on any route**.

## NOT verified (be aware)
* **Not run on a physical Android phone or in the installed-app (standalone) mode.** Layout was checked only at 390 px in Chromium; no iOS/Safari/Firefox testing.
* Installability (`beforeinstallprompt`) needs HTTPS or localhost: not exercised here.
* Multi-day timers (deadlines, 24 h windows, penalty countdowns) are proven with an injected clock, not by waiting real days.
* Checkers / tic-tac-toe / sliding **UI** and the 3D cube drag were not driven by browser tests (their logic is unit-tested).
* No screen-reader or colour-contrast audit; controls have labels and 44 px targets but this is unaudited.
* Very large histories (thousands of events) and low-memory phones were not load-tested.
