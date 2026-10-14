const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function winner(b) { for (const [x, y, z] of L) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]; return b.every(Boolean) ? 'draw' : null; }
function mm(b, turn, me) { const w = winner(b); if (w) return w === 'draw' ? 0 : w === me ? 1 : -1; let best = turn === me ? -2 : 2; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const v = mm(b, turn === 'X' ? 'O' : 'X', me); b[i] = null; best = turn === me ? Math.max(best, v) : Math.min(best, v); } return best; }
/** Perfect play: the computer never loses. */
export function bestMove(b, me) { let bi = -1, bv = -3; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me; const v = mm(b, me === 'X' ? 'O' : 'X', me); b[i] = null; if (v > bv) { bv = v; bi = i; } } return bi; }
