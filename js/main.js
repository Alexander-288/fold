import { Engine, TYPES, BLENDS, FOLDS, HALFTONES } from './engine.js';
import { ASPECTS, PRESETS, defaultState, normalize, makeLayer, newId, randomState } from './state.js';
import { h, icon, Slider, Seg, Menu, ColorField, Toggle, Section, moveBlob, toast, closeMenus } from './ui.js';
import * as X from './export.js';

const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- icons ----------
const I = {
  select: '<path d="M5 3.5 18.5 11l-6 1.6-2.7 6z"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V4.5a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',
  blob: '<ellipse cx="12" cy="12" rx="8" ry="6" transform="rotate(-25 12 12)"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4" opacity=".45"/>',
  band: '<path d="M3 15c4-5 14-5 18 0"/><path d="M3 11c4-5 14-5 18 0" opacity=".45"/>',
  linear: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 4v16M12 4v16" opacity=".45"/>',
  conic: '<circle cx="12" cy="12" r="8"/><path d="M12 12V4M12 12l6 5"/>',
  noise: '<path d="M4 14c2-4 5 1 7-3s5-3 9 1"/><path d="M4 18c3-3 6 0 9-2s5-1 7 0" opacity=".45"/>',
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
};

// ---------- state + history ----------
let S = null;
let sel = null;
let tool = 'select';
let playing = lsGet('fold.playing', true);
let phase = 0, frame = 0, dirty = true;
let tab = lsGet('fold.tab', 'layers');
const exp = { format: 'png', long: 2160, quality: .92, fps: 30, loops: 1, vlong: 1080, w: 0, h: 0, ...lsGet('fold.export', {}) };
const hist = [], fut = [];
let lastKey = null, lastT = 0;
let controls = [];

const layerOf = (s, id) => s.layers.find(l => l.id === id);
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
  if (!layerOf(S, sel)) sel = S.layers[S.layers.length - 1]?.id ?? null;
  lastKey = null;
  emit(true);
  layout();
}
function undo() { if (!hist.length) return; fut.push(JSON.stringify(S)); S = JSON.parse(hist.pop()); fix(); }
function redo() { if (!fut.length) return; hist.push(JSON.stringify(S)); S = JSON.parse(fut.pop()); fix(); }
function fix() { if (!layerOf(S, sel)) sel = S.layers[S.layers.length - 1]?.id ?? null; lastKey = null; emit(true); layout(); }

let saveT;
function emit(structural) {
  dirty = true;
  clearTimeout(saveT);
  saveT = setTimeout(() => lsSet('fold.state', S), 300);
  if (structural) renderPanel(); else controls.forEach(c => c.update());
  drawHandles();
  updateChrome();
}

// path binding: 'fold.count' -> get/set
function bind(path, { structural = false } = {}) {
  const ks = path.split('.');
  const get = () => ks.reduce((o, k) => o[k], S);
  const set = v => change(s => { const o = ks.slice(0, -1).reduce((o, k) => o[k], s); o[ks.at(-1)] = v; }, { key: path, structural });
  return { get, set, commit };
}
function lbind(prop, { structural = false } = {}) {
  return {
    get: () => cur()?.[prop],
    set: v => change(s => { const l = layerOf(s, sel); if (l) l[prop] = v; }, { key: sel + prop, structural }),
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
  if (dirty) { engine.render(S, phase, frame); dirty = false; }
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
  const padL = small ? 64 : 84, padR = small ? 16 : 40, padT = small ? 56 : 30, padB = (stripOpen ? 128 : 44) + 46;
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
  $('zoomPill').style.bottom = small ? '' : (stripOpen ? 140 : 46) + 'px';
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
  const rx = l.sx * k, ry = l.sy * k;
  const ax = [cx + ca * rx, cy + sa * rx], ay = [cx - sa * ry, cy + ca * ry];
  if (l.type === 'linear') {
    g.append(sv('line', { x1: cx - ca * rx, y1: cy - sa * rx, x2: ax[0], y2: ax[1], class: 'h-line' }));
  } else if (l.type === 'band') {
    const pts = [];
    for (let i = -10; i <= 10; i++) { const t = i / 10 * l.sx; const yy = -l.b * t * t; pts.push([cx + (ca * t - sa * yy) * k, cy + (sa * t + ca * yy) * k]); }
    g.append(sv('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'h-ell' }));
    g.append(sv('line', { x1: cx, y1: cy, x2: ay[0], y2: ay[1], class: 'h-line' }));
  } else {
    g.append(sv('ellipse', { cx, cy, rx, ry, transform: `rotate(${l.rot} ${cx} ${cy})`, class: 'h-ell' }));
    g.append(sv('line', { x1: cx, y1: cy, x2: ax[0], y2: ax[1], class: 'h-line' }));
  }
  const hx = sv('rect', { x: ax[0] - 5, y: ax[1] - 5, width: 10, height: 10, rx: 2, class: 'h-a' });
  hx.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'ax'); });
  g.append(hx);
  if (l.type !== 'linear') {
    const hy = sv('circle', { cx: ay[0], cy: ay[1], r: 5, class: 'h-a' });
    hy.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'ay'); });
    g.append(hy);
  }
  const c = sv('circle', { cx, cy, r: 6, class: 'h-c' });
  c.addEventListener('pointerdown', e => { e.stopPropagation(); startDrag(e, 'move'); });
  g.append(c);
  // name tag
  const tag = sv('g', { class: 'h-tag' });
  const txt = sv('text', { x: cx + 12, y: cy - 10 });
  txt.textContent = l.name;
  tag.append(txt);
  g.append(tag);
  svg.append(g);
  const bb = txt.getBBox();
  tag.insertBefore(sv('rect', { x: bb.x - 7, y: bb.y - 3, width: bb.width + 14, height: bb.height + 6, rx: (bb.height + 6) / 2 }), txt);
}

let drag = null;
function startDrag(e, mode) {
  const l = cur();
  if (!l && mode !== 'pan') return;
  e.preventDefault();
  const [px, py] = localPt(e);
  const [wx, wy] = toWorld(px, py);
  drag = { mode, id: e.pointerId, px, py, ox: l ? wx - l.x : 0, oy: l ? wy - l.y : 0, view: { ...S.view }, key: 'drag' + Math.random() };
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
    } else if (drag.mode === 'ax') {
      const dx = wx - l.x, dy = wy - l.y;
      l.sx = +Math.max(.01, Math.hypot(dx, dy)).toFixed(4);
      if (!e.shiftKey) l.rot = +(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
      if (e.altKey || l.type === 'ring' && e.ctrlKey) l.sy = l.sx;
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

let spaceDown = false;
frameEl.addEventListener('pointerdown', e => {
  if (e.button === 1 || tool === 'hand' || spaceDown) return startDrag(e, 'pan');
  if (e.button !== 0) return;
  const [px, py] = localPt(e);
  const [wx, wy] = toWorld(px, py);
  // topmost layer under the pointer
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const l = S.layers[i];
    if (!l.visible) continue;
    const a = -l.rot * Math.PI / 180, dx = wx - l.x, dy = wy - l.y;
    const u = (dx * Math.cos(a) - dy * Math.sin(a)) / l.sx, v = (dx * Math.sin(a) + dy * Math.cos(a)) / Math.max(l.sy, .02);
    const inside = l.type === 'linear' ? Math.abs(u) < 1 && Math.abs(v) < .1 : u * u + v * v < 1;
    if (inside) { select(l.id); return startDrag(e, 'move'); }
  }
  select(null);
});
stage.addEventListener('pointerdown', e => { if (e.target === stage && (e.button === 1 || tool === 'hand' || spaceDown)) startDrag(e, 'pan'); });

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
  drawHandles();
  if (tab === 'layers') renderPanel(); else updateChrome();
}

// ---------- toolbar ----------
const toolbar = $('toolbar');
const tbBlob = h('span', { class: 'tb-blob', 'data-axis': 'y', hidden: true });
const toolBtns = {};
function tb(id, label, ic, onclick, key) {
  const b = h('button', { type: 'button', class: 'tb-btn', 'data-label': key ? `${label}  ${key}` : label, 'aria-label': label, onclick }, icon(ic, 19));
  toolBtns[id] = b;
  return b;
}
toolbar.append(
  tbBlob,
  tb('select', 'Select', I.select, () => setTool('select'), 'V'),
  tb('hand', 'Pan & crop', I.hand, () => setTool('hand'), 'H'),
  h('div', { class: 'tb-div' }),
  ...TYPES.map(t => { const b = tb('add-' + t, 'Add ' + ({ band: 'spectrum', noise: 'cloud' }[t] || t), I[t], () => addLayer(t)); b.classList.add('tb-add'); return b; }),
  h('div', { class: 'tb-div tb-add' }),
  tb('shuffle', 'Shuffle', I.dice, shuffle, 'R'),
  tb('fit', 'Reset crop', I.fit, resetCrop, '0'),
);
function setTool(t) {
  tool = t;
  stage.dataset.tool = t;
  Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('is-on', k === t));
  moveBlob(tbBlob, toolBtns[t], toolbar);
  drawHandles();
}

// ---------- layer actions ----------
function addLayer(type) {
  if (S.layers.length >= 8) return toast('Eight layers is the limit.', { kind: 'err' });
  const l = makeLayer(type, { x: +S.view.x.toFixed(3), y: +S.view.y.toFixed(3) });
  const n = S.layers.filter(x => x.type === type).length;
  if (n) l.name += ' ' + (n + 1);
  change(s => s.layers.push(l), { structural: true });
  sel = l.id;
  setTab('layers');
  setTool('select');
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
  change(s => s.layers.splice(i, 1), { structural: true });
  if (sel === id) sel = S.layers[Math.min(i, S.layers.length - 1)]?.id ?? null;
  renderPanel(); drawHandles();
}
function shuffle() { replaceState(randomState(S)); }
function resetCrop() { change(s => { s.view = { zoom: 1, x: 0, y: 0 }; }, { structural: false }); commit(); }

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
  right.append(
    themeBtn,
    h('button', { type: 'button', class: 'btn primary', onclick: () => setTab('export') }, icon(I.down, 16), h('span', {}, 'Export')),
  );
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
  lsSet('fold.theme', next);
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

// zoom pill
const zoomVal = h('button', { class: 'z', type: 'button', title: 'Reset crop', onclick: resetCrop });
const zoomBy = f => { change(s => { s.view.zoom = +Math.min(20, Math.max(.1, s.view.zoom * f)).toFixed(4); }, { key: 'zoom' }); commit(); };
$('zoomPill').append(
  h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Zoom out', onclick: () => zoomBy(1 / 1.2) }, icon(I.minus, 15)),
  zoomVal,
  h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Zoom in', onclick: () => zoomBy(1.2) }, icon(I.plus, 15)),
);

// ---------- presets strip ----------
async function buildStrip() {
  const strip = $('strip');
  strip.append(h('button', { type: 'button', class: 'thumb dice', title: 'Shuffle a new one  (R)', onclick: shuffle }, icon(I.dice, 22)));
  const c = document.createElement('canvas');
  let eng;
  try { eng = new Engine(c, { preserve: true }); } catch { return; }
  PRESETS.forEach((p, i) => {
    const ar = p.state.aspect.w / p.state.aspect.h;
    c.height = 168; c.width = Math.round(168 * ar);
    eng.render(p.state, .1, 0);
    const b = h('button', { type: 'button', class: 'thumb', title: p.name, style: { animationDelay: i * 35 + 'ms' }, onclick: () => replaceState(clone(p.state)) },
      h('img', { src: c.toDataURL('image/jpeg', .85), alt: '' }), h('span', {}, p.name));
    strip.append(b);
  });
  eng.dispose();
}
$('stripToggle').addEventListener('click', () => { stripOpen = !stripOpen; lsSet('fold.strip', stripOpen); layout(); });

// ---------- inspector ----------
const TABS = [['layers', 'Layers'], ['fold', 'Fold'], ['finish', 'Finish'], ['export', 'Export']];
const tabsEl = $('tabs');
const tabBlob = h('span', { class: 'seg-blob', hidden: true });
const tabBtns = TABS.map(([id, label]) => h('button', { type: 'button', class: 'tab', 'data-tab': id, onclick: () => setTab(id) }, label));
tabsEl.append(tabBlob, ...tabBtns);
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
  const pane = h('div', { class: 'pane' + (changedTab ? (back ? ' is-back' : '') : '') });
  if (!changedTab) pane.style.animation = 'none';
  ({ layers: paneLayers, fold: paneFold, finish: paneFinish, export: paneExport })[tab](pane);
  body.append(pane);
  if (!changedTab) body.scrollTop = st;
  updateChrome();
}

// Layers tab
function paneLayers(p) {
  const list = h('ul', { class: 'layers' });
  const addMenu = Menu({
    options: TYPES.map(t => ({ v: t, label: { band: 'Spectrum', noise: 'Cloud' }[t] || t[0].toUpperCase() + t.slice(1), icon: I[t] })),
    get: () => '', set: addLayer,
  });
  addMenu.btn.innerHTML = '';
  addMenu.btn.append(icon(I.plus, 15), h('span', {}, 'Add'));
  addMenu.btn.classList.add('add-btn');
  addMenu.btn.style.height = '28px';
  const tools = h('div', { class: 'layer-tools' },
    h('button', { type: 'button', class: 'ibtn', title: 'Duplicate  (Ctrl+D)', 'aria-label': 'Duplicate layer', onclick: dupLayer, disabled: !cur() }, icon(I.dup, 16)),
    h('button', { type: 'button', class: 'ibtn', title: 'Delete  (Del)', 'aria-label': 'Delete layer', onclick: () => delLayer(), disabled: !cur() }, icon(I.trash, 16)),
    addMenu.el,
  );
  // top of the list = top of the stack
  const rows = [...S.layers].reverse();
  if (!rows.length) list.append(h('li', { class: 'empty' }, 'No layers yet. Add one from the toolbar or press Shuffle.'));
  rows.forEach((l, i) => list.append(layerRow(l, i)));
  p.append(Section('Layers', 'layers', [list], { actions: [tools] }));

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
    h('p', { class: 'note' }, 'Everything loops seamlessly, so video exports repeat without a seam.'),
  ], { defaultOpen: false }));
}

function swatchBg(l) {
  if (l.type === 'band') return 'linear-gradient(180deg,#5a6cff,#fff,#ffb340,#ff4a2a)';
  if (l.type === 'linear' || l.type === 'conic' || l.type === 'noise') return `linear-gradient(135deg, ${l.c1}, ${l.c2})`;
  if (l.type === 'ring') return `radial-gradient(circle, transparent 40%, ${l.c1} 55%, ${l.c2} 80%)`;
  return `radial-gradient(circle at 40% 40%, ${l.c1}, ${l.c2})`;
}

let dragRow = null;
function layerRow(l) {
  const name = h('span', { class: 'l-name' }, l.name);
  const sw = h('span', { class: 'l-sw', style: { background: swatchBg(l) } });
  const eye = h('button', { type: 'button', class: 'ibtn', 'aria-label': l.visible ? 'Hide layer' : 'Show layer', onclick: e => { e.stopPropagation(); change(s => { const x = layerOf(s, l.id); x.visible = !x.visible; }, { structural: true }); } }, icon(l.visible ? I.eye : I.eyeOff, 15));
  const row = h('li', {
    class: 'layer' + (l.id === sel ? ' is-sel' : '') + (l.visible ? '' : ' is-hidden'), draggable: 'true', tabindex: 0,
    onclick: () => select(l.id),
    onkeydown: e => { if (e.key === 'Enter') select(l.id); },
  }, h('span', { class: 'l-type' }, icon(I[l.type], 16)), sw, name, h('span', { class: 'l-blend' }, l.blend === 'normal' ? '' : l.blend), eye);
  name.addEventListener('dblclick', e => {
    e.stopPropagation();
    const inp = h('input', { value: l.name, 'aria-label': 'Layer name' });
    name.innerHTML = ''; name.append(inp); inp.focus(); inp.select();
    const done = ok => { if (ok && inp.value.trim()) change(s => { layerOf(s, l.id).name = inp.value.trim(); }, { structural: true }); else renderPanel(); };
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); ev.stopPropagation(); });
    inp.addEventListener('blur', () => done(true));
  });
  // reorder by dragging rows (list is top-of-stack first)
  row.addEventListener('dragstart', e => { dragRow = l.id; row.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
  row.addEventListener('dragend', () => { dragRow = null; row.classList.remove('is-dragging'); });
  row.addEventListener('dragover', e => {
    if (!dragRow || dragRow === l.id) return;
    e.preventDefault();
    const r = row.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    row.classList.toggle('drop-before', before); row.classList.toggle('drop-after', !before);
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
  row.addEventListener('drop', e => {
    e.preventDefault();
    const r = row.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
    const moving = dragRow;
    change(s => {
      const from = s.layers.findIndex(x => x.id === moving);
      const [m] = s.layers.splice(from, 1);
      let to = s.layers.findIndex(x => x.id === l.id);
      // "before" in the list means above, i.e. later in the stack
      s.layers.splice(before ? to + 1 : to, 0, m);
    }, { structural: true });
  });
  // keep swatch/name live while editing colours
  controls.push({ update: () => { const x = layerOf(S, l.id); if (x) sw.style.background = swatchBg(x); } });
  return row;
}

const blendOpts = BLENDS.map(b => ({ v: b, label: b[0].toUpperCase() + b.slice(1) }));
function layerProps(l) {
  const kids = [];
  const T = l.type;
  kids.push(reg(Menu({ label: 'Blend', options: blendOpts, ...lbind('blend', { structural: true }) })));
  const c1 = { blob: 'Core', ring: 'Rim', band: 'Tint', linear: 'Start', conic: 'Colour A', noise: 'Low' }[T];
  const c2 = { blob: 'Edge', ring: 'Glow', band: 'Core', linear: 'End', conic: 'Colour B', noise: 'High' }[T];
  kids.push(reg(ColorField({ label: c1, ...lbind('c1') })));
  kids.push(reg(ColorField({ label: c2, ...lbind('c2') })));
  if (T === 'blob') kids.push(h('button', { type: 'button', class: 'btn', style: { justifySelf: 'start', height: '26px', fontSize: '12px' }, onclick: () => change(s => { const x = layerOf(s, sel); x.c2 = x.c1; }) }, 'Match edge to core'));
  kids.push(reg(Slider({ label: T === 'linear' ? 'Mix' : 'Intensity', min: 0, max: 2, step: .01, def: 1, ...lbind('intensity') })));
  kids.push(reg(Slider({ label: { ring: 'Outer glow', band: 'Length fade', linear: 'Smoothness' }[T] || 'Softness', min: 0, max: 1, step: .01, def: 1, ...lbind('soft') })));
  if (T === 'ring') kids.push(reg(Slider({ label: 'Inner glow', min: 0, max: 1, step: .005, def: .06, ...lbind('b') })));
  if (T === 'band') {
    kids.push(reg(Slider({ label: 'Dispersion', min: 0, max: 1, step: .01, def: .9, ...lbind('a'), hint: 'Mix between the tint and a full spectrum' })));
    kids.push(reg(Slider({ label: 'Bend', min: -3, max: 3, step: .01, def: -.5, ...lbind('b') })));
  }
  if (T === 'conic') kids.push(reg(Slider({ label: 'Repeats', min: 1, max: 12, step: 1, def: 1, ...lbind('a') })));
  if (T === 'noise') {
    kids.push(reg(Slider({ label: 'Threshold', min: 0, max: 1, step: .01, def: .5, ...lbind('a') })));
    kids.push(reg(Slider({ label: 'Seed', min: 0, max: 1, step: .001, def: .3, ...lbind('b') })));
  }
  const geo = [
    reg(Slider({ label: 'X', min: -1.5, max: 1.5, step: .001, def: 0, ...lbind('x') })),
    reg(Slider({ label: 'Y', min: -1.5, max: 1.5, step: .001, def: 0, ...lbind('y') })),
    reg(Slider({ label: T === 'band' ? 'Length' : T === 'linear' ? 'Span' : 'Width', min: .01, max: 2, step: .001, def: .35, ...lbind('sx') })),
  ];
  if (T !== 'linear') geo.push(reg(Slider({ label: T === 'band' ? 'Thickness' : 'Height', min: .005, max: 2, step: .001, def: .35, ...lbind('sy') })));
  geo.push(reg(Slider({ label: 'Rotation', min: -180, max: 180, step: .5, def: 0, unit: '°', ...lbind('rot') })));
  const g = h('div', { class: 'sub' }, ...geo);
  g.style.display = 'grid'; g.style.gap = '6px';
  kids.push(g);
  kids.push(h('p', { class: 'note' }, 'Drag on the canvas: centre moves, square sets size and angle, circle sets height. Alt keeps it round.'));
  return Section(l.name, 'props', kids);
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
  const f = S.fold, t = f.type;
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

// Finish tab
const HT_INFO = {
  none: { label: 'Off', svg: '<rect width="60" height="34" fill="url(#gf)"/>' },
  dots: { label: 'Dots', svg: [...Array(40)].map((_, i) => `<circle cx="${(i % 10) * 6 + 3}" cy="${Math.floor(i / 10) * 8 + 5}" r="${.6 + (i % 10) * .28}" fill="currentColor"/>`).join('') },
  grid: { label: 'Grid', svg: [...Array(40)].map((_, i) => `<circle cx="${(i % 10) * 6 + 3}" cy="${Math.floor(i / 10) * 8 + 5}" r="1.2" fill="currentColor" opacity="${.15 + (i % 10) * .09}"/>`).join('') },
  lines: { label: 'Lines', svg: [...Array(6)].map((_, i) => `<rect x="0" y="${i * 6 + 1}" width="60" height="${.6 + i * .7}" fill="currentColor"/>`).join('') },
  dither: { label: 'Dither', svg: [...Array(120)].map((_, i) => { const x = i % 20, y = Math.floor(i / 20); return ((x * 7 + y * 13) % 20) < x ? `<rect x="${x * 3}" y="${y * 6}" width="3" height="3" fill="currentColor"/>` : ''; }).join('') },
};
function paneFinish(p) {
  p.append(Section('Tone', 'tone', [
    reg(Slider({ label: 'Exposure', min: -3, max: 3, step: .01, def: 0, ...bind('tone.exposure') })),
    reg(Slider({ label: 'Contrast', min: -1, max: 1, step: .01, def: 0, ...bind('tone.contrast') })),
    reg(Slider({ label: 'Saturation', min: 0, max: 2, step: .01, def: 1, ...bind('tone.saturation') })),
    reg(Slider({ label: 'Hue', min: -180, max: 180, step: 1, def: 0, unit: '°', ...bind('tone.hue') })),
    reg(Slider({ label: 'Vignette', min: 0, max: 1, step: .01, def: 0, ...bind('tone.vignette') })),
  ]));
  p.append(Section('Grain', 'grain', [
    reg(Slider({ label: 'Amount', min: 0, max: .5, step: .002, def: .08, ...bind('grain.amount') })),
    reg(Slider({ label: 'Size', min: .5, max: 6, step: .05, def: 1, ...bind('grain.size'), hint: 'Relative to a 1000 px frame, so exports match the preview' })),
    reg(Toggle({ label: 'Colour grain', ...bind('grain.colored') })),
    reg(Toggle({ label: 'Animated', ...bind('grain.animated') })),
  ]));
  const ht = S.halftone;
  const kids = [chips(HALFTONES.map(k => [k, HT_INFO[k]]), () => S.halftone.mode, v => change(s => { s.halftone.mode = v; }, { structural: true }))];
  if (ht.mode !== 'none') {
    kids.push(
      reg(Slider({ label: ht.mode === 'dither' ? 'Pixel' : 'Cell', min: 2, max: 60, step: .1, def: 6, ...bind('halftone.cell'), hint: 'Relative to a 1000 px frame' })),
      ht.mode !== 'dither' ? reg(Slider({ label: 'Angle', min: -90, max: 90, step: .5, def: 0, unit: '°', ...bind('halftone.angle') })) : null,
      ht.mode === 'grid' ? reg(Slider({ label: 'Dot size', min: .02, max: 1, step: .005, def: .3, ...bind('halftone.dot') })) : null,
      reg(Slider({ label: 'Gamma', min: .2, max: 3, step: .01, def: 1, ...bind('halftone.gamma') })),
      reg(Slider({ label: 'Mix', min: 0, max: 1, step: .01, def: 1, ...bind('halftone.mix') })),
      reg(Toggle({ label: 'Use image colour', ...bind('halftone.colored', { structural: true }) })),
      ht.colored ? null : reg(ColorField({ label: 'Ink', ...bind('halftone.ink') })),
      reg(ColorField({ label: 'Paper', ...bind('halftone.paper') })),
      h('button', { type: 'button', class: 'btn', style: { justifySelf: 'start', height: '26px', fontSize: '12px' }, onclick: () => change(s => { [s.halftone.ink, s.halftone.paper] = [s.halftone.paper, s.halftone.ink]; }) }, 'Swap ink and paper'),
    );
  }
  p.append(Section('Halftone', 'halftone', kids.filter(Boolean)));
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
  const typed = (which) => {
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

  const prog = h('div', { class: 'progress', hidden: true }, h('i'));
  const vidBtn = h('button', { type: 'button', class: 'btn primary wide', onclick: () => doVideo(vidBtn, prog) }, icon(I.down, 16), h('span', {}, 'Record loop'));
  const mime = X.videoMime();
  p.append(Section('Video loop', 'video', [
    reg(Seg({ label: 'Frame rate', options: [24, 30, 60].map(v => ({ v, label: v + ' fps' })), small: true, ...ebind('fps') })),
    reg(Menu({ label: 'Long edge', options: [720, 1080, 1440, 2160].map(v => ({ v, label: v + ' px' })), ...ebind('vlong') })),
    reg(Slider({ label: 'Loops', min: 1, max: 6, step: 1, def: 1, ...ebind('loops') })),
    reg(Slider({ label: 'Loop length', min: 1, max: 30, step: .5, def: 8, unit: 's', ...bind('anim.duration') })),
    h('p', { class: 'note' }, mime ? `Records in real time as ${mime.startsWith('video/mp4') ? 'MP4' : 'WebM'}. Keep this tab in front while it runs.` : 'This browser cannot record video.'),
    prog, vidBtn,
  ], { defaultOpen: false }));

  const codeRow = (title, sub, make, ext, mime) => h('div', { class: 'code-row' },
    h('div', { class: 't' }, h('b', {}, title), h('span', {}, sub)),
    h('button', { type: 'button', class: 'ibtn', title: 'Copy', 'aria-label': 'Copy ' + title, onclick: () => copyText(make(S), title) }, icon(I.copy, 16)),
    h('button', { type: 'button', class: 'ibtn', title: 'Download', 'aria-label': 'Download ' + title, onclick: () => X.download(new Blob([make(S)], { type: mime }), `fold-${slug()}.${ext}`) }, icon(I.down, 16)));
  p.append(Section('Code', 'code', [
    codeRow('Shadertoy', 'Paste into a new shader, animates', X.shadertoyCode, 'glsl', 'text/plain'),
    codeRow('GLSL (WebGL2)', 'Fragment shader, uResolution + uTime', X.glslCode, 'frag', 'text/plain'),
    codeRow('HTML page', 'Self-contained live background', X.htmlCode, 'html', 'text/html'),
    codeRow('CSS fallback', 'Rough radial-gradient stand-in', X.cssFallback, 'css', 'text/css'),
  ], { defaultOpen: false }));

  const fileIn = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', onchange: e => e.target.files[0] && loadFile(e.target.files[0]) });
  p.append(Section('Preset file', 'file', [
    h('div', { class: 'row3' },
      h('button', { type: 'button', class: 'btn', onclick: savePreset }, icon(I.down, 15), 'Save'),
      h('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, icon(I.upload, 15), 'Open'),
      h('button', { type: 'button', class: 'btn', onclick: copyLink }, icon(I.link, 15), 'Link')),
    fileIn,
    h('p', { class: 'note' }, 'Presets are small JSON files. You can also drop one on the canvas.'),
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
let recording = false;
async function doVideo(btn, prog) {
  if (recording) return;
  recording = true;
  const [w, hh] = X.sizeFor(S.aspect, exp.vlong);
  const ev = n => n - (n % 2);
  btn.classList.add('is-busy'); prog.hidden = false;
  const t = toast('Recording loop…', { progress: true });
  try {
    const { blob, ext } = await X.exportVideo(clone(S), {
      w: ev(w), h: ev(hh), fps: exp.fps, loops: exp.loops,
      onProgress: p => { prog.firstChild.style.width = p * 100 + '%'; t.set(p, `Recording loop… ${Math.round(p * 100)}%`); },
    });
    X.download(blob, `fold-${slug()}-${ev(w)}x${ev(hh)}.${ext}`);
    t.done(`Saved ${ext.toUpperCase()} loop`, 'ok');
  } catch (e) { t.done(e.message, 'err'); }
  btn.classList.remove('is-busy'); prog.hidden = true; prog.firstChild.style.width = 0;
  recording = false;
}
async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`, { kind: 'ok' }); }
  catch { toast('Clipboard is blocked here, use download instead.', { kind: 'err' }); }
}
function savePreset() { X.download(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), `${slug()}.fold.json`); }
async function loadFile(file) {
  try { const s = JSON.parse(await file.text()); if (!s.layers) throw 0; replaceState(s); toast('Preset loaded', { kind: 'ok' }); }
  catch { toast('That file is not a Fold preset.', { kind: 'err' }); }
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
  copyText(url, 'Link');
}

// drag & drop presets
stage.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); stage.classList.add('is-drop'); } });
stage.addEventListener('dragleave', e => { if (e.target === $('drop') || !stage.contains(e.relatedTarget)) stage.classList.remove('is-drop'); });
stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('is-drop'); const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

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
  if (k === 'v') setTool('select');
  else if (k === 'h') setTool('hand');
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
    const d = (e.shiftKey ? .05 : .005);
    const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    change(s => { const l = layerOf(s, sel); l.x = +(l.x + dx).toFixed(4); l.y = +(l.y + dy).toFixed(4); }, { key: 'nudge' });
  }
});
addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('is-panning'); } });

// ---------- boot ----------
async function boot() {
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
  buildStrip();
}
boot();
