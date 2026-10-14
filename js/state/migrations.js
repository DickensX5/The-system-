// Schema, defaults, validation and migrations for the single saved-state document.
import { StorageError } from '../utils/validation.js';

export const SCHEMA = 1;

export function createInitialState(now = Date.now()) {
  return {
    schema: SCHEMA,
    createdAt: now,
    updatedAt: now,
    seq: 1,                                   // global counter -> unique ids (nid)
    xp: { physique: 0, intelligence: 0, romance: 0 },   // Financial XP is DERIVED from balance (see FORMULAS.md)
    currency: { gold: 0, hearts: 0 },         // app-only currencies, separate from XP and from real money
    maxLevel: { financial: 1, physique: 1, intelligence: 1, romance: 1, overall: 1, band: 'band_unawakened' }, // peaks, for one-time level-up rewards
    titles: { unlocked: {}, equipped: null, revoked: {} },   // unlocked = ever unlocked; equipped must be currently eligible
    summon: { log: [], used: 0, requests: {} },              // log: [{id,at,from,to,amount}]; used = unlock charges spent
    itemXp: {},                               // 'YYYY-MM-DD:romance' -> XP gained from consumable items today
    fin: {
      settings: { expected: 6000, workdays: [1, 2, 3, 4, 5, 6], restDates: [], trackStart: null, explainLimit: 4 },
      tx: [],                                  // {id,at,date,type:start|income|expense|penalty,amount,note,voided?}
      explanations: {},                        // date -> {id,at,reason,text}
      penalties: {},                           // date -> {id,date,amount,status:pending|applied|cleared,...}
      xpOut: 0,                                // cumulative Financial XP summoned away
    },
    phy: { days: {} },                         // date -> {level, done:{ex:n}, awarded:{ex:true}, timer:{ex:{since,ms}}}
    int: { daily: {}, custom: { active: null, history: [] }, pause: null, lastPauseEnd: 0, xpDay: {}, quizzes: {} },
    rom: { quests: [], xpDay: {}, quizzes: {} },
    penalties: {},                             // id -> penalty (Intelligence/Romance), see penalty-engine
    inv: { items: {}, lost: [], emblem: null, opened: {} },   // items: id -> {count, at}
    grants: {},                                // 'lvl:quest:N' -> {id,quest,level,currency,amount,box,claimed,claimedAt}
    market: { txs: [], wishlist: [], exchanged: {} },
    inbox: { events: [], readAt: 0 },
    gallery: { physique: [], romance: [] },   // metadata only; image blobs live in IndexedDB
    settings: { sound: false, motion: 'auto', introSeen: false, lastBackupDay: null },
  };
}

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

/** Fill any missing keys from defaults (new versions add fields) without touching existing data. */
export function fillDefaults(defaults, obj) {
  for (const k of Object.keys(defaults)) {
    if (!(k in obj) || obj[k] === undefined || obj[k] === null && defaults[k] !== null) obj[k] = structuredClone(defaults[k]);
    else if (isObj(defaults[k]) && isObj(obj[k])) fillDefaults(defaults[k], obj[k]);
  }
  return obj;
}

/** Structural sanity check. Throws with a clear reason; never silently "fixes" bad money/XP numbers. */
export function validateState(s) {
  const bad = (m) => { throw new StorageError('Saved data is invalid: ' + m); };
  if (!isObj(s)) bad('not an object');
  if (typeof s.schema !== 'number') bad('missing schema');
  for (const k of ['xp', 'currency', 'fin', 'phy', 'int', 'rom', 'inv', 'grants', 'market', 'inbox', 'titles', 'summon', 'penalties']) if (!isObj(s[k])) bad(`missing "${k}"`);
  for (const q of ['physique', 'intelligence', 'romance']) if (!Number.isFinite(s.xp[q]) || s.xp[q] < 0) bad(`bad XP for ${q}`);
  for (const c of ['gold', 'hearts']) if (!Number.isFinite(s.currency[c]) || s.currency[c] < 0) bad(`bad currency ${c}`);
  if (!Array.isArray(s.fin.tx) || !Array.isArray(s.inbox.events) || !Array.isArray(s.rom.quests)) bad('lists missing');
  return true;
}

const STEPS = {
  // 1: (s) => {...}  <- add future migrations here, keyed by the schema they upgrade FROM
};

export function migrate(raw) {
  if (!isObj(raw) || typeof raw.schema !== 'number') throw new StorageError('Saved data has no schema number.');
  if (raw.schema > SCHEMA) throw new StorageError('Saved data was made by a newer version of THE SYSTEM. Update the app before opening it.');
  let s = raw;
  while (s.schema < SCHEMA) {
    const step = STEPS[s.schema];
    if (!step) throw new StorageError(`No migration from schema ${s.schema}.`);
    s = step(s); s.schema = s.schema + 1;
  }
  fillDefaults(createInitialState(s.createdAt || Date.now()), s);
  validateState(s);
  return s;
}
