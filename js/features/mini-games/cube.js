// CUBE CORE: a real 3x3x3 cube model. 54 stickers, each with a 3D position and a face normal; a move rotates one layer.
// (It is a 3D cube; the net shows all six faces at once. It is not a "4D" object.)
export const COLORS = { U: '#f5f5f5', D: '#ffd500', F: '#2fbf4a', B: '#2f6bff', R: '#e5322d', L: '#ff8a1f' };
const NORMALS = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
export function solvedCube() { const s = []; for (const [f, n] of Object.entries(NORMALS)) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const pos = n[0] ? [n[0], a, b] : n[1] ? [a, n[1], b] : [a, b, n[2]]; s.push({ pos, n: [...n], f }); } return s; }
// axis, layer, +1 = rotate by +90deg about the axis (right-hand rule)
const rot = (v, axis, q) => { const [x, y, z] = v; return axis === 0 ? [x, -q * z, q * y] : axis === 1 ? [q * z, y, -q * x] : [-q * y, q * x, z]; };
export const MOVES = {
  U: [1, 1, -1], "U'": [1, 1, 1], D: [1, -1, 1], "D'": [1, -1, -1], R: [0, 1, -1], "R'": [0, 1, 1], L: [0, -1, 1], "L'": [0, -1, -1],
  F: [2, 1, -1], "F'": [2, 1, 1], B: [2, -1, 1], "B'": [2, -1, -1], E: [1, 0, 1], "E'": [1, 0, -1], M: [0, 0, 1], "M'": [0, 0, -1], S: [2, 0, -1], "S'": [2, 0, 1],
};
export function move(cube, name) { const [axis, layer, q] = MOVES[name]; return cube.map((s) => (s.pos[axis] === layer ? { ...s, pos: rot(s.pos, axis, q), n: rot(s.n, axis, q) } : s)); }
export const inverse = (name) => (name.endsWith("'") ? name[0] : name + "'");
export function apply(cube, seq) { return (typeof seq === 'string' ? seq.trim().split(/\s+/) : seq).reduce(move, cube); }
export const isSolved = (c) => { const by = {}; for (const s of c) { const k = s.n.join(); (by[k] = by[k] || new Set()).add(s.f); } return Object.values(by).every((x) => x.size === 1); };
const FACE_AXES = { U: [[1, 0, 0], [0, 0, 1]], D: [[1, 0, 0], [0, 0, -1]], F: [[1, 0, 0], [0, -1, 0]], B: [[-1, 0, 0], [0, -1, 0]], R: [[0, 0, -1], [0, -1, 0]], L: [[0, 0, 1], [0, -1, 0]] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** 3x3 grid (row-major, 9 colour keys) of the stickers currently facing the given direction. */
export function faceGrid(cube, face) { const n = NORMALS[face], [rt, dn] = FACE_AXES[face], g = Array(9).fill(null); for (const s of cube) if (s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2]) g[(dot(s.pos, dn) + 1) * 3 + dot(s.pos, rt) + 1] = s.f; return g; }
export function scramble(rnd = Math.random, n = 22) {
  const names = ['U', 'D', 'L', 'R', 'F', 'B'], out = []; let last = '';
  for (let i = 0; i < n; i++) {
    const pool = names.filter((x) => x !== last);                 // never the same face twice in a row, and never loops forever
    const f = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
    last = f; out.push(rnd() < 0.5 ? f : f + "'");
  }
  return out;
}
