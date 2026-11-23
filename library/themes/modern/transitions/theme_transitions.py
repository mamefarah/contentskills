"""The Modern theme's own shader transitions, and its colours for the shared ones.
Read by load_theme() in library/_shared/shader_transitions.py; that file explains the two shader families
and the helpers used here (ease, bell, luma, hash, hash2, getA, getB, inside ...).

All original, in the genre of fast editorial "dynamic opener" edits. The look: a near-black charcoal canvas
around full-bleed vertical pictures; colour only from the pictures. Cuts are the frame itself rearranging:
vertical strips with staggered edges, a 2x2 mosaic with charcoal gutters, a narrow slot that widens, a centred
card that punches up to full frame, letterbox bars that close on the beat. Arrivals are expo-out and land hard;
departures accelerate away; no glows, no soft cross-fades. Every transition is a pure function of the two frames
and progress; the only randomness is hash() of strip / cell ids and seed.
"""
# Colours for the shared transitions (first two rows) and this theme's own names (theme.json / kit.js).
PALETTE = {
    'BG': '#1c1c1e', 'EDGE': '#1c1c1e', 'ACCENT': '#ff5a1f', 'HEAT': '#ff5a1f', 'HOT': '#f5f5f2',
    'BACK': '#2b2b2e', 'GRID': '#000000', 'EDGE_MIX': 1., 'VIGNETTE': .35,      # mesh tiles: charcoal gutters, no glow
    'CHAR': '#1c1c1e', 'INK': '#121213', 'GRAPHITE': '#2b2b2e', 'BONE': '#e8e5de', 'SIGNAL': '#ff5a1f',
}

HELPERS = '''
// The theme's arrival (expo-out, exactly 1 at 1), its departure (cubic in), and the zoom punch (back-out).
float snap(float x) { x = clamp(x, 0., 1.); return x >= 1. ? 1. : 1. - pow(2., -10. * x); }
float leave(float x) { x = clamp(x, 0., 1.); return x * x * x; }
float punch(float x) { x = clamp(x, 0., 1.); float c = 1.4, y = x - 1.; return 1. + (c + 1.) * y * y * y + c * y * y; }
// Moves that happen on the beat: n steps, each one a snap.
float stair(float x, float n) { x = clamp(x, 0., 1.) * n; float k = floor(x); return min(1., (k + snap(x - k)) / n); }
float gpx(float n) { return n * resolution.x / 1080.; }          // n pixels of the 1080-wide frame, in pixels here
// A picture shown through a window: the picture where inside, the charcoal canvas elsewhere.
vec3 frameOf(bool b, vec2 uv) { return inside(uv) > .5 ? (b ? getB(uv) : getA(uv)) : CHAR; }
'''
PIXEL = {}

# The next shot arrives in three vertical strips sliding in from alternate ends (top, bottom, top), in a
# scattered order, each landing hard; thin charcoal gutters stand between them until the last one lands.
PIXEL['strip_wipe'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, n = 3., i = min(floor(uv.x * n), n - 1.);
  float delay = (hash(vec2(i, 3.)) * .6 + mod(i, 2.) * .2) * .45;
  float t = snap((p - delay) / .55), dir = mod(i, 2.) < .5 ? 1. : -1.;
  float o = (1. - t) * 1.08 * dir;                                 // the strip's picture slides along y
  float gx = gpx(10.) * (1. - smoothstep(.8, 1., p));
  float lx = (uv.x - i / n) * resolution.x, wx = resolution.x / n;
  bool gut = (i > 0. && lx < gx * .5) || (i < n - 1. && lx > wx - gx * .5);
  vec2 q = uv - vec2(0., o);
  bool onB = q.y >= 0. && q.y <= 1.;
  vec3 a = mix(getA(uv), CHAR, .45 * smoothstep(0., .35, p));
  if (gut) return smoothstep(0., .08, p) > .5 ? CHAR : a;
  return onB ? getB(q) : a;
}
'''

# The shot leaves in three vertical strips that fall away to alternate ends, accelerating, in a scattered
# order; the next shot waits underneath, held down toward the charcoal, and comes up as the last strip goes.
PIXEL['strip_drop'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, n = 3., i = min(floor(uv.x * n), n - 1.);
  float delay = hash(vec2(i, 11.)) * .3;
  float t = leave((p - delay) / .55), dir = mod(i, 2.) < .5 ? -1. : 1.;
  vec2 q = uv - vec2(0., t * 1.1 * dir);
  float gx = gpx(10.) * smoothstep(0., .12, p);
  float lx = (uv.x - i / n) * resolution.x, wx = resolution.x / n;
  bool gut = (i > 0. && lx < gx * .5) || (i < n - 1. && lx > wx - gx * .5);
  vec3 b = mix(getB(uv), CHAR, .55 * (1. - smoothstep(.55, 1., p)));
  if (!gut && q.y >= 0. && q.y <= 1.) return getA(q);
  return gut && q.y >= 0. && q.y <= 1. ? CHAR : b;
}
'''

# The frame opens into a 2x2 mosaic with charcoal gutters; the four cells change to the next shot one at a
# time in a scattered order, each pushed in from the side, and the gutters close on the last.
PIXEL['mosaic_flip'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress;
  vec2 cell = min(floor(uv * 2.), vec2(1.)), l = uv * 2. - cell;
  float id = cell.x + cell.y * 2., h = hash(vec2(id, 5.)), rank = 0.;
  for (int k = 0; k < 4; k++) { float hk = hash(vec2(float(k), 5.)); if (hk < h || (hk == h && float(k) < id)) rank += 1.; }
  float s = snap((p - .14 - rank * .16) / .2), dir = mod(cell.x + cell.y, 2.) < .5 ? 1. : -1.;
  float g = gpx(18.) * smoothstep(0., .12, p) * (1. - smoothstep(.86, 1., p));
  vec2 inner = vec2(cell.x < .5 ? 1. - l.x : l.x, cell.y < .5 ? 1. - l.y : l.y) * resolution * .5;   // pixels to the gutters
  if (min(inner.x, inner.y) < g * .5) return CHAR;
  float lx = dir > 0. ? l.x : 1. - l.x;                            // 0 at the side B pushes in from
  if (lx < s) return getB(uv + vec2(dir * (1. - s) * .5, 0.));    // B slides in, A is pushed out ahead of it
  return getA(uv - vec2(dir * s * .5, 0.));
}
'''

# The shot steps back into a centred card on the charcoal canvas; on the beat the card cuts to the next shot,
# which punches up to full frame with a small overshoot and settles.
PIXEL['card_punch'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, s; bool b = p >= .44;
  if (!b) s = mix(1., .56, snap(p / .36));
  else s = mix(.56, 1., punch((p - .44) / .56));
  vec2 q = (uv - .5) / s + .5;
  return frameOf(b, q);
}
'''

# Charcoal closes in from both sides until the shot is a narrow slot; the slot cuts to the next shot and
# widens back out to the full frame, landing hard.
PIXEL['slot_open'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, w, h; bool b = p >= .46;
  if (!b) { float k = snap(p / .4); w = mix(1., .17, k); h = mix(1., .72, k); }
  else { float k = snap((p - .46) / .54); w = mix(.17, 1., k); h = mix(.72, 1., snap((p - .5) / .5)); }
  vec2 d = abs(uv - .5);
  if (d.x > w * .5 || d.y > h * .5) return CHAR;
  vec2 q = (uv - .5) * mix(1., .9, (1. - h) / .28) + .5;           // a slight push-in while the window is small
  return b ? getB(q) : getA(q);
}
'''

# Letterbox bars close from top and bottom in three beats to a thin band, which cuts to the next shot and
# opens in three beats. Hairline white rules ride the bar edges.
PIXEL['letterbox_snap'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress, hh; bool b = p >= .5;
  hh = b ? mix(.03, .5, stair((p - .52) / .48, 3.)) : mix(.5, .03, stair(p / .44, 3.));
  float dy = abs(uv.y - .5) - hh;
  vec3 col = dy > 0. ? CHAR : (b ? getB(uv) : getA(uv));
  float rule = 1. - smoothstep(gpx(1.5), gpx(3.), abs(dy * resolution.y + gpx(6.)));
  return mix(col, HOT, rule * .8 * step(hh, .499) * step(.0001, p) * (1. - step(.9999, p)));
}
'''

# A hard cut on a white flash: the shot pushes in and blows out to white, the next shot hits slightly zoomed
# and in black and white, then settles to itself and its colour.
PIXEL['flash_cut'] = HELPERS + '''
vec3 transition(vec2 uv) {
  float p = progress;
  if (p < .5) {
    float z = 1. + .08 * leave(p / .5), f = smoothstep(.3, .5, p);
    return mix(getA((uv - .5) / z + .5), HOT, f * f);
  }
  float k = 1. - snap((p - .5) / .5), z = 1. + .1 * k;
  vec3 b = getB((uv - .5) / z + .5);
  b = mix(b, vec3(luma(b)), smoothstep(.0, .5, k));
  return mix(b, HOT, k * k * k);
}
'''
