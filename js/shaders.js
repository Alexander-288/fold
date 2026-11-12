// GLSL sources. Split into chunks so the live engine and the code exporter share one source.

export const MAX_LAYERS = 8;
export const MAX_STOPS = 8;     // colour stops per ramp
export const MAX_SPLINE = 64;   // sampled spline points shared by all spline layers
export const MAX_IMAGES = 4;    // image + text layers

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
`;

// Noise, spectrum and colour helpers
export const COMMON = `
#define MAX_LAYERS ${MAX_LAYERS}
#define MAX_STOPS ${MAX_STOPS}
#define MAX_SPLINE ${MAX_SPLINE}
#define TAU 6.28318530718
#define PI 3.14159265359

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  float a = dot(hash22(i) * 2. - 1., f);
  float b = dot(hash22(i + vec2(1, 0)) * 2. - 1., f - vec2(1, 0));
  float c = dot(hash22(i + vec2(0, 1)) * 2. - 1., f - vec2(0, 1));
  float d = dot(hash22(i + vec2(1, 1)) * 2. - 1., f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0., a = .5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = m * p; a *= .5; }
  return s;
}

// Smooth visible spectrum (Zucconi), x: 0 = violet, 1 = red
vec3 bump3y(vec3 x, vec3 yo) { vec3 y = 1. - x * x; return clamp(y - yo, 0., 1.); }
vec3 spectral(float x) {
  const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945);
  const vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880);
  const vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128);
  const vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860);
  const vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(.5 * a) * .25 + bayer2(a); }
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca);
}
`;

export const SHARED_UNIFORMS = `
uniform vec2 uRes;
uniform float uPhase;
uniform float uFrame;
`;

export const FIELD_UNIFORMS = `
uniform float uZoom;
uniform vec2 uPan;
uniform vec3 uBg;
uniform vec4 uWarp;
uniform float uDrift;
uniform int uCount;
uniform vec4 uL0[MAX_LAYERS];
uniform vec4 uL1[MAX_LAYERS];
uniform vec4 uL2[MAX_LAYERS];
uniform vec4 uL3[MAX_LAYERS];
uniform vec4 uRamp[MAX_LAYERS * MAX_STOPS];
uniform vec4 uSpl[MAX_SPLINE];
uniform sampler2DArray uImg;
`;

// Light field: background plus up to 8 layers. World space is y-down, shorter frame side = 1.
// IMG_SAMPLE is defined by the caller (the code export has no images).
export const FIELD_BODY = `
vec2 toWorld(vec2 uv) {
  vec2 p = (uv - .5) * uRes / min(uRes.x, uRes.y);
  p.y = -p.y;
  return p / uZoom + uPan;
}

vec3 ramp(int i, float t) {
  int n = int(uL3[i].x + .5);
  int base = i * MAX_STOPS;
  vec4 s0 = uRamp[base];
  if (t <= s0.w) return s0.rgb;
  for (int k = 1; k < MAX_STOPS; k++) {
    if (k >= n) break;
    vec4 s1 = uRamp[base + k];
    if (t <= s1.w) return mix(s0.rgb, s1.rgb, (t - s0.w) / max(s1.w - s0.w, 1e-5));
    s0 = s1;
  }
  return s0.rgb;
}

// Light spline: distance to the sampled curve, with position along it and side
vec3 splineHit(vec2 d, int st, int cnt) {
  float best = 1e9, bt = 0., side = 1.;
  for (int k = 0; k < MAX_SPLINE - 1; k++) {
    if (k >= cnt - 1) break;
    vec4 A = uSpl[st + k], B = uSpl[st + k + 1];
    vec2 ba = B.xy - A.xy, pa = d - A.xy;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0., 1.);
    float dist = length(pa - ba * h);
    if (dist < best) { best = dist; bt = mix(A.z, B.z, h); side = sign(ba.x * pa.y - ba.y * pa.x); }
  }
  return vec3(best, bt, side);
}

vec3 field(vec2 p) {
  float th = uPhase * TAU;
  vec2 lo = vec2(cos(th), sin(th)) * uWarp.z;
  if (uWarp.x > 0.) {
    vec2 q = p * uWarp.y;
    vec2 w = vec2(fbm(q + lo), fbm(q + vec2(5.2, 1.3) - lo.yx));
    p += w * uWarp.x;
  }
  vec3 col = uBg;
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= uCount) break;
    vec4 a = uL0[i], b = uL1[i], c = uL2[i], e = uL3[i];
    if (c.w < .5) continue;
    float fi = float(i);
    vec2 pos = a.xy + uDrift * .08 * vec2(sin(th + fi * 1.7), cos(th + fi * 2.3));
    vec2 size = max(a.zw, vec2(1e-3));
    float cr = cos(b.x), sr = sin(b.x);
    vec2 d = p - pos;
    d = vec2(cr * d.x + sr * d.y, -sr * d.x + cr * d.y);
    int type = int(b.w + .5);
    float soft = clamp(b.y, 1e-3, 1.);
    vec3 lc = vec3(0.);
    float f = 0.;
    if (type == 0) {
      // blob: soft ellipse, ramp from core to edge
      float r = length(d / size);
      f = 1. - smoothstep(1. - soft, 1., r);
      lc = ramp(i, smoothstep(0., 1., r));
    } else if (type == 1) {
      // ring: rim with an outer glow running along the ramp
      float s = length(d / size) - 1.;
      float wo = soft * .5 + 1e-3, wi = clamp(c.y, 0., 1.) * .5 + 1e-3;
      f = s > 0. ? exp(-(s * s) / (wo * wo)) : exp(-(s * s) / (wi * wi));
      lc = ramp(i, s > 0. ? clamp(s / wo, 0., 1.) : 0.);
    } else if (type == 2) {
      // spectral band: curved light streak split into a rainbow
      float along = d.x / size.x;
      float across = (d.y + c.y * d.x * d.x) / size.y;
      float env = 1. - smoothstep(1. - soft, 1., abs(along));
      float g = exp(-across * across * 1.5);
      vec3 spec = spectral(clamp(.5 + across * .32, 0., 1.)) * 1.15;
      lc = mix(ramp(i, clamp(.5 + across * .35, 0., 1.)), spec, clamp(c.x, 0., 1.)) + vec3(e.y) * exp(-across * across * 10.);
      f = g * env;
    } else if (type == 3) {
      float t = d.x / size.x * .5 + .5;
      lc = ramp(i, smoothstep(.5 - soft * .5, .5 + soft * .5 + 1e-3, t));
      f = 1.;
    } else if (type == 4) {
      float ang = atan(d.y, d.x) / TAU + .5;
      lc = ramp(i, .5 - .5 * cos(ang * TAU * max(c.x, 1.)));
      f = 1. - smoothstep(1. - soft, 1., length(d / size));
    } else if (type == 5) {
      float n = fbm(d / size * 1.5 + lo + vec2(c.y * 10.)) + .5;
      f = smoothstep(c.x - soft * .5, c.x + soft * .5 + 1e-3, n);
      lc = ramp(i, clamp(n, 0., 1.));
    } else if (type == 6) {
      // light spline: sx core width, sy glow, a taper, b pulse
      int st = int(e.z + .5), cnt = int(e.w + .5);
      if (cnt < 2) continue;
      vec3 hit = splineHit(d, st, cnt);
      float dist = hit.x, t = hit.y;
      int style = int(mod(e.y, 10.) + .5), cm = int(floor(e.y / 10.) + .5);
      float tf = mix(1., sqrt(clamp(4. * t * (1. - t), 0., 1.)), clamp(c.x, 0., 1.));
      float w = size.x * tf + 1e-4, g = size.y * tf + 1e-4;
      float pulse = exp(-pow((fract(t - uPhase + .5) - .5) * 7., 2.));
      float pm = mix(1., .3 + 2.2 * pulse, clamp(c.y, 0., 1.));
      float across = hit.z * dist / (w + g);
      float ct = cm == 1 ? .5 + .5 * clamp(across, -1., 1.) : t;
      vec3 base = cm == 2 ? spectral(t) * 1.1 : ramp(i, ct);
      float fall = mix(.6, 2.4, soft);
      if (style == 0) {
        float core = 1. - smoothstep(w * .5, w, dist);
        float glow = pow(exp(-dist / g), fall);
        f = clamp(core + glow * .85, 0., 1.);
        lc = mix(base, vec3(1.), core * .65) * (1. + core * .6);
      } else if (style == 1) {
        float wid = w + g * .6;
        float streak = .7 + .3 * gnoise(vec2(t * 60., across * 4.));
        f = exp(-pow(dist / wid, 2.) * fall) * streak;
        lc = base;
      } else {
        float ac = across;
        f = 1. - smoothstep(1. - soft * .8, 1., abs(ac));
        float sheen = pow(.5 + .5 * cos(ac * 2.6 + t * 14.), 10.);
        lc = base * (.45 + .55 * cos(ac * 1.4)) + vec3(sheen * .55);
      }
      lc *= pm;
    } else {
      // image or text: sx width, box height comes from the image aspect (e.w)
      vec2 hs = vec2(size.x, size.x / max(e.w, 1e-3));
      vec2 uv = d / hs * .5 + .5;
      if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) continue;
      vec4 tx = IMG_SAMPLE(uv, e.z);
      float edge = soft > .01 ? smoothstep(0., soft * .25, min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y))) : 1.;
      vec3 tint = e.y > .5 ? ramp(i, uv.x) : ramp(i, luma(tx.rgb));
      lc = mix(tx.rgb, e.y > .5 ? tint * tx.rgb : tint, clamp(c.x, 0., 1.));
      f = tx.a * edge;
    }
    float k = f * b.z;
    int bm = int(c.z + .5);
    if (bm == 0) col = mix(col, lc, clamp(k, 0., 1.));
    else if (bm == 1) col += lc * k;
    else if (bm == 2) col = 1. - (1. - col) * (1. - clamp(lc * k, 0., 1.));
    else col = mix(col, col * lc, clamp(k, 0., 1.));
  }
  return col;
}
`;

export const FOLD_UNIFORMS = `
uniform vec4 uFold;   // type, angle, count, strength
uniform vec4 uFold2;  // shift, shading, chroma, smear
uniform vec4 uFold3;  // jitter, highlight
`;

// Fold / refraction. Expects fieldAt(uv).
export const FOLD_BODY = `
vec2 pToUv(vec2 P) {
  float m = min(uRes.x, uRes.y);
  return (vec2(P.x, -P.y) * m + .5 * uRes) / uRes;
}

vec3 foldSample(vec2 px) {
  float m = min(uRes.x, uRes.y);
  vec2 P = (px - .5 * uRes) / m;
  P.y = -P.y;
  int type = int(uFold.x + .5);
  vec2 n = vec2(cos(uFold.y), sin(uFold.y)), tg = vec2(-n.y, n.x);
  float cnt = max(uFold.z, .01);
  float st = uFold.w;
  vec2 off = vec2(0.);
  float lit = 0., edge = 0., hl = 0.;
  if (type > 0) {
    float u = dot(P, n), v = dot(P, tg);
    float s = u * cnt, id = floor(s), t = fract(s), x = t - .5;
    float pw = cnt / m * 1.5;
    float du = 0., dv = 0.;
    if (type == 1) {
      du = -x * st / cnt * 2.;
      lit = x * 2.;
      edge = 1. - smoothstep(0., pw + .03, min(t, 1. - t));
      hl = pow(max(0., 1. - abs(x + .22) * 7.), 2.);
    } else if (type == 2) {
      dv = id * uFold2.x + (hash11(id * 7.31) - .5) * uFold3.x;
      du = -x * st / cnt;
      lit = t * 2. - 1.;
      hl = smoothstep(1. - pw * 2.5, 1., t);
    } else if (type == 3) {
      float face = step(.5, t) * 2. - 1.;
      du = -(abs(x) * 2. - .5) * st / cnt;
      dv = (hash11(id * 3.7) - .5) * uFold3.x;
      lit = face;
      hl = 1. - smoothstep(0., pw * 1.2, abs(x));
    } else if (type == 4) {
      du = sin(t * TAU) * st / cnt * .35;
      dv = id * uFold2.x;
      lit = cos(t * TAU);
      hl = pow(max(lit, 0.), 24.);
    } else {
      float s2 = v * cnt, y = fract(s2) - .5;
      du = -x * st / cnt * 2.;
      dv = -y * st / cnt * 2.;
      lit = x - y;
      edge = 1. - smoothstep(0., pw + .03, min(min(t, 1. - t), .5 - abs(y)));
      hl = pow(max(0., 1. - length(vec2(x, y) + .22) * 5.), 2.);
    }
    off = n * du + tg * dv;
  }
  vec3 acc = vec3(0.);
  int taps = uFold2.w > .0005 ? 9 : 1;
  float ch = uFold2.z;
  vec2 cs = n * ch * .012;
  for (int k = 0; k < 9; k++) {
    if (k >= taps) break;
    float o = taps > 1 ? (float(k) / 8. - .5) * uFold2.w : 0.;
    vec2 base = P + tg * o;
    acc.r += fieldAt(pToUv(base + off * (1. + ch) + cs)).r;
    acc.g += fieldAt(pToUv(base + off)).g;
    acc.b += fieldAt(pToUv(base + off * (1. - ch) - cs)).b;
  }
  vec3 col = acc / float(taps);
  float shade = 1. + uFold2.y * .5 * lit - edge * uFold2.y * .8;
  return max(col * shade + uFold3.y * hl, 0.);
}
`;

// ---- Effects ----
// Each effect is a function FX(px) that reads the previous stage with PREV(px).
// Parameters arrive as P0..P3 (vec4), C0..C2 (vec3) and R[8] (ramp stops: rgb + position).
// "spatial" effects need extra blur passes and are skipped by the code export.

export const FX_DEFS = {
  adjust: { label: 'Adjust', glsl: `
vec3 FX(vec2 px) {
  vec3 c = PREV(px);
  c *= exp2(P0.x);
  if (P0.w != 0.) c = hueShift(c, P0.w);
  c = mix(vec3(luma(c)), c, P0.z);
  c = (c - .5) * (1. + P0.y) + .5;
  return max(c, 0.);
}` },
  grade: { label: 'Colour grade', glsl: `
vec3 FX(vec2 px) {
  vec3 c = max(PREV(px), 0.);
  c *= vec3(1. + P0.w * .18, 1. - P1.x * .12, 1. - P0.w * .18);
  c = P0.z * (c + P0.x * (1. - c));
  c = pow(max(c, 0.), vec3(1. / max(P0.y, .05)));
  float l = luma(c) + P1.w * .3;
  float ws = 1. - smoothstep(0., .55, l), wh = smoothstep(.45, 1., l);
  c += (C0 - vec3(luma(C0))) * ws * P1.y + (C1 - vec3(luma(C1))) * wh * P1.z;
  return max(c, 0.);
}` },
  gradmap: { label: 'Gradient map', glsl: `
vec3 FX(vec2 px) {
  vec3 c = PREV(px);
  float t = pow(clamp(luma(c), 0., 1.), max(P0.y, .05));
  int n = int(P0.z + .5);
  vec4 s0 = R[0];
  vec3 m = s0.rgb;
  if (t > s0.w) {
    for (int k = 1; k < 8; k++) {
      if (k >= n) break;
      vec4 s1 = R[k];
      if (t <= s1.w) { m = mix(s0.rgb, s1.rgb, (t - s0.w) / max(s1.w - s0.w, 1e-5)); break; }
      m = s1.rgb;
      s0 = s1;
    }
  }
  return mix(c, m, P0.x);
}` },
  bloom: { label: 'Bloom', spatial: true },
  halation: { label: 'Halation', spatial: true },
  lens: { label: 'Lens', glsl: `
vec3 FX(vec2 px) {
  vec2 uv = px / uRes - .5;
  vec2 q = uv * vec2(uRes.x / uRes.y, 1.);
  float r2 = dot(q, q);
  float k = P0.x, fr = P0.y * .05;
  float sc = 1. / (1. + max(k, 0.) * .3);
  vec3 c = vec3(0.);
  int taps = P0.z > .001 ? 5 : 1;
  for (int i = 0; i < 5; i++) {
    if (i >= taps) break;
    float b = taps > 1 ? (float(i) / 4. - .5) * P0.z * .04 * r2 : 0.;
    c.r += PREV((uv * (1. + (k + fr) * r2 + b) * sc + .5) * uRes).r;
    c.g += PREV((uv * (1. + k * r2 + b) * sc + .5) * uRes).g;
    c.b += PREV((uv * (1. + (k - fr) * r2 + b) * sc + .5) * uRes).b;
  }
  return c / float(taps);
}` },
  blur: { label: 'Blur', spatial: true },
  vignette: { label: 'Vignette', glsl: `
vec3 FX(vec2 px) {
  vec3 c = PREV(px);
  vec2 q = (px / uRes - .5) * 2.;
  q.x *= mix(1., uRes.x / uRes.y, P0.y);
  float v = smoothstep(.2 + (1. - P0.z) * .5, 1.45, length(q));
  return mix(c, C0, clamp(v * P0.x, 0., 1.));
}` },
  halftone: { label: 'Halftone', glsl: `
vec3 FX(vec2 px) {
  int hm = int(P0.x + .5);
  if (hm == 0) return PREV(px);
  float m = min(uRes.x, uRes.y);
  float cell = max(P0.y * m / 1000., 1.5);
  float gam = max(P1.y, .05);
  vec3 outc;
  if (hm == 4) {
    vec3 pc = PREV(px);
    float l = pow(clamp(luma(pc), 0., 1.), gam);
    float th = bayer8(floor(px / max(cell / 3., 1.)));
    vec3 ink = P1.x > .5 ? pc / max(max(pc.r, max(pc.g, pc.b)), 1e-3) : C0;
    outc = mix(C1, ink, step(th + 1e-4, l));
  } else {
    float a = P0.z;
    mat2 Rm = mat2(cos(a), sin(a), -sin(a), cos(a));
    vec2 g = Rm * px / cell;
    vec2 id = floor(g) + .5, f = fract(g) - .5;
    vec3 sc = PREV(transpose(Rm) * (id * cell));
    float l = pow(clamp(luma(sc), 0., 1.), gam);
    vec3 ink = P1.x > .5 ? sc / max(max(sc.r, max(sc.g, sc.b)), 1e-3) : C0;
    float aa = 1. / cell, cov;
    if (hm == 1 || hm == 2) {
      float r = hm == 1 ? sqrt(l) * .72 : P0.w * .5;
      float rc = max(r, aa);
      cov = (1. - smoothstep(rc - aa, rc + aa, length(f))) * (r * r) / (rc * rc);
      if (hm == 2) cov *= l;
    } else {
      float w = l * .5;
      cov = 1. - smoothstep(w - aa, w + aa, abs(f.y));
    }
    outc = mix(C1, ink, cov);
  }
  return P1.z < .999 ? mix(PREV(px), outc, P1.z) : outc;
}` },
  grain: { label: 'Grain', glsl: `
vec3 FX(vec2 px) {
  vec3 c = PREV(px);
  float m = min(uRes.x, uRes.y);
  float gs = max(P0.y * m / 1000., 1.);
  vec2 gp = floor(px / gs);
  float seed = P0.w > .5 ? mod(uFrame, 61.) : 0.;
  float gn = hash12(gp + seed * 13.17);
  vec3 gv = P0.z > .5 ? vec3(hash12(gp + seed * 7.1 + 3.3), hash12(gp + seed * 5.3 + 9.1), gn) : vec3(gn);
  return c + (gv - .5) * P0.x;
}` },
};

const FX_UNIFORMS = `
uniform sampler2D uPrev;
uniform vec4 P0, P1, P2, P3;
uniform vec3 C0, C1, C2;
uniform vec4 R[8];
#define PREV(p) texture(uPrev, (p) / uRes).rgb
`;

const MAIN = `
in vec2 vUv;
out vec4 fragColor;
`;

// ---- live engine programs ----
export const FIELD_FS = HEADER + COMMON + SHARED_UNIFORMS + FIELD_UNIFORMS +
  '#define IMG_SAMPLE(uv, idx) texture(uImg, vec3(uv, idx))\n' + FIELD_BODY + MAIN +
  'void main() { fragColor = vec4(field(toWorld(vUv)), 1.); }';

export const FOLD_FS = HEADER + COMMON + SHARED_UNIFORMS + FOLD_UNIFORMS + `
uniform sampler2D uField;
vec3 fieldAt(vec2 uv) { return texture(uField, uv).rgb; }
` + FOLD_BODY + MAIN + 'void main() { fragColor = vec4(foldSample(vUv * uRes), 1.); }';

export const fxFS = type => HEADER + COMMON + SHARED_UNIFORMS + FX_UNIFORMS + FX_DEFS[type].glsl + MAIN +
  'void main() { fragColor = vec4(FX(vUv * uRes), 1.); }';

// Bright pass for bloom and halation (soft knee)
export const BRIGHT_FS = HEADER + SHARED_UNIFORMS + `
uniform sampler2D uPrev;
uniform vec4 P0;
` + MAIN + `
void main() {
  vec3 c = texture(uPrev, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float knee = max(P0.w, 1e-4);
  float s = clamp(l - P0.x + knee, 0., 2. * knee);
  s = s * s / (4. * knee);
  float w = max(s, l - P0.x) / max(l, 1e-4);
  fragColor = vec4(c * w, 1.);
}`;

// Separable 15-tap Gaussian; uDir is the step in pixels. Tilt-shift scales the step per pixel.
export const BLUR_FS = HEADER + SHARED_UNIFORMS + `
uniform sampler2D uPrev;
uniform vec2 uDir;
uniform vec4 uTilt;  // amount, focus y, band, angle
` + MAIN + `
void main() {
  vec2 px = vUv * uRes;
  float k = 1.;
  if (uTilt.x > 0.) {
    vec2 n = vec2(-sin(uTilt.w), cos(uTilt.w));
    float d = abs(dot(vUv - vec2(.5, 1. - uTilt.y), n));
    k = mix(1., smoothstep(uTilt.z * .5, uTilt.z * .5 + .3, d), uTilt.x);
  }
  vec3 acc = vec3(0.);
  float ws = 0.;
  for (int i = -7; i <= 7; i++) {
    float t = float(i) / 7.;
    float w = exp(-t * t * 3.);
    acc += texture(uPrev, (px + uDir * k * float(i)) / uRes).rgb * w;
    ws += w;
  }
  fragColor = vec4(acc / ws, 1.);
}`;

// Adds a blurred glow back on top
export const GLOWMIX_FS = HEADER + SHARED_UNIFORMS + `
uniform sampler2D uPrev;
uniform sampler2D uAux;
uniform vec4 P0;
uniform vec3 C0;
` + MAIN + `
void main() {
  vec3 c = texture(uPrev, vUv).rgb;
  vec3 g = texture(uAux, vUv).rgb;
  fragColor = vec4(c + g * C0 * P0.z, 1.);
}`;

// Last step to the screen: clamp and dither to 8 bits
export const PRESENT_FS = HEADER + COMMON + SHARED_UNIFORMS + `
uniform sampler2D uPrev;
` + MAIN + `
void main() {
  vec3 c = texture(uPrev, vUv).rgb;
  c += (hash12(vUv * uRes + fract(uFrame * .618) * 97.) - .5) / 255.;
  fragColor = vec4(clamp(c, 0., 1.), 1.);
}`;
