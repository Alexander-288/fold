// Exports: still images, looping video, and shader code with the current look baked in.
import { Engine, packUniforms } from './engine.js';
import { HEADER, COMMON, FIELD_BODY, COMP_BODY, MAX_LAYERS } from './shaders.js';

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

export async function exportImage(state, { w, h, format = 'png', quality = .92, phase = 0 }) {
  const c = offscreen(w, h);
  const eng = new Engine(c, { preserve: true });
  try {
    if (w > eng.maxSize || h > eng.maxSize) throw new Error(`This GPU tops out at ${eng.maxSize}px per side.`);
    eng.render(state, phase, 0);
    const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[format];
    const blob = await new Promise(res => c.toBlob(res, type, quality));
    if (!blob) throw new Error('The browser could not encode this size. Try a smaller one.');
    return blob;
  } finally { eng.dispose(); }
}

export function videoMime() {
  const opts = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || null;
}

// Renders one full loop in real time and records it
export async function exportVideo(state, { w, h, fps = 30, loops = 1, bitrate = 16e6, onProgress }) {
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
  const total = Math.round(state.anim.duration * fps * loops);
  const t0 = performance.now();
  try {
    for (let i = 0; i < total; i++) {
      eng.render(state, (i / (state.anim.duration * fps)) % 1, i);
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
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}

// ---- Shader code export ----

const f = n => {
  const s = Number(n).toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0');
  return s === '-0.0' ? '0.0' : s;
};
const vec = a => `vec${a.length}(${Array.from(a, f).join(', ')})`;
const arr = (a, k) => {
  const items = [];
  for (let i = 0; i < MAX_LAYERS; i++) items.push(vec(Array.from(a.slice(i * k, i * k + k))));
  return `vec${k}[${MAX_LAYERS}](\n  ${items.join(',\n  ')}\n)`;
};

function bakedConsts(state) {
  const U = packUniforms(state);
  const lines = [
    `const float uZoom = ${f(U.uZoom)};`,
    `const vec2 uPan = ${vec(U.uPan)};`,
    `const vec3 uBg = ${vec(U.uBg)};`,
    `const vec4 uWarp = ${vec(U.uWarp)};`,
    `const float uDrift = ${f(U.uDrift)};`,
    `const int uCount = ${U.uCount};`,
    `const vec4 uL0[${MAX_LAYERS}] = ${arr(U.uL0, 4)};`,
    `const vec4 uL1[${MAX_LAYERS}] = ${arr(U.uL1, 4)};`,
    `const vec4 uL2[${MAX_LAYERS}] = ${arr(U.uL2, 4)};`,
    `const vec3 uC1[${MAX_LAYERS}] = ${arr(U.uC1, 3)};`,
    `const vec3 uC2[${MAX_LAYERS}] = ${arr(U.uC2, 3)};`,
    ...['uFold', 'uFold2', 'uFold3', 'uTone', 'uVig', 'uGrain', 'uHalf', 'uHalf2'].map(k => `const vec4 ${k} = ${vec(U[k])};`),
    `const vec3 uInk = ${vec(U.uInk)};`,
    `const vec3 uPaper = ${vec(U.uPaper)};`,
  ];
  return lines.join('\n');
}

// Single-pass version: evaluates the field per sample instead of reading a texture
function shaderCore(state) {
  return `// Made with Fold. Loop length: ${state.anim.duration}s
${COMMON}
float uPhase;
float uFrame;
${bakedConsts(state)}
${FIELD_BODY}
vec3 fieldAt(vec2 uv) {
  uv = 1. - abs(1. - mod(uv, 2.));  // mirror like the editor's texture wrap
  return field(toWorld(uv));
}
${COMP_BODY}`;
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
const animate = ${state.anim.playing === false ? 'false' : 'true'};
function frame(t) {
  const d = Math.min(devicePixelRatio, 2);
  const w = Math.round(c.clientWidth * d), h = Math.round(c.clientHeight * d);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(uR, w, h);
  gl.uniform1f(uT, t / 1000);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (animate) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => requestAnimationFrame(frame));
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
    return `radial-gradient(${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${px.toFixed(1)}% ${py.toFixed(1)}%, ${l.c1}, transparent)`;
  });
  return `.fold-gradient {\n  aspect-ratio: ${state.aspect.w} / ${state.aspect.h};\n  background:\n    ${[...grads, state.bg].join(',\n    ')};\n}\n`;
}
