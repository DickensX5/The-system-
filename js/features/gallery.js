// Photo galleries (Physique progress photos, Romance screenshot archive). Images are compressed on-device and
// stored as Blobs in IndexedDB, never uploaded anywhere. Metadata lives in the saved state.
import { h, ico, empty, toast, openSheet, confirmSheet, guarded } from '../ui/dom.js';
import { nid } from '../utils/ids.js';
import { rule, cleanText } from '../utils/validation.js';
import { fmtBytes } from '../utils/formatting.js';
import { formatDateTime } from '../utils/dates.js';
import { hasFeature } from '../engine/reward-engine.js';

export const MAX_PHOTOS = { physique: 120, romance: 40 };
export const limitFor = (S, bucket) => MAX_PHOTOS[bucket] + (bucket === 'romance' && hasFeature(S, 'archive_plus') ? 40 : 0);

export async function compressImage(file, maxDim = 1280, quality = 0.82) {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('This image could not be read (unsupported format?).'); }
  const k = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not compress the image.');
  return { blob, w: c.width, h: c.height };
}

export async function addPhoto(A, bucket, file, caption = '') {
  const S = A.S();
  if (S.gallery[bucket].length >= limitFor(S, bucket)) { toast(`This gallery is full (${limitFor(S, bucket)} images). Delete some first.`, 'error'); return false; }
  let img;
  try { img = await compressImage(file); } catch (e) { toast(e.message, 'error'); return false; }
  const id = `img-${bucket}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try { await A.store.adapter.putBlob(id, img.blob, { bucket }); } catch (e) { toast(e.message || 'Could not store the image.', 'error'); return false; }
  const r = await A.act('photo-add', (s, c) => { rule(s.gallery[bucket].length < limitFor(s, bucket), 'This gallery is full.'); s.gallery[bucket].push({ id, at: c.now, w: img.w, h: img.h, size: img.blob.size, caption: cleanText(caption, 80) }); });
  if (!r.ok) { A.store.adapter.deleteBlob(id).catch(() => {}); return false; }
  return true;
}
export async function removePhoto(A, bucket, id) {
  const r = await A.act('photo-del', (s) => { s.gallery[bucket] = s.gallery[bucket].filter((p) => p.id !== id); });
  if (r.ok) A.store.adapter.deleteBlob(id).catch(() => {});
}

export function galleryView(A, bucket, { title, hint }) {
  const S = A.S(), list = S.gallery[bucket].slice().reverse();
  if (A.store.adapter.kind !== 'indexedDB') return h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Image storage needs IndexedDB, which is unavailable in this browser mode.'));
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: guarded(async (e) => { for (const f of [...e.target.files]) if (!(await addPhoto(A, bucket, f))) break; e.target.value = ''; }) });
  const total = list.reduce((a, p) => a + p.size, 0);
  const urls = [];
  const grid = h('div', { class: 'photo-grid' }, list.map((p) => {
    const img = h('img', { alt: p.caption || `Saved ${formatDateTime(p.at)}`, loading: 'lazy' });
    A.store.adapter.getBlob(p.id).then((rec) => { if (rec?.blob) { const u = URL.createObjectURL(rec.blob); urls.push(u); img.src = u; } });
    return h('button', { 'aria-label': `Open image from ${formatDateTime(p.at)}`, onclick: () => viewer(A, bucket, p) }, img);
  }));
  new MutationObserver((_, ob) => { if (!grid.isConnected) { urls.forEach(URL.revokeObjectURL); ob.disconnect(); } }).observe(document.getElementById('view'), { childList: true });
  return h('div', { class: 'stack' },
    h('div', { class: 'row spread' }, h('div', null, h('h3', null, title), h('div', { class: 'hint' }, `${list.length}/${limitFor(S, bucket)} · ${fmtBytes(total)}`)), h('button', { class: 'btn small', onclick: () => input.click() }, ico('camera'), 'Add')),
    hint ? h('p', { class: 'hint' }, hint) : null, input,
    list.length ? grid : empty('camera', 'No images yet', 'They stay on this device only.'));
}
function viewer(A, bucket, p) {
  const img = h('img', { alt: p.caption || 'Saved image', style: { width: '100%', borderRadius: '10px' } });
  A.store.adapter.getBlob(p.id).then((rec) => { if (rec?.blob) img.src = URL.createObjectURL(rec.blob); });
  openSheet((s) => s.set(img, h('div', { class: 'hint', style: { margin: '8px 0' } }, `${formatDateTime(p.at)} · ${fmtBytes(p.size)}`),
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => s.close() }, 'Close'), h('button', { class: 'btn danger', onclick: async () => { if (await confirmSheet({ title: 'Delete image?', body: 'This permanently removes it from this device.', danger: true, confirmText: 'Delete' })) { await removePhoto(A, bucket, p.id); s.close(); } } }, ico('trash'), 'Delete'))), { onClose: () => URL.revokeObjectURL(img.src) });
}
