"""The minimal theme's soft cuts: a short zoom-blur push, a blur dissolve, a white dip and a punch-in.
Adapted from the glass/fashion set (soft_zoom builds on the shared zoom_through; see shader_transitions-NOTICES.md).
Pure functions of the two frames and progress."""
# Colours for the shared transitions (first row) and this theme's own names (from kit.js).
PALETTE = {
    'BG': '#0B0B0C', 'EDGE': '#FFFFFF', 'ACCENT': '#3B5BDB', 'HEAT': '#7B96FF', 'HOT': '#FFFFFF', 'BACK': '#161618', 'GRID': '#000000', 'EDGE_MIX': 1, 'VIGNETTE': .2,
    'INK': '#111113', 'POPPY': '#3B5BDB', 'COBALT': '#7B96FF', 'SUN': '#ECEBE8',
}

HELPERS = '''
float glide(float x) { x = clamp(x, 0., 1.); return 1. - pow(1. - x, 3.); }
vec2 mirror(vec2 uv) { return 1. - abs(mod(uv, 2.) - 1.); }
vec3 vivid(vec3 c, float s) { float l = luma(c); return clamp(vec3(l) + (c - vec3(l)) * s, 0., 1.); }
'''
PIXEL, VERTEX = {}, {}

PIXEL['soft_zoom'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, e = ease(p), env = bell(p);
  float dissolve = ease((p - .3) / .4), zoomA = mix(1., 1.55, e * e), zoomB = mix(.7, 1., e * (2. - e));
  vec2 c = vec2(.5, .46), toCentre = c - uv;
  float offset = hash(uv * resolution), total = 0.;
  vec3 col = vec3(0.);
  for (int i = 0; i < 24; i++) {
    float percent = (float(i) + offset) / 24., weight = 4. * (percent - percent * percent);
    vec2 q = uv + toCentre * percent * env * .45 - c;
    col += mix(getA(mirror(q / zoomA + c)), getB(mirror(q / zoomB + c)), dissolve) * weight; total += weight;
  }
  return col / total;
}
'''

PIXEL['blur_dissolve'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), m = ease((p - .3) / .4), radius = .055 * env * env;
  float turn = hash(uv * resolution) * 2. * PI;
  vec2 centre = .5 + (uv - .5) / (1. + .04 * env);
  vec3 col = vec3(0.);
  for (int i = 0; i < 24; i++) {
    float angle = float(i) * 2.39996 + turn, r = sqrt((float(i) + .5) / 24.) * radius;
    vec2 q = centre + vec2(cos(angle), sin(angle) * ratio) * r;
    col += mix(getA(q), getB(q), m);
  }
  return col / 24. * (1. - .12 * env);
}
'''

PIXEL['white_dip'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), m = ease((p - .38) / .24), radius = .022 * env;
  float turn = hash(uv * resolution) * 2. * PI;
  vec3 col = vec3(0.);
  for (int i = 0; i < 12; i++) {
    float angle = float(i) * 2.39996 + turn, r = sqrt((float(i) + .5) / 12.) * radius;
    vec2 q = uv + vec2(cos(angle), sin(angle) * ratio) * r;
    col += mix(getA(q), getB(q), m);
  }
  col /= 12.;
  col = 1. - (1. - col) * (1. - smoothstep(.45, 1., luma(col)) * env * .7);
  return mix(col, vec3(1.), pow(env, 1.6) * .86);
}
'''

PIXEL['punch_zoom'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), m = ease((p - .32) / .18);
  float zoomA = 1. + 1.1 * p * p, zoomB = mix(1.24, 1., glide(p));
  vec2 c = vec2(.5, .46), toCentre = c - uv;
  float offset = hash(uv * resolution), total = 0.;
  vec3 col = vec3(0.);
  for (int i = 0; i < 20; i++) {
    float percent = (float(i) + offset) / 20., weight = 1. - .6 * percent;
    vec2 q = uv + toCentre * percent * env * .6 - c;
    col += mix(getA(mirror(q / zoomA + c)), getB(mirror(q / zoomB + c)), m) * weight; total += weight;
  }
  return col / total;
}
'''

