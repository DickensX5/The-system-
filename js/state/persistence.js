// Storage adapters. IndexedDB (structured state + image blobs) -> localStorage fallback (state only) -> memory.
// Every write resolves ONLY after the browser confirms the transaction, so callers never "pretend" data was saved.
import { StorageError } from '../utils/validation.js';

const DB_NAME = 'the-system';
const DB_VERSION = 1;

export class MemoryAdapter {
  constructor() { this.kv = new Map(); this.blobs = new Map(); this.persistent = false; this.kind = 'memory'; this.failNext = false; }
  async init() { return this; }
  async getRaw(key) { return this.kv.has(key) ? this.kv.get(key) : null; }
  async putRaw(key, text) { if (this.failNext) { this.failNext = false; throw new StorageError('Simulated storage failure'); } this.kv.set(key, text); }
  async putBlob(id, blob, meta) { this.blobs.set(id, { blob, meta }); }
  async getBlob(id) { return this.blobs.get(id) || null; }
  async deleteBlob(id) { this.blobs.delete(id); }
  async listBlobs() { return [...this.blobs.entries()].map(([id, v]) => ({ id, meta: v.meta })); }
  async estimate() { let n = 0; for (const v of this.kv.values()) n += v.length; return { usage: n, quota: NaN, persisted: false }; }
  async requestPersist() { return false; }
}

export class LocalStorageAdapter {
  constructor() { this.persistent = true; this.kind = 'localStorage'; }
  async init() { const k = '__ts_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return this; }
  async getRaw(key) { return localStorage.getItem('ts:' + key); }
  async putRaw(key, text) { try { localStorage.setItem('ts:' + key, text); } catch (e) { throw new StorageError('Storage is full or blocked.', e); } }
  async putBlob() { throw new StorageError('Image storage needs IndexedDB, which is not available here.'); }
  async getBlob() { return null; }
  async deleteBlob() {}
  async listBlobs() { return []; }
  async estimate() { let n = 0; for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i)) || '').length; return { usage: n, quota: 5 * 1048576, persisted: false }; }
  async requestPersist() { return false; }
}

export class IdbAdapter {
  constructor() { this.db = null; this.persistent = true; this.kind = 'indexedDB'; }
  init() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      req.onsuccess = () => { this.db = req.result; this.db.onversionchange = () => this.db.close(); resolve(this); };
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }
  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      let out;
      let tx;
      try { tx = this.db.transaction(store, mode); } catch (e) { return reject(new StorageError('Could not open storage.', e)); }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(new StorageError('Storage write failed (device may be full).', tx.error));
      tx.onabort = () => reject(new StorageError('Storage write was aborted (device may be full).', tx.error));
      try { const r = fn(tx.objectStore(store)); if (r) r.onsuccess = () => { out = r.result; }; } catch (e) { reject(new StorageError('Storage error.', e)); }
    });
  }
  getRaw(key) { return this._tx('kv', 'readonly', (s) => s.get(key)).then((v) => (v === undefined ? null : v)); }
  putRaw(key, text) { return this._tx('kv', 'readwrite', (s) => s.put(text, key)); }
  putBlob(id, blob, meta) { return this._tx('blobs', 'readwrite', (s) => s.put({ blob, meta }, id)); }
  getBlob(id) { return this._tx('blobs', 'readonly', (s) => s.get(id)).then((v) => v || null); }
  deleteBlob(id) { return this._tx('blobs', 'readwrite', (s) => s.delete(id)); }
  async listBlobs() {
    const keys = await this._tx('blobs', 'readonly', (s) => s.getAllKeys());
    return (keys || []).map((id) => ({ id }));
  }
  async estimate() {
    try { const e = await navigator.storage.estimate(); return { usage: e.usage, quota: e.quota, persisted: await navigator.storage.persisted?.() }; } catch { return { usage: NaN, quota: NaN, persisted: false }; }
  }
  async requestPersist() { try { return await navigator.storage.persist(); } catch { return false; } }
}

/** Pick the best available adapter. Returns {adapter, note}. */
export async function openBestAdapter() {
  try { return { adapter: await new IdbAdapter().init(), note: null }; } catch (e1) {
    try { return { adapter: await new LocalStorageAdapter().init(), note: 'IndexedDB is unavailable: progress is saved in basic storage and image galleries are disabled.' }; } catch (e2) {
      return { adapter: await new MemoryAdapter().init(), note: 'Storage is unavailable in this browser mode. Progress will be LOST when you close the app.' };
    }
  }
}
