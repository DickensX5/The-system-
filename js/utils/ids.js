/** Unique id from the saved global counter (never repeats, survives reloads). */
export function nid(s, prefix = 'id') { const n = s.seq++; return `${prefix}-${n.toString(36)}`; }
