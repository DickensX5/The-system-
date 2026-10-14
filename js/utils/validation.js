// Rule violations are thrown as RuleError so the UI can show a precise, honest message
// and the store can guarantee that NOTHING was changed.
export class RuleError extends Error {
  constructor(message, code = 'rule') { super(message); this.name = 'RuleError'; this.code = code; }
}
export class StorageError extends Error {
  constructor(message, cause) { super(message); this.name = 'StorageError'; this.cause = cause; }
}
export function rule(cond, message, code) { if (!cond) throw new RuleError(message, code); }
export function isInt(n) { return Number.isInteger(n); }
export function posInt(n, label = 'Amount') {
  rule(typeof n === 'number' && Number.isInteger(n) && n > 0, `${label} must be a whole number above zero.`, 'amount');
  rule(n <= 1e12, `${label} is too large.`, 'amount');
  return n;
}
/** Trim + collapse control chars + length limit. Never trusts rendered HTML (UI uses textContent). */
export function cleanText(s, max = 200) {
  return String(s ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);
}
export function wordCount(s) { return (String(s).trim().match(/\S+/g) || []).length; }
