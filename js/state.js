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

const R2 = (a, b = a) => [{ p: 0, c: a }, { p: 1, c: b }];
const clone = o => JSON.parse(JSON.stringify(o));

const LAYER_DEFAULTS = {
  blob: { name: 'Blob', sx: .35, sy: .35, soft: 1, a: 0, b: 0, blend: 'normal', ramp: R2('#9696ff') },
  ring: { name: 'Ring', sx: .4, sy: .4, soft: .15, a: 0, b: .06, blend: 'add', ramp: R2('#ff8a3c', '#5a2a10') },
  band: { name: 'Spectrum', sx: .7, sy: .07, soft: .8, a: .9, b: -.5, core: 1, blend: 'add', ramp: R2('#ffd9b0') },
  linear: { name: 'Linear', sx: .5, sy: .5, soft: 1, a: 0, b: 0, blend: 'normal', ramp: R2('#111111', '#9696ff') },
  conic: { name: 'Conic', sx: .6, sy: .6, soft: .6, a: 1, b: 0, blend: 'screen', ramp: R2('#111111', '#9696ff') },
  noise: { name: 'Cloud', sx: .5, sy: .5, soft: .5, a: .5, b: .3, blend: 'screen', ramp: R2('#2a2a2a', '#9696ff') },
  spline: {
    name: 'Light', sx: .006, sy: .05, soft: .5, a: .6, b: 0, blend: 'add', style: 'neon', cmode: 'along',
    ramp: R2('#9696ff', '#ff8a4c'), pts: [[-.32, .12], [-.12, -.12], [.1, .12], [.32, -.06]],
  },
  image: { name: 'Image', sx: .35, sy: .35, soft: 0, a: 0, b: 0, blend: 'normal', src: 'image', asset: null, ramp: R2('#ffffff') },
};
const TEXT_DEFAULTS = {
  name: 'Text', src: 'text', text: 'Fold', font: '"Schibsted Grotesk", sans-serif', weight: 700, spacing: -.02, align: 'center',
  sx: .4, a: 1, ramp: R2('#f2f1ed', '#9696ff'),
};

export function makeLayer(type = 'blob', over = {}) {
  const extra = type === 'text' ? TEXT_DEFAULTS : {};
  const t = type === 'text' ? 'image' : type;
  const l = { id: newId(), type: t, visible: true, x: 0, y: 0, rot: 0, intensity: 1, ...clone(LAYER_DEFAULTS[t]), ...clone(extra), ...over };
  // old two-colour layers
  if (over.c1 && !over.ramp) l.ramp = R2(over.c1, over.c2 || over.c1);
  delete l.c1; delete l.c2;
  return l;
}

export const FX_DEFAULTS = {
  adjust: { exposure: 0, contrast: 0, saturation: 1, hue: 0 },
  grade: { lift: 0, gamma: 1, gain: 1, temp: 0, tint: 0, shadows: 0, highlights: 0, balance: 0, shadowColor: '#2a4a9a', highlightColor: '#ffb070' },
  gradmap: { amount: 1, contrast: 1, ramp: [{ p: 0, c: '#111111' }, { p: .55, c: '#9696ff' }, { p: 1, c: '#f2f1ed' }] },
  bloom: { threshold: .6, radius: 60, intensity: .8, knee: .3, tint: '#ffffff' },
  halation: { threshold: .65, radius: 22, intensity: .7, color: '#ff4a1c' },
  lens: { distortion: .12, fringe: .35, edgeBlur: .3 },
  blur: { radius: 12, tilt: 0, focus: .5, band: .3, angle: 0 },
  vignette: { amount: .3, roundness: 0, softness: .5, color: '#000000' },
  halftone: { mode: 'dots', cell: 6, angle: 0, dot: .3, colored: false, gamma: 1, mix: 1, ink: '#ffffff', paper: '#000000' },
  grain: { amount: .08, size: 1, colored: false, animated: true },
};
export const makeFx = (type, over = {}) => ({ id: newId(), type, on: true, ...clone(FX_DEFAULTS[type]), ...over });

export function defaultState() {
  return {
    v: 2,
    aspect: { id: '9:16', w: 9, h: 16 },
    view: { zoom: 1, x: 0, y: 0 },
    bg: '#0b0b0b',
    warp: { amount: 0, scale: 1.5, flow: .25 },
    drift: 0,
    layers: [],
    fold: { type: 'none', angle: 0, count: 14, strength: .5, shift: 0, shading: .3, chroma: 0, smear: 0, jitter: 0, highlight: 0 },
    fx: [makeFx('adjust'), makeFx('grain')],
    anim: { duration: 8 },
  };
}

// Old files had tone / grain / halftone blocks instead of an effects stack
function legacyFx(s) {
  const t = s.tone || {}, g = s.grain, h = s.halftone;
  const fx = [makeFx('adjust', { exposure: t.exposure ?? 0, contrast: t.contrast ?? 0, saturation: t.saturation ?? 1, hue: t.hue ?? 0 })];
  if (t.vignette > 0) fx.push(makeFx('vignette', { amount: t.vignette }));
  if (h && h.mode && h.mode !== 'none') fx.push(makeFx('halftone', h));
  if (!g || g.amount > 0) fx.push(makeFx('grain', g || {}));
  return fx;
}

// Merge a partial (preset or loaded file) over defaults so older files keep working
export function normalize(s) {
  const d = defaultState();
  const out = { ...d, ...s };
  for (const k of ['aspect', 'view', 'warp', 'fold', 'anim']) out[k] = { ...d[k], ...(s[k] || {}) };
  out.layers = (s.layers || []).map(l => {
    const n = { ...makeLayer(l.src === 'text' ? 'text' : l.type || 'blob'), ...l, id: l.id || newId() };
    if (!l.ramp && l.c1) n.ramp = R2(l.c1, l.c2 || l.c1);
    delete n.c1; delete n.c2;
    return n;
  });
  out.fx = (s.fx || legacyFx(s)).map(f => ({ ...makeFx(f.type), ...f, id: f.id || newId() }));
  delete out.tone; delete out.grain; delete out.halftone;
  out.v = 2;
  return out;
}

const L = makeLayer;
// evenly spaced ramp from a list of colours
const RS = (...cs) => cs.map((c, i) => ({ p: i / (cs.length - 1), c }));
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
  P('Neon line', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#060608',
    layers: [
      L('blob', { name: 'Haze', x: .1, y: -.2, sx: .7, sy: .6, ramp: R2('#16163a', '#09090f'), intensity: .9 }),
      L('spline', { name: 'Neon', pts: [[-.45, .55], [-.2, .1], [.15, .25], [.05, -.35], [.42, -.7]], sx: .005, sy: .045, soft: .6, a: .5, b: .7, ramp: R2('#9696ff', '#ff6a3d'), intensity: .9 }),
    ],
    fold: { type: 'fluted', angle: 0, count: 26, strength: .55, shift: 0, shading: .3, chroma: .2, smear: 0, jitter: 0, highlight: .03 },
    fx: [{ type: 'adjust', contrast: .05 }, { type: 'bloom', threshold: .55, radius: 70, intensity: .7 }, { type: 'vignette', amount: .35 }, { type: 'grain', amount: .07 }],
    drift: .2,
  }),
  P('Light painting', {
    aspect: { id: '4:5', w: 4, h: 5 }, bg: '#050505',
    layers: [
      L('spline', { name: 'Warm stroke', style: 'paint', pts: [[-.5, .3], [-.2, -.25], [.15, .2], [.5, -.15]], sx: .01, sy: .05, soft: .4, a: .8, ramp: [{ p: 0, c: '#ff3d1f' }, { p: .5, c: '#ffb36b' }, { p: 1, c: '#fff2d6' }], intensity: 1.1 }),
      L('spline', { name: 'Cool stroke', style: 'paint', pts: [[-.45, -.45], [-.05, -.05], [.3, .45]], sx: .006, sy: .035, soft: .5, a: .9, cmode: 'spectrum', intensity: .9 }),
    ],
    fx: [{ type: 'adjust' }, { type: 'bloom', threshold: .35, radius: 50, intensity: .9 }, { type: 'halation', intensity: .6 }, { type: 'grain', amount: .1, size: 1.2 }],
    warp: { amount: .015, scale: 2, flow: .3 }, drift: .15,
  }),
  P('Silk', {
    aspect: { id: '16:9', w: 16, h: 9 }, bg: '#0c0a10',
    layers: [
      L('spline', { name: 'Silk', style: 'silk', pts: [[-.95, .25], [-.4, -.15], [.1, .2], [.55, -.2], [1, .1]], sx: .06, sy: .12, soft: .6, a: .3, ramp: [{ p: 0, c: '#3b3b8a' }, { p: .5, c: '#9696ff' }, { p: 1, c: '#ffd2c2' }], cmode: 'across', blend: 'screen' }),
    ],
    fx: [{ type: 'adjust', contrast: .1 }, { type: 'lens', distortion: .08, fringe: .4, edgeBlur: .4 }, { type: 'bloom', threshold: .7, radius: 40, intensity: .5 }, { type: 'grain', amount: .05 }],
    warp: { amount: .03, scale: 1.2, flow: .35 }, drift: .3,
  }),
  P('Type glass', {
    aspect: { id: '1:1', w: 1, h: 1 }, bg: '#0b0b0b',
    layers: [
      L('blob', { name: 'Glow', x: -.1, y: .05, sx: .45, sy: .35, ramp: R2('#9696ff', '#2a2a6a') }),
      L('blob', { name: 'Ember', x: .25, y: -.1, sx: .25, sy: .25, ramp: R2('#ff8a4c', '#5a2410'), blend: 'screen' }),
      L('text', { name: 'Word', text: 'FOLD', weight: 800, sx: .38, spacing: -.03, ramp: R2('#f2f1ed', '#f2f1ed') }),
    ],
    fold: { type: 'fluted', angle: 0, count: 18, strength: .8, shift: 0, shading: .35, chroma: .25, smear: 0, jitter: 0, highlight: .05 },
    fx: [{ type: 'adjust' }, { type: 'bloom', threshold: .7, radius: 30, intensity: .5 }, { type: 'grain', amount: .06 }],
    drift: .3,
  }),
  P('Chrome', {
    aspect: { id: '4:5', w: 4, h: 5 }, bg: '#0e0e10',
    layers: [
      L('linear', { name: 'Metal', rot: 70, sx: .35, ramp: RS('#1a1a1e', '#d9dce4', '#3a3c44', '#f4f5f8', '#22232a') }),
      L('blob', { name: 'Glint', x: .15, y: -.2, sx: .2, sy: .5, rot: 20, ramp: R2('#ffffff', '#8890a0'), blend: 'screen', intensity: .7 }),
    ],
    fold: { type: 'accordion', angle: 15, count: 7, strength: .9, shift: 0, shading: .7, chroma: .08, smear: 0, jitter: .03, highlight: .1 },
    fx: [{ type: 'adjust', contrast: .2, saturation: .4 }, { type: 'gradmap', amount: .35, ramp: RS('#0b0c10', '#7d8496', '#f2f4fa') }, { type: 'grain', amount: .05 }],
    drift: .3,
  }),
  P('Deep sea', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#020a12',
    layers: [
      L('noise', { name: 'Current', x: 0, y: -.2, sx: .6, sy: .6, a: .52, b: .4, soft: .7, ramp: RS('#031a2a', '#0d6f8a', '#7af0ff'), blend: 'add', intensity: .8 }),
      L('noise', { name: 'Depth', x: .1, y: .4, sx: .5, sy: .4, a: .55, b: .8, soft: .6, ramp: R2('#020a12', '#1a3a8a'), blend: 'add', intensity: .6 }),
      L('blob', { name: 'Surface', x: 0, y: -.85, sx: .9, sy: .3, ramp: R2('#9ff2ff', '#0d4a6a'), blend: 'screen', intensity: .6 }),
    ],
    fold: { type: 'wave', angle: 0, count: 9, strength: .5, shift: .05, shading: .2, chroma: .1, smear: .03, jitter: 0, highlight: .02 },
    fx: [{ type: 'adjust', exposure: .35 }, { type: 'bloom', threshold: .45, radius: 80, intensity: .8, tint: '#7af0ff' }, { type: 'vignette', amount: .4 }, { type: 'grain', amount: .07 }],
    warp: { amount: .1, scale: 1.2, flow: .45 }, drift: .3,
  }),
  P('Duotone moon', {
    aspect: { id: '4:5', w: 4, h: 5 }, bg: '#000000',
    layers: [
      L('blob', { name: 'Moon', x: .08, y: -.05, sx: .3, sy: .3, soft: .35, ramp: R2('#ffffff', '#9a9a9a') }),
      L('noise', { name: 'Craters', x: .08, y: -.05, sx: .18, sy: .18, a: .55, b: .2, soft: .5, ramp: R2('#000000', '#000000'), blend: 'multiply', intensity: .35 }),
      L('blob', { name: 'Halo', x: .08, y: -.05, sx: .6, sy: .6, ramp: R2('#3a3a3a', '#000000'), blend: 'add', intensity: .6 }),
    ],
    fx: [{ type: 'adjust', contrast: .15 }, { type: 'gradmap', amount: 1, ramp: RS('#1b1464', '#9696ff', '#ffe8d6') }, { type: 'halftone', mode: 'dots', cell: 7, angle: 30, colored: true, paper: '#120d3a', mix: .85 }],
    drift: .15,
  }),
  P('Signal', {
    aspect: { id: '16:9', w: 16, h: 9 }, bg: '#050507',
    layers: [
      L('spline', { name: 'Red', pts: [[-1, .1], [-.4, -.15], [.2, .2], [1, -.05]], sx: .004, sy: .04, a: .3, b: .8, ramp: R2('#ff3d3d', '#ff9a5a') }),
      L('spline', { name: 'Green', pts: [[-1, .18], [-.4, -.07], [.2, .28], [1, .03]], sx: .004, sy: .04, a: .3, b: .8, ramp: R2('#3dff8a', '#c8ff5a') }),
      L('spline', { name: 'Blue', pts: [[-1, .26], [-.4, .01], [.2, .36], [1, .11]], sx: .004, sy: .04, a: .3, b: .8, ramp: R2('#3d8aff', '#9696ff') }),
    ],
    fold: { type: 'folds', angle: 0, count: 8, strength: .25, shift: .05, shading: .4, chroma: .2, smear: 0, jitter: .04, highlight: .05 },
    fx: [{ type: 'adjust' }, { type: 'bloom', threshold: .4, radius: 60, intensity: .8 }, { type: 'lens', distortion: .1, fringe: .5, edgeBlur: .2 }, { type: 'grain', amount: .09 }],
    drift: .2,
  }),
  P('Ember ring', {
    aspect: { id: '1:1', w: 1, h: 1 }, bg: '#070404',
    layers: [
      L('blob', { name: 'Inner', x: 0, y: 0, sx: .28, sy: .28, soft: .4, ramp: R2('#0a0505', '#1a0a06') }),
      L('ring', { name: 'Fire', sx: .3, sy: .3, soft: .35, b: .04, ramp: RS('#fff0c8', '#ff7a2a', '#5a1006'), intensity: 1.2 }),
      L('noise', { name: 'Smoke', sx: .6, sy: .6, a: .6, b: .5, soft: .7, ramp: R2('#000000', '#3a1a10'), blend: 'screen', intensity: .5 }),
    ],
    fx: [{ type: 'adjust', contrast: .1 }, { type: 'halation', threshold: .5, radius: 30, intensity: 1 }, { type: 'bloom', threshold: .6, radius: 90, intensity: .6, tint: '#ffb070' }, { type: 'vignette', amount: .5 }, { type: 'grain', amount: .12, colored: true }],
    warp: { amount: .04, scale: 3, flow: .4 }, drift: .1,
  }),
  P('Holographic', {
    aspect: { id: '9:16', w: 9, h: 16 }, bg: '#b9bccc',
    layers: [
      L('conic', { name: 'Foil', sx: 1.6, sy: 1.6, soft: .1, a: 2, ramp: RS('#ff6fb8', '#6fd8ff', '#c6ff6f', '#9a6fff', '#ff6fb8') }),
      L('linear', { name: 'Silver', rot: 60, sx: .6, ramp: RS('#ffffff', '#8a8ea0', '#ffffff'), blend: 'multiply', intensity: .45 }),
      L('blob', { name: 'Sheen', x: -.15, y: -.35, sx: .35, sy: .55, rot: -30, ramp: R2('#ffffff', '#d8d8ff'), blend: 'screen', intensity: .45 }),
    ],
    fold: { type: 'fluted', angle: 25, count: 22, strength: .6, shift: 0, shading: .35, chroma: .45, smear: 0, jitter: 0, highlight: .1 },
    fx: [{ type: 'adjust', saturation: 1.15, contrast: .1 }, { type: 'lens', distortion: .05, fringe: .6, edgeBlur: 0 }, { type: 'grain', amount: .03 }],
    warp: { amount: .1, scale: 1.4, flow: .4 }, drift: .3,
  }),
  P('Fog', {
    aspect: { id: '3:2', w: 3, h: 2 }, bg: '#aeb3b0',
    layers: [
      L('linear', { name: 'Sky', rot: 90, sx: .5, ramp: RS('#eef0ec', '#c4c9c5', '#7f8883') }),
      L('blob', { name: 'Far trees', x: -.45, y: .2, sx: .55, sy: .3, soft: .7, ramp: R2('#5f6964', '#9aa29d'), intensity: .7 }),
      L('blob', { name: 'Near trees', x: .5, y: .35, sx: .5, sy: .45, soft: .55, ramp: R2('#2c332f', '#5f6964'), intensity: .9 }),
      L('blob', { name: 'Light', x: -.35, y: -.3, sx: .5, sy: .35, ramp: R2('#ffffff', '#e6e8e4'), blend: 'screen', intensity: .7 }),
      L('noise', { name: 'Mist', sx: .7, sy: .35, a: .5, b: .6, soft: .9, ramp: R2('#c9ccc9', '#ffffff'), blend: 'screen', intensity: .5 }),
    ],
    fx: [{ type: 'adjust' }, { type: 'blur', radius: 26, tilt: 1, focus: .6, band: .2, angle: 0 }, { type: 'grade', temp: -.15, shadows: .25, shadowColor: '#2a4a5a' }, { type: 'grain', amount: .12, size: 1.6 }],
    warp: { amount: .05, scale: 1.2, flow: .3 }, drift: .2,
  }),
  P('Riso', {
    aspect: { id: '4:5', w: 4, h: 5 }, bg: '#f2ede2',
    layers: [
      L('blob', { name: 'Pink', x: -.12, y: -.12, sx: .32, sy: .32, soft: .6, ramp: R2('#ff5fa2', '#ff9cc7'), blend: 'multiply' }),
      L('blob', { name: 'Blue', x: .12, y: .1, sx: .32, sy: .32, soft: .6, ramp: R2('#2f6bff', '#8fb0ff'), blend: 'multiply' }),
      L('blob', { name: 'Yellow', x: .05, y: .38, sx: .2, sy: .2, soft: .6, ramp: R2('#ffd23b', '#ffe68a'), blend: 'multiply' }),
    ],
    fx: [{ type: 'adjust' }, { type: 'halftone', mode: 'dither', cell: 9, colored: true, paper: '#f2ede2', gamma: .9, mix: .7 }, { type: 'grain', amount: .06, size: 1.4 }],
    drift: .3,
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
      ramp: R2(c, pick(pal)), intensity: r(.6, 1), blend: Math.random() < .25 ? 'screen' : 'normal',
    }));
  }
  if (Math.random() < .35) s.layers.push(makeLayer('band', { x: r(-.1, .1), y: r(-ey * .5, ey * .5), rot: r(-25, 25), b: r(-.8, .8), sx: r(.6, 1.1) }));
  if (Math.random() < .2) s.layers.push(makeLayer('ring', { x: r(-ex, ex), y: r(-ey, ey), sx: r(.3, .8), sy: 0, ramp: R2(pick(pal.slice(1)), pal[0]) }));
  if (Math.random() < .2) s.layers.push(makeLayer('noise', { ramp: R2(pal[0], pick(pal.slice(1))), a: r(.4, .6), b: r(0, 1) }));
  if (Math.random() < .25) s.layers.push(makeLayer('spline', {
    pts: [0, 1, 2, 3].map(i => [-ex * .8 + i * ex * .53, r(-ey * .6, ey * .6)]), style: pick(['neon', 'neon', 'paint', 'silk']),
    ramp: R2(pick(pal.slice(1)), pick(pal.slice(1))), b: Math.random() < .5 ? r(.3, .8) : 0,
  }));
  s.layers.forEach(l => { if (l.type === 'ring') l.sy = l.sx; });
  const fold = pick(['none', 'fluted', 'fluted', 'folds', 'folds', 'accordion', 'wave', 'tiles']);
  s.fold = { ...s.fold, type: fold, angle: pick([0, 0, 90, r(-50, 50)]), count: fold === 'fluted' ? r(16, 48) : fold === 'tiles' ? r(4, 10) : r(3, 12), strength: r(.3, .9), shift: fold === 'folds' ? r(.05, .25) : 0, shading: r(.15, .6), chroma: r(0, .25), smear: Math.random() < .3 ? r(.02, .08) : 0, highlight: r(0, .1) };
  s.warp = { amount: r(0, .1), scale: r(.8, 2), flow: r(.15, .4) };
  s.drift = r(.1, .4);
  s.fx = [makeFx('adjust', { contrast: r(0, .15) })];
  if (Math.random() < .35) s.fx.push(makeFx('bloom', { threshold: r(.45, .75), intensity: r(.4, 1) }));
  if (Math.random() < .15) s.fx.push(makeFx('halation'));
  if (Math.random() < .12) s.fx.push(makeFx('halftone', { mode: pick(['dots', 'grid', 'dither']), cell: r(5, 14) }));
  if (Math.random() < .3) s.fx.push(makeFx('vignette', { amount: r(.15, .4) }));
  s.fx.push(makeFx('grain', { amount: r(.03, .18), size: r(1, 1.6) }));
  s.view = { ...(base?.view || s.view) };
  return s;
}
