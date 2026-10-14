import { mulberry32 } from '../../utils/rng.js';
export function valid(g, i, v) { const r = (i / 9) | 0, c = i % 9; for (let k = 0; k < 9; k++) { if (g[r * 9 + k] === v && r * 9 + k !== i) return false; if (g[k * 9 + c] === v && k * 9 + c !== i) return false; } const br = r - (r % 3), bc = c - (c % 3); for (let a = 0; a < 3; a++) for (let d = 0; d < 3; d++) { const j = (br + a) * 9 + bc + d; if (g[j] === v && j !== i) return false; } return true; }
export function solveCount(g, limit = 2) { const a = g.slice(); let n = 0; (function rec() { if (n >= limit) return; const i = a.indexOf(0); if (i < 0) { n++; return; } for (let v = 1; v <= 9; v++) if (valid(a, i, v)) { a[i] = v; rec(); a[i] = 0; if (n >= limit) return; } })(); return n; }
function fill(g, rnd) { const i = g.indexOf(0); if (i < 0) return true; const vs = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rnd() - 0.5); for (const v of vs) if (valid(g, i, v)) { g[i] = v; if (fill(g, rnd)) return true; g[i] = 0; } return false; }
/** Returns {puzzle, solution}. Puzzles have exactly ONE solution. clues: ~40 easy, 32 medium, 26 hard, 23 expert. */
export function generate(clues = 36, seed = Date.now()) {
  const rnd = mulberry32(seed), sol = Array(81).fill(0); fill(sol, rnd);
  const p = sol.slice(), order = [...Array(81).keys()].sort(() => rnd() - 0.5); let left = 81;
  for (const i of order) { if (left <= clues) break; const keep = p[i]; p[i] = 0; if (solveCount(p, 2) !== 1) p[i] = keep; else left--; }
  return { puzzle: p, solution: sol };
}
