// Arcade: relaxing mini-games. They never award XP, levels or titles (so they cannot be farmed).
import { h, ico, tabs, toast, openSheet, confirmSheet } from '../ui/dom.js';
import * as C from '../features/mini-games/chess.js';
import * as K from '../features/mini-games/checkers.js';
import * as T from '../features/mini-games/tictactoe.js';
import * as SL from '../features/mini-games/sliding.js';
import * as SU from '../features/mini-games/sudoku.js';
import * as CU from '../features/mini-games/cube.js';
import { hasFeature } from '../engine/reward-engine.js';

let current = null;
const G = { chess: null, checkers: null, ttt: null, slide: null, sudoku: null, cube: null };
const btn = (cls, text, fn, extra) => h('button', { class: `btn ${cls}`, onclick: fn, ...extra }, text);

// ------------------------------------------------------------------ chess
function chessView(A) {
  const g = G.chess || (G.chess = { st: C.fromFen(C.START), sel: null, last: null, mode: 'ai', level: 1, over: null, busy: false });
  const hard = hasFeature(A.S(), 'chess_hard');
  const legal = C.legalMoves(g.st), checked = C.inCheck(g.st, g.st.turn);
  const hints = g.sel != null ? legal.filter((m) => m.from === g.sel).map((m) => m.to) : [];
  const finish = () => { const s = C.status(g.st); g.over = s === 'checkmate' ? `Checkmate. ${g.st.turn === 'w' ? 'Black' : 'White'} wins.` : s === 'stalemate' ? 'Stalemate: a draw.' : null; };
  const ai = () => { g.busy = true; A.render(); setTimeout(() => { const m = C.aiMove(g.st, g.level + (g.level === 3 ? 0 : 0)); if (m) { g.st = C.apply(g.st, m); g.last = [m.from, m.to]; finish(); } g.busy = false; A.render(); }, 60); };
  const click = (i) => {
    if (g.over || g.busy || (g.mode === 'ai' && g.st.turn === 'b')) return;
    const m = legal.find((x) => x.from === g.sel && x.to === i);
    if (m) { g.st = C.apply(g.st, m); g.last = [m.from, m.to]; g.sel = null; finish(); if (!g.over && g.mode === 'ai') return ai(); return A.render(); }
    g.sel = g.st.b[i] && g.st.b[i][0] === g.st.turn ? i : null; A.render();
  };
  const kingIdx = g.st.b.indexOf(g.st.turn + 'K');
  return h('div', { class: 'stack' },
    h('div', { class: 'row wrap' }, h('div', { class: 'seg' }, h('button', { 'aria-pressed': String(g.mode === 'ai'), onclick: () => { g.mode = 'ai'; A.render(); } }, 'vs Computer'), h('button', { 'aria-pressed': String(g.mode === 'two'), onclick: () => { g.mode = 'two'; A.render(); } }, '2 players')),
      g.mode === 'ai' ? h('div', { class: 'seg' }, [[1, 'Easy'], [2, 'Normal'], [3, hard ? 'Hard' : 'Hard 🔒']].map(([lv, l]) => h('button', { 'aria-pressed': String(g.level === lv), onclick: () => { if (lv === 3 && !hard) return toast('Hard needs the Strategy Codex (Intelligence reward).', 'error'); g.level = lv; A.render(); } }, l))) : null),
    h('div', { class: 'hint' }, g.over || (g.busy ? 'Computer is thinking…' : `${g.st.turn === 'w' ? 'White' : 'Black'} to move${checked ? ' · CHECK' : ''}`)),
    h('div', { class: 'board chess' }, g.st.b.map((p, i) => h('button', { class: `sq${(i + (i >> 3)) % 2 ? ' dark' : ''}${g.sel === i ? ' sel' : ''}${hints.includes(i) ? ' hint' : ''}${g.last?.includes(i) ? ' last' : ''}${checked && i === kingIdx ? ' check' : ''}`, 'aria-label': `${'abcdefgh'[i & 7]}${8 - (i >> 3)} ${p || 'empty'}`, onclick: () => click(i) }, p ? h('span', { class: p[0] }, C.GLYPH[p[1]]) : null))),
    h('div', { class: 'row' }, btn('', 'New game', () => { G.chess = null; A.render(); }), g.over ? null : h('span', { class: 'hint' }, 'Pawns promote to queens automatically.')));
}
// ------------------------------------------------------------------ checkers
function checkersView(A) {
  const g = G.checkers || (G.checkers = { st: K.initial(), sel: null, over: null, busy: false });
  const legal = K.legalMoves(g.st), hints = g.sel != null ? legal.filter((m) => m.from === g.sel).map((m) => m.to) : [];
  const after = () => { const w = K.winner(g.st); if (w) g.over = w === 'r' ? 'You win!' : 'The computer wins.'; };
  const ai = () => { g.busy = true; A.render(); const step = () => { if (g.st.turn !== 'b' || g.over) { g.busy = false; A.render(); return; } const m = K.aiMove(g.st); if (!m) { after(); g.busy = false; A.render(); return; } g.st = K.apply(g.st, m); after(); A.render(); setTimeout(step, 350); }; setTimeout(step, 350); };
  const click = (i) => {
    if (g.over || g.busy || g.st.turn !== 'r') return;
    const m = legal.find((x) => x.from === g.sel && x.to === i);
    if (m) { g.st = K.apply(g.st, m); g.sel = g.st.chain; after(); if (!g.over && g.st.turn === 'b') return ai(); return A.render(); }
    const p = g.st.b[i]; g.sel = p && p.toLowerCase() === 'r' && legal.some((x) => x.from === i) ? i : null; A.render();
  };
  return h('div', { class: 'stack' }, h('div', { class: 'hint' }, g.over || (g.busy ? 'Computer is moving…' : g.st.chain != null ? 'Keep jumping!' : 'You are red (bottom). Captures are mandatory.')),
    h('div', { class: 'board checkers' }, g.st.b.map((p, i) => h('button', { class: `sq${((i >> 3) + (i & 7)) % 2 ? ' dark' : ''}${g.sel === i ? ' sel' : ''}${hints.includes(i) ? ' hint' : ''}`, 'aria-label': `square ${i} ${p || 'empty'}`, onclick: () => click(i) }, p ? h('span', { class: `pc ${p.toLowerCase() === 'r' ? 'w' : 'b'}` }, p === p.toUpperCase() ? '♛' : '') : null))),
    btn('', 'New game', () => { G.checkers = null; A.render(); }));
}
// ------------------------------------------------------------------ tic-tac-toe
function tttView(A) {
  const g = G.ttt || (G.ttt = { b: Array(9).fill(null), easy: false, score: { w: 0, d: 0, l: 0 } });
  const w = T.winner(g.b);
  const click = (i) => {
    if (g.b[i] || T.winner(g.b)) return; g.b[i] = 'X'; let r = T.winner(g.b);
    if (!r) { const free = g.b.map((v, k) => (v ? -1 : k)).filter((k) => k >= 0); g.b[g.easy ? free[Math.floor(Math.random() * free.length)] : T.bestMove(g.b, 'O')] = 'O'; r = T.winner(g.b); }
    if (r) g.score[r === 'X' ? 'w' : r === 'O' ? 'l' : 'd']++; A.render();
  };
  return h('div', { class: 'stack' }, h('div', { class: 'row spread' }, h('div', { class: 'seg' }, h('button', { 'aria-pressed': String(!g.easy), onclick: () => { g.easy = false; A.render(); } }, 'Perfect AI'), h('button', { 'aria-pressed': String(g.easy), onclick: () => { g.easy = true; A.render(); } }, 'Casual')), h('span', { class: 'mono hint' }, `W ${g.score.w} · D ${g.score.d} · L ${g.score.l}`)),
    h('div', { class: 'hint' }, w === 'X' ? 'You win!' : w === 'O' ? 'The computer wins.' : w === 'draw' ? 'A draw.' : 'You are X.'),
    h('div', { class: 'board tt' }, g.b.map((v, i) => h('button', { class: 'sq', 'aria-label': `cell ${i + 1} ${v || 'empty'}`, onclick: () => click(i), style: { color: v === 'X' ? 'var(--accent2)' : 'var(--romance)' } }, v))), btn('', 'Next round', () => { g.b = Array(9).fill(null); A.render(); }));
}
// ------------------------------------------------------------------ sliding puzzle
function slideView(A) {
  const g = G.slide || (G.slide = { n: 3, b: null, moves: 0 });
  if (!g.b) g.b = SL.scramble(g.n);
  const done = SL.isSolved(g.n, g.b);
  return h('div', { class: 'stack' }, h('div', { class: 'row spread' }, h('div', { class: 'seg' }, [3, 4].map((n) => h('button', { 'aria-pressed': String(g.n === n), onclick: () => { g.n = n; g.b = null; g.moves = 0; A.render(); } }, `${n}×${n}`))), h('span', { class: 'mono' }, `Moves ${g.moves}`)),
    h('div', { class: 'hint' }, done ? `Solved in ${g.moves} moves!` : 'Slide tiles into order, 1 to ' + (g.n * g.n - 1)),
    h('div', { class: 'board slide', style: { gridTemplateColumns: `repeat(${g.n}, 1fr)` } }, g.b.map((v, i) => h('button', { class: `sq${v ? '' : ' empty'}`, disabled: !v, onclick: () => { if (!done && SL.slide(g.n, g.b, i)) { g.moves++; A.render(); } } }, v || ''))), btn('', 'Shuffle', () => { g.b = null; g.moves = 0; A.render(); }));
}
// ------------------------------------------------------------------ sudoku
function sudokuView(A) {
  const g = G.sudoku || (G.sudoku = { d: 36, data: null, grid: null, sel: null, check: false, busy: false });
  const expert = hasFeature(A.S(), 'sudoku_expert');
  const make = (d) => { g.d = d; g.busy = true; g.data = null; A.render(); setTimeout(() => { g.data = SU.generate(d, Date.now()); g.grid = g.data.puzzle.slice(); g.sel = null; g.check = false; g.busy = false; A.render(); }, 30); };
  if (!g.data && !g.busy) { make(g.d); }
  const diffs = [[40, 'Easy'], [32, 'Medium'], [27, 'Hard'], [23, expert ? 'Expert' : 'Expert 🔒']];
  if (!g.data) return h('div', { class: 'stack' }, h('div', { class: 'hint' }, 'Generating a puzzle with exactly one solution…'));
  const solvedNow = g.grid.every((v, i) => v === g.data.solution[i]);
  return h('div', { class: 'stack' }, h('div', { class: 'seg' }, diffs.map(([d, l]) => h('button', { 'aria-pressed': String(g.d === d), onclick: () => { if (d === 23 && !expert) return toast('Expert needs the Expert Grid Sigil (Intelligence reward).', 'error'); make(d); } }, l))),
    h('div', { class: 'hint' }, solvedNow ? 'Solved! Beautiful.' : 'Tap a cell, then a number.'),
    h('div', { class: 'sudoku' }, g.grid.map((v, i) => { const fixed = !!g.data.puzzle[i], bad = g.check && v && !fixed && v !== g.data.solution[i]; return h('button', { class: `sq${fixed ? ' fixed' : ''}${bad ? ' bad' : ''}${g.sel === i ? ' sel' : ''}${i % 9 === 2 || i % 9 === 5 ? ' bx' : ''}${(i / 9 | 0) === 2 || (i / 9 | 0) === 5 ? ' by' : ''}`, onclick: () => { g.sel = i; A.render(); } }, v || ''); })),
    h('div', { class: 'numpad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('button', { onclick: () => { if (g.sel != null && !g.data.puzzle[g.sel]) { g.grid[g.sel] = n; A.render(); } } }, n)), h('button', { onclick: () => { if (g.sel != null && !g.data.puzzle[g.sel]) { g.grid[g.sel] = 0; A.render(); } }, 'aria-label': 'Erase' }, '⌫')),
    h('div', { class: 'row' }, btn('', g.check ? 'Hide mistakes' : 'Show mistakes', () => { g.check = !g.check; A.render(); }), btn('', 'New puzzle', () => make(g.d))));
}
// ------------------------------------------------------------------ cube core
const CUBE_MOVES = [['U', "U'", 'D', "D'", 'L', "L'"], ['R', "R'", 'F', "F'", 'B', "B'"], ['E', "E'", 'M', "M'", 'S', "S'"]];
function cubeView(A) {
  const g = G.cube || (G.cube = { c: CU.solvedCube(), moves: 0, rx: -25, ry: -35, hist: [] });
  const grids = Object.fromEntries(['U', 'D', 'F', 'B', 'R', 'L'].map((f) => [f, CU.faceGrid(g.c, f)]));
  const cell = (k) => h('i', { style: { background: CU.COLORS[k] } });
  const face = (f) => h('div', { class: 'f' }, grids[f].map(cell));
  const T3 = { F: 'rotateY(0deg)', B: 'rotateY(180deg)', R: 'rotateY(90deg)', L: 'rotateY(-90deg)', U: 'rotateX(90deg)', D: 'rotateX(-90deg)' };
  const cube3d = h('div', { class: 'cube3d', style: { transform: `rotateX(${g.rx}deg) rotateY(${g.ry}deg)` } }, Object.keys(T3).map((f) => h('div', { class: 'cube-face', style: { transform: `${T3[f]} translateZ(95px)` } }, grids[f].map(cell))));
  let sx = 0, sy = 0, drag = false;
  const wrap = h('div', { class: 'cube-wrap', 'aria-label': 'Drag to rotate the cube', onpointerdown: (e) => { drag = true; sx = e.clientX; sy = e.clientY; wrap.setPointerCapture(e.pointerId); }, onpointermove: (e) => { if (!drag) return; g.ry += (e.clientX - sx) * 0.6; g.rx -= (e.clientY - sy) * 0.6; sx = e.clientX; sy = e.clientY; cube3d.style.transform = `rotateX(${g.rx}deg) rotateY(${g.ry}deg)`; }, onpointerup: () => { drag = false; } }, cube3d);
  const mv = (m) => () => { g.c = CU.move(g.c, m); g.moves++; g.hist.push(m); A.render(); };
  return h('div', { class: 'stack' }, h('div', { class: 'hint' }, CU.isSolved(g.c) && g.moves ? `Solved in ${g.moves} moves!` : 'A real 3×3×3 cube. Drag the cube to look around; all six faces are shown in the net below.'), wrap,
    h('div', { class: 'net' }, h('div', { class: 'gap' }), face('U'), h('div', { class: 'gap' }), h('div', { class: 'gap' }), face('L'), face('F'), face('R'), face('B'), h('div', { class: 'gap' }), face('D'), h('div', { class: 'gap' }), h('div', { class: 'gap' })),
    ...CUBE_MOVES.map((row) => h('div', { class: 'cubebtns' }, row.map((m) => h('button', { onclick: mv(m), 'aria-label': `Turn ${m}` }, m)))),
    h('p', { class: 'hint' }, 'Top row: U D L · Middle: R F B · Bottom: slices E M S. An apostrophe means the opposite direction.'),
    h('div', { class: 'row wrap' }, btn('', 'Undo', () => { const m = g.hist.pop(); if (m) { g.c = CU.move(g.c, CU.inverse(m)); g.moves = Math.max(0, g.moves - 1); A.render(); } }), btn('', 'Scramble', () => { g.c = CU.apply(CU.solvedCube(), CU.scramble(Math.random, 22)); g.moves = 0; g.hist = []; A.render(); }), btn('', 'Reset', () => { G.cube = null; A.render(); })));
}

const GAMES = [['chess', 'Chess', chessView, 'game'], ['checkers', 'Checkers', checkersView, 'game'], ['ttt', 'Tic-tac-toe', tttView, 'game'], ['slide', 'Sliding puzzle', slideView, 'game'], ['sudoku', 'Sudoku', sudokuView, 'intelligence'], ['cube', 'Cube Core', cubeView, 'gem']];
export default function arcade(A) {
  if (!current) return h('div', { class: 'stack rise' }, h('p', { class: 'muted' }, 'Relax. Games never give XP, levels or titles, so there is nothing to farm.'), h('div', { class: 'arcade' }, GAMES.map(([id, name, , icon]) => h('button', { onclick: () => { current = id; A.render(); } }, ico(icon), h('b', null, name)))));
  const [, name, view] = GAMES.find((g) => g[0] === current);
  return h('div', { class: 'stack rise' }, h('div', { class: 'row' }, h('button', { class: 'icon-btn', 'aria-label': 'All games', onclick: () => { current = null; A.render(); } }, ico('back')), h('h2', null, name)), view(A));
}
