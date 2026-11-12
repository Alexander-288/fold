// Imported images: decoded bitmaps in memory, originals kept in IndexedDB so they survive reloads.
const store = new Map();   // id -> { bitmap, w, h, dataUrl }
const DB = 'fold-assets', OS = 'images';
const MAX_SIDE = 2048;

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction(OS, mode);
      const req = fn(tx.objectStore(OS));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = () => rej(tx.error);
    });
  } catch { return null; }
}

export const getAsset = id => store.get(id);

async function decode(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, w: bitmap.width, h: bitmap.height, dataUrl };
}

// Read a file, scale it down to MAX_SIDE, keep it as a data URL
export async function addImageFile(file) {
  let img;
  try { img = await createImageBitmap(file); }
  catch {
    // SVG and a few other formats only load through an <img>
    const url = URL.createObjectURL(file);
    img = await new Promise((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = url; });
    if (!img.width) { img.width = 1024; img.height = 1024; }
  }
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = /png|svg|gif|webp/.test(file.type);
  const dataUrl = c.toDataURL(png ? 'image/png' : 'image/jpeg', .9);
  const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store.set(id, await decode(dataUrl));
  idb('readwrite', os => os.put(dataUrl, id));
  return { id, w: c.width, h: c.height };
}

// Restore every saved image on start-up
export async function loadAssets() {
  const keys = await idb('readonly', os => os.getAllKeys()) || [];
  const vals = await idb('readonly', os => os.getAll()) || [];
  await Promise.all(keys.map(async (k, i) => { try { store.set(k, await decode(vals[i])); } catch {} }));
}

// For preset files: embed the images the state uses, and load them back
export function exportAssets(state) {
  const out = {};
  for (const l of state.layers) if (l.type === 'image' && l.asset && store.has(l.asset)) out[l.asset] = store.get(l.asset).dataUrl;
  return out;
}
export async function importAssets(map = {}) {
  for (const [id, dataUrl] of Object.entries(map)) {
    if (store.has(id)) continue;
    try { store.set(id, await decode(dataUrl)); idb('readwrite', os => os.put(dataUrl, id)); } catch {}
  }
}
