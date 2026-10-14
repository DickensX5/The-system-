// CHESS: full legal-move rules (castling, en passant, promotion, check, mate, stalemate). Promotion is automatic queen.
// Not implemented: threefold repetition and the fifty-move rule (the game can run on in those rare cases).
const F = 'abcdefgh';
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function fromFen(fen) {
  const [pos, turn, cas, ep] = fen.split(' ');
  const b = []; for (const row of pos.split('/')) for (const ch of row) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) b.push(null); else b.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase()); }
  return { b, turn, castle: { wK: cas.includes('K'), wQ: cas.includes('Q'), bK: cas.includes('k'), bQ: cas.includes('q') }, ep: ep === '-' ? null : F.indexOf(ep[0]) + (8 - +ep[1]) * 8 };
}
const R = (i) => i >> 3, C = (i) => i & 7, inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]], BISH = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export function attacked(st, sq, by) {
  const { b } = st; const r = R(sq), c = C(sq);
  const dir = by === 'w' ? 1 : -1;                                            // white pawns attack upward (towards row-1)
  for (const dc of [-1, 1]) { const rr = r + dir, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === by + 'P') return true; }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === by + 'N') return true; }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === by + 'K') return true; }
  for (const [ds, types] of [[ROOK, 'RQ'], [BISH, 'BQ']]) for (const [dr, dc] of ds) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (p[0] === by && types.includes(p[1])) return true; break; } rr += dr; cc += dc; } }
  return false;
}
const kingSq = (st, col) => st.b.indexOf(col + 'K');
export const inCheck = (st, col) => attacked(st, kingSq(st, col), col === 'w' ? 'b' : 'w');
function pseudo(st) {
  const { b, turn } = st, out = [], opp = turn === 'w' ? 'b' : 'w';
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || p[0] !== turn) continue; const r = R(i), c = C(i), t = p[1];
    if (t === 'P') {
      const d = turn === 'w' ? -1 : 1, start = turn === 'w' ? 6 : 1, last = turn === 'w' ? 0 : 7;
      const push = (to, extra = {}) => { if (R(to) === last) out.push({ from: i, to, promo: 'Q', ...extra }); else out.push({ from: i, to, ...extra }); };
      if (inb(r + d, c) && !b[(r + d) * 8 + c]) { push((r + d) * 8 + c); if (r === start && !b[(r + 2 * d) * 8 + c]) out.push({ from: i, to: (r + 2 * d) * 8 + c, dbl: true }); }
      for (const dc of [-1, 1]) { const rr = r + d, cc = c + dc; if (!inb(rr, cc)) continue; const to = rr * 8 + cc; if (b[to] && b[to][0] === opp) push(to); else if (st.ep === to) out.push({ from: i, to, ep: true }); }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of t === 'N' ? KN : KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && (!b[rr * 8 + cc] || b[rr * 8 + cc][0] === opp)) out.push({ from: i, to: rr * 8 + cc }); }
      if (t === 'K') {
        const home = turn === 'w' ? 60 : 4;
        if (i === home && !inCheck(st, turn)) {
          if (st.castle[turn + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === turn + 'R' && !attacked(st, home + 1, opp) && !attacked(st, home + 2, opp)) out.push({ from: i, to: home + 2, castle: 'K' });
          if (st.castle[turn + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === turn + 'R' && !attacked(st, home - 1, opp) && !attacked(st, home - 2, opp)) out.push({ from: i, to: home - 2, castle: 'Q' });
        }
      }
    } else {
      for (const [dr, dc] of t === 'R' ? ROOK : t === 'B' ? BISH : [...ROOK, ...BISH]) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const q = b[rr * 8 + cc]; if (q) { if (q[0] === opp) out.push({ from: i, to: rr * 8 + cc }); break; } out.push({ from: i, to: rr * 8 + cc }); rr += dr; cc += dc; } }
    }
  }
  return out;
}
export function apply(st, m) {
  const b = st.b.slice(), p = b[m.from], turn = st.turn, castle = { ...st.castle };
  b[m.to] = m.promo ? turn + m.promo : p; b[m.from] = null;
  if (m.ep) b[m.to + (turn === 'w' ? 8 : -8)] = null;
  if (m.castle) { const home = m.from; if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = null; } else { b[home - 1] = b[home - 4]; b[home - 4] = null; } }
  if (p[1] === 'K') { castle[turn + 'K'] = false; castle[turn + 'Q'] = false; }
  for (const [sq, key] of [[0, 'bQ'], [7, 'bK'], [56, 'wQ'], [63, 'wK']]) if (m.from === sq || m.to === sq) castle[key] = false;
  return { b, turn: turn === 'w' ? 'b' : 'w', castle, ep: m.dbl ? (m.from + m.to) / 2 : null };
}
export function legalMoves(st) { return pseudo(st).filter((m) => !inCheck(apply(st, m), st.turn)); }
export function status(st) { const mv = legalMoves(st); if (mv.length) return inCheck(st, st.turn) ? 'check' : 'play'; return inCheck(st, st.turn) ? 'checkmate' : 'stalemate'; }
export function perft(st, d) { if (d === 0) return 1; let n = 0; for (const m of legalMoves(st)) n += d === 1 ? 1 : perft(apply(st, m), d - 1); return n; }
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const evalSt = (st) => { let s = 0; st.b.forEach((p, i) => { if (p) { const v = VAL[p[1]] + (p[1] === 'P' ? (p[0] === 'w' ? 7 - R(i) : R(i)) * 6 : 0) + (p[1] !== 'K' && p[1] !== 'R' ? 8 - Math.abs(3.5 - C(i)) - Math.abs(3.5 - R(i)) : 0); s += p[0] === 'w' ? v : -v; } }); return s; };
function search(st, d, a, b2) { const mv = legalMoves(st); if (!mv.length) return inCheck(st, st.turn) ? (st.turn === 'w' ? -1e5 - d : 1e5 + d) : 0; if (d === 0) return evalSt(st); let best = st.turn === 'w' ? -Infinity : Infinity; for (const m of mv) { const v = search(apply(st, m), d - 1, a, b2); if (st.turn === 'w') { best = Math.max(best, v); a = Math.max(a, v); } else { best = Math.min(best, v); b2 = Math.min(b2, v); } if (b2 <= a) break; } return best; }
export function aiMove(st, depth = 1, rnd = Math.random) {
  const mv = legalMoves(st); if (!mv.length) return null;
  const sc = mv.map((m) => ({ m, v: search(apply(st, m), depth - 1 + (depth > 1 ? 0 : 0), -Infinity, Infinity) + rnd() * 6 }));
  sc.sort((x, y) => (st.turn === 'w' ? y.v - x.v : x.v - y.v)); return sc[0].m;
}
export const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
