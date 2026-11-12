// WebGL2 renderer. Passes: light field -> fold -> effects stack (ping-pong) -> screen.
import * as SH from './shaders.js';
import { getAsset } from './assets.js';

const { MAX_LAYERS, MAX_STOPS, MAX_SPLINE, MAX_IMAGES } = SH;
export const TYPES = ['blob', 'ring', 'band', 'linear', 'conic', 'noise', 'spline', 'image'];
export const BLENDS = ['normal', 'add', 'screen', 'multiply'];
export const FOLDS = ['none', 'fluted', 'folds', 'accordion', 'wave', 'tiles'];
export const HALFTONES = ['none', 'dots', 'grid', 'lines', 'dither'];
export const SPLINE_STYLES = ['neon', 'paint', 'silk'];
export const SPLINE_COLOR = ['along', 'across', 'spectrum'];
const SPATIAL = { bloom: 1, halation: 1, blur: 1 };
const IMG_SIZE = 1024;
const RAD = Math.PI / 180;

export function hexToRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// Ramp stops sorted by position, packed as rgb + position
export function packRamp(ramp, out, offset, max = MAX_STOPS) {
  const st = [...(ramp?.length ? ramp : [{ p: 0, c: '#ffffff' }])].sort((a, b) => a.p - b.p).slice(0, max);
  st.forEach((s, k) => out.set([...hexToRgb(s.c), s.p], offset + k * 4));
  return st.length;
}

// Catmull-Rom through the control points, sampled evenly per span, with normalized length in z
export function sampleSpline(pts, perSpan = 10) {
  if (!pts || pts.length < 2) return [];
  const P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    for (let k = 0; k < perSpan; k++) {
      const t = k / perSpan, t2 = t * t, t3 = t2 * t;
      const f = j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push([...pts.at(-1)]);
  let len = 0;
  const acc = [0];
  for (let i = 1; i < out.length; i++) acc.push(len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return out.map((p, i) => [p[0], p[1], len ? acc[i] / len : 0]);
}

// How many samples per span so all splines fit in the shared budget
function splineBudget(layers) {
  const spans = layers.filter(l => l.type === 'spline').reduce((n, l) => n + Math.max(0, (l.pts?.length || 0) - 1), 0);
  return spans ? Math.max(2, Math.min(16, Math.floor((MAX_SPLINE - 4) / spans))) : 10;
}

// Editor state -> field and fold uniforms (shared with the code exporter)
export function packUniforms(s, img = {}) {
  const L0 = new Float32Array(MAX_LAYERS * 4), L1 = new Float32Array(MAX_LAYERS * 4);
  const L2 = new Float32Array(MAX_LAYERS * 4), L3 = new Float32Array(MAX_LAYERS * 4);
  const RA = new Float32Array(MAX_LAYERS * MAX_STOPS * 4), SP = new Float32Array(MAX_SPLINE * 4);
  const layers = s.layers.slice(0, MAX_LAYERS);
  const per = splineBudget(layers);
  let sp = 0;
  layers.forEach((l, i) => {
    const n = packRamp(l.ramp, RA, i * MAX_STOPS * 4);
    let e = [n, 0, 0, 0], visible = l.visible;
    if (l.type === 'band') e[1] = l.core ?? 1;
    if (l.type === 'spline') {
      const pts = sampleSpline(l.pts, per).slice(0, MAX_SPLINE - sp);
      pts.forEach((p, k) => SP.set([p[0], p[1], p[2], 0], (sp + k) * 4));
      e = [n, SPLINE_STYLES.indexOf(l.style || 'neon') + 10 * Math.max(0, SPLINE_COLOR.indexOf(l.cmode || 'along')), sp, pts.length];
      sp += pts.length;
    }
    if (l.type === 'image') {
      const info = img[l.id];
      if (!info) visible = false;
      else e = [n, l.src === 'text' ? 1 : 0, info.slot, info.aspect];
    }
    L0.set([l.x, l.y, l.sx, l.sy], i * 4);
    L1.set([l.rot * RAD, l.soft, l.intensity, Math.max(0, TYPES.indexOf(l.type))], i * 4);
    L2.set([l.a ?? 0, l.b ?? 0, Math.max(0, BLENDS.indexOf(l.blend)), visible ? 1 : 0], i * 4);
    L3.set(e, i * 4);
  });
  const f = s.fold;
  return {
    uZoom: s.view.zoom, uPan: [s.view.x, s.view.y], uBg: hexToRgb(s.bg),
    uWarp: [s.warp.amount, s.warp.scale, s.warp.flow, 0], uDrift: s.drift,
    uCount: layers.length, uL0: L0, uL1: L1, uL2: L2, uL3: L3, uRamp: RA, uSpl: SP,
    uFold: [FOLDS.indexOf(f.type), f.angle * RAD, f.count, f.strength],
    uFold2: [f.shift, f.shading, f.chroma, f.smear],
    uFold3: [f.jitter, f.highlight, 0, 0],
  };
}

// One effect -> P0..P3, C0..C2, R
export function packFx(fx) {
  const z = [0, 0, 0, 0];
  const o = { P0: z, P1: z, P2: z, P3: z, C0: [1, 1, 1], C1: [0, 0, 0], C2: [0, 0, 0], R: new Float32Array(32) };
  switch (fx.type) {
    case 'adjust': o.P0 = [fx.exposure, fx.contrast, fx.saturation, fx.hue * RAD]; break;
    case 'grade':
      o.P0 = [fx.lift, fx.gamma, fx.gain, fx.temp]; o.P1 = [fx.tint, fx.shadows, fx.highlights, fx.balance];
      o.C0 = hexToRgb(fx.shadowColor); o.C1 = hexToRgb(fx.highlightColor); break;
    case 'gradmap': { const n = packRamp(fx.ramp, o.R, 0, 8); o.P0 = [fx.amount, fx.contrast, n, 0]; break; }
    case 'bloom': o.P0 = [fx.threshold, fx.radius, fx.intensity, fx.knee]; o.C0 = hexToRgb(fx.tint); break;
    case 'halation': o.P0 = [fx.threshold, fx.radius, fx.intensity, .2]; o.C0 = hexToRgb(fx.color); break;
    case 'lens': o.P0 = [fx.distortion, fx.fringe, fx.edgeBlur, 0]; break;
    case 'blur': o.P0 = [fx.radius, fx.tilt, fx.focus, fx.band]; o.P1 = [fx.angle * RAD, 0, 0, 0]; break;
    case 'vignette': o.P0 = [fx.amount, fx.roundness, fx.softness, 0]; o.C0 = hexToRgb(fx.color); break;
    case 'halftone':
      o.P0 = [HALFTONES.indexOf(fx.mode), fx.cell, fx.angle * RAD, fx.dot]; o.P1 = [fx.colored ? 1 : 0, fx.gamma, fx.mix, 0];
      o.C0 = hexToRgb(fx.ink); o.C1 = hexToRgb(fx.paper); break;
    case 'grain': o.P0 = [fx.amount, fx.size, fx.colored ? 1 : 0, fx.animated ? 1 : 0]; break;
  }
  return o;
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, SH.VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const setters = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    const loc = gl.getUniformLocation(p, info.name);
    const T = info.type;
    setters[name] =
      T === gl.FLOAT ? v => gl.uniform1fv(loc, typeof v === 'number' ? [v] : v) :
      T === gl.FLOAT_VEC2 ? v => gl.uniform2fv(loc, v) :
      T === gl.FLOAT_VEC3 ? v => gl.uniform3fv(loc, v) :
      T === gl.FLOAT_VEC4 ? v => gl.uniform4fv(loc, v) :
      v => gl.uniform1i(loc, v);
  }
  return { p, setters };
}

// Draw text into a canvas sized to the text, white on transparent
export function renderText(l) {
  const size = 220;
  const font = `${l.weight || 600} ${size}px ${l.font || '"Schibsted Grotesk", sans-serif'}`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (l.spacing || 0) * size + 'px';
  const lines = String(l.text || ' ').split('\n');
  const lh = size * 1.05;
  const w = Math.max(...lines.map(t => ctx.measureText(t).width), 10);
  const pad = size * .25;
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(lh * lines.length + pad * 2);
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (l.spacing || 0) * size + 'px';
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = l.align || 'center';
  const x = ctx.textAlign === 'left' ? pad : ctx.textAlign === 'right' ? c.width - pad : c.width / 2;
  lines.forEach((t, i) => ctx.fillText(t, x, pad + lh * (i + .5)));
  return { canvas: c, aspect: c.width / c.height, ready: document.fonts.check(font) };
}

export class Engine {
  constructor(canvas, { preserve = false } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: preserve });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    this.p = {
      field: program(gl, SH.FIELD_FS), fold: program(gl, SH.FOLD_FS), present: program(gl, SH.PRESENT_FS),
      bright: program(gl, SH.BRIGHT_FS), blur: program(gl, SH.BLUR_FS), glowmix: program(gl, SH.GLOWMIX_FS),
    };
    this.fxp = {};
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.t = {};
    this.size = [0, 0];
    this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    // image slots: one texture array, redrawn only when a slot's source changes
    this.imgTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.imgTex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(IMG_SIZE) + 1, gl.RGBA8, IMG_SIZE, IMG_SIZE, MAX_IMAGES);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.slotKeys = [];
    this.imgInfo = {};
    this.slotCanvas = document.createElement('canvas');
    this.slotCanvas.width = this.slotCanvas.height = IMG_SIZE;
  }

  target(name, w, h, wrap) {
    const gl = this.gl;
    let t = this.t[name];
    if (t && t.w === w && t.h === h) return t;
    if (!t) { t = { tex: gl.createTexture(), fbo: gl.createFramebuffer() }; this.t[name] = t; }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    t.w = w; t.h = h;
    return t;
  }

  // Keep the image texture array in step with the image / text layers
  syncImages(state) {
    const gl = this.gl;
    const layers = state.layers.filter(l => l.type === 'image').slice(0, MAX_IMAGES);
    const info = {};
    let touched = false;
    layers.forEach((l, slot) => {
      let key, draw;
      if (l.src === 'text') {
        const r = renderText(l);
        key = 'text|' + [l.text, l.font, l.weight, l.spacing, l.align, r.ready].join('|');
        draw = () => r.canvas;
        info[l.id] = { slot, aspect: r.aspect };
      } else {
        const a = getAsset(l.asset);
        if (!a) return;
        key = 'img|' + l.asset;
        draw = () => a.bitmap;
        info[l.id] = { slot, aspect: a.w / a.h };
      }
      if (this.slotKeys[slot] === key) return;
      const ctx = this.slotCanvas.getContext('2d');
      ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE);
      ctx.drawImage(draw(), 0, 0, IMG_SIZE, IMG_SIZE);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.imgTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slot, IMG_SIZE, IMG_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.slotCanvas);
      this.slotKeys[slot] = key;
      touched = true;
    });
    if (touched) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.imgTex); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); }
    this.imgInfo = info;
  }

  fxProgram(type) {
    return this.fxp[type] ??= program(this.gl, SH.fxFS(type));
  }

  pass(prog, U, out, inputs = {}) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    for (const k in prog.setters) if (U[k] !== undefined) prog.setters[k](U[k]);
    let unit = 0;
    for (const [name, tex] of Object.entries(inputs)) {
      if (!prog.setters[name]) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(name === 'uImg' ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D, tex);
      prog.setters[name](unit++);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, out ? out.w : this.canvas.width, out ? out.h : this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(state, phase = 0, frame = 0) {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    if (!w || !h) return;
    this.syncImages(state);
    const field = this.target('field', w, h, gl.MIRRORED_REPEAT);
    let cur = this.target('ping', w, h, gl.CLAMP_TO_EDGE), other = this.target('pong', w, h, gl.CLAMP_TO_EDGE);
    const base = { uRes: [w, h], uPhase: phase, uFrame: frame };
    const U = { ...packUniforms(state, this.imgInfo), ...base };
    this.pass(this.p.field, U, field, { uImg: this.imgTex });
    this.pass(this.p.fold, U, cur, { uField: field.tex });
    const m = Math.min(w, h);
    for (const fx of state.fx || []) {
      if (!fx.on) continue;
      const F = { ...packFx(fx), ...base };
      if (fx.type === 'blur') {
        const r = fx.radius * m / 1000 / 7;
        const T = { ...base, uTilt: [fx.tilt, fx.focus, fx.band, fx.angle * RAD] };
        this.pass(this.p.blur, { ...T, uDir: [r, 0] }, other, { uPrev: cur.tex });
        this.pass(this.p.blur, { ...T, uDir: [0, r] }, cur, { uPrev: other.tex });
      } else if (fx.type === 'bloom' || fx.type === 'halation') {
        const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
        const A = this.target('halfA', hw, hh, gl.CLAMP_TO_EDGE), B = this.target('halfB', hw, hh, gl.CLAMP_TO_EDGE);
        const hb = { ...base, uRes: [hw, hh], uTilt: [0, 0, 0, 0] };
        this.pass(this.p.bright, { ...F, uRes: [hw, hh] }, A, { uPrev: cur.tex });
        const r = F.P0[1] * m / 2000 / 7;
        for (const k of [.35, 1]) {
          this.pass(this.p.blur, { ...hb, uDir: [r * k, 0] }, B, { uPrev: A.tex });
          this.pass(this.p.blur, { ...hb, uDir: [0, r * k] }, A, { uPrev: B.tex });
        }
        this.pass(this.p.glowmix, F, other, { uPrev: cur.tex, uAux: A.tex });
        [cur, other] = [other, cur];
      } else {
        this.pass(this.fxProgram(fx.type), F, other, { uPrev: cur.tex });
        [cur, other] = [other, cur];
      }
    }
    this.pass(this.p.present, base, null, { uPrev: cur.tex });
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export const isSpatial = type => !!SPATIAL[type];
