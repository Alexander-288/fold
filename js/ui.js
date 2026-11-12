// Small UI kit: sliders, segmented controls with a liquid blob, menus, colour fields, toggles, sections.

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? e.style.setProperty(sk, sv) : (e.style[sk] = sv);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

export const icon = (paths, size = 18) =>
  h('span', { class: 'ic', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` });

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const decimals = step => (String(step).split('.')[1] || '').length;

// Liquid blob: the leading edge moves first, the trailing edge catches up
export function moveBlob(blob, target, container, instant = false) {
  if (!target) { blob.hidden = true; return; }
  const cr = container.getBoundingClientRect(), tr = target.getBoundingClientRect();
  const k = cr.width / (container.offsetWidth || cr.width) || 1;  // undo CSS scale on the container
  const L1 = (tr.left - cr.left) / k + container.scrollLeft, T1 = (tr.top - cr.top) / k + container.scrollTop, W1 = tr.width / k, H1 = tr.height / k;
  const vertical = blob.dataset.axis === 'y';
  const prev = blob._pos;
  blob.hidden = false;
  Object.assign(blob.style, { left: L1 + 'px', top: T1 + 'px', width: W1 + 'px', height: H1 + 'px' });
  blob._pos = { L1, T1, W1, H1 };
  if (!prev || instant || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = vertical ? 'top' : 'left', s = vertical ? 'height' : 'width';
  const p0 = vertical ? prev.T1 : prev.L1, s0 = vertical ? prev.H1 : prev.W1;
  const p1 = vertical ? T1 : L1, s1 = vertical ? H1 : W1;
  if (p0 === p1 && s0 === s1) return;
  const mid = p1 > p0 ? { [a]: p0 + 'px', [s]: (p1 + s1 - p0) + 'px' } : { [a]: p1 + 'px', [s]: (p0 + s0 - p1) + 'px' };
  blob.animate([
    { [a]: p0 + 'px', [s]: s0 + 'px' },
    { ...mid, offset: .45 },
    { [a]: p1 + 'px', [s]: s1 + 'px' },
  ], { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)' });
}

export function Slider({ label, min, max, step = .01, get, set, def, unit = '', commit, hint }) {
  const dp = decimals(step);
  const fill = h('div', { class: 'sl-fill' });
  const thumb = h('div', { class: 'sl-thumb' });
  const track = h('div', { class: 'sl-track', tabindex: 0, role: 'slider', 'aria-label': label, 'aria-valuemin': min, 'aria-valuemax': max }, h('div', { class: 'sl-rail' }, fill), thumb);
  const num = h('input', { class: 'ctl-num', inputmode: 'decimal', 'aria-label': label + ' value', spellcheck: 'false' });
  const lab = h('label', { class: 'ctl-label scrub', title: hint || 'Drag to scrub, double-click to reset' }, label);
  const root = h('div', { class: 'ctl slider' }, lab, track, num);
  const put = (v, key = 'slider') => {
    v = clamp(Math.round(v / step) * step, min, max);
    set(+v.toFixed(dp), key);
    update();
  };
  function update() {
    const v = get();
    const t = (v - min) / (max - min);
    const z = clamp((0 - min) / (max - min), 0, 1);
    const bip = min < 0 && max > 0;
    fill.style.left = (bip ? Math.min(t, z) : 0) * 100 + '%';
    fill.style.width = Math.abs(t - (bip ? z : 0)) * 100 + '%';
    thumb.style.left = t * 100 + '%';
    track.setAttribute('aria-valuenow', v);
    if (document.activeElement !== num) num.value = (+v).toFixed(dp) + unit;
  }
  const fromX = x => { const r = track.getBoundingClientRect(); return min + clamp((x - r.left) / r.width, 0, 1) * (max - min); };
  track.addEventListener('pointerdown', e => {
    track.setPointerCapture(e.pointerId);
    root.classList.add('is-drag');
    put(fromX(e.clientX));
    const mv = ev => put(fromX(ev.clientX));
    const up = () => { root.classList.remove('is-drag'); track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); commit?.(); };
    track.addEventListener('pointermove', mv);
    track.addEventListener('pointerup', up);
  });
  track.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!k) return;
    e.preventDefault();
    put(get() + k * step * (e.shiftKey ? 10 : 1), 'key');
  });
  // Adobe-style label scrubbing
  lab.addEventListener('pointerdown', e => {
    lab.setPointerCapture(e.pointerId);
    let x0 = e.clientX, v0 = get();
    root.classList.add('is-drag');
    const mv = ev => { const k = ev.shiftKey ? .1 : ev.altKey ? 4 : 1; put(v0 + (ev.clientX - x0) * (max - min) / 260 * k); };
    const up = () => { root.classList.remove('is-drag'); lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); commit?.(); };
    lab.addEventListener('pointermove', mv);
    lab.addEventListener('pointerup', up);
  });
  const reset = () => { if (def !== undefined) { put(def, 'reset'); commit?.(); } };
  lab.addEventListener('dblclick', reset);
  track.addEventListener('dblclick', reset);
  num.addEventListener('focus', () => { num.value = (+get()).toFixed(dp); num.select(); });
  num.addEventListener('keydown', e => { if (e.key === 'Enter') num.blur(); if (e.key === 'Escape') { num.value = get(); num.blur(); } });
  num.addEventListener('blur', () => { const v = parseFloat(num.value); if (!isNaN(v)) { put(v, 'num'); commit?.(); } update(); });
  num.addEventListener('wheel', e => { if (document.activeElement !== num) return; e.preventDefault(); put(get() - Math.sign(e.deltaY) * step * (e.shiftKey ? 10 : 1)); }, { passive: false });
  update();
  return { el: root, update };
}

export function Seg({ label, options, get, set, small }) {
  const blob = h('span', { class: 'seg-blob', hidden: true });
  const btns = options.map(o => h('button', { type: 'button', class: 'seg-btn', title: o.title || o.label, 'data-v': o.v, onclick: () => { set(o.v); update(); } }, o.icon ? icon(o.icon, 16) : null, o.icon && !o.text ? null : h('span', {}, o.label)));
  const seg = h('div', { class: 'seg' + (small ? ' seg-sm' : ''), role: 'group', 'aria-label': label }, blob, ...btns);
  const root = label ? h('div', { class: 'ctl ctl-block' }, h('label', { class: 'ctl-label' }, label), seg) : seg;
  let first = true;
  function update() {
    const v = get();
    btns.forEach(b => { const on = String(b.dataset.v) === String(v); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    const on = btns.find(b => b.classList.contains('is-on'));
    requestAnimationFrame(() => { if (seg.isConnected) { moveBlob(blob, on, seg, first); first = false; } });
  }
  update();
  new ResizeObserver(() => { const on = btns.find(b => b.classList.contains('is-on')); if (on && seg.isConnected) moveBlob(blob, on, seg, true); }).observe(seg);
  return { el: root, update };
}

let openMenu = null;
export function closeMenus() { openMenu?.close(); }
addEventListener('pointerdown', e => { if (openMenu && !openMenu.root.contains(e.target) && !openMenu.pop.contains(e.target)) openMenu.close(); });
addEventListener('keydown', e => { if (e.key === 'Escape') openMenu?.close(); });

// Dropdown with an animated popover
export function Menu({ label, options, get, set, render, cls = '' }) {
  const val = h('span', { class: 'menu-val' });
  const btn = h('button', { type: 'button', class: 'menu-btn ' + cls, 'aria-haspopup': 'listbox' }, val, icon('<path d="m7 10 5 5 5-5"/>', 14));
  const pop = h('div', { class: 'menu-pop', role: 'listbox' });
  const root = label ? h('div', { class: 'ctl ctl-menu' }, h('label', { class: 'ctl-label' }, label), btn) : h('div', { class: 'ctl-menu-bare' }, btn);
  const api = {
    root, pop,
    close() { pop.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); setTimeout(() => !pop.classList.contains('is-open') && pop.remove(), 180); if (openMenu === api) openMenu = null; },
  };
  function build() {
    pop.innerHTML = '';
    const v = get();
    for (const o of options) {
      if (o.divider) { pop.append(h('div', { class: 'menu-div' })); continue; }
      const it = h('button', { type: 'button', class: 'menu-item' + (String(o.v) === String(v) ? ' is-on' : ''), role: 'option', onclick: () => { set(o.v); api.close(); update(); } },
        render ? render(o) : [o.icon ? icon(o.icon, 16) : null, h('span', {}, o.label), o.note ? h('span', { class: 'menu-note' }, o.note) : null]);
      pop.append(it);
    }
  }
  btn.addEventListener('click', () => {
    if (openMenu === api) return api.close();
    openMenu?.close();
    build();
    document.body.append(pop);
    const r = btn.getBoundingClientRect();
    const w = Math.max(r.width, 200);
    let left = Math.min(r.left, innerWidth - w - 8);
    pop.style.minWidth = w + 'px';
    pop.style.left = Math.max(8, left) + 'px';
    const below = innerHeight - r.bottom;
    pop.style.maxHeight = Math.max(160, Math.max(below, r.top) - 24) + 'px';
    if (below < 260 && r.top > below) { pop.style.top = ''; pop.style.bottom = (innerHeight - r.top + 6) + 'px'; pop.dataset.dir = 'up'; }
    else { pop.style.bottom = ''; pop.style.top = (r.bottom + 6) + 'px'; pop.dataset.dir = 'down'; }
    requestAnimationFrame(() => pop.classList.add('is-open'));
    btn.setAttribute('aria-expanded', 'true');
    openMenu = api;
    pop.querySelector('.is-on')?.focus();
  });
  pop.addEventListener('keydown', e => {
    const items = [...pop.querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  function update() {
    const o = options.find(o => String(o.v) === String(get()));
    val.textContent = o ? o.label : String(get());
  }
  update();
  return { el: root, update, btn };
}

export function ColorField({ label, get, set, commit }) {
  const picker = h('input', { type: 'color', class: 'sr-only', tabindex: -1 });
  const sw = h('button', { type: 'button', class: 'swatch', 'aria-label': label + ' colour', onclick: () => picker.click() });
  const hex = h('input', { class: 'ctl-num hex', spellcheck: 'false', maxlength: 7, 'aria-label': label + ' hex' });
  const root = h('div', { class: 'ctl color' }, h('label', { class: 'ctl-label' }, label), h('div', { class: 'color-row' }, sw, hex, picker));
  picker.addEventListener('input', () => { set(picker.value, 'color'); update(); });
  picker.addEventListener('change', () => commit?.());
  hex.addEventListener('keydown', e => { if (e.key === 'Enter') hex.blur(); });
  hex.addEventListener('blur', () => {
    let v = hex.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) { if (v.length === 4) v = '#' + [...v.slice(1)].map(c => c + c).join(''); set(v.toLowerCase(), 'hex'); commit?.(); }
    update();
  });
  function update() {
    const v = get();
    sw.style.setProperty('--c', v);
    if (document.activeElement !== hex) hex.value = v.toUpperCase();
    picker.value = v;
  }
  update();
  return { el: root, update };
}

export function Toggle({ label, get, set }) {
  const sw = h('button', { type: 'button', class: 'toggle', role: 'switch', 'aria-label': label, onclick: () => { set(!get()); update(); } }, h('span', { class: 'toggle-knob' }));
  const root = h('div', { class: 'ctl toggle-row' }, h('label', { class: 'ctl-label' }, label), sw);
  function update() { const on = !!get(); sw.classList.toggle('is-on', on); sw.setAttribute('aria-checked', on); }
  update();
  return { el: root, update };
}

// Collapsible section; open state remembered per key
const openState = (() => { try { return JSON.parse(localStorage.getItem('fold.sections') || '{}'); } catch { return {}; } })();
export function Section(title, key, kids, { actions = [], defaultOpen = true } = {}) {
  const open = openState[key] ?? defaultOpen;
  const body = h('div', { class: 'sec-body' }, h('div', { class: 'sec-inner' }, ...kids));
  const head = h('button', { type: 'button', class: 'sec-head', 'aria-expanded': open },
    icon('<path d="m9 6 6 6-6 6"/>', 14), h('span', {}, title));
  const root = h('section', { class: 'sec' + (open ? ' is-open' : '') }, h('div', { class: 'sec-bar' }, head, ...actions), body);
  head.addEventListener('click', () => {
    const o = !root.classList.contains('is-open');
    root.classList.toggle('is-open', o);
    head.setAttribute('aria-expanded', o);
    openState[key] = o;
    try { localStorage.setItem('fold.sections', JSON.stringify(openState)); } catch {}
  });
  return root;
}

let toastWrap;
export function toast(msg, { kind = '', ms = 2600, progress = false } = {}) {
  toastWrap ??= document.body.appendChild(h('div', { class: 'toasts', 'aria-live': 'polite' }));
  const bar = progress ? h('div', { class: 'toast-bar' }, h('i')) : null;
  const t = h('div', { class: 'toast ' + kind }, h('span', {}, msg), bar);
  toastWrap.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  const kill = () => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 260); };
  if (!progress) setTimeout(kill, ms);
  return {
    set(p, text) { if (bar) bar.firstChild.style.width = (p * 100).toFixed(1) + '%'; if (text) t.firstChild.textContent = text; },
    done(text, k) { if (text) t.firstChild.textContent = text; if (k) t.classList.add(k); bar?.remove(); setTimeout(kill, 2200); },
  };
}

// ---- colour ramp editor ----
const hx = h2 => { h2 = h2.replace('#', ''); const n = parseInt(h2.length === 3 ? [...h2].map(c => c + c).join('') : h2, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export function rampAt(stops, p) {
  const s = [...stops].sort((a, b) => a.p - b.p);
  if (p <= s[0].p) return s[0].c;
  for (let i = 1; i < s.length; i++) if (p <= s[i].p) {
    const k = (p - s[i - 1].p) / Math.max(1e-5, s[i].p - s[i - 1].p), a = hx(s[i - 1].c), b = hx(s[i].c);
    return toHex(a.map((v, j) => v + (b[j] - v) * k));
  }
  return s.at(-1).c;
}
export const rampCss = (stops, dir = '90deg') => `linear-gradient(${dir}, ${[...stops].sort((a, b) => a.p - b.p).map(s => `${s.c} ${(s.p * 100).toFixed(1)}%`).join(', ')})`;

// Gradient bar: click to add a stop, drag stops, double-click a stop to remove it
export function RampEditor({ label = 'Colours', get, set, commit, max = 8, presets = [] }) {
  let sel = 0;
  const stops = () => get() || [];
  const put = (fn, key = 'ramp') => { const s = JSON.parse(JSON.stringify(stops())); fn(s); set(s, key); update(); };
  const bar = h('div', { class: 'ramp-bar' });
  const marks = h('div', { class: 'ramp-marks' });
  const track = h('div', { class: 'ramp-track', title: 'Click to add a stop, drag to move, double-click to remove' }, bar, marks);
  const colorCtl = ColorField({ label: 'Stop colour', get: () => stops()[sel]?.c || '#000000', set: v => put(s => { if (s[sel]) s[sel].c = v; }, 'rampc'), commit });
  const posIn = h('input', { class: 'ctl-num', 'aria-label': 'Stop position', inputmode: 'decimal' });
  posIn.addEventListener('change', () => { const v = parseFloat(posIn.value); if (!isNaN(v)) put(s => { s[sel].p = Math.max(0, Math.min(1, v / 100)); }); commit?.(); });
  posIn.addEventListener('keydown', e => { if (e.key === 'Enter') posIn.blur(); });
  const btn = (title, ic, fn) => h('button', { type: 'button', class: 'ibtn', title, 'aria-label': title, onclick: fn }, icon(ic, 15));
  const delBtn = btn('Remove stop', '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>', () => { if (stops().length > 2) { put(s => s.splice(sel, 1)); sel = Math.max(0, sel - 1); update(); commit?.(); } });
  const tools = h('div', { class: 'ramp-tools' },
    h('span', { class: 'ctl-label' }, 'Position'), posIn, h('span', { class: 'mono' }, '%'),
    h('span', { style: { flex: 1 } }),
    btn('Reverse', '<path d="M7 7h11l-3-3M17 17H6l3 3"/>', () => { put(s => s.forEach(x => (x.p = 1 - x.p))); commit?.(); }),
    btn('Space evenly', '<path d="M4 6v12M12 6v12M20 6v12"/>', () => { put(s => { s.sort((a, b) => a.p - b.p).forEach((x, i) => (x.p = s.length > 1 ? i / (s.length - 1) : 0)); }); commit?.(); }),
    delBtn);
  const presetRow = presets.length ? h('div', { class: 'ramp-presets' }, ...presets.map(pr =>
    h('button', { type: 'button', class: 'ramp-chip', title: pr.name, style: { background: rampCss(pr.stops) }, onclick: () => { set(JSON.parse(JSON.stringify(pr.stops)), 'rampp'); sel = 0; update(); commit?.(); } }))) : null;
  const root = h('div', { class: 'ramp' }, h('div', { class: 'ramp-head' }, h('label', { class: 'ctl-label' }, label)), track, tools, colorCtl.el, presetRow);
  const fromX = x => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); };
  track.addEventListener('pointerdown', e => {
    const mk = e.target.closest('.ramp-mark');
    if (mk) sel = +mk.dataset.i;
    else {
      if (stops().length >= max) return;
      const p = fromX(e.clientX);
      put(s => { s.push({ p: +p.toFixed(3), c: rampAt(s, p) }); });
      sel = stops().length - 1;
    }
    update();
    track.setPointerCapture(e.pointerId);
    const mv = ev => put(s => { s[sel].p = +fromX(ev.clientX).toFixed(3); }, 'rampdrag');
    const up = () => { track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); commit?.(); };
    track.addEventListener('pointermove', mv);
    track.addEventListener('pointerup', up);
  });
  track.addEventListener('dblclick', e => { const mk = e.target.closest('.ramp-mark'); if (mk && stops().length > 2) { sel = +mk.dataset.i; put(s => s.splice(sel, 1)); sel = 0; update(); commit?.(); } });
  function update() {
    const s = stops();
    if (sel >= s.length) sel = s.length - 1;
    bar.style.background = rampCss(s);
    marks.innerHTML = '';
    s.forEach((st, i) => marks.append(h('span', { class: 'ramp-mark' + (i === sel ? ' is-sel' : ''), 'data-i': i, style: { left: st.p * 100 + '%', '--c': st.c } })));
    if (document.activeElement !== posIn) posIn.value = Math.round((s[sel]?.p || 0) * 100);
    delBtn.disabled = s.length <= 2;
    colorCtl.update();
  }
  update();
  return { el: root, update };
}
