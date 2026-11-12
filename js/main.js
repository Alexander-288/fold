import { Engine, TYPES, BLENDS, FOLDS, HALFTONES, SPLINE_STYLES, SPLINE_COLOR, sampleSpline, isSpatial } from './engine.js';
import { FX_DEFS } from './shaders.js';
import { ASPECTS, PRESETS, normalize, makeLayer, makeFx, newId, randomState, FX_DEFAULTS } from './state.js';
import { h, icon, Slider, Seg, Menu, ColorField, Toggle, Section, moveBlob, toast, closeMenus, RampEditor, rampCss } from './ui.js';
import { loadAssets, addImageFile, exportAssets, importAssets } from './assets.js';
import * as X from './export.js';

const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// ---------- icons ----------
const I = {
  select: '<path d="M5 3.5 18.5 11l-6 1.6-2.7 6z"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V4.5a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',
  pen: '<path d="M4 20c3-1 4-4 6-7s5-6 10-8"/><circle cx="4" cy="20" r="1.4" fill="currentColor"/><circle cx="20" cy="5" r="1.4" fill="currentColor"/><circle cx="11" cy="12" r="1.4" fill="currentColor"/>',
  blob: '<ellipse cx="12" cy="12" rx="8" ry="6" transform="rotate(-25 12 12)"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4" opacity=".45"/>',
  band: '<path d="M3 15c4-5 14-5 18 0"/><path d="M3 11c4-5 14-5 18 0" opacity=".45"/>',
  linear: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 4v16M12 4v16" opacity=".45"/>',
  conic: '<circle cx="12" cy="12" r="8"/><path d="M12 12V4M12 12l6 5"/>',
  noise: '<path d="M4 14c2-4 5 1 7-3s5-3 9 1"/><path d="M4 18c3-3 6 0 9-2s5-1 7 0" opacity=".45"/>',
  spline: '<path d="M3 18c4 0 5-12 9-12s5 12 9 12"/><path d="M3 18c4 0 5-12 9-12s5 12 9 12" stroke-width="4" opacity=".25"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
  text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="2.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.6 6.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-1"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M14 11v6M11 14h6"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  swap: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  grip: '<circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  fx: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>',
};
const LABEL = { band: 'Spectrum', noise: 'Cloud', spline: 'Light spline', image: 'Image', text: 'Text' };
const typeName = t => LABEL[t] || t[0].toUpperCase() + t.slice(1);
const layerIcon = l => l.type === 'image' && l.src === 'text' ? I.text : I[l.type];

// ---------- state + history ----------
let S = null;
let sel = null;
let tool = 'select';
let penId = null;       // spline being drawn with the pen
let playing = lsGet('fold.playing', true);
let phase = 0, frame = 0, dirty = true;
let tab = lsGet('fold.tab', 'layers');
if (tab === 'finish') tab = 'effects';
const exp = { format: 'png', long: 2160, quality: .92, fps: 30, loops: 1, vlong: 1080, pack: ['iphone', 'android', 'fhd', '4k'], packFormat: 'png', ...lsGet('fold.export', {}) };
const hist = [], fut = [];
let lastKey = null, lastT = 0;
let controls = [];
const fxOpen = new Set(lsGet('fold.fxOpen', []));

const layerOf = (s, id) => s.layers.find(l => l.id === id);
const fxOf = (s, id) => s.fx.find(x => x.id === id);
const cur = () => layerOf(S, sel);

function change(fn, { key = null, structural = false } = {}) {
  const now = performance.now();
  if (!key || key !== lastKey || now - lastT > 900) {
    hist.push(JSON.stringify(S));
    if (hist.length > 200) hist.shift();
    fut.length = 0;
  }
  lastKey = key; lastT = now;
  fn(S);
  emit(structural);
}
const commit = () => { lastKey = null; };

function replaceState(next, { record = true, fade = true } = {}) {
  if (fade) crossfade();
  if (record) { hist.push(JSON.stringify(S)); fut.length = 0; }
  S = normalize(next);
  penId = null;
  if (!layerOf(S, sel)) sel = S.layers[S.layers.length - 1]?.id ?? null;
  lastKey = null;
  emit(true);
  layout();
}
function undo() { if (!hist.length) return; fut.push(JSON.stringify(S)); S = JSON.parse(hist.pop()); fix(); }
function redo() { if (!fut.length) return; hist.push(JSON.stringify(S)); S = JSON.parse(fut.pop()); fix(); }
function fix() { if (!layerOf(S, sel)) sel = S.layers[S.layers.length - 1]?.id ?? null; if (!layerOf(S, penId)) penId = null; lastKey = null; emit(true); layout(); }

let saveT;
function emit(structural) {
  dirty = true;
  clearTimeout(saveT);
  saveT = setTimeout(() => lsSet('fold.state', S), 300);
  if (structural) renderPanel(); else controls.forEach(c => c.update());
  drawHandles();
  updateChrome();
}

function bind(path, { structural = false } = {}) {
  const ks = path.split('.');
  const get = () => ks.reduce((o, k) => o[k], S);
  const set = v => change(s => { const o = ks.slice(0, -1).reduce((o, k) => o[k], s); o[ks.at(-1)] = v; }, { key: path, structural });
  return { get, set, commit };
}
function lbind(prop, { structural = false } = {}) {
  return {
    get: () => cur()?.[prop],
    set: (v, k) => change(s => { const l = layerOf(s, sel); if (l) l[prop] = v; }, { key: sel + prop + (k === 'rampc' ? 'c' : ''), structural }),
    commit,
  };
}
function fbind(id, prop, { structural = false } = {}) {
  return {
    get: () => fxOf(S, id)?.[prop],
    set: v => change(s => { const x = fxOf(s, id); if (x) x[prop] = v; }, { key: id + prop, structural }),
    commit,
  };
}
const reg = c => (controls.push(c), c.el);

// ---------- engine ----------
const view = $('view');
let engine;
try {
  engine = new Engine(view, { preserve: true });
} catch (e) {
  document.body.append(h('div', { class: 'fatal' }, h('div', {}, h('b', {}, 'Fold needs WebGL2.'), h('p', { class: 'note' }, String(e.message)))));
  throw e;
}

let lastT0 = performance.now();
function tick(t) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (t - lastT0) / 1000);
  lastT0 = t;
  if (playing) { phase = (phase + dt / Math.max(.5, S.anim.duration)) % 1; frame++; dirty = true; updatePhase(); }
  if (dirty) {
    try { engine.render(S, phase, frame); } catch (e) { console.error(e); }
    dirty = false;
  }
}

function crossfade() {
  const x = $('xfade');
  x.width = view.width; x.height = view.height;
  try { x.getContext('2d').drawImage(view, 0, 0); } catch { return; }
  x.getAnimations().forEach(a => a.cancel());
  x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)' });
}

// ---------- stage layout ----------
const stage = $('stage'), frameEl = $('frame'), wrap = $('frameWrap');
let fw = 0, fh = 0;
let stripOpen = lsGet('fold.strip', true);

function layout() {
  if (!S) return;
  const r = stage.getBoundingClientRect();
  const small = innerWidth <= 860;
  const padL = small ? 64 : 84, padR = small ? 16 : 40, padT = small ? 56 : 30, padB = (stripOpen ? 132 : 44) + 46;
  const aw = Math.max(80, r.width - padL - padR), ah = Math.max(80, r.height - padT - padB);
  const ar = S.aspect.w / S.aspect.h;
  let w = aw, hh = aw / ar;
  if (hh > ah) { hh = ah; w = ah * ar; }
  fw = Math.round(w); fh = Math.round(hh);
  frameEl.style.width = fw + 'px';
  frameEl.style.height = fh + 'px';
  wrap.style.left = Math.round(padL + (aw - fw) / 2) + 'px';
  wrap.style.top = Math.round(padT + (ah - fh) / 2) + 'px';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cw = Math.round(fw * dpr), ch = Math.round(fh * dpr);
  if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
  $('handles').setAttribute('viewBox', `0 0 ${fw} ${fh}`);
  $('zoomPill').style.bottom = small ? '' : (stripOpen ? 144 : 46) + 'px';
  $('stripWrap').classList.toggle('is-closed', !stripOpen);
  dirty = true;
  drawHandles();
  updateChrome();
  if (toolBtns[tool]) moveBlob(tbBlob, toolBtns[tool], toolbar, true);
}
new ResizeObserver(layout).observe(stage);

// world <-> frame pixels
const kScale = () => Math.min(fw, fh) * S.view.zoom;
const toScreen = (x, y) => [(x - S.view.x) * kScale() + fw / 2, (y - S.view.y) * kScale() + fh / 2];
const toWorld = (px, py) => [(px - fw / 2) / kScale() + S.view.x, (py - fh / 2) / kScale() + S.view.y];
const localPt = e => { const r = frameEl.getBoundingClientRect(); return [(e.clientX - r.left) * fw / r.width, (e.clientY - r.top) * fh / r.height]; };
// layer-local (rotated) <-> world
const rotv = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * x - s * y, s * x + c * y]; };
const localToWorld = (l, p) => { const [x, y] = rotv(p[0], p[1], l.rot); return [l.x + x, l.y + y]; };
const worldToLocal = (l, wx, wy) => rotv(wx - l.x, wy - l.y, -l.rot);
const imgAspect = l => engine.imgInfo[l.id]?.aspect || 1;

// ---------- handles ----------
const svgNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

let lastDrawn = null;
function drawHandles() {
  const svg = $('handles');
  if (!S || !fw) return;
  svg.innerHTML = '';
  if (tool === 'hand') return;
  const k = kScale();
  for (const l of S.layers) {
    if (!l.visible || l.id === sel) continue;
    const [x, y] = toScreen(l.x, l.y);
    const d = sv('circle', { cx: x, cy: y, r: 4, class: 'h-dot' });
    d.addEventListener('pointerdown', e => { e.stopPropagation(); select(l.id); startDrag(e, 'move'); });
    svg.append(d);
  }
  const l = cur();
  if (!l) return;
  const g = sv('g', { class: 'h-group' + (sel !== lastDrawn ? ' is-new' : '') });
  lastDrawn = sel;
  const [cx, cy] = toScreen(l.x, l.y);
  const a = l.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  if (l.type === 'spline') {
    const pts = sampleSpline(l.pts, 12).map(p => toScreen(...localToWorld(l, p)));
    if (pts.length > 1) g.append(sv('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'h-ell' }));
    (l.pts || []).forEach((p, i) => {
      const [x, y] = toScreen(...localToWorld(l, p));
      const pt = sv('rect', { x: x - 5, y: y - 5, width: 10, height: 10, rx: 2.5, class: 'h-a h-pt' + (penId === l.id && i === l.pts.length - 1 ? ' is-last' : '') });
      pt.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'pt', i); });
      pt.addEventListener('dblclick', e => { e.stopPropagation(); if (l.pts.length > 2) change(s => layerOf(s, l.id).pts.splice(i, 1)); });
      g.append(pt);
    });
  } else {
    const rx = l.sx * k, ry = (l.type === 'image' ? l.sx / imgAspect(l) : l.sy) * k;
    const ax = [cx + ca * rx, cy + sa * rx], ay = [cx - sa * ry, cy + ca * ry];
    if (l.type === 'linear') {
      g.append(sv('line', { x1: cx - ca * rx, y1: cy - sa * rx, x2: ax[0], y2: ax[1], class: 'h-line' }));
    } else if (l.type === 'band') {
      const pts = [];
      for (let i = -10; i <= 10; i++) { const t = i / 10 * l.sx; const yy = -l.b * t * t; pts.push([cx + (ca * t - sa * yy) * k, cy + (sa * t + ca * yy) * k]); }
      g.append(sv('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'h-ell' }));
      g.append(sv('line', { x1: cx, y1: cy, x2: ay[0], y2: ay[1], class: 'h-line' }));
    } else if (l.type === 'image') {
      g.append(sv('rect', { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2, transform: `rotate(${l.rot} ${cx} ${cy})`, class: 'h-ell' }));
      g.append(sv('line', { x1: cx, y1: cy, x2: ax[0], y2: ax[1], class: 'h-line' }));
    } else {
      g.append(sv('ellipse', { cx, cy, rx, ry, transform: `rotate(${l.rot} ${cx} ${cy})`, class: 'h-ell' }));
      g.append(sv('line', { x1: cx, y1: cy, x2: ax[0], y2: ax[1], class: 'h-line' }));
    }
    const hx = sv('rect', { x: ax[0] - 5, y: ax[1] - 5, width: 10, height: 10, rx: 2, class: 'h-a' });
    hx.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'ax'); });
    g.append(hx);
    if (l.type !== 'linear' && l.type !== 'image') {
      const hy = sv('circle', { cx: ay[0], cy: ay[1], r: 5, class: 'h-a' });
      hy.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'ay'); });
      g.append(hy);
    }
  }
  const c = sv('circle', { cx, cy, r: 6, class: 'h-c' });
  c.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'move'); });
  g.append(c);
  const tag = sv('g', { class: 'h-tag' });
  const txt = sv('text', { x: cx + 12, y: cy - 10 });
  txt.textContent = penId === l.id ? `${l.name} · click to add points, Enter to finish` : l.name;
  tag.append(txt);
  g.append(tag);
  svg.append(g);
  const bb = txt.getBBox();
  tag.insertBefore(sv('rect', { x: bb.x - 7, y: bb.y - 3, width: bb.width + 14, height: bb.height + 6, rx: (bb.height + 6) / 2 }), txt);
}

let drag = null;
function startDrag(e, mode, index = 0) {
  const l = cur();
  if (!l && mode !== 'pan') return;
  e.preventDefault();
  const [px, py] = localPt(e);
  const [wx, wy] = toWorld(px, py);
  drag = { mode, index, id: e.pointerId, px, py, ox: l ? wx - l.x : 0, oy: l ? wy - l.y : 0, view: { ...S.view }, key: 'drag' + Math.random() };
  stage.setPointerCapture(e.pointerId);
  stage.classList.add('is-dragging');
}
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const [px, py] = localPt(e);
  if (drag.mode === 'pan') {
    const k = Math.min(fw, fh) * drag.view.zoom;
    S.view.x = drag.view.x - (px - drag.px) / k;
    S.view.y = drag.view.y - (py - drag.py) / k;
    dirty = true; drawHandles(); controls.forEach(c => c.update());
    return;
  }
  const [wx, wy] = toWorld(px, py);
  change(s => {
    const l = layerOf(s, sel);
    if (!l) return;
    if (drag.mode === 'move') {
      l.x = +(wx - drag.ox).toFixed(4); l.y = +(wy - drag.oy).toFixed(4);
    } else if (drag.mode === 'pt') {
      l.pts[drag.index] = worldToLocal(l, wx, wy).map(v => +v.toFixed(4));
    } else if (drag.mode === 'ax') {
      const dx = wx - l.x, dy = wy - l.y;
      l.sx = +Math.max(.01, Math.hypot(dx, dy)).toFixed(4);
      if (!e.shiftKey) l.rot = +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
      if (e.altKey) l.sy = l.sx;
    } else if (drag.mode === 'ay') {
      const a = l.rot * Math.PI / 180;
      l.sy = +Math.max(.005, Math.abs(-(wx - l.x) * Math.sin(a) + (wy - l.y) * Math.cos(a))).toFixed(4);
      if (e.altKey) l.sx = l.sy;
    }
  }, { key: drag.key });
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.mode === 'pan') { hist.push(JSON.stringify({ ...S, view: drag.view })); fut.length = 0; lsSet('fold.state', S); }
  drag = null; commit();
  stage.classList.remove('is-dragging');
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// hit test in world space, topmost first
function hitLayer(wx, wy) {
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const l = S.layers[i];
    if (!l.visible) continue;
    const [u0, v0] = worldToLocal(l, wx, wy);
    if (l.type === 'spline') {
      const pts = sampleSpline(l.pts, 8);
      for (let j = 1; j < pts.length; j++) {
        const [ax, ay] = pts[j - 1], [bx, by] = pts[j];
        const t = Math.max(0, Math.min(1, ((u0 - ax) * (bx - ax) + (v0 - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
        if (Math.hypot(u0 - ax - (bx - ax) * t, v0 - ay - (by - ay) * t) < Math.max(l.sy, .025)) return l;
      }
      continue;
    }
    if (l.type === 'image') { if (Math.abs(u0) < l.sx && Math.abs(v0) < l.sx / imgAspect(l)) return l; continue; }
    const u = u0 / l.sx, v = v0 / Math.max(l.sy, .02);
    if (l.type === 'linear' ? Math.abs(u) < 1 && Math.abs(v0) < .05 : u * u + v * v < 1) return l;
  }
  return null;
}

let spaceDown = false;
frameEl.addEventListener('pointerdown', e => {
  if (e.button === 1 || tool === 'hand' || spaceDown) return startDrag(e, 'pan');
  if (e.button !== 0) return;
  const [px, py] = localPt(e);
  const [wx, wy] = toWorld(px, py);
  if (tool === 'pen') return penClick(wx, wy);
  const l = hitLayer(wx, wy);
  if (l) { select(l.id); return startDrag(e, 'move'); }
  select(null);
});
stage.addEventListener('pointerdown', e => { if (e.target === stage && (e.button === 1 || tool === 'hand' || spaceDown)) startDrag(e, 'pan'); });
frameEl.addEventListener('dblclick', () => { if (tool === 'pen') finishPen(); });

stage.addEventListener('wheel', e => {
  e.preventDefault();
  const [px, py] = localPt(e);
  const [wx, wy] = toWorld(px, py);
  const z = Math.min(20, Math.max(.1, S.view.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015))));
  change(s => {
    s.view.zoom = +z.toFixed(4);
    const k = Math.min(fw, fh) * z;
    s.view.x = wx - (px - fw / 2) / k;
    s.view.y = wy - (py - fh / 2) / k;
  }, { key: 'zoom' });
}, { passive: false });

function select(id) {
  if (sel === id) return;
  sel = id;
  if (penId && penId !== id) penId = null;
  drawHandles();
  if (tab === 'layers') renderPanel(); else updateChrome();
}

// ---------- pen: draw light splines point by point ----------
function penClick(wx, wy) {
  const l = layerOf(S, penId);
  if (l) {
    if (l.pts.length >= 12) { toast('Twelve points is the most per spline.'); return finishPen(); }
    change(s => { const x = layerOf(s, penId); x.pts.push(worldToLocal(x, wx, wy).map(v => +v.toFixed(4))); }, { structural: l.pts.length < 2 });
    return;
  }
  if (S.layers.length >= 8) return toast('Eight layers is the limit.', { kind: 'err' });
  const n = S.layers.filter(x => x.type === 'spline').length;
  const nl = makeLayer('spline', { x: +wx.toFixed(4), y: +wy.toFixed(4), pts: [[0, 0]], name: 'Light' + (n ? ' ' + (n + 1) : '') });
  change(s => s.layers.push(nl), { structural: true });
  sel = penId = nl.id;
  setTab('layers');
  drawHandles();
}
function finishPen() {
  const l = layerOf(S, penId);
  penId = null;
  if (l && l.pts.length < 2) change(s => s.layers.splice(s.layers.findIndex(x => x.id === l.id), 1), { structural: true });
  if (tool === 'pen') setTool('select');
  drawHandles();
}

// ---------- toolbar ----------
const toolbar = $('toolbar');
const tbBlob = h('span', { class: 'tb-blob', 'data-axis': 'y', hidden: true });
const toolBtns = {};
function tb(id, label, ic, onclick, key, cls = '') {
  const b = h('button', { type: 'button', class: 'tb-btn ' + cls, 'data-label': key ? `${label}  ${key}` : label, 'aria-label': label, onclick }, icon(ic, 19));
  toolBtns[id] = b;
  return b;
}
const imgInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', onchange: e => { const f = e.target.files[0]; e.target.value = ''; if (f) addImage(f, imgInput._replace); } });
document.body.append(imgInput);
const pickImage = (replaceId = null) => { imgInput._replace = replaceId; imgInput.click(); };
toolbar.append(
  tbBlob,
  tb('select', 'Select', I.select, () => setTool('select'), 'V'),
  tb('hand', 'Pan & crop', I.hand, () => setTool('hand'), 'H'),
  tb('pen', 'Draw light spline', I.pen, () => setTool('pen'), 'L'),
  h('div', { class: 'tb-div' }),
  ...['blob', 'ring', 'band', 'linear', 'conic', 'noise'].map(t => tb('add-' + t, 'Add ' + typeName(t).toLowerCase(), I[t], () => addLayer(t), '', 'tb-add')),
  tb('add-image', 'Add image', I.image, () => pickImage(), '', 'tb-add'),
  tb('add-text', 'Add text', I.text, () => addLayer('text'), 'T', 'tb-add'),
  h('div', { class: 'tb-div tb-add' }),
  tb('shuffle', 'Shuffle', I.dice, shuffle, 'R'),
  tb('fit', 'Reset crop', I.fit, resetCrop, '0'),
);
function setTool(t) {
  if (t !== 'pen' && penId) { const id = penId; penId = null; const l = layerOf(S, id); if (l && l.pts.length < 2) change(s => s.layers.splice(s.layers.findIndex(x => x.id === id), 1), { structural: true }); }
  tool = t;
  stage.dataset.tool = t;
  Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('is-on', k === t));
  moveBlob(tbBlob, toolBtns[t], toolbar);
  drawHandles();
  if (t === 'pen') toast('Click on the canvas to place points. Enter or double-click to finish.');
}

// ---------- layer actions ----------
function addLayer(type, over = {}) {
  if (S.layers.length >= 8) return toast('Eight layers is the limit.', { kind: 'err' });
  if ((type === 'text' || type === 'image') && S.layers.filter(l => l.type === 'image').length >= 4) return toast('Four image or text layers is the limit.', { kind: 'err' });
  const l = makeLayer(type, { x: +S.view.x.toFixed(3), y: +S.view.y.toFixed(3), ...over });
  const n = S.layers.filter(x => x.name.startsWith(l.name)).length;
  if (n) l.name += ' ' + (n + 1);
  change(s => s.layers.push(l), { structural: true });
  sel = l.id;
  setTab('layers');
  setTool('select');
}
async function addImage(file, replaceId) {
  try {
    const a = await addImageFile(file);
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Image';
    if (replaceId && layerOf(S, replaceId)) change(s => { const l = layerOf(s, replaceId); l.asset = a.id; l.src = 'image'; }, { structural: true });
    else addLayer('image', { asset: a.id, name });
  } catch { toast('Could not read that image.', { kind: 'err' }); }
}
function dupLayer() {
  const l = cur();
  if (!l) return;
  if (S.layers.length >= 8) return toast('Eight layers is the limit.', { kind: 'err' });
  const c = { ...clone(l), id: newId(), name: l.name + ' copy', x: l.x + .04, y: l.y + .04 };
  change(s => s.layers.splice(s.layers.findIndex(x => x.id === l.id) + 1, 0, c), { structural: true });
  sel = c.id; renderPanel(); drawHandles();
}
function delLayer(id = sel) {
  const i = S.layers.findIndex(x => x.id === id);
  if (i < 0) return;
  if (penId === id) penId = null;
  change(s => s.layers.splice(i, 1), { structural: true });
  if (sel === id) sel = S.layers[Math.min(i, S.layers.length - 1)]?.id ?? null;
  renderPanel(); drawHandles();
}
function shuffle() { replaceState(randomState(S)); }
function resetCrop() { change(s => { s.view = { zoom: 1, x: 0, y: 0 }; }); commit(); }

// ---------- top bar ----------
const ratioIcon = a => {
  const m = 14 / Math.max(a.w, a.h);
  return h('span', { class: 'ratio-ic' }, h('i', { style: { width: Math.max(4, a.w * m) + 'px', height: Math.max(4, a.h * m) + 'px' } }));
};
function aspectOptions() {
  const o = ASPECTS.map(a => ({ v: a.id, label: a.id === 'A' ? 'A4' : a.id, note: a.label, a }));
  if (!ASPECTS.find(a => a.id === S.aspect.id)) o.unshift({ v: S.aspect.id, label: S.aspect.id, note: 'Custom', a: S.aspect });
  return o;
}
function setAspect(id) {
  const a = ASPECTS.find(a => a.id === id);
  if (!a) return;
  change(s => { s.aspect = { id: a.id, w: a.w, h: a.h }; }, { structural: true });
  layout();
}
function flipAspect() {
  const { w, h: hh, id } = S.aspect;
  const nid = id === 'A' ? 'A' : id.split(':').reverse().join(':');
  const known = ASPECTS.find(a => a.id === nid && a.w === hh && a.h === w);
  change(s => { s.aspect = { id: known ? nid : `${+(hh).toFixed(2)}:${+(w).toFixed(2)}`, w: hh, h: w }; }, { structural: true });
  layout();
}

let aspectMenu, playBtn, phaseEl, undoBtn, redoBtn, themeBtn;
function buildTop() {
  const mid = $('topMid'), right = $('topRight');
  aspectMenu = Menu({
    options: aspectOptions(), get: () => S.aspect.id, set: setAspect, cls: 'aspect-btn',
    render: o => [ratioIcon(o.a), h('span', {}, o.label), h('span', { class: 'menu-note' }, o.note)],
  });
  aspectMenu.el.style.width = '128px';
  playBtn = h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Play or pause', title: 'Play / pause  (P)', onclick: togglePlay });
  phaseEl = h('div', { class: 'phase', title: 'Scrub the loop' }, h('i'), h('b'));
  const tlabel = h('span', { class: 'mono phase-t' });
  phaseEl._t = tlabel;
  phaseEl.addEventListener('pointerdown', e => {
    phaseEl.setPointerCapture(e.pointerId);
    const go = ev => { const r = phaseEl.getBoundingClientRect(); phase = Math.min(.9999, Math.max(0, (ev.clientX - r.left) / r.width)); dirty = true; updatePhase(); };
    playing = false; updatePlay(); go(e);
    phaseEl.onpointermove = go;
    phaseEl.onpointerup = () => { phaseEl.onpointermove = null; };
  });
  undoBtn = h('button', { type: 'button', class: 'ibtn', title: 'Undo  (Ctrl+Z)', 'aria-label': 'Undo', onclick: undo }, icon(I.undo));
  redoBtn = h('button', { type: 'button', class: 'ibtn', title: 'Redo  (Ctrl+Shift+Z)', 'aria-label': 'Redo', onclick: redo }, icon(I.redo));
  mid.append(
    aspectMenu.el,
    h('button', { type: 'button', class: 'ibtn', title: 'Swap orientation', 'aria-label': 'Swap orientation', onclick: flipAspect }, icon(I.swap)),
    h('div', { class: 'vsep hide-sm' }),
    h('div', { class: 'play hide-sm' }, playBtn, phaseEl, tlabel),
    h('div', { class: 'vsep hide-sm' }),
    h('span', { class: 'hide-sm', style: { display: 'contents' } }, undoBtn, redoBtn),
  );
  themeBtn = h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Toggle theme', title: 'Light / dark', onclick: toggleTheme });
  right.append(themeBtn, h('button', { type: 'button', class: 'btn primary', onclick: () => setTab('export') }, icon(I.down, 16), h('span', {}, 'Export')));
  updatePlay(); updateTheme();
}
function togglePlay() { playing = !playing; lsSet('fold.playing', playing); updatePlay(); }
function updatePlay() { if (!playBtn) return; playBtn.innerHTML = ''; playBtn.append(icon(playing ? I.pause : I.play, 15)); }
function updatePhase() {
  if (!phaseEl) return;
  phaseEl.firstChild.style.width = phase * 100 + '%';
  phaseEl.lastChild.style.left = phase * 100 + '%';
  phaseEl._t.textContent = (phase * S.anim.duration).toFixed(1) + 's';
}
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('fold.theme', next); } catch {}
  updateTheme();
}
function updateTheme() { themeBtn.innerHTML = ''; themeBtn.append(icon(isDark() ? I.sun : I.moon)); }

function updateChrome() {
  if (!S) return;
  aspectMenu?.update();
  if (undoBtn) { undoBtn.disabled = !hist.length; redoBtn.disabled = !fut.length; }
  const [w, hh] = X.sizeFor(S.aspect, exp.long);
  $('frameMeta').innerHTML = '';
  $('frameMeta').append(h('b', {}, `${w} × ${hh}`), h('span', {}, S.aspect.id === 'A' ? 'A4' : S.aspect.id), h('span', {}, `zoom ${Math.round(S.view.zoom * 100)}%`));
  zoomVal.textContent = Math.round(S.view.zoom * 100) + '%';
  updatePhase();
}

const zoomVal = h('button', { class: 'z', type: 'button', title: 'Reset crop', onclick: resetCrop });
const zoomBy = f => { change(s => { s.view.zoom = +Math.min(20, Math.max(.1, s.view.zoom * f)).toFixed(4); }, { key: 'zoom' }); commit(); };
$('zoomPill').append(
  h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Zoom out', onclick: () => zoomBy(1 / 1.2) }, icon(I.minus, 15)),
  zoomVal,
  h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Zoom in', onclick: () => zoomBy(1.2) }, icon(I.plus, 15)),
);

// ---------- presets strip: built-in and my presets ----------
let stripView = lsGet('fold.stripView', 'presets');
let library = lsGet('fold.library', []);
const saveLibrary = () => { if (!lsSet('fold.library', library)) toast('Browser storage is full. Delete a few presets.', { kind: 'err' }); };
const thumbCache = {};

async function thumbOf(state, hgt = 168) {
  const ar = state.aspect.w / state.aspect.h;
  const blob = await X.exportImage(state, { w: Math.max(2, Math.round(hgt * ar)), h: hgt, format: 'jpg', quality: .8, phase: .1 });
  return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}

function buildStripHead() {
  const head = $('stripHead');
  head.innerHTML = '';
  const tabBtn = (id, label) => h('button', { type: 'button', class: 'strip-tab mono' + (stripView === id ? ' is-on' : ''), onclick: () => {
    if (!stripOpen) { stripOpen = true; lsSet('fold.strip', true); layout(); }
    else if (stripView === id) { stripOpen = false; lsSet('fold.strip', false); layout(); }
    stripView = id; lsSet('fold.stripView', id); buildStripHead(); buildStrip();
  } }, label);
  head.append(tabBtn('presets', 'Presets'), tabBtn('mine', `Mine${library.length ? ' ' + library.length : ''}`));
}

async function buildStrip() {
  const strip = $('strip');
  strip.innerHTML = '';
  if (stripView === 'mine') {
    strip.append(h('button', { type: 'button', class: 'thumb dice', title: 'Save the current design', onclick: saveToLibrary }, icon(I.plus, 22), h('span', {}, 'Save')));
    const items = [...library].sort((a, b) => (b.fav - a.fav) || (b.t - a.t));
    if (!items.length) strip.append(h('div', { class: 'strip-empty' }, 'Saved designs show up here.'));
    items.forEach((it, i) => {
      const name = h('span', {}, it.name);
      const b = h('div', { class: 'thumb mine' + (it.fav ? ' is-fav' : ''), title: it.name, style: { animationDelay: i * 30 + 'ms' } },
        h('button', { type: 'button', class: 'thumb-hit', 'aria-label': 'Load ' + it.name, onclick: () => replaceState(clone(it.state)) }, h('img', { src: it.thumb, alt: '' })),
        name,
        h('div', { class: 'thumb-acts' },
          h('button', { type: 'button', class: 'fav', title: it.fav ? 'Unstar' : 'Star', 'aria-label': 'Star', onclick: () => { it.fav = !it.fav; saveLibrary(); buildStrip(); } }, icon(I.star, 13)),
          h('button', { type: 'button', title: 'Delete', 'aria-label': 'Delete ' + it.name, onclick: () => { library = library.filter(x => x.id !== it.id); saveLibrary(); buildStripHead(); buildStrip(); toast('Preset deleted'); } }, icon(I.x, 13))));
      name.addEventListener('dblclick', () => {
        const inp = h('input', { value: it.name, 'aria-label': 'Preset name' });
        name.replaceWith(inp); inp.focus(); inp.select();
        const done = () => { it.name = inp.value.trim() || it.name; saveLibrary(); buildStrip(); };
        inp.addEventListener('blur', done);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
      });
      strip.append(b);
    });
    return;
  }
  strip.append(h('button', { type: 'button', class: 'thumb dice', title: 'Shuffle a new one  (R)', onclick: shuffle }, icon(I.dice, 22)));
  for (const [i, p] of PRESETS.entries()) {
    thumbCache[p.name] ??= await thumbOf(p.state).catch(() => '');
    if (stripView !== 'presets') return;
    strip.append(h('button', { type: 'button', class: 'thumb', title: p.name, style: { animationDelay: i * 30 + 'ms' }, onclick: () => replaceState(clone(p.state)) },
      h('img', { src: thumbCache[p.name], alt: '' }), h('span', {}, p.name)));
  }
}

async function saveToLibrary() {
  const n = library.length + 1;
  const item = { id: newId(), name: `Design ${n}`, t: Date.now(), fav: false, state: clone(S), thumb: await thumbOf(S, 140) };
  library.push(item);
  saveLibrary();
  stripView = 'mine'; stripOpen = true; lsSet('fold.strip', true);
  buildStripHead(); buildStrip(); layout();
  toast('Saved to My presets. Double-click the name to rename.', { kind: 'ok' });
}

// ---------- inspector ----------
const TABS = [['layers', 'Layers'], ['fold', 'Fold'], ['effects', 'Effects'], ['export', 'Export']];
const tabsEl = $('tabs');
const tabBlob = h('span', { class: 'seg-blob', hidden: true });
const tabBtns = TABS.map(([id, label]) => h('button', { type: 'button', class: 'tab', 'data-tab': id, onclick: () => setTab(id) }, label));
tabsEl.append(tabBlob, ...tabBtns);
new ResizeObserver(() => { const b = tabBtns.find(x => x.classList.contains('is-on')); if (b) moveBlob(tabBlob, b, tabsEl, true); }).observe(tabsEl);
let lastTabIndex = 0;
function setTab(id) {
  const back = TABS.findIndex(t => t[0] === id) < lastTabIndex;
  tab = id; lsSet('fold.tab', id);
  renderPanel(back);
}

function renderPanel(back = false) {
  closeMenus();
  const idx = TABS.findIndex(t => t[0] === tab);
  const changedTab = idx !== lastTabIndex;
  lastTabIndex = idx;
  tabBtns.forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab));
  requestAnimationFrame(() => moveBlob(tabBlob, tabBtns[idx], tabsEl));
  const body = $('panelBody');
  const st = body.scrollTop;
  controls = [];
  body.innerHTML = '';
  const pane = h('div', { class: 'pane' + (changedTab && back ? ' is-back' : '') });
  if (!changedTab) pane.style.animation = 'none';
  ({ layers: paneLayers, fold: paneFold, effects: paneEffects, export: paneExport })[tab](pane);
  body.append(pane);
  if (!changedTab) body.scrollTop = st;
  updateChrome();
}

const RAMP_PRESETS = [
  { name: 'Periwinkle', stops: [{ p: 0, c: '#3b3b8a' }, { p: .5, c: '#9696ff' }, { p: 1, c: '#f2f1ed' }] },
  { name: 'Ember', stops: [{ p: 0, c: '#ff3d1f' }, { p: .5, c: '#ffb36b' }, { p: 1, c: '#fff2d6' }] },
  { name: 'Prism', stops: [{ p: 0, c: '#5b5be8' }, { p: .5, c: '#9696ff' }, { p: 1, c: '#ff8a4c' }] },
  { name: 'Aurora', stops: [{ p: 0, c: '#0d3b3a' }, { p: .5, c: '#3cf0b0' }, { p: 1, c: '#e6ff6b' }] },
  { name: 'Rainbow', stops: [{ p: 0, c: '#ff3b3b' }, { p: .25, c: '#ffd23b' }, { p: .5, c: '#3bff8a' }, { p: .75, c: '#3b8aff' }, { p: 1, c: '#b33bff' }] },
  { name: 'Ink', stops: [{ p: 0, c: '#111111' }, { p: 1, c: '#f2f1ed' }] },
];

// Layers tab
function paneLayers(p) {
  const list = h('ul', { class: 'layers' });
  const addMenu = Menu({
    options: [...TYPES.filter(t => t !== 'image'), 'image', 'text'].map(t => ({ v: t, label: typeName(t), icon: t === 'text' ? I.text : I[t] })),
    get: () => '', set: t => t === 'image' ? pickImage() : t === 'spline' ? addLayer('spline') : addLayer(t),
  });
  addMenu.btn.innerHTML = '';
  addMenu.btn.append(icon(I.plus, 15), h('span', {}, 'Add'));
  addMenu.btn.style.height = '28px';
  const tools = h('div', { class: 'layer-tools' },
    h('button', { type: 'button', class: 'ibtn', title: 'Duplicate  (Ctrl+D)', 'aria-label': 'Duplicate layer', onclick: dupLayer, disabled: !cur() }, icon(I.dup, 16)),
    h('button', { type: 'button', class: 'ibtn', title: 'Delete  (Del)', 'aria-label': 'Delete layer', onclick: () => delLayer(), disabled: !cur() }, icon(I.trash, 16)),
    addMenu.el,
  );
  const rows = [...S.layers].reverse();
  if (!rows.length) list.append(h('li', { class: 'empty' }, 'No layers yet. Add one from the toolbar, draw a light with the pen (L), or press Shuffle.'));
  rows.forEach(l => list.append(layerRow(l)));
  p.append(Section(`Layers  ${S.layers.length}/8`, 'layers', [list], { actions: [tools] }));

  const l = cur();
  if (l) p.append(layerProps(l));

  p.append(Section('Scene', 'scene', [
    reg(ColorField({ label: 'Background', ...bind('bg') })),
    reg(Slider({ label: 'Warp', min: 0, max: .4, step: .005, def: 0, ...bind('warp.amount'), hint: 'Bends everything with flowing noise' })),
    reg(Slider({ label: 'Warp scale', min: .2, max: 6, step: .05, def: 1.5, ...bind('warp.scale') })),
  ]));
  p.append(Section('Motion', 'motion', [
    reg(Slider({ label: 'Loop', min: 1, max: 30, step: .5, def: 8, unit: 's', ...bind('anim.duration'), hint: 'Length of one seamless loop' })),
    reg(Slider({ label: 'Flow', min: 0, max: 1.5, step: .01, def: .25, ...bind('warp.flow'), hint: 'How far the warp travels per loop' })),
    reg(Slider({ label: 'Drift', min: 0, max: 2, step: .01, def: 0, ...bind('drift'), hint: 'Layers orbit gently over the loop' })),
    h('p', { class: 'note' }, 'Everything loops seamlessly, so video exports repeat without a seam. Light spline pulses travel once per loop.'),
  ], { defaultOpen: false }));
}

const swatchBg = l => l.type === 'band' ? 'linear-gradient(180deg,#5a6cff,#fff,#ffb340,#ff4a2a)' : l.type === 'spline' && l.cmode === 'spectrum' ? rampCss(RAMP_PRESETS[4].stops) : rampCss(l.ramp || []);

let dragRow = null;
function layerRow(l) {
  const name = h('span', { class: 'l-name' }, l.name);
  const sw = h('span', { class: 'l-sw', style: { background: swatchBg(l) } });
  const eye = h('button', { type: 'button', class: 'ibtn', 'aria-label': l.visible ? 'Hide layer' : 'Show layer', onclick: e => { e.stopPropagation(); change(s => { const x = layerOf(s, l.id); x.visible = !x.visible; }, { structural: true }); } }, icon(l.visible ? I.eye : I.eyeOff, 15));
  const row = h('li', {
    class: 'layer' + (l.id === sel ? ' is-sel' : '') + (l.visible ? '' : ' is-hidden'), draggable: 'true', tabindex: 0,
    onclick: () => select(l.id),
    onkeydown: e => { if (e.key === 'Enter') select(l.id); },
  }, h('span', { class: 'l-type' }, icon(layerIcon(l), 16)), sw, name, h('span', { class: 'l-blend' }, l.blend === 'normal' ? '' : l.blend), eye);
  name.addEventListener('dblclick', e => {
    e.stopPropagation();
    const inp = h('input', { value: l.name, 'aria-label': 'Layer name' });
    name.innerHTML = ''; name.append(inp); inp.focus(); inp.select();
    const done = ok => { if (ok && inp.value.trim()) change(s => { layerOf(s, l.id).name = inp.value.trim(); }, { structural: true }); else renderPanel(); };
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); ev.stopPropagation(); });
    inp.addEventListener('blur', () => done(true));
  });
  dndRow(row, () => (dragRow = l.id), () => dragRow, (moving, before) => change(s => {
    const from = s.layers.findIndex(x => x.id === moving);
    const [m] = s.layers.splice(from, 1);
    const to = s.layers.findIndex(x => x.id === l.id);
    s.layers.splice(before ? to + 1 : to, 0, m);   // list is top-of-stack first
  }, { structural: true }), l.id);
  controls.push({ update: () => { const x = layerOf(S, l.id); if (x) sw.style.background = swatchBg(x); } });
  return row;
}

// Shared drag-to-reorder for layer rows and effect cards
function dndRow(row, start, getDragging, drop, id) {
  row.addEventListener('dragstart', e => { start(); row.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
  row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); });
  row.addEventListener('dragover', e => {
    const d = getDragging();
    if (!d || d === id) return;
    e.preventDefault();
    const r = row.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    row.classList.toggle('drop-before', before); row.classList.toggle('drop-after', !before);
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
  row.addEventListener('drop', e => {
    e.preventDefault();
    row.classList.remove('drop-before', 'drop-after');
    const d = getDragging();
    if (!d || d === id) return;
    const r = row.getBoundingClientRect();
    drop(d, e.clientY < r.top + r.height / 2);
  });
}

const blendOpts = BLENDS.map(b => ({ v: b, label: b[0].toUpperCase() + b.slice(1) }));
const FONTS = [
  { v: '"Schibsted Grotesk", sans-serif', label: 'Schibsted Grotesk' },
  { v: '"Fragment Mono", monospace', label: 'Fragment Mono' },
  { v: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { v: 'system-ui, sans-serif', label: 'System' },
  { v: 'Impact, "Arial Black", sans-serif', label: 'Condensed' },
];
const sl = (o, k, def, label, min, max, step, extra = {}) => reg(Slider({ label, min, max, step, def, ...lbind(k), ...extra }));

function layerProps(l) {
  const T = l.type, kids = [];
  const isText = T === 'image' && l.src === 'text';
  kids.push(reg(Menu({ label: 'Blend', options: blendOpts, ...lbind('blend', { structural: true }) })));
  if (T === 'spline') {
    kids.push(reg(Seg({ label: 'Style', options: SPLINE_STYLES.map(v => ({ v, label: { neon: 'Neon', paint: 'Paint', silk: 'Silk' }[v] })), ...lbind('style') })));
    kids.push(reg(Seg({ label: 'Colour', options: SPLINE_COLOR.map(v => ({ v, label: { along: 'Along', across: 'Across', spectrum: 'Spectrum' }[v] })), ...lbind('cmode', { structural: true }) })));
  }
  if (isText) {
    const ta = h('textarea', { class: 'text-in', rows: 2, 'aria-label': 'Text', spellcheck: 'false' });
    ta.value = l.text;
    ta.addEventListener('input', () => change(s => { layerOf(s, sel).text = ta.value; }, { key: sel + 'text' }));
    ta.addEventListener('keydown', e => e.stopPropagation());
    kids.push(h('div', { class: 'ctl ctl-block' }, h('label', { class: 'ctl-label' }, 'Text'), ta));
    kids.push(reg(Menu({ label: 'Font', options: FONTS, ...lbind('font') })));
    kids.push(sl(l, 'weight', 700, 'Weight', 100, 900, 100));
    kids.push(sl(l, 'spacing', 0, 'Spacing', -.15, .5, .005));
    kids.push(reg(Seg({ label: 'Align', options: [{ v: 'left', label: 'Left' }, { v: 'center', label: 'Centre' }, { v: 'right', label: 'Right' }], small: true, ...lbind('align') })));
  }
  if (T === 'image' && !isText) {
    kids.push(h('button', { type: 'button', class: 'btn', style: { justifySelf: 'start', height: '28px', fontSize: '12px' }, onclick: () => pickImage(l.id) }, icon(I.upload, 14), 'Replace image'));
  }
  const showRamp = !(T === 'spline' && l.cmode === 'spectrum');
  if (showRamp) kids.push(reg(RampEditor({ label: T === 'image' && !isText ? 'Tint colours' : 'Colours', presets: RAMP_PRESETS, ...lbind('ramp') })));
  if (T === 'image') kids.push(sl(l, 'a', isText ? 1 : 0, isText ? 'Colour' : 'Tint', 0, 1, .01, { hint: isText ? 'How much the colours replace plain white' : 'Maps the image brightness onto the colours' }));
  kids.push(sl(l, 'intensity', 1, T === 'linear' ? 'Mix' : 'Intensity', 0, 2, .01));
  if (T === 'spline') {
    kids.push(sl(l, 'sx', .006, 'Core width', .001, .08, .0005));
    kids.push(sl(l, 'sy', .05, l.style === 'silk' ? 'Spread' : 'Glow', .003, .5, .001));
    kids.push(sl(l, 'soft', .5, 'Falloff', 0, 1, .01));
    kids.push(sl(l, 'a', .6, 'Taper', 0, 1, .01, { hint: 'Thins the ends' }));
    kids.push(sl(l, 'b', 0, 'Pulse', 0, 1, .01, { hint: 'A light that travels along the line once per loop' }));
  } else if (T === 'image') {
    kids.push(sl(l, 'soft', 0, 'Feather', 0, 1, .01));
  } else {
    kids.push(sl(l, 'soft', 1, { ring: 'Outer glow', band: 'Length fade', linear: 'Smoothness' }[T] || 'Softness', 0, 1, .01));
  }
  if (T === 'ring') kids.push(sl(l, 'b', .06, 'Inner glow', 0, 1, .005));
  if (T === 'band') {
    kids.push(sl(l, 'a', .9, 'Dispersion', 0, 1, .01, { hint: 'Mix between the colours and a full spectrum' }));
    kids.push(sl(l, 'core', 1, 'Core', 0, 2, .01, { hint: 'White-hot line in the middle' }));
    kids.push(sl(l, 'b', -.5, 'Bend', -3, 3, .01));
  }
  if (T === 'conic') kids.push(sl(l, 'a', 1, 'Repeats', 1, 12, 1));
  if (T === 'noise') { kids.push(sl(l, 'a', .5, 'Threshold', 0, 1, .01)); kids.push(sl(l, 'b', .3, 'Seed', 0, 1, .001)); }
  const geo = [sl(l, 'x', 0, 'X', -1.5, 1.5, .001), sl(l, 'y', 0, 'Y', -1.5, 1.5, .001)];
  if (T !== 'spline') geo.push(sl(l, 'sx', .35, T === 'band' ? 'Length' : T === 'linear' ? 'Span' : T === 'image' ? 'Size' : 'Width', .01, 2, .001));
  if (T !== 'linear' && T !== 'spline' && T !== 'image') geo.push(sl(l, 'sy', .35, T === 'band' ? 'Thickness' : 'Height', .005, 2, .001));
  geo.push(sl(l, 'rot', 0, 'Rotation', -180, 180, .5, { unit: '°' }));
  const g = h('div', { class: 'sub' }, ...geo);
  g.style.display = 'grid'; g.style.gap = '6px';
  kids.push(g);
  kids.push(h('p', { class: 'note' }, T === 'spline'
    ? 'Drag the square points to reshape. Double-click a point to remove it. To add points, select the pen (L) while this light is selected.'
    : 'Drag on the canvas: centre moves, square sets size and angle, circle sets height. Alt keeps it round.'));
  if (T === 'spline' && penId !== l.id) kids.push(h('button', { type: 'button', class: 'btn', style: { justifySelf: 'start', height: '28px', fontSize: '12px' }, onclick: () => { setTool('pen'); penId = l.id; drawHandles(); } }, icon(I.pen, 14), 'Add points'));
  return Section(`${l.name}  ·  ${typeName(isText ? 'text' : T)}`, 'props', kids);
}

// Fold tab
const FOLD_INFO = {
  none: { label: 'None', svg: '<rect x="0" y="0" width="60" height="34" fill="url(#gf)"/>' },
  fluted: { label: 'Fluted', svg: [...Array(10)].map((_, i) => `<rect x="${i * 6}" y="0" width="6" height="34" fill="url(#gr)"/>`).join('') },
  folds: { label: 'Folds', svg: [...Array(5)].map((_, i) => `<path d="M${i * 16 - 14} 34 L${i * 16} 0 L${i * 16 + 12} 0 L${i * 16 - 2} 34Z" fill="currentColor" opacity="${.15 + i * .15}"/>`).join('') },
  accordion: { label: 'Accordion', svg: [...Array(6)].map((_, i) => `<rect x="${i * 10}" y="0" width="5" height="34" fill="currentColor" opacity=".55"/><rect x="${i * 10 + 5}" y="0" width="5" height="34" fill="currentColor" opacity=".15"/>`).join('') },
  wave: { label: 'Wave', svg: [0, 1, 2, 3].map(i => `<path d="M0 ${6 + i * 8} q7.5 -6 15 0 t15 0 t15 0 t15 0" stroke="currentColor" fill="none" stroke-width="2.4" opacity="${.3 + i * .2}"/>`).join('') },
  tiles: { label: 'Tiles', svg: [...Array(12)].map((_, i) => `<rect x="${(i % 6) * 10 + 1}" y="${Math.floor(i / 6) * 17 + 1}" width="8" height="15" rx="1.5" fill="url(#gt)"/>`).join('') },
};
const svgDefs = '<defs><linearGradient id="gf" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".1"/><stop offset="1" stop-color="currentColor" stop-opacity=".6"/></linearGradient><linearGradient id="gr" x2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".65"/><stop offset=".8" stop-color="currentColor" stop-opacity=".1"/><stop offset="1" stop-color="currentColor" stop-opacity=".35"/></linearGradient><radialGradient id="gt" cx=".35" cy=".3"><stop offset="0" stop-color="currentColor" stop-opacity=".7"/><stop offset="1" stop-color="currentColor" stop-opacity=".1"/></radialGradient></defs>';

function chips(items, get, set) {
  const wrap = h('div', { class: 'chips' });
  const btns = items.map(([v, info]) => {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => set(v) },
      h('span', { html: `<svg viewBox="0 0 60 34" preserveAspectRatio="none">${svgDefs}${info.svg}</svg>` }), h('span', {}, info.label));
    b.dataset.v = v;
    return b;
  });
  wrap.append(...btns);
  const update = () => btns.forEach(b => { const on = b.dataset.v === get(); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
  update();
  return reg({ el: wrap, update });
}

function paneFold(p) {
  const t = S.fold.type;
  p.append(Section('Fold type', 'foldtype', [
    chips(FOLDS.map(k => [k, FOLD_INFO[k]]), () => S.fold.type, v => change(s => { s.fold.type = v; }, { structural: true })),
  ]));
  if (t === 'none') {
    p.append(Section('Smear', 'smear', [
      reg(Slider({ label: 'Angle', min: -90, max: 90, step: .5, def: 0, unit: '°', ...bind('fold.angle') })),
      reg(Slider({ label: 'Smear', min: 0, max: .3, step: .002, def: 0, ...bind('fold.smear'), hint: 'Directional blur' })),
      reg(Slider({ label: 'Chroma', min: 0, max: 1, step: .01, def: 0, ...bind('fold.chroma'), hint: 'Splits colour channels' })),
    ]));
    return;
  }
  const shape = [
    reg(Slider({ label: 'Angle', min: -90, max: 90, step: .5, def: 0, unit: '°', ...bind('fold.angle') })),
    reg(Slider({ label: t === 'tiles' ? 'Tiles' : 'Strips', min: 1, max: 120, step: .1, def: 14, ...bind('fold.count'), hint: 'Per frame height' })),
    reg(Slider({ label: 'Refraction', min: -2, max: 2, step: .01, def: .5, ...bind('fold.strength') })),
  ];
  if (t === 'folds' || t === 'wave') shape.push(reg(Slider({ label: 'Slide', min: -.6, max: .6, step: .002, def: 0, ...bind('fold.shift'), hint: 'Each strip slides along itself' })));
  if (t === 'folds' || t === 'accordion') shape.push(reg(Slider({ label: 'Jitter', min: 0, max: .5, step: .002, def: 0, ...bind('fold.jitter') })));
  p.append(Section('Shape', 'foldshape', shape));
  p.append(Section('Light', 'foldlight', [
    reg(Slider({ label: 'Shading', min: 0, max: 1.5, step: .01, def: .3, ...bind('fold.shading') })),
    reg(Slider({ label: 'Highlight', min: 0, max: .6, step: .005, def: 0, ...bind('fold.highlight') })),
    reg(Slider({ label: 'Chroma', min: 0, max: 1, step: .01, def: 0, ...bind('fold.chroma'), hint: 'Prism split at the edges' })),
    reg(Slider({ label: 'Smear', min: 0, max: .3, step: .002, def: 0, ...bind('fold.smear'), hint: 'Blur along the strips' })),
  ]));
}

// ---------- Effects tab: an ordered, reorderable stack ----------
const HT_INFO = {
  dots: { label: 'Dots', svg: [...Array(40)].map((_, i) => `<circle cx="${(i % 10) * 6 + 3}" cy="${Math.floor(i / 10) * 8 + 5}" r="${.6 + (i % 10) * .28}" fill="currentColor"/>`).join('') },
  grid: { label: 'Grid', svg: [...Array(40)].map((_, i) => `<circle cx="${(i % 10) * 6 + 3}" cy="${Math.floor(i / 10) * 8 + 5}" r="1.2" fill="currentColor" opacity="${.15 + (i % 10) * .09}"/>`).join('') },
  lines: { label: 'Lines', svg: [...Array(6)].map((_, i) => `<rect x="0" y="${i * 6 + 1}" width="60" height="${.6 + i * .7}" fill="currentColor"/>`).join('') },
  dither: { label: 'Dither', svg: [...Array(120)].map((_, i) => { const x = i % 20, y = Math.floor(i / 20); return ((x * 7 + y * 13) % 20) < x ? `<rect x="${x * 3}" y="${y * 6}" width="3" height="3" fill="currentColor"/>` : ''; }).join('') },
};
const FX_NOTE = {
  adjust: 'Exposure, contrast, saturation and hue.',
  grade: 'Lift, gamma, gain, white balance and split toning.',
  gradmap: 'Maps brightness onto a colour ramp for duotone looks.',
  bloom: 'Bright parts glow outward.',
  halation: 'Warm film glow around highlights.',
  lens: 'Barrel distortion, colour fringing and soft edges.',
  blur: 'Gaussian blur, or tilt-shift with a sharp band.',
  vignette: 'Darkens or tints the edges.',
  halftone: 'Print dots, grid, lines or dither.',
  grain: 'Film grain.',
};
const FX_ORDER = ['adjust', 'grade', 'gradmap', 'bloom', 'halation', 'lens', 'blur', 'vignette', 'halftone', 'grain'];
let dragFx = null;

function addFx(type) {
  const x = makeFx(type);
  // keep grain last and halftone near the end by default
  const tail = S.fx.findIndex(f => f.type === 'grain' || (f.type === 'halftone' && type !== 'grain'));
  change(s => { if (tail >= 0 && type !== 'grain') s.fx.splice(tail, 0, x); else s.fx.push(x); }, { structural: true });
  fxOpen.add(x.id); lsSet('fold.fxOpen', [...fxOpen]);
  renderPanel();
}

function paneEffects(p) {
  const addMenu = Menu({
    options: FX_ORDER.map(t => ({ v: t, label: FX_DEFS[t].label, note: S.fx.some(f => f.type === t) ? 'added' : '' })),
    get: () => '', set: addFx,
  });
  addMenu.btn.innerHTML = '';
  addMenu.btn.append(icon(I.plus, 15), h('span', {}, 'Add effect'));
  const head = h('div', { class: 'fx-head' }, h('p', { class: 'note' }, 'Effects run top to bottom. Drag the handle to reorder.'), addMenu.el);
  const list = h('div', { class: 'fx-list' });
  if (!S.fx.length) list.append(h('div', { class: 'empty' }, 'No effects. Add bloom, a colour grade or grain.'));
  S.fx.forEach(x => list.append(fxCard(x)));
  p.append(h('div', { class: 'fx-wrap' }, head, list));
}

function fxCard(x) {
  const open = fxOpen.has(x.id);
  const fb = (k, o = {}) => fbind(x.id, k, o);
  const S_ = (label, k, min, max, step, extra = {}) => reg(Slider({ label, min, max, step, def: FX_DEFAULTS[x.type][k], ...fb(k), ...extra }));
  const kids = [];
  switch (x.type) {
    case 'adjust':
      kids.push(S_('Exposure', 'exposure', -3, 3, .01), S_('Contrast', 'contrast', -1, 1, .01), S_('Saturation', 'saturation', 0, 2, .01), S_('Hue', 'hue', -180, 180, 1, { unit: '°' }));
      break;
    case 'grade':
      kids.push(S_('Lift', 'lift', -.3, .3, .002), S_('Gamma', 'gamma', .3, 3, .01), S_('Gain', 'gain', 0, 2.5, .01),
        S_('Temperature', 'temp', -1, 1, .01), S_('Tint', 'tint', -1, 1, .01),
        h('div', { class: 'sub' }),
        reg(ColorField({ label: 'Shadows', ...fb('shadowColor') })), S_('Amount', 'shadows', 0, 1, .01),
        reg(ColorField({ label: 'Highlights', ...fb('highlightColor') })), S_('Amount', 'highlights', 0, 1, .01),
        S_('Balance', 'balance', -1, 1, .01));
      break;
    case 'gradmap':
      kids.push(reg(RampEditor({ label: 'Map', presets: RAMP_PRESETS, ...fb('ramp') })), S_('Amount', 'amount', 0, 1, .01), S_('Contrast', 'contrast', .2, 3, .01));
      break;
    case 'bloom':
      kids.push(S_('Threshold', 'threshold', 0, 1.5, .01), S_('Radius', 'radius', 2, 200, 1), S_('Intensity', 'intensity', 0, 3, .01), S_('Knee', 'knee', 0, 1, .01, { hint: 'Softens where the glow starts' }), reg(ColorField({ label: 'Tint', ...fb('tint') })));
      break;
    case 'halation':
      kids.push(S_('Threshold', 'threshold', 0, 1.5, .01), S_('Radius', 'radius', 2, 120, 1), S_('Intensity', 'intensity', 0, 3, .01), reg(ColorField({ label: 'Colour', ...fb('color') })));
      break;
    case 'lens':
      kids.push(S_('Distortion', 'distortion', -.5, 1, .005), S_('Fringe', 'fringe', 0, 2, .01), S_('Edge blur', 'edgeBlur', 0, 2, .01));
      break;
    case 'blur':
      kids.push(S_('Radius', 'radius', 0, 120, .5), S_('Tilt-shift', 'tilt', 0, 1, .01, { hint: '0 blurs everything, 1 keeps a sharp band' }));
      if (x.tilt > 0) kids.push(S_('Focus', 'focus', 0, 1, .005), S_('Band', 'band', 0, 1, .005), S_('Angle', 'angle', -90, 90, .5, { unit: '°' }));
      break;
    case 'vignette':
      kids.push(S_('Amount', 'amount', 0, 1, .01), S_('Roundness', 'roundness', 0, 1, .01), S_('Softness', 'softness', 0, 1, .01), reg(ColorField({ label: 'Colour', ...fb('color') })));
      break;
    case 'halftone':
      kids.push(chips(Object.entries(HT_INFO), () => fxOf(S, x.id)?.mode, v => change(s => { fxOf(s, x.id).mode = v; }, { structural: true })),
        S_(x.mode === 'dither' ? 'Pixel' : 'Cell', 'cell', 2, 60, .1, { hint: 'Relative to a 1000 px frame' }));
      if (x.mode !== 'dither') kids.push(S_('Angle', 'angle', -90, 90, .5, { unit: '°' }));
      if (x.mode === 'grid') kids.push(S_('Dot size', 'dot', .02, 1, .005));
      kids.push(S_('Gamma', 'gamma', .2, 3, .01), S_('Mix', 'mix', 0, 1, .01), reg(Toggle({ label: 'Use image colour', ...fb('colored', { structural: true }) })));
      if (!x.colored) kids.push(reg(ColorField({ label: 'Ink', ...fb('ink') })));
      kids.push(reg(ColorField({ label: 'Paper', ...fb('paper') })),
        h('button', { type: 'button', class: 'btn', style: { justifySelf: 'start', height: '26px', fontSize: '12px' }, onclick: () => change(s => { const f = fxOf(s, x.id); [f.ink, f.paper] = [f.paper, f.ink]; }) }, 'Swap ink and paper'));
      break;
    case 'grain':
      kids.push(S_('Amount', 'amount', 0, .5, .002), S_('Size', 'size', .5, 6, .05, { hint: 'Relative to a 1000 px frame, so exports match the preview' }),
        reg(Toggle({ label: 'Colour grain', ...fb('colored') })), reg(Toggle({ label: 'Animated', ...fb('animated') })));
      break;
  }
  const onBtn = h('button', { type: 'button', class: 'toggle fx-on' + (x.on ? ' is-on' : ''), role: 'switch', 'aria-checked': x.on, 'aria-label': (x.on ? 'Turn off ' : 'Turn on ') + FX_DEFS[x.type].label, onclick: e => { e.stopPropagation(); change(s => { const f = fxOf(s, x.id); f.on = !f.on; }, { structural: true }); } }, h('span', { class: 'toggle-knob' }));
  const head = h('div', { class: 'fx-bar', draggable: 'true' },
    h('span', { class: 'fx-grip', title: 'Drag to reorder' }, icon(I.grip, 14)),
    onBtn,
    h('button', { type: 'button', class: 'fx-title', 'aria-expanded': open, onclick: () => { open ? fxOpen.delete(x.id) : fxOpen.add(x.id); lsSet('fold.fxOpen', [...fxOpen]); renderPanel(); } },
      h('b', {}, FX_DEFS[x.type].label), h('span', {}, FX_NOTE[x.type]), icon(I.chev, 14)),
    h('button', { type: 'button', class: 'ibtn', title: 'Remove', 'aria-label': 'Remove ' + FX_DEFS[x.type].label, onclick: e => { e.stopPropagation(); change(s => s.fx.splice(s.fx.findIndex(f => f.id === x.id), 1), { structural: true }); } }, icon(I.x, 14)));
  const card = h('div', { class: 'fx-card' + (open ? ' is-open' : '') + (x.on ? '' : ' is-off') }, head,
    h('div', { class: 'fx-body' }, h('div', { class: 'fx-inner' }, ...kids)));
  dndRow(head, () => (dragFx = x.id), () => dragFx, (moving, before) => change(s => {
    const from = s.fx.findIndex(f => f.id === moving);
    const [m] = s.fx.splice(from, 1);
    const to = s.fx.findIndex(f => f.id === x.id);
    s.fx.splice(before ? to : to + 1, 0, m);
  }, { structural: true }), x.id);
  return card;
}

// Export tab
const saveExp = () => lsSet('fold.export', exp);
function ebind(k, after) { return { get: () => exp[k], set: v => { exp[k] = v; saveExp(); after?.(); updateChrome(); } }; }

function paneExport(p) {
  const longOpts = [720, 1080, 1440, 2160, 3840, 5120, 7680].map(v => ({ v, label: v + ' px', note: { 2160: '4K', 3840: '4K+', 7680: '8K' }[v] || '' }));
  const sizeOut = h('div', { class: 'size-in' });
  const wIn = h('input', { inputmode: 'numeric', 'aria-label': 'Width' }), hIn = h('input', { inputmode: 'numeric', 'aria-label': 'Height' });
  sizeOut.append(wIn, h('span', {}, '×'), hIn);
  const syncSize = () => { const [w, hh] = X.sizeFor(S.aspect, exp.long); wIn.value = w; hIn.value = hh; };
  const typed = which => {
    const v = parseInt((which === 'w' ? wIn : hIn).value);
    if (!v || v < 16) return syncSize();
    const ar = S.aspect.w / S.aspect.h;
    const w = which === 'w' ? v : Math.round(v * ar), hh = which === 'h' ? v : Math.round(v / ar);
    exp.long = Math.max(w, hh); saveExp(); syncSize(); updateChrome();
  };
  wIn.addEventListener('change', () => typed('w'));
  hIn.addEventListener('change', () => typed('h'));
  syncSize();
  controls.push({ update: syncSize });

  const fmt = Seg({ options: [{ v: 'png', label: 'PNG' }, { v: 'jpg', label: 'JPG' }, { v: 'webp', label: 'WebP' }], ...ebind('format', () => renderPanel()) });
  const imgBtn = h('button', { type: 'button', class: 'btn primary wide', onclick: () => doImage(imgBtn) }, icon(I.down, 16), h('span', {}, 'Download image'), h('span', { class: 'kbd' }, 'Ctrl E'));
  p.append(Section('Frame', 'frame', [
    reg(Menu({ label: 'Aspect', options: aspectOptions(), get: () => S.aspect.id, set: setAspect, render: o => [ratioIcon(o.a), h('span', {}, o.label), h('span', { class: 'menu-note' }, o.note)] })),
    customAspect(),
    reg(Slider({ label: 'Crop zoom', min: .1, max: 6, step: .01, def: 1, ...bind('view.zoom') })),
    reg(Slider({ label: 'Crop X', min: -1.5, max: 1.5, step: .001, def: 0, ...bind('view.x') })),
    reg(Slider({ label: 'Crop Y', min: -1.5, max: 1.5, step: .001, def: 0, ...bind('view.y') })),
    h('p', { class: 'note' }, 'Scroll on the canvas to zoom, hold Space or use the hand to pan. The export is exactly the frame.'),
  ]));
  p.append(Section('Image', 'image', [
    fmt.el,
    reg(Menu({ label: 'Long edge', options: longOpts, ...ebind('long', syncSize) })),
    h('div', { class: 'ctl ctl-block' }, h('label', { class: 'ctl-label' }, 'Size'), sizeOut),
    exp.format !== 'png' ? reg(Slider({ label: 'Quality', min: .5, max: 1, step: .01, def: .92, ...ebind('quality') })) : null,
    h('p', { class: 'note' }, `Renders the frame at the current moment of the loop. Up to ${engine.maxSize}px per side on this GPU.`),
    imgBtn,
    h('button', { type: 'button', class: 'btn wide', onclick: copyImage }, icon(I.copy, 16), h('span', {}, 'Copy PNG to clipboard')),
  ].filter(Boolean)));

  // video
  const prog = h('div', { class: 'progress', hidden: true }, h('i'));
  const vidBtn = h('button', { type: 'button', class: 'btn primary wide', onclick: () => doVideo(vidBtn, prog) }, icon(I.down, 16), h('span', {}, recording ? 'Cancel' : 'Render video'));
  const frames = Math.round(S.anim.duration * exp.fps * exp.loops);
  p.append(Section('Video loop', 'video', [
    reg(Seg({ label: 'Frame rate', options: [24, 30, 60].map(v => ({ v, label: v + ' fps' })), small: true, ...ebind('fps', () => renderPanel()) })),
    reg(Menu({ label: 'Long edge', options: [720, 1080, 1440, 2160, 3840].map(v => ({ v, label: v + ' px', note: v >= 2160 ? '4K' : '' })), ...ebind('vlong') })),
    reg(Slider({ label: 'Loops', min: 1, max: 6, step: 1, def: 1, ...ebind('loops', () => renderPanel()) })),
    reg(Slider({ label: 'Loop length', min: 1, max: 30, step: .5, def: 8, unit: 's', ...bind('anim.duration') })),
    h('p', { class: 'note' }, X.canEncode()
      ? `Renders all ${frames} frames one by one into an MP4, so nothing stutters. You can switch tabs while it runs.`
      : 'This browser has no video encoder, so it records in real time as WebM. Keep this tab in front.'),
    prog, vidBtn,
  ], { defaultOpen: false }));

  // wallpaper pack
  const packProg = h('div', { class: 'progress', hidden: true }, h('i'));
  const packBtn = h('button', { type: 'button', class: 'btn primary wide', onclick: () => doPack(packBtn, packProg) }, icon(I.down, 16), h('span', {}, 'Download ZIP'));
  const checks = h('div', { class: 'checks' }, ...X.WALLPAPERS.map(w => {
    const on = exp.pack.includes(w.id);
    return h('label', { class: 'check' + (on ? ' is-on' : '') },
      h('input', { type: 'checkbox', checked: on, onchange: e => { exp.pack = e.target.checked ? [...exp.pack, w.id] : exp.pack.filter(x => x !== w.id); saveExp(); e.target.parentElement.classList.toggle('is-on', e.target.checked); } }),
      h('span', { class: 'check-box' }), h('span', {}, w.label), h('span', { class: 'mono' }, `${w.w}×${w.h}`));
  }));
  p.append(Section('Wallpaper pack', 'pack', [
    reg(Seg({ options: [{ v: 'png', label: 'PNG' }, { v: 'jpg', label: 'JPG' }], small: true, ...ebind('packFormat') })),
    checks,
    h('p', { class: 'note' }, 'One file per size in a ZIP. Each keeps the composition and fills its own shape.'),
    packProg, packBtn,
  ], { defaultOpen: false }));

  const sk = X.skippedInCode(S);
  const codeRow = (title, sub, make, ext, mime) => h('div', { class: 'code-row' },
    h('div', { class: 't' }, h('b', {}, title), h('span', {}, sub)),
    h('button', { type: 'button', class: 'ibtn', title: 'Copy', 'aria-label': 'Copy ' + title, onclick: () => copyText(make(S), title) }, icon(I.copy, 16)),
    h('button', { type: 'button', class: 'ibtn', title: 'Download', 'aria-label': 'Download ' + title, onclick: () => X.download(new Blob([make(S)], { type: mime }), `fold-${slug()}.${ext}`) }, icon(I.down, 16)));
  p.append(Section('Code', 'code', [
    codeRow('Shadertoy', 'Paste into a new shader, animates', X.shadertoyCode, 'glsl', 'text/plain'),
    codeRow('GLSL (WebGL2)', 'Fragment shader, uResolution + uTime', X.glslCode, 'frag', 'text/plain'),
    codeRow('HTML page', 'Self-contained live background', X.htmlCode, 'html', 'text/html'),
    codeRow('CSS fallback', 'Rough radial-gradient stand-in', X.cssFallback, 'css', 'text/css'),
    sk.fx.length || sk.images ? h('p', { class: 'note' }, `Code runs in one pass, so it leaves out ${[sk.fx.join(', '), sk.images ? 'image and text layers' : ''].filter(Boolean).join(' and ')}.`) : null,
  ].filter(Boolean), { defaultOpen: false }));

  const fileIn = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', onchange: e => e.target.files[0] && loadFile(e.target.files[0]) });
  p.append(Section('Preset file', 'file', [
    h('div', { class: 'row3' },
      h('button', { type: 'button', class: 'btn', onclick: savePreset }, icon(I.down, 15), 'Save'),
      h('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, icon(I.upload, 15), 'Open'),
      h('button', { type: 'button', class: 'btn', onclick: copyLink }, icon(I.link, 15), 'Link')),
    fileIn,
    h('p', { class: 'note' }, 'Preset files carry your images too. Links are lighter and leave images out. You can also drop a preset on the canvas.'),
  ], { defaultOpen: false }));
}

function customAspect() {
  const wI = h('input', { inputmode: 'decimal', value: S.aspect.w, 'aria-label': 'Ratio width' });
  const hI = h('input', { inputmode: 'decimal', value: S.aspect.h, 'aria-label': 'Ratio height' });
  const apply = () => {
    const w = parseFloat(wI.value), hh = parseFloat(hI.value);
    if (!(w > 0 && hh > 0)) return;
    change(s => { s.aspect = { id: `${w}:${hh}`, w, h: hh }; }, { structural: true });
    layout();
  };
  wI.addEventListener('change', apply); hI.addEventListener('change', apply);
  return h('div', { class: 'ctl ctl-block' }, h('label', { class: 'ctl-label' }, 'Ratio'), h('div', { class: 'size-in' }, wI, h('span', {}, ':'), hI,
    h('button', { type: 'button', class: 'ibtn', title: 'Swap', 'aria-label': 'Swap orientation', onclick: flipAspect }, icon(I.swap, 16))));
}

const slug = () => (S.layers[0]?.name || 'gradient').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + S.aspect.id.replace(/[:.]/g, 'x');

async function doImage(btn) {
  const [w, hh] = X.sizeFor(S.aspect, exp.long);
  btn?.classList.add('is-busy');
  const t = toast(`Rendering ${w} × ${hh}…`, { progress: true });
  await new Promise(r => setTimeout(r, 30));
  try {
    const blob = await X.exportImage(S, { w, h: hh, format: exp.format, quality: exp.quality, phase });
    X.download(blob, `fold-${slug()}-${w}x${hh}.${exp.format}`);
    t.done(`Saved ${w} × ${hh} ${exp.format.toUpperCase()}`, 'ok');
  } catch (e) { t.done(e.message, 'err'); }
  btn?.classList.remove('is-busy');
}
async function copyImage() {
  const [w, hh] = X.sizeFor(S.aspect, Math.min(exp.long, 2160));
  try {
    const blob = await X.exportImage(S, { w, h: hh, format: 'png', phase });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(`Copied ${w} × ${hh} PNG`, { kind: 'ok' });
  } catch (e) { toast('Clipboard is blocked here: ' + e.message, { kind: 'err' }); }
}
let recording = null;
async function doVideo(btn, prog) {
  if (recording) { recording.abort(); return; }
  recording = new AbortController();
  const [w, hh] = X.sizeFor(S.aspect, exp.vlong);
  const ev = n => n - (n % 2);
  btn.lastChild.textContent = 'Cancel';
  prog.hidden = false;
  const t = toast('Rendering video…', { progress: true });
  try {
    const { blob, ext } = await X.exportVideo(clone(S), {
      w: ev(w), h: ev(hh), fps: exp.fps, loops: exp.loops, signal: recording.signal,
      onProgress: p => { prog.firstChild.style.width = p * 100 + '%'; t.set(p, `Rendering video… ${Math.round(p * 100)}%`); },
    });
    X.download(blob, `fold-${slug()}-${ev(w)}x${ev(hh)}.${ext}`);
    t.done(`Saved ${ext.toUpperCase()} loop`, 'ok');
  } catch (e) { t.done(e.message, e.message === 'Cancelled' ? '' : 'err'); }
  btn.lastChild.textContent = 'Render video';
  prog.hidden = true; prog.firstChild.style.width = 0;
  recording = null;
}
async function doPack(btn, prog) {
  if (!exp.pack.length) return toast('Pick at least one size.', { kind: 'err' });
  btn.classList.add('is-busy'); prog.hidden = false;
  const t = toast('Rendering wallpapers…', { progress: true });
  try {
    const blob = await X.exportPack(clone(S), exp.pack, {
      format: exp.packFormat, phase, name: slug().replace(/-[^-]+$/, ''),
      onProgress: (p, label) => { prog.firstChild.style.width = p * 100 + '%'; t.set(p, label ? `Rendering ${label}…` : 'Packing…'); },
    });
    X.download(blob, `fold-${slug().replace(/-[^-]+$/, '')}-wallpapers.zip`);
    t.done(`Saved ${exp.pack.length} wallpapers`, 'ok');
  } catch (e) { t.done(e.message, 'err'); }
  btn.classList.remove('is-busy'); prog.hidden = true; prog.firstChild.style.width = 0;
}
async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`, { kind: 'ok' }); }
  catch { toast('Clipboard is blocked here, use download instead.', { kind: 'err' }); }
}
function savePreset() {
  const out = { ...S, assets: exportAssets(S) };
  X.download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), `${slug()}.fold.json`);
}
async function loadFile(file) {
  try {
    const s = JSON.parse(await file.text());
    if (!s.layers) throw 0;
    if (s.assets) await importAssets(s.assets);
    delete s.assets;
    replaceState(s);
    toast('Preset loaded', { kind: 'ok' });
  } catch { toast('That file is not a Fold preset.', { kind: 'err' }); }
}

// share link: deflate + base64url in the hash
async function encodeState(s) {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let out = bytes, tag = 'j';
  if (window.CompressionStream) { out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); tag = 'z'; }
  let bin = ''; out.forEach(b => (bin += String.fromCharCode(b)));
  return tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decodeState(str) {
  const tag = str[0], b = atob(str.slice(1).replace(/-/g, '+').replace(/_/g, '/'));
  let bytes = Uint8Array.from(b, c => c.charCodeAt(0));
  if (tag === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function copyLink() {
  const url = location.href.split('#')[0] + '#s=' + await encodeState(S);
  history.replaceState(null, '', url);
  await copyText(url, 'Link');
  if (S.layers.some(l => l.type === 'image' && l.src !== 'text')) toast('Images are not in links. Use Save for a file that keeps them.');
}

// drag & drop: presets and images
stage.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); stage.classList.add('is-drop'); } });
stage.addEventListener('dragleave', e => { if (e.target === $('drop') || !stage.contains(e.relatedTarget)) stage.classList.remove('is-drop'); });
stage.addEventListener('drop', e => {
  e.preventDefault(); stage.classList.remove('is-drop');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (f.type.startsWith('image/')) addImage(f); else loadFile(f);
});

// ---------- keyboard ----------
const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { if (typing(e)) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); doImage(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); savePreset(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dupLayer(); return; }
  if (typing(e) || mod) return;
  if (e.code === 'Space' && !spaceDown) { spaceDown = true; stage.classList.add('is-panning'); e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (penId && (k === 'enter' || k === 'escape')) { finishPen(); return; }
  if (k === 'v') setTool('select');
  else if (k === 'h') setTool('hand');
  else if (k === 'l') setTool('pen');
  else if (k === 't') addLayer('text');
  else if (k === 'p' || k === 'k') togglePlay();
  else if (k === 'r') shuffle();
  else if (k === '0') resetCrop();
  else if ((k === 'delete' || k === 'backspace') && cur()) delLayer();
  else if (k === 'escape') select(null);
  else if (k === '[' || k === ']') {
    const i = S.layers.findIndex(l => l.id === sel), n = S.layers.length;
    if (n) select(S.layers[((i < 0 ? 0 : i) + (k === ']' ? 1 : -1) + n) % n].id);
  } else if (e.key.startsWith('Arrow') && cur()) {
    e.preventDefault();
    const d = e.shiftKey ? .05 : .005;
    const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    change(s => { const l = layerOf(s, sel); l.x = +(l.x + dx).toFixed(4); l.y = +(l.y + dy).toFixed(4); }, { key: 'nudge' });
  }
});
addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('is-panning'); } });
document.fonts?.addEventListener?.('loadingdone', () => { dirty = true; drawHandles(); });

// ---------- boot ----------
async function boot() {
  // images load in the background; never hold up the first frame for them
  const assets = loadAssets().then(() => { dirty = true; });
  await Promise.race([assets, new Promise(r => setTimeout(r, 1200))]);
  let s = null;
  const m = location.hash.match(/#s=(.+)$/);
  if (m) { try { s = await decodeState(m[1]); } catch {} }
  s ??= lsGet('fold.state', null);
  S = normalize(s && s.layers ? s : clone(PRESETS[0].state));
  sel = S.layers[S.layers.length - 1]?.id ?? null;
  buildTop();
  setTool('select');
  layout();
  renderPanel();
  requestAnimationFrame(tick);
  buildStripHead();
  await document.fonts.ready;
  buildStrip();
}
boot();
