// The Store owns the one saved-state document.
// commit() = apply a mutation to a CLONE, run engine finalizers, persist, and only then swap it in.
// Commits are serialised in a queue, so a rapid double-tap re-validates against the already-updated state.
import { createInitialState, migrate } from './migrations.js';
import { StorageError, RuleError } from '../utils/validation.js';
import { dateKey } from '../utils/dates.js';
import { bus } from './event-bus.js';

export const NO_CHANGE = Symbol('no-change');
const KEY = 'state';

export class Store {
  constructor({ adapter, now = () => Date.now(), finalize = null } = {}) {
    this.adapter = adapter; this.now = now; this.finalize = finalize;
    this.state = null; this.queue = Promise.resolve(); this.loadNote = null; this.lastError = null;
  }

  async init() {
    const raw = await this.adapter.getRaw(KEY);
    if (raw == null) { this.state = createInitialState(this.now()); return this.state; }
    try {
      this.state = migrate(JSON.parse(raw));
    } catch (e) {
      // Never silently wipe: keep the unreadable text under its own key before starting fresh.
      const backupKey = `corrupt-${this.now()}`;
      try { await this.adapter.putRaw(backupKey, raw); } catch { /* best effort */ }
      this.loadNote = `Your saved data could not be read (${e.message}). A raw copy was kept as "${backupKey}". Starting with fresh data.`;
      this.state = createInitialState(this.now());
    }
    return this.state;
  }

  /** Run `fn(draft, ctx)`; it may throw RuleError (nothing changes) or return NO_CHANGE. */
  commit(label, fn) {
    const run = async () => {
      const now = this.now();
      const draft = structuredClone(this.state);
      const ctx = { now, label };
      const result = fn(draft, ctx);
      if (result === NO_CHANGE) return undefined;
      if (this.finalize) this.finalize(draft, ctx);
      draft.updatedAt = now;
      try {
        // rolling safety copy of the previous document once per day
        const today = dateKey(now);
        if (draft.settings.lastBackupDay !== today) {
          draft.settings.lastBackupDay = today;
          const prev = await this.adapter.getRaw(KEY);
          if (prev) await this.adapter.putRaw('state.backup', prev);
        }
        await this.adapter.putRaw(KEY, JSON.stringify(draft));
      } catch (e) {
        this.lastError = e;
        bus.emit('storage-error', e);
        throw e instanceof StorageError ? e : new StorageError('Could not save your progress. Nothing was changed.', e);
      }
      this.state = draft; this.lastError = null;
      bus.emit('change', { label, result });
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** Replace everything (import). Validated by migrate() first. */
  async replaceAll(obj) {
    const s = migrate(structuredClone(obj));
    return this.commit('import', (draft) => { for (const k of Object.keys(draft)) delete draft[k]; Object.assign(draft, s); });
  }
  exportJson() { return JSON.stringify(this.state, null, 1); }
}
export { RuleError };
