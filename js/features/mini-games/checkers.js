// CHECKERS (American rules): diagonal moves on dark squares, mandatory capture, multi-jump, kings. Player = red (bottom), moves up.
export function initial() { const b = Array(64).fill(null); for (let i = 0; i < 64; i++) { const r = i >> 3, c = i & 7; if ((r + c) % 2 === 1) { if (r < 3) b[i] = 'b'; else if (r > 4) b[i] = 'r'; } } return { b, turn: 'r', chain: null }; }
const dirs = (p) => (p === 'R' || p === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : p === 'r' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const own = (p, t) => p && p.toLowerCase() === t;
export function movesFor(st, i) {
  const { b } = st, p = b[i], t = p.toLowerCase(), r = i >> 3, c = i & 7, caps = [], steps = [];
  for (const [dr, dc] of dirs(p)) {
    const r1 = r + dr, c1 = c + dc; if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const q = b[r1 * 8 + c1];
    if (!q) steps.push({ from: i, to: r1 * 8 + c1 });
    else if (!own(q, t)) { const r2 = r1 + dr, c2 = c1 + dc; if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && !b[r2 * 8 + c2]) caps.push({ from: i, to: r2 * 8 + c2, cap: r1 * 8 + c1 }); }
  }
  return { caps, steps };
}
export function legalMoves(st) {
  if (st.chain != null) return movesFor(st, st.chain).caps;
  let caps = [], steps = [];
  st.b.forEach((p, i) => { if (own(p, st.turn)) { const m = movesFor(st, i); caps = caps.concat(m.caps); steps = steps.concat(m.steps); } });
  return caps.length ? caps : steps;                                        // capturing is mandatory
}
export function apply(st, m) {
  const b = st.b.slice(); let p = b[m.from]; b[m.from] = null; if (m.cap != null) b[m.cap] = null;
  const lastRow = p === 'r' ? 0 : p === 'b' ? 7 : -1; let promoted = false;
  if ((m.to >> 3) === lastRow) { p = p.toUpperCase(); promoted = true; }
  b[m.to] = p;
  const next = { b, turn: st.turn, chain: null };
  if (m.cap != null && !promoted && movesFor(next, m.to).caps.length) { next.chain = m.to; return next; }   // must keep jumping
  next.turn = st.turn === 'r' ? 'b' : 'r'; return next;
}
export function winner(st) { return legalMoves(st).length ? null : (st.turn === 'r' ? 'b' : 'r'); }
export function aiMove(st, rnd = Math.random) {
  const mv = legalMoves(st); if (!mv.length) return null;
  const score = (m) => { const n = apply(st, m); let s = (m.cap != null ? 10 : 0) + (n.chain != null ? 6 : 0); const t = n.b[m.to]; if (t === t.toUpperCase() && st.b[m.from] !== t) s += 8; s += (m.to >> 3) * 0.3; if ((m.to >> 3) === 7 || (m.to & 7) === 0 || (m.to & 7) === 7) s += 0.5; return s + rnd() * 2; };
  return mv.sort((a, b) => score(b) - score(a))[0];
}
