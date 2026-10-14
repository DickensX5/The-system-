// Hash router. Routes: #/home #/quests #/q/<quest> #/inbox #/rewards #/market #/arcade #/settings #/summon
export function parseRoute() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const seg = path.split('/').filter(Boolean);
  return { seg, name: seg[0] || 'home', arg: seg[1] || null, params: Object.fromEntries(new URLSearchParams(query)) };
}
export const go = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };
