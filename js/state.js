// Editor state: defaults, layer factory, aspect ratios, presets and the shuffle generator.

export const ASPECTS = [
  { id: '9:16', w: 9, h: 16, label: 'Story' },
  { id: '9:19.5', w: 9, h: 19.5, label: 'Phone' },
  { id: '9:20', w: 9, h: 20, label: 'Tall phone' },
  { id: '4:5', w: 4, h: 5, label: 'Portrait post' },
  { id: '2:3', w: 2, h: 3, label: 'Poster' },
  { id: 'A', w: 1, h: 1.4142, label: 'A-series' },
  { id: '1:1', w: 1, h: 1, label: 'Square' },
  { id: '3:2', w: 3, h: 2, label: 'Photo' },
  { id: '16:10', w: 16, h: 10, label: 'Laptop' },
  { id: '16:9', w: 16, h: 9, label: 'Widescreen' },
  { id: '21:9', w: 21, h: 9, label: 'Ultrawide' },
  { id: '3:1', w: 3, h: 1, label: 'Banner' },
];

let uid = 1;
export const newId = () => 'l' + (Date.now().toString(36)) + (uid++);

const LAYER_DEFAULTS = {
  blob: { name: 'Blob', sx: .35, sy: .35, soft: 1, a: 0, b: 0, blend: 'normal', c1: '#9696ff', c2: '#9696ff' },
  ring: { name: 'Ring', sx: .4, sy: .4, soft: .15, a: 0, b: .06, blend: 'add', c1: '#ff8a3c', c2: '#5a2a10' },
  band: { name: 'Spectrum', sx: .7, sy: .07, soft: .8, a: .9, b: -.5, blend: 'add', c1: '#ffd9b0', c2: '#ffffff' },
  linear: { name: 'Linear', sx: .5, sy: .5, soft: 1, a: 0, b: 0, blend: 'normal', c1: '#111111', c2: '#9696ff' },
  conic: { name: 'Conic', sx: .6, sy: .6, soft: .6, a: 1, b: 0, blend: 'screen', c1: '#111111', c2: '#9696ff' },
  noise: { name: 'Cloud', sx: .5, sy: .5, soft: .5, a: .5, b: .3, blend: 'screen', c1: '#2a2a2a', c2: '#9696ff' },
};

export function makeLayer(type = 'blob', over = {}) {
  return {
    id: newId(), type, visible: true, x: 0, y: 0, rot: 0, intensity: 1,
    ...LAYER_DEFAULTS[type], ...over,
  };
}

export function defaultState() {
  return {
    v: 1,
    aspect: { id: '9:16', w: 9, h: 16 },
    view: { zoom: 1, x: 0, y: 0 },
    bg: '#0b0b0b',
    warp: { amount: 0, scale: 1.5, flow: .25 },
    drift: 0,
    layers: [],
    fold: { type: 'none', angle: 0, count: 14, strength: .5, shift: 0, shading: .3, chroma: 0, smear: 0, jitter: 0, highlight: 0 },
    tone: { exposure: 0, contrast: 0, saturation: 1, hue: 0, vignette: 0 },
    grain: { amount: .08, size: 1, colored: false, animated: true },
    halftone: { mode: 'none', cell: 6, angle: 0, dot: .3, colored: false, gamma: 1, mix: 1, ink: '#ffffff', paper: '#000000' },
    anim: { duration: 8 },
  };
}

// Merge a partial (preset or loaded file) over defaults so older files keep working
export function normalize(s) {
  const d = defaultState();
  const out = { ...d, ...s };
  for (const k of ['aspect', 'view', 'warp', 'fold', 'tone', 'grain', 'halftone', 'anim']) out[k] = { ...d[k], ...(s[k] || {}) };
  out.layers = (s.layers || []).map(l => ({ ...makeLayer(l.type || 'blob'), ...l, id: l.id || newId() }));
  return out;
}

const L = makeLayer;
const P = (name, s) => ({ name, state: normalize(s) });

export const PRESETS = [
  P('Prism', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#050506',
    layers: [
      L('blob', { name: 'Haze', x: -.42, y: -.62, sx: .55, sy: .3, rot: -40, c1: '#77736d', c2: '#2a2826', intensity: .8 }),
      L('blob', { name: 'Ember', x: .05, y: .38, sx: .8, sy: .42, c1: '#a5622c', c2: '#24160d', intensity: .95 }),
      L('blob', { name: 'Sky', x: .05, y: -.12, sx: .6, sy: .16, c1: '#34527e', c2: '#101827', blend: 'add', intensity: .55 }),
      L('band', { name: 'Spectrum', x: .05, y: .05, sx: .95, sy: .06, rot: -6, a: .95, b: -.55, soft: .9, c1: '#ffd2a0', c2: '#ffffff', intensity: 1.1 }),
    ],
    fold: { type: 'folds', angle: 40, count: 4.2, strength: .35, shift: .16, shading: .55, chroma: .15, smear: 0, jitter: .06, highlight: .12 },
    tone: { exposure: 0, contrast: .08, saturation: 1.05, hue: 0, vignette: .25 },
    grain: { amount: .12, size: 1.2, colored: false, animated: true },
    warp: { amount: .03, scale: 1.2, flow: .3 }, drift: .3,
  }),
  P('Reeded', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#0a0c0c',
    layers: [
      L('blob', { name: 'Light', x: .02, y: -.4, sx: .75, sy: .6, c1: '#e6ebec', c2: '#93a6ae' }),
      L('blob', { name: 'Shade', x: .5, y: -.55, sx: .32, sy: .5, c1: '#243032', c2: '#2c3638', intensity: .85 }),
      L('blob', { name: 'Coral', x: .05, y: .1, sx: .3, sy: .12, c1: '#e8665a', c2: '#a8483e', intensity: .9 }),
      L('blob', { name: 'Ember', x: 0, y: .26, sx: .42, sy: .1, c1: '#3d1612', c2: '#1a0b09', intensity: .8 }),
      L('blob', { name: 'Floor', x: 0, y: .72, sx: 1.1, sy: .48, soft: .9, c1: '#080a0a', c2: '#0a0c0c' }),
    ],
    fold: { type: 'fluted', angle: 0, count: 42, strength: .7, shift: 0, shading: .25, chroma: .05, smear: .05, jitter: 0, highlight: .03 },
    grain: { amount: .1, size: 1.1, colored: false, animated: true },
    warp: { amount: .04, scale: 1.4, flow: .25 }, drift: .2,
  }),
  P('Halftone', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#000000',
    layers: [
      L('blob', { name: 'Moon', x: .02, y: .02, sx: .3, sy: .42, rot: -18, c1: '#ffffff', c2: '#bdbdbd', intensity: 1.1 }),
      L('blob', { name: 'Glow', x: .08, y: -.42, sx: .5, sy: .3, c1: '#4a4a4a', c2: '#222', blend: 'add', intensity: .5 }),
    ],
    halftone: { mode: 'dots', cell: 5.5, angle: 0, dot: .3, colored: false, gamma: 1, mix: 1, ink: '#ffffff', paper: '#000000' },
    grain: { amount: 0, size: 1, colored: false, animated: false },
    drift: .25,
  }),
  P('Dot field', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#000000',
    layers: [
      L('blob', { name: 'Field', x: .05, y: -.08, sx: .62, sy: .7, c1: '#e0e0e0', c2: '#5a5a5a', intensity: .95 }),
      L('blob', { name: 'Shadow', x: -.15, y: .75, sx: .7, sy: .3, c1: '#000000', c2: '#000000' }),
    ],
    halftone: { mode: 'grid', cell: 14, angle: 0, dot: .3, colored: false, gamma: .8, mix: 1, ink: '#ffffff', paper: '#000000' },
    grain: { amount: 0, size: 1, colored: false, animated: false },
    drift: .3,
  }),
  P('Eclipse', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#0d1719',
    layers: [
      L('blob', { name: 'Teal haze', x: -.15, y: -.3, sx: .95, sy: .95, c1: '#1f4b4d', c2: '#122426', intensity: .75 }),
      L('blob', { name: 'Dark', x: -.2, y: -.05, sx: .5, sy: .55, c1: '#0b1214', c2: '#101c1e', intensity: .8 }),
      L('blob', { name: 'Disc', x: .58, y: .88, sx: .78, sy: .78, soft: .3, c1: '#120707', c2: '#120707' }),
      L('blob', { name: 'Core', x: .62, y: .98, sx: .55, sy: .5, c1: '#ff7a30', c2: '#b8201a' }),
      L('ring', { name: 'Rim', x: .58, y: .88, sx: .8, sy: .8, soft: .14, b: .05, c1: '#ff9a3c', c2: '#4a6a5c', intensity: 1.15 }),
    ],
    grain: { amount: .18, size: 1.4, colored: true, animated: true },
    warp: { amount: .02, scale: 1, flow: .2 }, drift: .2,
  }),
  P('Spectrum glass', {
    aspect: { id: '9:20', w: 9, h: 20 }, bg: '#2a2420',
    layers: [
      L('blob', { name: 'Sand', x: -.2, y: -.62, sx: .7, sy: .42, c1: '#8b7c6a', c2: '#5a4e42' }),
      L('blob', { name: 'Shadow', x: .2, y: -.28, sx: .55, sy: .18, rot: 32, c1: '#120c08', c2: '#1e1610' }),
      L('blob', { name: 'Cream', x: -.05, y: -.05, sx: .45, sy: .28, rot: 30, c1: '#dcd3c4', c2: '#a89c8a' }),
      L('blob', { name: 'Rust', x: -.3, y: .32, sx: .36, sy: .17, c1: '#bb5a2a', c2: '#6a3018' }),
      L('blob', { name: 'Ink blue', x: .48, y: 0, sx: .2, sy: .95, c1: '#1c4a7c', c2: '#0c1c30' }),
      L('blob', { name: 'Ice', x: -.35, y: .78, sx: .42, sy: .3, c1: '#a9c1d1', c2: '#56708a' }),
    ],
    fold: { type: 'fluted', angle: 0, count: 34, strength: .9, shift: 0, shading: .35, chroma: .25, smear: 0, jitter: 0, highlight: .05 },
    warp: { amount: .08, scale: 1.3, flow: .3 }, drift: .25,
    grain: { amount: .04, size: 1, colored: false, animated: true },
  }),
  P('Paper', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#fdfdfd',
    grain: { amount: .015, size: 1, colored: false, animated: false },
  }),
  P('Aurora', {
    aspect: { id: '16:9', w: 16, h: 9 }, bg: '#06070b',
    layers: [
      L('noise', { name: 'Veil', x: 0, y: -.1, sx: .7, sy: .35, a: .55, b: .2, soft: .6, c1: '#0d3b3a', c2: '#3cf0b0', blend: 'add', intensity: .9 }),
      L('noise', { name: 'Violet', x: .3, y: -.2, sx: .5, sy: .4, a: .6, b: .7, soft: .5, c1: '#1a0f3a', c2: '#9696ff', blend: 'add', intensity: .7 }),
      L('blob', { name: 'Horizon', x: 0, y: .55, sx: 1.4, sy: .3, c1: '#000000', c2: '#06070b' }),
    ],
    fold: { type: 'wave', angle: 90, count: 6, strength: .4, shift: 0, shading: .15, chroma: .1, smear: .04, jitter: 0, highlight: 0 },
    warp: { amount: .12, scale: 1.2, flow: .4 }, drift: .3,
    grain: { amount: .08, size: 1, colored: false, animated: true },
  }),
  P('Glass blocks', {
    aspect: { id: '1:1', w: 1, h: 1 }, bg: '#101014',
    layers: [
      L('blob', { name: 'Peri', x: -.15, y: -.1, sx: .4, sy: .35, c1: '#9696ff', c2: '#3b3b8a' }),
      L('blob', { name: 'Peach', x: .2, y: .15, sx: .3, sy: .3, c1: '#ffb38a', c2: '#c0503a', blend: 'screen' }),
    ],
    fold: { type: 'tiles', angle: 0, count: 6, strength: .8, shift: 0, shading: .3, chroma: .2, smear: 0, jitter: 0, highlight: .08 },
    grain: { amount: .06, size: 1, colored: false, animated: true }, drift: .4,
  }),
  P('Pleats', {
    aspect: { id: '4:5', w: 4, h: 5 }, bg: '#151515',
    layers: [
      L('linear', { name: 'Ramp', rot: 90, sx: .7, c1: '#1a1a1a', c2: '#d9d7d0' }),
      L('blob', { name: 'Peri', x: .1, y: .1, sx: .3, sy: .3, c1: '#9696ff', c2: '#6060c0', blend: 'screen', intensity: .9 }),
    ],
    fold: { type: 'accordion', angle: -20, count: 9, strength: .5, shift: 0, shading: .6, chroma: .05, smear: 0, jitter: .02, highlight: .04 },
    grain: { amount: .06, size: 1, colored: false, animated: true }, drift: .3,
  }),
];

// Curated palettes for shuffle: [bg, ...colours]
const PALETTES = [
  ['#050506', '#a5622c', '#34527e', '#d9d2c6', '#77736d'],
  ['#0a0c0c', '#e6ebec', '#e8665a', '#3d1612', '#93a6ae'],
  ['#0d1719', '#1f4b4d', '#ff7a30', '#b8201a', '#ff9a3c'],
  ['#2a2420', '#dcd3c4', '#bb5a2a', '#1c4a7c', '#a9c1d1'],
  ['#08080c', '#9696ff', '#3b3b8a', '#f2f1ed', '#ff8ab3'],
  ['#0b0b0b', '#f2f1ed', '#8c8c8c', '#2a2a2a', '#9696ff'],
  ['#120a14', '#ff4f8b', '#ffb36b', '#6b2fd6', '#2a0f3a'],
  ['#03100e', '#3cf0b0', '#0d3b3a', '#e6ff6b', '#1a5c55'],
  ['#f2f1ed', '#111111', '#9696ff', '#ff6a3d', '#d3d2cc'],
];

export function randomState(base) {
  const r = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const pal = pick(PALETTES);
  const s = normalize({ aspect: base?.aspect, bg: pal[0] });
  const ar = s.aspect.w / s.aspect.h;
  const ex = Math.max(1, ar) * .5, ey = Math.max(1, 1 / ar) * .5;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const c = pick(pal.slice(1));
    s.layers.push(makeLayer('blob', {
      name: 'Blob ' + (i + 1), x: r(-ex, ex), y: r(-ey, ey), sx: r(.15, .7), sy: r(.12, .6), rot: r(-60, 60),
      c1: c, c2: pick(pal), intensity: r(.6, 1), blend: Math.random() < .25 ? 'screen' : 'normal',
    }));
  }
  if (Math.random() < .35) s.layers.push(makeLayer('band', { x: r(-.1, .1), y: r(-ey * .5, ey * .5), rot: r(-25, 25), b: r(-.8, .8), sx: r(.6, 1.1) }));
  if (Math.random() < .2) s.layers.push(makeLayer('ring', { x: r(-ex, ex), y: r(-ey, ey), sx: r(.3, .8), sy: 0, c1: pick(pal.slice(1)) }));
  if (Math.random() < .2) s.layers.push(makeLayer('noise', { c1: pal[0], c2: pick(pal.slice(1)), a: r(.4, .6), b: r(0, 1) }));
  s.layers.forEach(l => { if (l.type === 'ring') l.sy = l.sx; });
  const fold = pick(['none', 'fluted', 'fluted', 'folds', 'folds', 'accordion', 'wave', 'tiles']);
  s.fold = { ...s.fold, type: fold, angle: pick([0, 0, 90, r(-50, 50)]), count: fold === 'fluted' ? r(16, 48) : fold === 'tiles' ? r(4, 10) : r(3, 12), strength: r(.3, .9), shift: fold === 'folds' ? r(.05, .25) : 0, shading: r(.15, .6), chroma: r(0, .25), smear: Math.random() < .3 ? r(.02, .08) : 0, highlight: r(0, .1) };
  s.warp = { amount: r(0, .1), scale: r(.8, 2), flow: r(.15, .4) };
  s.drift = r(.1, .4);
  s.grain = { ...s.grain, amount: r(.03, .18), size: r(1, 1.6) };
  if (Math.random() < .12) s.halftone = { ...s.halftone, mode: pick(['dots', 'grid', 'dither']), cell: r(5, 14) };
  s.view = { ...(base?.view || s.view) };
  return s;
}
