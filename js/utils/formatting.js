export function fmtInt(n) { return Math.trunc(Number(n) || 0).toLocaleString('en-US'); }
export function fmtTSh(n) { return 'TSh ' + fmtInt(n); }
export function pct(a, b) { return b <= 0 ? 0 : Math.max(0, Math.min(100, (a / b) * 100)); }
export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
export function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
export function fmtBytes(b) {
  if (!Number.isFinite(b)) return 'unknown';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
/** 'The Money Keeper' -> 'the-money-keeper' */
export function slug(s) { return String(s).toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export function rarityIndex(r) { return Math.max(0, RARITIES.indexOf(r)); }
export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
