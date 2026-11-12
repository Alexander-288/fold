// Exports: still images, video, wallpaper packs (ZIP), and shader code with the current look baked in.
import { Engine, packUniforms, packFx, isSpatial } from './engine.js';
import { HEADER, COMMON, FIELD_BODY, FOLD_BODY, FX_DEFS, MAX_LAYERS, MAX_STOPS, MAX_SPLINE } from './shaders.js';

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function sizeFor(aspect, longEdge) {
  const ar = aspect.w / aspect.h;
  return ar >= 1 ? [longEdge, Math.round(longEdge / ar)] : [Math.round(longEdge * ar), longEdge];
}

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

export async function exportImage(state, { w, h, format = 'png', quality = .92, phase = 0 }) {
  const c = offscreen(w, h);
  const eng = new Engine(c, { preserve: true });
  try {
    if (w > eng.maxSize || h > eng.maxSize) throw new Error(`This GPU tops out at ${eng.maxSize}px per side.`);
    eng.render(state, phase, 0);
    const blob = await new Promise(res => c.toBlob(res, MIME[format], quality));
    if (!blob) throw new Error('The browser could not encode this size. Try a smaller one.');
    return blob;
  } finally { eng.dispose(); }
}

// ---- video ----

export const canEncode = () => typeof VideoEncoder !== 'undefined';

export function videoMime() {
  if (canEncode()) return 'video/mp4';
  const opts = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || null;
}

const tick = () => new Promise(r => setTimeout(r, 0));

// Frame by frame with WebCodecs: never drops frames and doesn't care if the tab is hidden
async function encodeMp4(state, { w, h, fps, loops, bitrate, onProgress, signal }) {
  const { Muxer, ArrayBufferTarget } = await import('./vendor/mp4-muxer.mjs');
  let codec = null;
  for (const c of ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.640028', 'avc1.42003e']) {
    const r = await VideoEncoder.isConfigSupported({ codec: c, width: w, height: h, bitrate, framerate: fps }).catch(() => null);
    if (r?.supported) { codec = c; break; }
  }
  if (!codec) throw new Error(`This browser can't encode ${w} × ${h} H.264. Try a smaller size.`);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' });
  let failed = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => (failed = e) });
  enc.configure({ codec, width: w, height: h, bitrate, framerate: fps });
  const c = offscreen(w, h);
  const eng = new Engine(c, { preserve: true });
  const perLoop = Math.round(state.anim.duration * fps);
  const total = perLoop * loops;
  try {
    for (let i = 0; i < total; i++) {
      if (failed) throw failed;
      if (signal?.aborted) throw new Error('Cancelled');
      eng.render(state, (i % perLoop) / perLoop, i);
      const frame = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
      if (i % 4 === 0) { onProgress?.(i / total); await tick(); }
    }
    await enc.flush();
    muxer.finalize();
  } finally {
    if (enc.state !== 'closed') enc.close();
    eng.dispose();
  }
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
}

// Fallback: record the canvas in real time
async function recordRealtime(state, { w, h, fps, loops, bitrate, onProgress }) {
  const mime = videoMime();
  if (!mime) throw new Error('Video recording is not supported in this browser.');
  const c = offscreen(w, h);
  const eng = new Engine(c, { preserve: true });
  const stream = c.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(res => (rec.onstop = res));
  rec.start();
  const perLoop = Math.round(state.anim.duration * fps), total = perLoop * loops;
  const t0 = performance.now();
  try {
    for (let i = 0; i < total; i++) {
      eng.render(state, (i % perLoop) / perLoop, i);
      track.requestFrame?.();
      onProgress?.(i / total);
      const wait = t0 + ((i + 1) * 1000) / fps - performance.now();
      await new Promise(r => setTimeout(r, Math.max(0, wait)));
    }
  } finally {
    rec.stop();
    await done;
    eng.dispose();
  }
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

export function exportVideo(state, opts) {
  const o = { fps: 30, loops: 1, bitrate: Math.min(60e6, Math.round(opts.w * opts.h * (opts.fps || 30) * .12)), ...opts };
  return canEncode() ? encodeMp4(state, o) : recordRealtime(state, o);
}

// ---- wallpaper pack ----

export const WALLPAPERS = [
  { id: 'iphone', label: 'iPhone', w: 1179, h: 2556 },
  { id: 'iphone-max', label: 'iPhone Pro Max', w: 1320, h: 2868 },
  { id: 'android', label: 'Android FHD+', w: 1080, h: 2400 },
  { id: 'android-qhd', label: 'Android QHD+', w: 1440, h: 3200 },
  { id: 'ipad', label: 'iPad Pro 13"', w: 2064, h: 2752 },
  { id: 'fhd', label: 'Desktop 1080p', w: 1920, h: 1080 },
  { id: 'qhd', label: 'Desktop 1440p', w: 2560, h: 1440 },
  { id: '4k', label: 'Desktop 4K', w: 3840, h: 2160 },
  { id: 'mac', label: 'MacBook Pro 16"', w: 3456, h: 2234 },
  { id: 'ultrawide', label: 'Ultrawide', w: 3440, h: 1440 },
];

export async function exportPack(state, ids, { format = 'png', quality = .92, phase = 0, onProgress, name = 'fold' }) {
  const list = WALLPAPERS.filter(p => ids.includes(p.id));
  const files = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    onProgress?.(i / list.length, p.label);
    const s = { ...state, aspect: { id: `${p.w}:${p.h}`, w: p.w, h: p.h } };
    const blob = await exportImage(s, { w: p.w, h: p.h, format, quality, phase });
    files.push({ name: `${name}-${p.id}-${p.w}x${p.h}.${format}`, data: new Uint8Array(await blob.arrayBuffer()) });
    await tick();
  }
  onProgress?.(1);
  return zip(files);
}

// Minimal ZIP writer (stored, no compression: images are already compressed)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

export function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => n === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true));
    parts.push(lh, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
      .forEach(([o, v, n]) => n === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true));
    central.push(ch, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdSize, 4], [16, offset, 4], [20, 0, 2]]
    .forEach(([o, v, n]) => n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// ---- shader code export ----

const f = n => {
  const s = Number(n).toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0');
  return s === '-0.0' ? '0.0' : s;
};
const vec = a => `vec${a.length}(${Array.from(a, f).join(', ')})`;
const arr = (a, k, count) => {
  const items = [];
  for (let i = 0; i < count; i++) items.push(vec(Array.from(a.slice(i * k, i * k + k))));
  return `vec${k}[${count}](\n  ${items.join(',\n  ')}\n)`;
};

// Effects the single-pass code can carry (blur-based ones need extra passes)
export const codeFx = state => (state.fx || []).filter(x => x.on && !isSpatial(x.type));
export const skippedInCode = state => ({
  fx: (state.fx || []).filter(x => x.on && isSpatial(x.type)).map(x => FX_DEFS[x.type].label),
  images: state.layers.some(l => l.type === 'image' && l.visible),
});

function bakedField(state) {
  const U = packUniforms(state, {});  // no image info: image and text layers drop out
  return [
    `const float uZoom = ${f(U.uZoom)};`,
    `const vec2 uPan = ${vec(U.uPan)};`,
    `const vec3 uBg = ${vec(U.uBg)};`,
    `const vec4 uWarp = ${vec(U.uWarp)};`,
    `const float uDrift = ${f(U.uDrift)};`,
    `const int uCount = ${U.uCount};`,
    ...['uL0', 'uL1', 'uL2', 'uL3'].map(k => `const vec4 ${k}[${MAX_LAYERS}] = ${arr(U[k], 4, MAX_LAYERS)};`),
    `const vec4 uRamp[${MAX_LAYERS * MAX_STOPS}] = ${arr(U.uRamp, 4, MAX_LAYERS * MAX_STOPS)};`,
    `const vec4 uSpl[${MAX_SPLINE}] = ${arr(U.uSpl, 4, MAX_SPLINE)};`,
    ...['uFold', 'uFold2', 'uFold3'].map(k => `const vec4 ${k} = ${vec(U[k])};`),
  ].join('\n');
}

function bakedFx(state) {
  const out = ['vec3 fx0(vec2 px) { return foldSample(px); }'];
  let k = 0;
  for (const x of codeFx(state)) {
    k++;
    const p = packFx(x);
    out.push(`
// ${FX_DEFS[x.type].label}
${['P0', 'P1', 'P2', 'P3'].map(n => `const vec4 ${n}_${k} = ${vec(p[n])};`).join('\n')}
${['C0', 'C1', 'C2'].map(n => `const vec3 ${n}_${k} = ${vec(p[n])};`).join('\n')}
const vec4 R_${k}[8] = ${arr(p.R, 4, 8)};
${['P0', 'P1', 'P2', 'P3', 'C0', 'C1', 'C2', 'R'].map(n => `#define ${n} ${n}_${k}`).join('\n')}
#define PREV(p) fx${k - 1}(p)
#define FX fx${k}
${FX_DEFS[x.type].glsl.trim()}
${['P0', 'P1', 'P2', 'P3', 'C0', 'C1', 'C2', 'R', 'PREV', 'FX'].map(n => `#undef ${n}`).join('\n')}`);
  }
  out.push(`
vec3 render(vec2 px) {
  vec3 c = fx${k}(px);
  c += (hash12(px + fract(uFrame * .618) * 97.) - .5) / 255.;
  return clamp(c, 0., 1.);
}`);
  return out.join('\n');
}

function shaderCore(state) {
  const sk = skippedInCode(state);
  const notes = [
    sk.fx.length ? `// Not included (needs extra blur passes): ${sk.fx.join(', ')}` : '',
    sk.images ? '// Image and text layers are not included.' : '',
  ].filter(Boolean).join('\n');
  return `// Made with Fold. Loop length: ${state.anim.duration}s
${notes}
${COMMON}
float uPhase;
float uFrame;
${bakedField(state)}
#define IMG_SAMPLE(uv, idx) vec4(0.)
${FIELD_BODY}
vec3 fieldAt(vec2 uv) {
  uv = 1. - abs(1. - mod(uv, 2.));  // mirror like the editor's texture wrap
  return field(toWorld(uv));
}
${FOLD_BODY}
${bakedFx(state)}`;
}

export function shadertoyCode(state) {
  return `#define uRes iResolution.xy
const float LOOP = ${f(state.anim.duration)};
${shaderCore(state)}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  uPhase = fract(iTime / LOOP);
  uFrame = float(iFrame);
  fragColor = vec4(render(fragCoord), 1.);
}
`;
}

export function glslCode(state) {
  return `${HEADER}// Uniforms: uResolution (pixels), uTime (seconds)
uniform vec2 uResolution;
uniform float uTime;
out vec4 fragColor;
#define uRes uResolution
const float LOOP = ${f(state.anim.duration)};
${shaderCore(state)}
void main() {
  uPhase = fract(uTime / LOOP);
  uFrame = floor(uTime * 30.);
  fragColor = vec4(render(gl_FragCoord.xy), 1.);
}
`;
}

export function htmlCode(state) {
  const fs = glslCode(state).replace(/`/g, '\\`');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fold gradient</title>
<style>html,body{margin:0;height:100%;background:#000}canvas{display:block;width:100vw;height:100vh}</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const c = document.getElementById('c');
const gl = c.getContext('webgl2');
const vs = \`#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }\`;
const fs = \`${fs}\`;
function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
const pr = gl.createProgram();
gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(pr);
gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const uR = gl.getUniformLocation(pr, 'uResolution'), uT = gl.getUniformLocation(pr, 'uTime');
function frame(t) {
  const d = Math.min(devicePixelRatio, 2);
  const w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(uR, w, h);
  gl.uniform1f(uT, t / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>
</body>
</html>
`;
}

export function cssFallback(state) {
  // A rough CSS stand-in made from the blob layers, for places that can't run WebGL
  const ar = state.aspect.w / state.aspect.h;
  const ex = Math.max(1, ar), ey = Math.max(1, 1 / ar);
  const grads = state.layers.filter(l => l.visible && (l.type === 'blob' || l.type === 'ring')).reverse().map(l => {
    const px = ((l.x - state.view.x) * state.view.zoom / ex + .5) * 100;
    const py = ((l.y - state.view.y) * state.view.zoom / ey + .5) * 100;
    const rx = l.sx * state.view.zoom / ex * 100, ry = l.sy * state.view.zoom / ey * 100;
    return `radial-gradient(${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${px.toFixed(1)}% ${py.toFixed(1)}%, ${l.ramp[0].c}, transparent)`;
  });
  return `.fold-gradient {\n  aspect-ratio: ${state.aspect.w} / ${state.aspect.h};\n  background:\n    ${[...grads, state.bg].join(',\n    ')};\n}\n`;
}
