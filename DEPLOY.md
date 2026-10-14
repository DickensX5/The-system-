# Running and installing THE SYSTEM

A PWA needs **http(s)**, not `file://` (ES modules and service workers are blocked on `file://`).

## Option A — GitHub Pages (recommended; gives HTTPS and installability)
1. Create a repo, upload the *contents* of this folder (so `index.html` is at the repo root).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<you>.github.io/<repo>/` in Chrome on Android → menu → **Install app**.

## Option B — on the phone with Termux
```
cd THE-SYSTEM
python3 -m http.server 8080
```
Open `http://localhost:8080` in Chrome. `localhost` counts as secure, so offline mode and install work.

## After you change any file
```
python3 tools/gen_precache.py      # refreshes the offline file list + version hash in sw.js
```
Users then see an **Update** banner; their progress is untouched (it lives in IndexedDB, not in the app cache).

## Re-making the icons
`python3 tools/make_icons.py` (needs Pillow) rewrites `assets/branding/*` and `assets/favicon/*`.

## Tests
`node --test "tests/*.test.js"` (Node 20+, no dependencies). Browser tests: `tests/e2e/*.py` (Playwright).
