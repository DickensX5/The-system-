// THE SYSTEM - application shell: boot, store wiring, router, banners, service worker, celebrations.
import { openBestAdapter } from './state/persistence.js';
import { Store, NO_CHANGE } from './state/store.js';
import { bus } from './state/event-bus.js';
import { finalize, dueWork, overallLevel } from './engine/progression-engine.js';
import { RuleError } from './utils/validation.js';
import { dateKey } from './utils/dates.js';
import { unreadCount } from './features/inbox.js';
import { unclaimedGrants } from './engine/reward-engine.js';
import { h, $, ico, toast, startTicker, celebrate, openSheet } from './ui/dom.js';
import { parseRoute, go } from './ui/router.js';
import dashboard from './views/dashboard.js';
import questsList from './views/quests-list.js';
import financial from './views/financial.js';
import physique from './views/physique.js';
import intelligence from './views/intelligence.js';
import romance from './views/romance.js';
import inbox from './views/inbox.js';
import rewards from './views/rewards.js';
import market from './views/market.js';
import summon from './views/summon.js';
import settings from './views/settings.js';
import arcade from './views/arcade.js';

export const A = {
  store: null, adapterNote: null, installEvent: null, swUpdate: null, swReady: false, online: navigator.onLine,
  S: () => A.store.state, now: () => Date.now(), go, ov: () => overallLevel(A.store.state), render: () => scheduleRender(),
  /** Run a state change. Never throws: shows the exact rule that was broken, or the storage problem. */
  async act(label, fn) {
    try { return { ok: true, value: await A.store.commit(label, fn) }; } catch (e) {
      toast(e.message || 'Something went wrong. Nothing was changed.', 'error', 6000);
      if (!(e instanceof RuleError)) console.error(e);
      return { ok: false, error: e };
    }
  },
};

const VIEWS = {
  home: dashboard, quests: questsList, q: (a, r) => ({ financial, physique, intelligence, romance }[r.arg] || questsList)(a, r),
  inbox, rewards, market: (a, r) => market(a, r, 'global'), summon, settings, arcade,
};
const NAV = [['home', 'Home', 'home', '#/home'], ['quests', 'Quests', 'quests', '#/quests'], ['rewards', 'Rewards', 'gift', '#/rewards'], ['market', 'Market', 'store', '#/market'], ['inbox', 'Inbox', 'inbox', '#/inbox']];
const TITLES = { home: 'THE SYSTEM', quests: 'Quests', inbox: 'Inbox', rewards: 'Rewards', market: 'Market', settings: 'Settings', summon: 'XP Summoning', arcade: 'Arcade' };

let rafPending = false, lastDay = null, lastEventIdx = 0, celebrating = Promise.resolve();
function scheduleRender() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; render(); }); }

function render() {
  if (!A.store?.state) return;
  const route = parseRoute();
  const S = A.S();
  document.documentElement.dataset.motion = S.settings.motion || 'auto';
  const main = $('#view');
  const y = window.scrollY;
  let node;
  try { node = (VIEWS[route.name] || dashboard)(A, route); } catch (e) { console.error(e); node = h('div', { class: 'card' }, h('h3', null, 'This screen failed to draw'), h('p', { class: 'muted' }, String(e.message)), h('button', { class: 'btn', onclick: () => go('#/home') }, 'Back home')); }
  main.replaceChildren(node);
  window.scrollTo(0, route._keepScroll ? y : y);
  renderTop(route, S); renderNav(route, S); renderBanners();
  document.title = (TITLES[route.name] ? TITLES[route.name] + ' · ' : '') + 'THE SYSTEM';
}
function renderTop(route, S) {
  const deep = route.name === 'q' || route.name === 'summon' || route.name === 'arcade' || route.name === 'settings';
  const q = route.name === 'q' ? route.arg : null;
  $('#topbar').replaceChildren(
    deep ? h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => history.length > 1 ? history.back() : go(q ? '#/quests' : '#/home') }, ico('back')) : h('img', { src: 'assets/favicon/favicon.svg', width: 28, height: 28, alt: '' }),
    h('div', { class: 'title' }, q ? q[0].toUpperCase() + q.slice(1) : (TITLES[route.name] || 'THE SYSTEM')),
    h('div', { class: 'currency', 'aria-label': 'Currency' }, h('span', { title: 'Gold' }, ico('financial'), S.currency.gold.toLocaleString()), h('span', { title: 'Heart Coins' }, ico('heart-fill'), S.currency.hearts.toLocaleString())),
    h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => go('#/settings') }, ico('settings')));
}
function renderNav(route, S) {
  const unread = unreadCount(S), claim = unclaimedGrants(S).length;
  $('#nav').replaceChildren(...NAV.map(([id, label, icon, href]) => h('a', { href, 'aria-current': route.name === id || (id === 'quests' && route.name === 'q') ? 'page' : null }, ico(icon), label,
    id === 'inbox' && unread ? h('span', { class: 'badge-dot' }, unread > 99 ? '99+' : unread) : null, id === 'rewards' && claim ? h('span', { class: 'badge-dot' }, claim) : null)));
}
function renderBanners() {
  const b = []; const ad = A.store.adapter;
  const add = (cls, icon, text, action) => b.push(h('div', { class: `banner ${cls}`, role: 'status' }, ico(icon), h('div', { class: 'grow' }, text), action));
  if (A.adapterNote) add('bad', 'warn', A.adapterNote);
  if (A.store.loadNote) add('bad', 'warn', A.store.loadNote);
  if (!ad.persistent) add('bad', 'warn', 'Progress is not being saved in this browser mode.');
  if (A.store.lastError) add('bad', 'warn', 'The last change could not be saved: ' + A.store.lastError.message);
  if (!A.online) add('info', 'wifi-off', 'You are offline. Everything still works; nothing needs the internet.');
  if (A.swUpdate) add('info', 'download', 'A new version is ready.', h('button', { class: 'btn small primary', onclick: () => A.swUpdate.postMessage({ type: 'SKIP_WAITING' }) }, 'Update'));
  $('#banners').replaceChildren(...b);
}

// ------------------------------------------------------------------------------------------ celebrations
function handleNewEvents() {
  const evs = A.S().inbox.events;
  if (lastEventIdx > evs.length) lastEventIdx = evs.length;
  const fresh = evs.slice(lastEventIdx); lastEventIdx = evs.length;
  for (const e of fresh) {
    if (e.type === 'level-up' && !e.quest) celebrating = celebrating.then(() => celebrate({ tag: 'Level up', big: String(e.amount), sub: 'Your overall level increased' }));
    else if (e.type === 'level-up') toast(`${e.title}. A reward is waiting.`, 'level');
    else if (e.type === 'title-unlock') toast(e.title, 'level');
    else if (e.cat === 'penalty' && ['penalty-start', 'penalty-savage', 'fin-penalty-pending'].includes(e.type)) toast(e.title + ': ' + e.text, 'error', 7000);
  }
}

// ------------------------------------------------------------------------------------------ background work
let tickBusy = false;
async function tick() {
  if (tickBusy || !A.store?.state) return; tickBusy = true;
  try { await A.store.commit('tick', (s, c) => (dueWork(s, c) ? undefined : NO_CHANGE)); } catch (e) { /* surfaced by banner */ } finally { tickBusy = false; }
  const day = dateKey(Date.now()); if (day !== lastDay) { lastDay = day; scheduleRender(); }
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    A.swReady = true;
    const watch = (w) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { A.swUpdate = w; scheduleRender(); } });
    if (reg.waiting && navigator.serviceWorker.controller) A.swUpdate = reg.waiting;
    reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('SW registration failed', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
}

async function boot() {
  const sub = $('#splash-sub');
  try {
    try { const r = await fetch('icons/icon-sprite.svg'); if (r.ok) document.body.insertAdjacentHTML('afterbegin', await r.text()); } catch { /* icons are decorative; the app still works */ }
    sub.textContent = 'Opening storage';
    const { adapter, note } = await openBestAdapter();
    A.adapterNote = note;
    A.store = new Store({ adapter, finalize });
    await A.store.init();
    sub.textContent = 'Syncing';
    await A.store.commit('boot', () => {});         // finalize once: unlock starting titles, process any due timers
    lastEventIdx = A.S().inbox.events.length; lastDay = dateKey(Date.now());
    bus.on('change', () => { handleNewEvents(); scheduleRender(); });
    bus.on('storage-error', () => scheduleRender());
    window.addEventListener('hashchange', () => { scrollTo(0, 0); scheduleRender(); });
    window.addEventListener('online', () => { A.online = true; scheduleRender(); });
    window.addEventListener('offline', () => { A.online = false; scheduleRender(); });
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); A.installEvent = e; scheduleRender(); });
    window.addEventListener('appinstalled', () => { A.installEvent = null; toast('Installed. Open THE SYSTEM from your home screen.', 'good'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); scheduleRender(); } });
    setInterval(tick, 15000);
    startTicker();
    $('#app').hidden = false;
    render();
    registerSW();
    A.adapter = adapter; adapter.requestPersist?.();
  } catch (e) {
    console.error(e);
    sub.textContent = 'Could not start: ' + (e.message || e);
    return;
  }
  setTimeout(() => $('#splash').classList.add('done'), 350);
}
boot();
window.__SYSTEM__ = A;   // handy for debugging in devtools
