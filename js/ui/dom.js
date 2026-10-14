// Tiny DOM toolkit. User-supplied text is ALWAYS inserted as text nodes (never innerHTML), so it cannot inject markup.
import { formatCountdown } from '../utils/dates.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function ico(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', ('ico ' + cls).trim()); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', `#i-${name}`); s.append(u); return s;
}
export const KIND_ICON = { emblem: 'badge', collectible: 'gem', lootbox: 'chest', key: 'key', consumable: 'bolt', certificate: 'scroll', currency: 'financial' };
export const QUEST_ICON = { financial: 'financial', physique: 'physique', intelligence: 'intelligence', romance: 'romance' };

// ---- toasts -----------------------------------------------------------------------------------
export function toast(msg, kind = 'info', ms = 4500) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, ico(kind === 'error' ? 'warn' : kind === 'good' ? 'check' : kind === 'level' ? 'bolt' : 'info'), h('div', { class: 'grow' }, msg));
  box.append(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), ms);
  return t;
}

// ---- sheets / modals ----------------------------------------------------------------------------
let sheetStack = [];
export function openSheet(build, { onClose } = {}) {
  const overlay = document.getElementById('overlay');
  const wrap = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const api = { el: wrap, close(result) { if (!sheetStack.includes(api)) return; sheetStack = sheetStack.filter((x) => x !== api); wrap.remove(); backdrop.remove(); if (!sheetStack.length) overlay.hidden = true; document.removeEventListener('keydown', onKey); onClose?.(result); }, set(...c) { wrap.replaceChildren(...c.flat()); } };
  const backdrop = h('div', { style: { position: 'absolute', inset: 0 }, onclick: () => api.close() });
  const onKey = (e) => { if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === api) api.close(); };
  document.addEventListener('keydown', onKey);
  overlay.hidden = false; overlay.append(backdrop, wrap); wrap.style.position = 'relative';
  sheetStack.push(api);
  build(api);
  const f = wrap.querySelector('input,textarea,select,button.primary'); if (f && matchMedia('(pointer:fine)').matches) f.focus();
  return api;
}
export function closeAllSheets() { [...sheetStack].forEach((s) => s.close()); }
export function confirmSheet({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return new Promise((res) => {
    let result = false;
    openSheet((s) => s.set(h('h2', null, title), h('div', { class: 'stack' }, ...[].concat(body).map((b) => (typeof b === 'string' ? h('p', null, b) : b))),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, cancelText), h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { result = true; s.close(); } }, confirmText))), { onClose: () => res(result) });
  });
}
/** Runs async fn once per click and disables the button meanwhile (the engine is also idempotent). */
export function guarded(fn) {
  let busy = false;
  return async (ev) => {
    if (busy) return; busy = true;
    const b = ev?.currentTarget; if (b) b.disabled = true;
    try { await fn(ev); } finally { busy = false; if (b && b.isConnected) b.disabled = false; }
  };
}

// ---- small components ----------------------------------------------------------------------------
export function bar(q, pct, thick = false) { const i = h('i'); requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = Math.max(0, Math.min(100, pct)) + '%'; })); return h('div', { class: 'bar' + (thick ? ' thick' : ''), 'data-q': q, role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, i); }
export function chip(text, cls = '') { return h('span', { class: `chip ${cls}` }, text); }
export function empty(icon, title, sub) { return h('div', { class: 'empty' }, ico(icon), h('div', null, title), sub && h('div', { class: 'hint' }, sub)); }
export function field(label, input, hint) { return h('div', { class: 'field' }, h('label', null, label), input, hint && h('div', { class: 'hint' }, hint)); }
export function tabs(items, current, onPick) { return h('div', { class: 'tabs', role: 'tablist' }, items.map(([id, label]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(id === current), onclick: () => onPick(id) }, label))); }
export function kv(k, v) { return h('div', { class: 'kv' }, h('span', null, k), h('span', { class: 'mono' }, v)); }

/** Live DD:HH:MM:SS countdown computed from a stored deadline timestamp. */
export function countdown(deadline, now = Date.now) {
  const el = h('span', { class: 'countdown', 'data-tick': '1' });
  el._tick = () => { const left = deadline - now(); el.textContent = formatCountdown(left); el.classList.toggle('urgent', left < 3600e3); };
  el._tick(); return el;
}
/** Generic live element: text computed by fn() every second. */
export function live(fn, cls = 'mono') { const el = h('span', { class: cls, 'data-tick': '1' }); el._tick = () => { el.textContent = fn(); }; el._tick(); return el; }
let tickerStarted = false;
export function startTicker() {
  if (tickerStarted) return; tickerStarted = true;
  setInterval(() => { if (document.hidden) return; for (const el of document.querySelectorAll('[data-tick]')) el._tick?.(); }, 1000);
}

export function celebrate({ tag, big, sub }) {
  return new Promise((res) => {
    const el = h('div', { class: 'levelup', role: 'alertdialog', 'aria-label': `${tag} ${big}`, onclick: () => { el.remove(); res(); } },
      h('div', { class: 'rays' }), h('div', { class: 'box' }, h('div', { class: 'tag' }, tag), h('div', { class: 'lv' }, big), h('p', { class: 'muted' }, sub), h('p', { class: 'hint' }, 'Tap to continue')));
    document.body.append(el); setTimeout(() => { if (el.isConnected) { el.remove(); res(); } }, 6000);
  });
}
export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
