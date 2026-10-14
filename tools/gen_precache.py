#!/usr/bin/env python3
"""Regenerates the precache list and build hash inside sw.js.
Run from the project root after ANY file change:   python3 tools/gen_precache.py
The hash changes whenever any shipped file changes, which makes browsers install the new service worker."""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'tools', 'tests', '.git', 'node_modules', 'docs'}
SKIP_FILES = {'sw.js', 'package.json', 'README.md', 'FORMULAS.md', 'TEST-REPORT.md', 'DEPLOY.md', '.nojekyll'}

files = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = sorted(d for d in dn if d not in SKIP_DIRS)
    for f in sorted(fn):
        rel = os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, '/')
        if f in SKIP_FILES or f.startswith('.'):
            continue
        files.append(rel)
files.sort()
h = hashlib.sha256()
for rel in files:
    h.update(rel.encode()); h.update(open(os.path.join(ROOT, rel), 'rb').read())
build = '1.0.0-' + h.hexdigest()[:10]
urls = ['./'] + ['./' + f for f in files]
sw_path = os.path.join(ROOT, 'sw.js')
sw = open(sw_path, encoding='utf-8').read()
sw = re.sub(r"const BUILD = '[^']*'; /\*BUILD\*/", f"const BUILD = '{build}'; /*BUILD*/", sw)
lst = ",\n  ".join("'" + u + "'" for u in urls)
sw = re.sub(r"/\*PRECACHE_START\*/.*?/\*PRECACHE_END\*/", "/*PRECACHE_START*/\n  " + lst + "\n  /*PRECACHE_END*/", sw, flags=re.S)
open(sw_path, 'w', encoding='utf-8').write(sw)
print(f"sw.js updated: build {build}, {len(urls)} precached URLs")
