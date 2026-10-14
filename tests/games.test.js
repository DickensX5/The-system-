import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/features/mini-games/chess.js';
import * as K from '../js/features/mini-games/checkers.js';
import * as T from '../js/features/mini-games/tictactoe.js';
import * as SL from '../js/features/mini-games/sliding.js';
import * as SU from '../js/features/mini-games/sudoku.js';
import * as CU from '../js/features/mini-games/cube.js';
import { mulberry32 } from '../js/utils/rng.js';

test('chess: perft matches published values (start position)', () => {
  const st = C.fromFen(C.START);
  assert.equal(C.perft(st, 1), 20); assert.equal(C.perft(st, 2), 400); assert.equal(C.perft(st, 3), 8902);
});
test('chess: perft on Kiwipete (castling, en passant, promotions, pins)', () => {
  const st = C.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(C.perft(st, 1), 48); assert.equal(C.perft(st, 2), 2039);
});
test('chess: checkmate and stalemate detection, AI returns a legal move', () => {
  assert.equal(C.status(C.fromFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), 'checkmate');   // fool's mate
  assert.equal(C.status(C.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
  const st = C.fromFen(C.START); const m = C.aiMove(st, 2); assert.ok(C.legalMoves(st).some((x) => x.from === m.from && x.to === m.to));
});
test('checkers: initial position, mandatory capture, multi-jump chain, king promotion', () => {
  const st = K.initial(); assert.equal(st.b.filter((p) => p === 'r').length, 12); assert.equal(K.legalMoves(st).length, 7);
  const b = Array(64).fill(null); b[5 * 8 + 2] = 'r'; b[4 * 8 + 3] = 'b'; b[2 * 8 + 5] = 'b'; b[7 * 8 + 0] = 'b';
  let s = { b, turn: 'r', chain: null }; const mv = K.legalMoves(s); assert.ok(mv.every((m) => m.cap != null) && mv.length === 1);
  s = K.apply(s, mv[0]); assert.equal(s.turn, 'r'); assert.equal(s.chain, 3 * 8 + 4);                    // must continue jumping
  s = K.apply(s, K.legalMoves(s)[0]); assert.equal(s.turn, 'b');
  const k = Array(64).fill(null); k[1 * 8 + 2] = 'r'; k[7 * 8 + 6] = 'b'; const after = K.apply({ b: k, turn: 'r', chain: null }, { from: 10, to: 3 }); assert.equal(after.b[3], 'R');
});
test('tic-tac-toe: perfect AI never loses against any opponent line', () => {
  const play = (b, turn) => { const w = T.winner(b); if (w) { assert.notEqual(w, 'X'); return; } if (turn === 'O') { b[T.bestMove(b, 'O')] = 'O'; play(b, 'X'); } else for (let i = 0; i < 9; i++) if (!b[i]) { const c = b.slice(); c[i] = 'X'; play(c, 'O'); } };
  play(Array(9).fill(null), 'X');
});
test('sliding puzzle: scrambles are solvable and solved detection works', () => {
  for (const n of [3, 4]) for (let k = 0; k < 20; k++) { const b = SL.scramble(n); assert.ok(SL.solvable(n, b)); }
  assert.ok(SL.isSolved(3, SL.solved(3))); const b = SL.solved(3); assert.ok(SL.slide(3, b, 7)); assert.ok(!SL.slide(3, b, 0)); assert.ok(!SL.isSolved(3, b));
});
test('sudoku: generated puzzles have exactly one solution and match the stored solution', () => {
  const { puzzle, solution } = SU.generate(40, 12345);
  assert.equal(SU.solveCount(puzzle, 2), 1);
  assert.ok(solution.every((v, i) => SU.valid(solution, i, v)));
  assert.ok(puzzle.every((v, i) => !v || v === solution[i]));
});
test('cube: identities (4x any move, move+inverse, (R U R\' U\')^6) and scramble/undo', () => {
  const s = CU.solvedCube(); assert.equal(s.length, 54); assert.ok(CU.isSolved(s));
  for (const m of Object.keys(CU.MOVES)) { assert.ok(!CU.isSolved(CU.move(s, m)), m); assert.ok(CU.isSolved(CU.apply(s, [m, m, m, m])), m); assert.ok(CU.isSolved(CU.apply(s, [m, CU.inverse(m)])), m); }
  assert.ok(CU.isSolved(CU.apply(s, Array(6).fill("R U R' U'").join(' '))));
  const sc = CU.scramble(mulberry32(7), 25); assert.equal(sc.length, 25); const scr = CU.apply(s, sc); assert.ok(!CU.isSolved(scr));
  assert.ok(CU.isSolved(CU.apply(scr, sc.slice().reverse().map(CU.inverse))));
  const g = CU.faceGrid(s, 'F'); assert.ok(g.every((x) => x === 'F'));
  const after = CU.faceGrid(CU.move(s, 'U'), 'F'); assert.deepEqual(after.slice(0, 3), ['R', 'R', 'R']);       // U turn clockwise: front top row takes the right face colour
});
