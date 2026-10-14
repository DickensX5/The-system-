// Shared test helpers: a real Store over the in-memory adapter with a controllable clock.
import { Store } from '../js/state/store.js';
import { MemoryAdapter } from '../js/state/persistence.js';
import { finalize, overallLevel } from '../js/engine/progression-engine.js';

export const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi, 0).getTime();
export async function mkStore(start = at(2026, 10, 12)) {
  const clock = { t: start };
  const adapter = new MemoryAdapter();
  const store = new Store({ adapter, now: () => clock.t, finalize });
  await store.init();
  return { store, clock, adapter, S: () => store.state, ov: () => overallLevel(store.state) };
}
export async function rejects(promise, codeOrText) {
  try { await promise; } catch (e) { if (!codeOrText || e.code === codeOrText || String(e.message).includes(codeOrText)) return e; throw new Error(`Wrong error: ${e.code} / ${e.message}`); }
  throw new Error('Expected a rejection but it succeeded');
}
