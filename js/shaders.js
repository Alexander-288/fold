// GLSL sources. Split into chunks so the live engine and the code exporter share one source.

export const MAX_LAYERS = 8;

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

// Noise, spectrum and colour helpers
export const COMMON = `
#define MAX_LAYERS ${MAX_LAYERS}
#define TAU 6.28318530718

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
uniform vec3 uC1[MAX_LAYERS];
uniform vec3 uC2[MAX_LAYERS];
`;

// Light field: background plus up to 8 layers. World space is y-down, shorter frame side = 1.
export const FIELD_BODY = `
vec2 toWorld(vec2 uv) {
  vec2 p = (uv - .5) * uRes / min(uRes.x, uRes.y);
  p.y = -p.y;
  return p / uZoom + uPan;
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
    vec4 a = uL0[i], b = uL1[i], c = uL2[i];
    if (c.w < .5) continue;
    float fi = float(i);
    vec2 pos = a.xy + uDrift * .08 * vec2(sin(th + fi * 1.7), cos(th + fi * 2.3));
    vec2 size = max(a.zw, vec2(1e-3));
    float cr = cos(b.x), sr = sin(b.x);
    vec2 d = p - pos;
    d = vec2(cr * d.x + sr * d.y, -sr * d.x + cr * d.y);
    int type = int(b.w + .5);
    float soft = clamp(b.y, 1e-3, 1.);
    vec3 c1 = uC1[i], c2 = uC2[i];
    vec3 lc = c1;
    float f = 0.;
    if (type == 0) {
      // blob: soft ellipse, c1 at the core fading to c2
      float r = length(d / size);
      f = 1. - smoothstep(1. - soft, 1., r);
      lc = mix(c1, c2, smoothstep(0., 1., r));
    } else if (type == 1) {
      // ring: c1 on the rim, outer glow fades into c2
      float s = length(d / size) - 1.;
      float wo = soft * .5 + 1e-3, wi = clamp(c.y, 0., 1.) * .5 + 1e-3;
      f = s > 0. ? exp(-(s * s) / (wo * wo)) : exp(-(s * s) / (wi * wi));
      lc = s > 0. ? mix(c1, c2, clamp(s / wo, 0., 1.)) : c1;
    } else if (type == 2) {
      // spectral band: curved light streak split into a rainbow
      float along = d.x / size.x;
      float across = (d.y + c.y * d.x * d.x) / size.y;
      float env = 1. - smoothstep(1. - soft, 1., abs(along));
      float g = exp(-across * across * 1.5);
      vec3 spec = spectral(clamp(.5 + across * .32, 0., 1.)) * 1.15;
      lc = mix(c1, spec, clamp(c.x, 0., 1.)) + c2 * exp(-across * across * 10.);
      f = g * env;
    } else if (type == 3) {
      // linear gradient
      float t = d.x / size.x * .5 + .5;
      t = smoothstep(.5 - soft * .5, .5 + soft * .5 + 1e-3, t);
      lc = mix(c1, c2, t);
      f = 1.;
    } else if (type == 4) {
      // conic sweep
      float ang = atan(d.y, d.x) / TAU + .5;
      float t = .5 - .5 * cos(ang * TAU * max(c.x, 1.));
      lc = mix(c1, c2, t);
      f = 1. - smoothstep(1. - soft, 1., length(d / size));
    } else {
      // noise cloud
      float n = fbm(d / size * 1.5 + lo + vec2(c.y * 10.)) + .5;
      f = smoothstep(c.x - soft * .5, c.x + soft * .5 + 1e-3, n);
      lc = mix(c1, c2, clamp(n, 0., 1.));
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

export const COMP_UNIFORMS = `
uniform vec4 uFold;   // type, angle, count, strength
uniform vec4 uFold2;  // shift, shading, chroma, smear
uniform vec4 uFold3;  // jitter, highlight
uniform vec4 uTone;   // exposure, contrast, saturation, hue
uniform vec4 uVig;    // vignette amount
uniform vec4 uGrain;  // amount, size, colored, animated
uniform vec4 uHalf;   // mode, cell, angle, dot
uniform vec4 uHalf2;  // colored, gamma, mix
uniform vec3 uInk;
uniform vec3 uPaper;
`;

// Fold / refraction, tone, halftone, vignette, grain. Expects fieldAt(uv).
export const COMP_BODY = `
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(.5 * a) * .25 + bayer2(a); }

vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca);
}

vec3 tone(vec3 c) {
  c *= exp2(uTone.x);
  if (uTone.w != 0.) c = hueShift(c, uTone.w);
  float l = luma(c);
  c = mix(vec3(l), c, uTone.z);
  c = (c - .5) * (1. + uTone.y) + .5;
  return max(c, 0.);
}

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
      // fluted glass
      du = -x * st / cnt * 2.;
      lit = x * 2.;
      edge = 1. - smoothstep(0., pw + .03, min(t, 1. - t));
      hl = pow(max(0., 1. - abs(x + .22) * 7.), 2.);
    } else if (type == 2) {
      // sliding folded panels
      dv = id * uFold2.x + (hash11(id * 7.31) - .5) * uFold3.x;
      du = -x * st / cnt;
      lit = t * 2. - 1.;
      hl = smoothstep(1. - pw * 2.5, 1., t);
    } else if (type == 3) {
      // accordion pleats
      float face = step(.5, t) * 2. - 1.;
      du = -(abs(x) * 2. - .5) * st / cnt;
      dv = (hash11(id * 3.7) - .5) * uFold3.x;
      lit = face;
      hl = 1. - smoothstep(0., pw * 1.2, abs(x));
    } else if (type == 4) {
      // wave
      du = sin(t * TAU) * st / cnt * .35;
      dv = id * uFold2.x;
      lit = cos(t * TAU);
      hl = pow(max(lit, 0.), 24.);
    } else {
      // glass tiles
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

vec3 halftone(vec2 px, int hm) {
  float m = min(uRes.x, uRes.y);
  float cell = max(uHalf.y * m / 1000., 1.5);
  float gam = max(uHalf2.y, .05);
  if (hm == 4) {
    vec3 pc = tone(foldSample(px));
    float l = pow(clamp(luma(pc), 0., 1.), gam);
    float th = bayer8(floor(px / max(cell / 3., 1.)));
    vec3 ink = uHalf2.x > .5 ? pc / max(max(pc.r, max(pc.g, pc.b)), 1e-3) : uInk;
    return mix(uPaper, ink, step(th + 1e-4, l));
  }
  float a = uHalf.z;
  mat2 R = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 g = R * px / cell;
  vec2 id = floor(g) + .5, f = fract(g) - .5;
  vec2 cpx = transpose(R) * (id * cell);
  vec3 sc = tone(foldSample(cpx));
  float l = pow(clamp(luma(sc), 0., 1.), gam);
  vec3 ink = uHalf2.x > .5 ? sc / max(max(sc.r, max(sc.g, sc.b)), 1e-3) : uInk;
  float aa = 1. / cell;
  float cov;
  if (hm == 1 || hm == 2) {
    // keep tiny dots from fading: clamp the radius to a pixel and scale by the lost area
    float r = hm == 1 ? sqrt(l) * .72 : uHalf.w * .5;
    float rc = max(r, aa);
    cov = (1. - smoothstep(rc - aa, rc + aa, length(f))) * (r * r) / (rc * rc);
    if (hm == 2) cov *= l;
  } else {
    float w = l * .5;
    cov = 1. - smoothstep(w - aa, w + aa, abs(f.y));
  }
  return mix(uPaper, ink, cov);
}

vec3 render(vec2 px) {
  int hm = int(uHalf.x + .5);
  vec3 c;
  if (hm == 0) {
    c = tone(foldSample(px));
  } else {
    c = halftone(px, hm);
    if (uHalf2.z < .999) c = mix(tone(foldSample(px)), c, uHalf2.z);
  }
  float m = min(uRes.x, uRes.y);
  if (uVig.x > 0.) {
    vec2 q = (px / uRes - .5) * 2.;
    c *= 1. - uVig.x * smoothstep(.35, 1.45, length(q));
  }
  if (uGrain.x > 0.) {
    float gs = max(uGrain.y * m / 1000., 1.);
    vec2 gp = floor(px / gs);
    float seed = uGrain.w > .5 ? mod(uFrame, 61.) : 0.;
    float gn = hash12(gp + seed * 13.17);
    vec3 gv = uGrain.z > .5 ? vec3(hash12(gp + seed * 7.1 + 3.3), hash12(gp + seed * 5.3 + 9.1), gn) : vec3(gn);
    c += (gv - .5) * uGrain.x;
  }
  c += (hash12(px + fract(uFrame * .618) * 97.) - .5) / 255.;
  return clamp(c, 0., 1.);
}
`;

// Live engine programs
export const FIELD_FS = HEADER + COMMON + SHARED_UNIFORMS + FIELD_UNIFORMS + FIELD_BODY + `
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = vec4(field(toWorld(vUv)), 1.); }`;

export const COMP_FS = HEADER + COMMON + SHARED_UNIFORMS + COMP_UNIFORMS + `
uniform sampler2D uField;
vec3 fieldAt(vec2 uv) { return texture(uField, uv).rgb; }
` + COMP_BODY + `
in vec2 vUv;
out vec4 fragColor;
void main() { fragColor = vec4(render(vUv * uRes), 1.); }`;
