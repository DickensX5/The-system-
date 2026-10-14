// Tiny pub/sub used for 'change', 'toast', 'storage-error', etc.
export class EventBus {
  constructor() { this.m = new Map(); }
  on(evt, fn) { if (!this.m.has(evt)) this.m.set(evt, new Set()); this.m.get(evt).add(fn); return () => this.off(evt, fn); }
  off(evt, fn) { this.m.get(evt)?.delete(fn); }
  emit(evt, payload) { for (const fn of [...(this.m.get(evt) || [])]) { try { fn(payload); } catch (e) { console.error('[bus]', evt, e); } } }
}
export const bus = new EventBus();
