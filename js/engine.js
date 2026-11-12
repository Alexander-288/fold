// WebGL2 renderer: pass 1 draws the light field into a float texture, pass 2 folds and finishes it.
import { VERT, FIELD_FS, COMP_FS, MAX_LAYERS } from './shaders.js';

export const TYPES = ['blob', 'ring', 'band', 'linear', 'conic', 'noise'];
export const BLENDS = ['normal', 'add', 'screen', 'multiply'];
export const FOLDS = ['none', 'fluted', 'folds', 'accordion', 'wave', 'tiles'];
export const HALFTONES = ['none', 'dots', 'grid', 'lines', 'dither'];

const RAD = Math.PI / 180;

export function hexToRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// Turn editor state into shader uniform values (shared with the code exporter)
export function packUniforms(s) {
  const L0 = new Float32Array(MAX_LAYERS * 4), L1 = new Float32Array(MAX_LAYERS * 4), L2 = new Float32Array(MAX_LAYERS * 4);
  const C1 = new Float32Array(MAX_LAYERS * 3), C2 = new Float32Array(MAX_LAYERS * 3);
  const layers = s.layers.slice(0, MAX_LAYERS);
  layers.forEach((l, i) => {
    L0.set([l.x, l.y, l.sx, l.sy], i * 4);
    L1.set([l.rot * RAD, l.soft, l.intensity, Math.max(0, TYPES.indexOf(l.type))], i * 4);
    L2.set([l.a ?? 0, l.b ?? 0, Math.max(0, BLENDS.indexOf(l.blend)), l.visible ? 1 : 0], i * 4);
    C1.set(hexToRgb(l.c1), i * 3);
    C2.set(hexToRgb(l.c2), i * 3);
  });
  const f = s.fold, t = s.tone, g = s.grain, h = s.halftone;
  return {
    uZoom: s.view.zoom, uPan: [s.view.x, s.view.y], uBg: hexToRgb(s.bg),
    uWarp: [s.warp.amount, s.warp.scale, s.warp.flow, 0], uDrift: s.drift,
    uCount: layers.length, uL0: L0, uL1: L1, uL2: L2, uC1: C1, uC2: C2,
    uFold: [FOLDS.indexOf(f.type), f.angle * RAD, f.count, f.strength],
    uFold2: [f.shift, f.shading, f.chroma, f.smear],
    uFold3: [f.jitter, f.highlight, 0, 0],
    uTone: [t.exposure, t.contrast, t.saturation, t.hue * RAD],
    uVig: [t.vignette, 0, 0, 0],
    uGrain: [g.amount, g.size, g.colored ? 1 : 0, g.animated ? 1 : 0],
    uHalf: [HALFTONES.indexOf(h.mode), h.cell, h.angle * RAD, h.dot],
    uHalf2: [h.colored ? 1 : 0, h.gamma, h.mix, 0],
    uInk: hexToRgb(h.ink), uPaper: hexToRgb(h.paper),
  };
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
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  // Collect uniform setters by reflected type
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

export class Engine {
  constructor(canvas, { preserve = false } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: preserve });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.float = !!gl.getExtension('EXT_color_buffer_float');
    this.field = program(gl, FIELD_FS);
    this.comp = program(gl, COMP_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    this.fbo = gl.createFramebuffer();
    this.size = [0, 0];
    this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  }

  ensureTarget(w, h) {
    if (this.size[0] === w && this.size[1] === h) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.size = [w, h];
  }

  render(state, phase = 0, frame = 0) {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height;
    if (!w || !h) return;
    this.ensureTarget(w, h);
    const U = packUniforms(state);
    U.uRes = [w, h]; U.uPhase = phase; U.uFrame = frame;
    const apply = ({ p, setters }) => {
      gl.useProgram(p);
      for (const k in setters) if (U[k] !== undefined) setters[k](U[k]);
    };
    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    apply(this.field);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    apply(this.comp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    this.comp.setters.uField?.(0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
