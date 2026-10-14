// Sliding puzzle. The board is scrambled by random LEGAL slides from the solved state, so it is always solvable.
export const solved = (n) => [...Array(n * n - 1).keys()].map((x) => x + 1).concat(0);
export function scramble(n, rnd = Math.random, moves = n * n * 12) { const b = solved(n); let z = b.length - 1, last = -1; for (let k = 0; k < moves; k++) { const nb = neighbors(n, z).filter((x) => x !== last); const j = nb[Math.floor(rnd() * nb.length)]; [b[z], b[j]] = [b[j], b[z]]; last = z; z = j; } return b; }
export function neighbors(n, i) { const r = (i / n) | 0, c = i % n, o = []; if (r > 0) o.push(i - n); if (r < n - 1) o.push(i + n); if (c > 0) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; }
export function slide(n, b, i) { const z = b.indexOf(0); if (!neighbors(n, z).includes(i)) return false; [b[z], b[i]] = [b[i], b[z]]; return true; }
export const isSolved = (n, b) => b.every((v, i) => v === (i === b.length - 1 ? 0 : i + 1));
/** Parity test: used by the unit test to prove solvability. */
export function solvable(n, b) { let inv = 0; const a = b.filter(Boolean); for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++; const row = n - ((b.indexOf(0) / n) | 0); return n % 2 ? inv % 2 === 0 : (inv + row) % 2 === 1; }
