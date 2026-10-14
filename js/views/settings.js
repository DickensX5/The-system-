import { h, ico, kv, openSheet, confirmSheet, guarded, toast, download, field } from '../ui/dom.js';
import { fmtBytes } from '../utils/formatting.js';
import { MemoryAdapter } from '../state/persistence.js';
import { formatDateTime } from '../utils/dates.js';

let est = null;
export default function settings(A) {
  const S = A.S(), ad = A.store.adapter;
  if (!est) { ad.estimate().then((e) => { est = e; A.render(); }); }
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const importer = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!await confirmSheet({ title: 'Replace ALL progress?', body: [`This file was saved ${obj.updatedAt ? formatDateTime(obj.updatedAt) : '(unknown date)'}. Importing replaces everything currently in the app. Images are not part of exports.`], danger: true, confirmText: 'Replace' })) return;
      await A.store.replaceAll(obj); toast('Imported.', 'good');
    } catch (err) { toast('That file could not be imported: ' + err.message, 'error', 7000); }
  } });
  return h('div', { class: 'stack rise' },
    h('div', { class: 'card stack' }, h('h3', null, 'Storage'),
      kv('Saved in', ad.kind), kv('Persistent', ad.persistent ? 'Yes' : 'NO (lost on close)'),
      est ? kv('Used', `${fmtBytes(est.usage)}${Number.isFinite(est.quota) ? ' of ' + fmtBytes(est.quota) : ''}`) : null,
      kv('Last saved', formatDateTime(S.updatedAt)),
      ad.kind === 'indexedDB' ? h('button', { class: 'btn small', onclick: async () => { const ok = await ad.requestPersist(); est = null; toast(ok ? 'The browser promised not to clear this data automatically.' : 'The browser did not grant persistent storage. Installing the app to your home screen helps.', ok ? 'good' : 'info', 6000); A.render(); } }, 'Ask the browser to protect my data') : null,
      h('p', { class: 'hint' }, 'Everything lives on this device only. Clearing browser/site data deletes it. Export a backup from time to time.')),
    h('div', { class: 'card stack' }, h('h3', null, 'Backup'),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: () => download(`the-system-backup-${new Date().toISOString().slice(0, 10)}.json`, A.store.exportJson()) }, ico('download'), 'Export progress'), h('button', { class: 'btn', onclick: () => importer.click() }, ico('upload'), 'Import')), importer,
      h('p', { class: 'hint' }, 'Exports contain progress, inventory, history and settings. Photos are not included.')),
    h('div', { class: 'card stack' }, h('h3', null, 'App'),
      kv('Online', A.online ? 'Yes' : 'No (works anyway)'), kv('Offline support', A.swReady ? 'Ready' : 'Not active yet'), kv('Display', standalone ? 'Installed app' : 'In browser'),
      A.installEvent ? h('button', { class: 'btn primary', onclick: async () => { A.installEvent.prompt(); await A.installEvent.userChoice; A.installEvent = null; A.render(); } }, ico('download'), 'Install app') : (!standalone ? h('p', { class: 'hint' }, ios ? 'To install on iPhone: tap Share, then "Add to Home Screen".' : 'To install: open the browser menu and choose "Install app" or "Add to Home screen".') : null),
      h('button', { class: 'btn', onclick: async () => { const r = await navigator.serviceWorker?.getRegistration(); if (!r) return toast('Updates are only checked when the app runs over https.', 'info'); await r.update(); toast(A.swUpdate ? 'Update ready: see the banner at the top.' : 'You have the latest version.', 'info'); } }, 'Check for updates'),
      h('p', { class: 'hint' }, 'THE SYSTEM v1.0.0')),
    h('div', { class: 'card stack' }, h('h3', null, 'Display'),
      h('div', { class: 'seg' }, [['auto', 'Motion: auto'], ['reduce', 'Reduce motion']].map(([v, l]) => h('button', { 'aria-pressed': String(S.settings.motion === v), onclick: () => A.act('motion', (s) => { s.settings.motion = v; document.documentElement.dataset.motion = v; }) }, l)))),
    h('div', { class: 'card stack' }, h('h3', null, 'The rules, briefly'),
      h('details', null, h('summary', null, 'How levels work'), h('p', { class: 'muted' }, 'Overall level 1–100 = 1 + floor(99 × average progress of the four quests). Financial: TSh 6,000 = 1 XP, 6 XP = 1 level (max 50), based on the balance you currently have. Physique: 56 XP per level (max 50), 8 XP per full workout. Intelligence: 140 XP per level (max 100), 20 XP per daily quest. Romance: 100 XP per level (max 50). See FORMULAS.md for worked examples.')),
      h('details', null, h('summary', null, 'What penalties never do'), h('p', { class: 'muted' }, 'No penalty ever deducts quest XP. Financial penalties are in-app accounting deductions of TSh 6,000 and never move real money. Savage penalties only remove an eligible item or title that exists, and everything removed can be recovered in Market > Lost & Found.'))),
    h('div', { class: 'card stack', style: { borderColor: '#7a2038' } }, h('h3', { class: 'bad' }, 'Danger zone'),
      h('button', { class: 'btn danger', onclick: () => resetSheet(A) }, ico('trash'), 'Erase all data')));
}
function resetSheet(A) {
  const inp = h('input', { type: 'text', placeholder: 'Type RESET', autocapitalize: 'characters' });
  openSheet((s) => s.set(h('h2', null, 'Erase everything?'), h('p', { class: 'muted' }, 'All progress, inventory, history and photos on this device will be deleted. This cannot be undone. Consider exporting a backup first.'), field('Type RESET to confirm', inp),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Cancel'), h('button', { class: 'btn danger', onclick: guarded(async () => {
      if (inp.value.trim() !== 'RESET') return toast('Type RESET exactly to confirm.', 'error');
      const blobs = await A.store.adapter.listBlobs(); for (const b of blobs) await A.store.adapter.deleteBlob(b.id);
      const { createInitialState } = await import('../state/migrations.js');
      await A.store.replaceAll(createInitialState(Date.now())); s.close(); toast('All data erased.', 'info'); A.go('#/home');
    }) }, 'Erase'))));
}
