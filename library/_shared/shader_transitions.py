"""GPU shader transitions between two frames. BGR uint8 in, BGR uint8 out.

    from shader_transitions import render, CATALOG
    frame = render('cube_spin', frame_a, frame_b, 0.4)        # progress 0 = A, 1 = B

Two families, both rendered offscreen with moderngl (a standalone OpenGL 3.3 context):
  pixel   one fragment shader over a full-frame quad: `vec3 transition(vec2 uv)`
  vertex  a subdivided mesh of tiles moved in 3D by a vertex shader: `void displace(inout V v)`
Every transition is a pure function of (A, B, progress, params): the only randomness is an
integer hash of cell ids and `seed`. No clocks, no frame counters.

Image space throughout: uv (0,0) is the TOP-left pixel, y points down. Row 0 of the numpy
image is uploaded as texture row 0 and drawn at the bottom of GL clip space, which is also
row 0 of what the framebuffer reads back, so nothing is ever flipped. Textures hold the BGR
bytes as they are; shaders swizzle to RGB on the way in and back on the way out.

Shaders marked "Adapted from" come from gl-transitions (MIT); see shader_transitions-NOTICES.md.
Everything else is original.

A theme can bring its own transitions and its own colours for the shared ones without touching this
file: library/themes/<theme>/transitions/theme_transitions.py, read by load_theme() (see the end of this file).

  python library/_shared/shader_transitions.py            # self-test: p=0 is A, p=1 is B, deterministic
"""
import re
import numpy as np
import moderngl

VERSION = 2
# The colours the shared transitions draw with. The default is the futuristic theme's (library/themes/futuristic/theme.json);
# a theme replaces any of them with PALETTE in its theme_transitions.py. The five colours are known to the shaders by
# their futuristic names; each also has a role name a theme may use instead:
#   BG                 the backdrop behind the 3D mesh transitions, and "off" in crt_collapse and hex_reveal
#   CYAN    = EDGE     glowing rims of mesh tiles, the hot edge of wipes and dissolves
#   MAGENTA = ACCENT   the second colour in a few glows
#   AMBER   = HEAT     luma_melt's burn
#   WHITE   = HOT      the hottest core of beams and collapsing tubes
PALETTE = {'BG': '#04070c', 'CYAN': '#3ef0ff', 'MAGENTA': '#ff3fa4', 'AMBER': '#ffb300', 'WHITE': '#e9fcff'}
ROLES = {'EDGE': 'CYAN', 'ACCENT': 'MAGENTA', 'HEAT': 'AMBER', 'HOT': 'WHITE'}
# More a theme may set in PALETTE. None means "derived", as written beside it.
OPTIONS = {
    'BACK': None,         # colour of the back of a mesh tile (None: BG * 3)
    'GRID': None,         # colour of the grid lines on the mesh backdrop (None: the edge colour; '#000000' for no grid)
    'EDGE_MIX': 0.,       # 0: tile rims are added light (a glow); 1: rims are painted in the edge colour (ink or paper edges)
    'BACK_SHADE': 0.,     # 1: the back of a tile is lit like its front (paper); 0: flat
    'VIGNETTE': 0.,       # how much the mesh backdrop darkens toward the corners, 0..1
}

def _vec3(hex_color):
    return 'vec3(%.4f, %.4f, %.4f)' % tuple(int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))

def _colors(palette=None, own=False):
    """GLSL constants for a palette. Shared shaders see the five colours, their role names and OPTIONS;
    a theme's own shaders (own=True) also see every other colour the theme put in its PALETTE."""
    given = dict(palette or {})
    for role, name in ROLES.items():
        if role in given: given[name] = given.pop(role)
    unknown = [key for key, value in given.items() if key not in PALETTE and key not in OPTIONS and not (isinstance(value, str) and re.fullmatch('#[0-9a-fA-F]{6}', value))]
    if unknown: raise ValueError(f'PALETTE: {", ".join(unknown)} must be "#rrggbb" colours')
    lines = [f'const vec3 {name} = {_vec3(given.get(name, value))};' for name, value in PALETTE.items()]
    lines += [f'const vec3 {role} = {name};' for role, name in ROLES.items()]
    lines.append(f"const vec3 BACK = {_vec3(given['BACK']) if given.get('BACK') else 'BG * 3.'};")
    lines.append(f"const vec3 GRID = {_vec3(given['GRID']) if given.get('GRID') else 'CYAN'};")
    lines += [f'const float {name} = {float(given.get(name, OPTIONS[name])):.4f};' for name in ('EDGE_MIX', 'BACK_SHADE', 'VIGNETTE')]
    if own: lines += [f'const vec3 {name} = {_vec3(value)};' for name, value in given.items() if name not in PALETTE and name not in OPTIONS]
    return '\n'.join(lines) + '\n'

COMMON_HEAD = '''#version 330
uniform float progress;      // 0 = frame A, 1 = frame B
uniform float ratio;         // width / height
uniform vec2 resolution;     // pixels
uniform int seed;
const float PI = 3.14159265;
'''
COMMON_TAIL = '''
float ease(float x) { x = clamp(x, 0., 1.); return x * x * (3. - 2. * x); }
float bell(float x) { return max(sin(PI * clamp(x, 0., 1.)), 0.); }   // 0 at both ends, 1 in the middle
float luma(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
// Integer hash ("lowbias32" constants, Chris Wellons, public domain): the same bits on every GPU.
uint ih(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
/** 0..1 for an integer cell (the argument is floored). */
float hash(vec2 cell) { ivec2 i = ivec2(floor(cell)); return float(ih(uint(i.x) ^ ih(uint(i.y) ^ ih(uint(seed))))) / 4294967296.; }
vec2 hash2(vec2 cell) { return vec2(hash(cell), hash(cell + vec2(57., 113.))); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
'''

# ---------------------------------------------------------------- pixel family
QUAD_VERT = '''#version 330
in vec2 in_pos; out vec2 v_uv;
void main() { v_uv = in_pos; gl_Position = vec4(in_pos * 2. - 1., 0., 1.); }
'''
COMMON = COMMON_HEAD + _colors() + COMMON_TAIL        # with the default colours

PIXEL_BODY = '''
uniform sampler2D texA; uniform sampler2D texB;
in vec2 v_uv; out vec4 fragColor;
vec3 getA(vec2 uv) { return textureLod(texA, uv, 0.).bgr; }   // edges clamp
vec3 getB(vec2 uv) { return textureLod(texB, uv, 0.).bgr; }
float inside(vec2 uv) { vec2 s = step(vec2(0.), uv) * step(uv, vec2(1.)); return s.x * s.y; }
vec3 transition(vec2 uv);
void main() { fragColor = vec4(clamp(transition(v_uv), 0., 1.).bgr, 1.); }
'''
PIXEL_HEAD = COMMON + PIXEL_BODY
# Behind the meshes of the vertex family: the theme's backdrop colour with a faint grid (cyan on near-black by default).
BACKDROP = '''
vec3 transition(vec2 uv) {
  vec2 g = abs(fract(uv * vec2(8., 8. / ratio)) - .5) * 2.;
  float line = smoothstep(.955, .985, max(g.x, g.y));
  float fade = 1. - .6 * length(uv - .5);
  return BG * (1. - VIGNETTE * smoothstep(.25, .75, length(uv - .5))) + GRID * (.05 * line + .02) * fade;
}
'''
BACKDROP_FRAG = PIXEL_HEAD + BACKDROP

PIXEL = {}

# Adapted from gl-transitions "GlitchMemories" by Gunnar Roth, based on work from natewave. License: MIT.
# Changes: blocks sized from the frame, re-rolled 12 times, row tears, staggered per-block switch, cyan bars.
PIXEL['rgb_glitch'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), tick = floor(p * 12.);
  vec2 block = floor(uv * resolution / (resolution.x / 14.));
  vec2 n = hash2(block + tick * vec2(37., 91.));
  float row = floor(uv.y * 36.), rn = hash(vec2(row, tick + 500.));
  vec2 dist = (n - .5) * .3 * step(.45, n.y) * env;
  dist.x += (rn - .5) * .22 * step(.7, hash(vec2(tick + 9., row))) * env;
  vec2 split = vec2(.014 * env, 0.);
  vec2 r = uv + dist * .6 + split, g = uv + dist, b = uv + dist * 1.4 - split;
  float m = smoothstep(.3, .7, p + (n.x - .5) * .6 * env);
  vec3 col = vec3(mix(getA(r), getB(r), m).r, mix(getA(g), getB(g), m).g, mix(getA(b), getB(b), m).b);
  float bar = step(.9, hash(vec2(floor(uv.y * 18.), tick + 77.))) * env;
  return mix(col, col * .4 + CYAN * .5, bar * .5);
}
'''

# Original. Blocks freeze, smear along a per-block motion vector and are replaced out of order.
PIXEL['datamosh'] = '''
vec3 transition(vec2 uv) {
  float p = progress;
  vec2 g = vec2(10., 10. / ratio), id = floor(uv * g);
  if (hash(id + 31.) > .55) { g *= 2.; id = floor(uv * g) + 200.; }      // some blocks split in four
  vec2 c = (floor(uv * g) + .5) / g;
  float th = .16 + .68 * mix(hash(id), c.y, .35);                         // when this block is replaced
  float k = p - th;
  vec2 v = (hash2(id + 3.) - .5) * vec2(.45, .2);
  if (k < 0.) {
    float a = smoothstep(-.15, 0., k);
    vec3 col = getA(mix(uv, c, a * .7) + v * a * a);                      // flattens toward one stale color and drifts
    return mix(col, col.brg, a * .2);
  }
  float b = 1. - smoothstep(0., .15, k);
  vec2 q = uv + v * b, s = vec2(.02 * b, 0.);
  vec3 col = vec3(getB(q + s).r, getB(q).g, getB(q - s).b);
  return mix(col, getA(mix(uv, c, .7) + v), b * .5);
}
'''

# Original. The picture drops to coarser and coarser blocks, swaps, and resolves again.
PIXEL['pixel_dissolve'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), level = floor(env * 6.4);
  float px = level < 1. ? 1. : exp2(level) * resolution.x / 540.;         // block size in pixels
  vec2 cell = uv * resolution / px, id = floor(cell);
  vec2 q = (id + .5) * px / resolution;
  float m = smoothstep(.42, .58, p + (hash(id + level * 17.) - .5) * .3 * env);
  vec3 col = mix(getA(q), getB(q), m);
  vec2 f = fract(cell);
  float line = level >= 4. ? max(step(f.x, 1.5 / exp2(level)), step(f.y, 1.5 / exp2(level))) : 0.;
  return mix(col, col * .35 + CYAN * .22, line * env);
}
'''

# Original. A scanning beam travels down the frame, drawing B behind it.
PIXEL['scan_wipe'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), beam = mix(-.08, 1.08, ease(p));
  float d = uv.y - beam, near = exp(-abs(d) * 14.) * env;                 // d < 0: already scanned
  float row = floor(uv.y * 240.);
  vec2 q = uv + vec2((hash(vec2(row, floor(p * 30.))) - .5) * .12 * near * near, 0.);
  vec3 col;
  if (d < 0.) {
    vec2 s = vec2(.012 * near, 0.);
    col = vec3(getB(q + s).r, getB(q).g, getB(q - s).b);
    float trail = exp(d * 7.) * env;
    col = mix(col, luma(col) * CYAN * 1.4, trail * .65) * (1. - .35 * trail * mod(row, 2.));
  } else col = getA(q) * (1. - .25 * near);
  return col + (CYAN * exp(-abs(d) * 45.) + WHITE * exp(-abs(d) * 260.)) * sqrt(env);
}
'''

# Original. Hexagonal cells close and reopen on B, rippling out from the centre.
PIXEL['hex_reveal'] = '''
vec3 transition(vec2 uv) {
  const float N = 13.;                                                    // cells down the frame
  vec2 sp = vec2(uv.x * ratio, uv.y) * N, r = vec2(1., 1.7320508), h = r * .5;
  vec2 a = mod(sp, r) - h, b = mod(sp - h, r) - h, gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 centre = sp - gv, cuv = centre / N / vec2(ratio, 1.);
  float e = max(dot(abs(gv), vec2(.5, .8660254)), abs(gv.x)) * 2.;        // 0 at the centre of a cell, 1 on its edge
  float far = clamp(length((cuv - .5) * vec2(ratio, 1.)) / length(vec2(ratio, 1.) * .5), 0., 1.);
  float delay = far * .42 + hash(floor(centre / h + .5)) * .08;
  float t = clamp((progress - delay) / .5, 0., 1.), s = abs(1. - 2. * t) * 1.1, glow = bell(t);
  vec3 tex = t < .5 ? getA(uv) : getB(uv);
  vec3 col = mix(BG + CYAN * .1 * glow, tex, 1. - smoothstep(s - .03, s + .03, e));
  return col + (CYAN * exp(-abs(e - s) * 18.) * .9 + MAGENTA * exp(-abs(e - s - .12) * 30.) * .25) * glow;
}
'''

# Adapted from gl-transitions "DirectionalWarp" by pschroen. License: MIT.
# Changes: wider band, cyan/magenta glow along the warped edge.
PIXEL['warp_wipe'] = '''
uniform vec2 direction;
vec3 transition(vec2 uv) {
  const float smoothness = .22;
  vec2 v = normalize(direction); v /= abs(v.x) + abs(v.y);
  float d = v.x * .5 + v.y * .5;
  float m = 1. - smoothstep(-smoothness, 0., v.x * uv.x + v.y * uv.y - (d - .5 + progress * (1. + smoothness)));
  vec3 col = mix(getA((uv - .5) * (1. - m) + .5), getB((uv - .5) * m + .5), m);
  float edge = 4. * m * (1. - m);
  return col + CYAN * edge * edge * .5 + MAGENTA * pow(edge, 6.) * .22;
}
'''

# Original. Columns of A drip down at different speeds while its bright areas burn through first.
PIXEL['luma_melt'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p);
  float d = .65 * vnoise(vec2(uv.x * 7., 3.)) + .35 * hash(vec2(floor(uv.x * 60.), 9.));
  float o = clamp((p - d * .45) / .55, 0., 1.); o = o * o * 1.02;         // how far this column has fallen
  vec3 b = getB(uv);
  float y = uv.y - o;
  if (y < 0.) return b + (AMBER * .6 + MAGENTA * .3) * exp(y * 50.) * env;
  vec3 a = getA(vec2(uv.x, y));
  float burn = smoothstep(0., .18, luma(a) - (1.3 - p * 1.7));
  vec3 col = mix(a + AMBER * burn * (1. - burn) * 1.6, b, burn);
  return col + AMBER * exp(-y * 50.) * .6 * env * step(.001, o);
}
'''

# Original. An iris opens from the centre with a glowing, ticked ring that bends the picture at its edge.
PIXEL['iris_glow'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p);
  vec2 d = (uv - .5) * vec2(ratio, 1.);
  float r = length(d), x = r - ease(p) * length(vec2(ratio, 1.)) * .54;
  vec2 dir = d / max(r, 1e-4) / vec2(ratio, 1.);
  float bump = exp(-x * x * 900.) * env;
  vec3 col = x < 0. ? getB(.5 + (uv - .5) * (1. - .12 * (1. - ease(p))) - dir * bump * .02) : getA(uv + dir * bump * .035);
  float ticks = step(.5, fract(atan(d.y, d.x) / (2. * PI) * 48.));
  return col + (CYAN * exp(-abs(x) * 60.) + WHITE * exp(-abs(x) * 400.) * .9 + MAGENTA * exp(-abs(x - .03) * 120.) * .5 * ticks) * sqrt(env);
}
'''

# Adapted from gl-transitions "CrossZoom" by rectalogic (ported by gre; zoom blur after evanw's glfx.js). License: MIT.
# Changes: fixed centre, both pictures also scale so the camera appears to fly through A into B, hashed sample offset, cyan flash.
PIXEL['zoom_through'] = '''
vec2 mirror(vec2 uv) { return 1. - abs(mod(uv, 2.) - 1.); }
vec3 transition(vec2 uv) {
  float p = progress, e = ease(p), env = bell(p);
  float dissolve = ease((p - .3) / .4), strength = env * .5, zoomA = mix(1., 2.6, e * e), zoomB = mix(.38, 1., e * (2. - e));
  vec2 toCentre = vec2(.5) - uv;
  float offset = hash(uv * resolution), total = 0.;
  vec3 col = vec3(0.);
  for (int i = 0; i < 28; i++) {
    float percent = (float(i) + offset) / 28., weight = 4. * (percent - percent * percent);
    vec2 q = uv + toCentre * percent * strength - .5;
    col += mix(getA(q / zoomA + .5), getB(mirror(q / zoomB + .5)), dissolve) * weight; total += weight;
  }
  return col / total + CYAN * pow(env, 10.) * .22;
}
'''

# Original. Three sizes of digital noise eat A away, with a hot cyan edge on the dissolve front.
PIXEL['noise_dissolve'] = '''
vec3 transition(vec2 uv) {
  vec2 s = uv * vec2(1., 1. / ratio);
  float n = .5 * hash(floor(s * 7.)) + .3 * hash(floor(s * 28.) + 50.) + .2 * hash(floor(s * 112.) + 90.);
  float e = n - mix(-.06, 1.06, progress);
  if (e < 0.) return getB(uv) + CYAN * smoothstep(-.035, 0., e) * .45;
  return mix(getA(uv), WHITE * .35 + CYAN * .8, (1. - smoothstep(0., .05, e)) * .85);
}
'''

# Original. B flickers in as a cyan projection (scanlines, jumping rows) and then gains its real color.
PIXEL['hologram_in'] = '''
vec3 transition(vec2 uv) {
  float p = progress, hs = pow(bell(p), .6), tick = floor(p * 20.);
  float row = floor(uv.y * resolution.y / max(2., floor(resolution.y / 240.))), band = floor(uv.y * 24.);
  float jitter = (hash(vec2(band, tick)) - .5) * .1 * step(.72, hash(vec2(tick + 40., band)));
  vec2 q = uv + vec2(jitter * hs, 0.), s = vec2(.008 * hs, 0.);
  vec3 b = vec3(getB(q + s).r, getB(q).g, getB(q - s).b);
  vec3 holo = luma(b) * mix(CYAN, WHITE, .25) * 1.5 * (1. - .45 * mod(row, 2.));
  holo += CYAN * .25 * smoothstep(.9, 1., fract(uv.y * 1.5 - p * 3.));
  float flicker = mix(1., .35 + .65 * step(.3, hash(vec2(tick, 5.))), hs);
  float m = smoothstep(.05, .45, p);
  return mix(getA(uv) * (1. - .5 * hs), mix(b, holo, hs * .85) * flicker, m) + holo * hs * .15 * m;
}
'''

# Original. A switches off like a tube monitor (collapses to a line, then a dot) and B switches on.
PIXEL['crt_collapse'] = '''
vec3 tube(vec2 uv, float t, bool first) {                                 // t: 0 = full picture, 1 = collapsed
  float sy = max(1. - ease(t / .75), .006), sx = 1. - ease((t - .7) / .3), hot = 1. - sy;
  vec2 q = .5 + (uv - .5) / vec2(max(sx, 1e-4), sy);
  vec3 c = mix(first ? getA(q) : getB(q), WHITE, hot * hot * .8);
  vec3 col = mix(BG, c, inside(q) * step(1e-3, sx));
  float glow = exp(-abs(uv.y - .5) / (sy * .5 + .004) * 1.2) * hot * step(abs(uv.x - .5), sx * .5 + .02);
  return col + CYAN * glow * .8;
}
vec3 transition(vec2 uv) { return progress < .5 ? tube(uv, progress * 2., true) : tube(uv, (1. - progress) * 2., false); }
'''

# Original. A radar arm sweeps once around the centre, leaving B behind it under a fading cyan trail.
PIXEL['radar_sweep'] = '''
vec3 transition(vec2 uv) {
  float p = progress, env = sqrt(bell(p));
  vec2 d = (uv - .5) * vec2(ratio, 1.);
  float r = length(d), angle = fract(atan(d.x, -d.y) / (2. * PI) + 1.);   // 0 at 12 o'clock, clockwise
  float k = mix(-.03, 1.03, p) - angle;                                   // > 0: swept
  vec3 col;
  if (k > 0.) {
    col = getB(uv);
    float trail = exp(-k * 9.) * env;
    col = mix(col, luma(col) * CYAN * 1.5, trail * .7) + CYAN * smoothstep(.9, 1., fract(r * 9.)) * trail * .5;
  } else col = getA(uv) * (1. - .2 * env * exp(k * 6.));
  float arc = abs(k) * 2. * PI * r;
  return col + (CYAN * exp(-arc * 70.) + WHITE * exp(-arc * 400.) + CYAN * exp(-r * r * 900.)) * env;
}
'''

# ---------------------------------------------------------------- vertex family
# The frame is a sheet at z = 0 spanning x -ratio..ratio, y -1..1 (y down), seen by a camera on
# the +z axis that frames it exactly. The mesh is a grid of tiles that do not share vertices, so
# tiles can come apart; each tile is subdivided so it can also bend.
MESH_VERT_BODY = '''
uniform int layer;           // 0 = the sheet carrying A, 1 = the sheet carrying B
uniform vec2 grid;           // tiles across, down
in vec2 in_uv;               // this vertex on the sheet, 0..1
in vec2 in_cell;             // the centre of its tile, 0..1
in vec2 in_local;            // -1..1 inside its tile
in vec2 in_id;               // tile column, row
out vec2 v_uv; out vec2 v_local;
out float v_shade; out float v_glow; out float v_alpha; out float v_facing; out float v_mix; out float v_tint;
const float CAM = 2.6, NEAR = .1, FAR = 20.;
struct V { vec3 pos; vec3 nrm; vec2 uv; float shade; float glow; float alpha; float mixB; float tint; };
vec3 sheet(vec2 uv) { return vec3((uv.x - .5) * 2. * ratio, (uv.y - .5) * 2., 0.); }
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 rotAxis(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1. - c); }
void displace(inout V v);
void main() {
  // shade: brightness; glow: cyan on the tile's rim; mixB: 0 shows A, 1 shows B; tint: cyan added everywhere
  V v = V(sheet(in_uv), vec3(0., 0., 1.), in_uv, 1., 0., 1., float(layer), 0.);
  displace(v);
  float depth = CAM - v.pos.z;
  v_uv = v.uv; v_local = in_local; v_glow = v.glow; v_alpha = v.alpha; v_mix = v.mixB; v_tint = v.tint;
  v_facing = dot(v.nrm, vec3(0., 0., CAM) - v.pos);
  v_shade = v.shade * mix(.4, 1., abs(normalize(v.nrm).z));              // a sheet seen head-on is untouched
  gl_Position = vec4(v.pos.x / ratio * CAM, v.pos.y * CAM, (depth * (FAR + NEAR) - 2. * FAR * NEAR) / (FAR - NEAR), depth);
}
'''
MESH_VERT_HEAD = COMMON + MESH_VERT_BODY
MESH_FRAG_BODY = '''
uniform sampler2D texA; uniform sampler2D texB;
uniform float cull;          // 1: tiles are one-sided
in vec2 v_uv; in vec2 v_local;
in float v_shade; in float v_glow; in float v_alpha; in float v_facing; in float v_mix; in float v_tint;
out vec4 fragColor;
void main() {
  vec3 c = mix(texture(texA, v_uv).bgr, texture(texB, v_uv).bgr, v_mix) * v_shade;
  if (v_facing < 0.) { if (cull > .5) discard; c = BACK * mix(1., v_shade, BACK_SHADE) + c * .08; }  // the back of a tile: a dark panel
  vec2 rim = (1. - abs(v_local)) / max(fwidth(v_local), vec2(1e-5));      // pixels to the tile's edge
  float edge = 1. - smoothstep(0., 2.5 * resolution.x / 540., min(rim.x, rim.y));
  float lit = v_glow * edge * .9 + v_tint;
  c = mix(c + CYAN * lit, mix(c, CYAN, clamp(lit, 0., 1.)), EDGE_MIX);
  fragColor = vec4(clamp(c, 0., 1.).bgr, v_alpha);
}
'''
MESH_FRAG = COMMON + MESH_FRAG_BODY

# name -> (displace GLSL, tiles across, tile subdivisions (x, y), layers [(layer, depth-tested)], one-sided)
# Rows are chosen so tiles are roughly square, unless `rows` is given. A layer that is not
# depth-tested is a flat backdrop drawn first.
VERTEX = {}

# Original. A and B are two faces of a box that turns a quarter of the way round.
VERTEX['cube_spin'] = dict(cols=1, rows=1, sub=(1, 1), layers=[(0, True), (1, True)], cull=True, glsl='''
void displace(inout V v) {
  float turn = ease(progress) * PI * .5, a = layer == 0 ? -turn : PI * .5 - turn;
  vec3 c = vec3(0., 0., -ratio);                                          // the middle of the box
  v.pos = c + rotY(v.pos - c, a); v.nrm = rotY(v.nrm, a);
  v.pos.z -= bell(progress) * 1.1;                                    // pull back so the turning box fits
  v.glow = bell(progress);
}
''')

# Original. A folds up like a concertina toward the left edge, uncovering B.
VERTEX['accordion_fold'] = dict(cols=4, rows=1, sub=(1, 1), layers=[(1, False), (0, True)], cull=False, glsl='''
void displace(inout V v) {
  float e = ease(progress);
  if (layer == 1) { v.pos.xy *= mix(.9, 1., e); v.shade = mix(.45, 1., e); return; }
  float w = 2. * ratio / grid.x, fold = e * PI * .5, c = cos(fold), s = sin(fold), along = (in_local.x + 1.) * .5;
  bool odd = mod(in_id.x, 2.) > .5;
  v.pos.x = -ratio + (in_id.x + along) * w * c;
  v.pos.z = (odd ? 1. - along : along) * w * s;
  v.nrm = vec3(odd ? s : -s, 0., c);
  v.shade = odd ? mix(1., 1.9, s) : mix(1., .45, s);                       // panels facing the light stay brighter
  v.glow = bell(progress);
}
''')

# Original. A breaks into tiles that tumble toward the camera, the centre first.
VERTEX['shatter'] = dict(cols=7, sub=(1, 1), layers=[(1, False), (0, True)], cull=False, glsl='''
void displace(inout V v) {
  if (layer == 1) { float e = ease(progress); v.pos.xy *= mix(1.06, 1., e); v.shade = mix(.5, 1., e); return; }
  vec2 dc = (in_cell - .5) * vec2(ratio, 1.);
  float delay = clamp(length(dc) / length(vec2(ratio, 1.) * .5), 0., 1.) * .3 + hash(in_id) * .1;
  float t = clamp((progress - delay) / .6, 0., 1.), t2 = t * t;
  vec3 c = sheet(in_cell), axis = normalize(vec3(hash2(in_id + 7.) - .5, (hash(in_id + 19.) - .5) * .6) + vec3(1e-3, 0., 0.));
  float angle = t2 * (2. + 5. * hash(in_id + 23.));
  v.pos = c + rotAxis(v.pos - c, axis, angle); v.nrm = rotAxis(v.nrm, axis, angle);
  v.pos.xy += normalize(dc + vec2(1e-4, 0.)) * t2 * (.5 + .9 * hash(in_id + 31.));
  v.pos.z += t2 * (.8 + 1.8 * hash(in_id + 37.));
  v.alpha = 1. - smoothstep(.7, 1., t);
  v.glow = smoothstep(0., .12, t);
}
''')

# Original. One sheet: a ring of ripples runs out from the centre and the picture behind it is already B.
VERTEX['wave_sheet'] = dict(cols=1, rows=1, sub=(48, 84), layers=[(0, True)], cull=False, glsl='''
float front(vec2 uv) { return length((uv - .5) * vec2(ratio, 1.)) / length(vec2(ratio, 1.) * .5) - mix(-.25, 1.25, progress); }
float height(vec2 uv) {
  float x = front(uv), border = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
  return bell(progress) * .16 * exp(-x * x * 14.) * cos(x * 22.) * smoothstep(0., .08, border);
}
void displace(inout V v) {
  const float E = .004;
  float z = height(v.uv), x = front(v.uv);
  v.pos.z = z;
  v.nrm = normalize(vec3(-(height(v.uv + vec2(E, 0.)) - z) / (E * 2. * ratio), -(height(v.uv + vec2(0., E)) - z) / (E * 2.), 1.));
  v.shade = 1. + dot(v.nrm.xy, vec2(.5, .8)) * .9;
  v.mixB = smoothstep(-.06, .06, -x);
  v.tint = exp(-x * x * 500.) * bell(progress) * .6;
}
''')

# Original. A splits down the middle into two doors that swing open away from the camera; B is what lies beyond.
VERTEX['swing_doors'] = dict(cols=2, rows=1, sub=(1, 1), layers=[(1, False), (0, True)], cull=False, glsl='''
void displace(inout V v) {
  float e = ease(progress);
  if (layer == 1) { v.pos.xy *= mix(.86, 1., e); v.shade = mix(.35, 1., e); return; }
  bool left = in_id.x < .5;
  float open = e * (PI * .5 + atan(ratio, CAM) + .02), hinge = left ? -ratio : ratio, side = left ? 1. : -1., reach = abs(v.pos.x - hinge);
  v.pos.x = hinge + side * reach * cos(open); v.pos.z = -reach * sin(open);   // swung until edge-on to the camera
  v.nrm = vec3(side * sin(open), 0., cos(open));
  v.shade = 1. + .6 * sin(open);
  v.glow = bell(progress);
}
''')

# Original. A is cut into horizontal slices that tilt and slide off to alternate sides at different speeds.
VERTEX['slice_slide'] = dict(cols=1, rows=9, sub=(1, 1), layers=[(1, False), (0, True)], cull=False, glsl='''
void displace(inout V v) {
  if (layer == 1) { v.shade = mix(.45, 1., ease(progress)); return; }
  float t = clamp((progress - hash(vec2(in_id.y, 3.)) * .4) / .6, 0., 1.), side = mod(in_id.y, 2.) < .5 ? 1. : -1.;
  vec3 c = sheet(in_cell);
  float tilt = side * ease(t) * .9;
  v.pos = c + rotX(v.pos - c, tilt); v.nrm = rotX(v.nrm, tilt);
  v.pos.x += side * t * t * 2.6 * ratio;
  v.pos.z += ease(t) * .25;
  v.glow = smoothstep(0., .1, t);
}
''')

# Original. A grid of cards turns over in a diagonal wave; B is on the back of each card.
VERTEX['tile_flip'] = dict(cols=4, sub=(1, 1), layers=[(0, True), (1, True)], cull=True, glsl='''
void displace(inout V v) {
  float delay = (in_id.x / max(grid.x - 1., 1.) + in_id.y / max(grid.y - 1., 1.)) * .25;
  float t = ease((progress - delay) / .5), angle = PI * t - (layer == 1 ? PI : 0.);
  vec3 c = sheet(in_cell);
  v.pos = c + rotY(v.pos - c, angle); v.nrm = rotY(v.nrm, angle);
  v.pos.z += bell(t) * .22;
  v.glow = bell(t);
}
''')

# ---------------------------------------------------------------- GTA6 theme (pixel family)
# Comic-panel and sunset transitions for library/themes/gta6. All original. They carry their own
# colours (that theme's ink, cream gutter and sunset run) in a prefix, so nothing above is touched.
COAST_GLSL = '''
const vec3 INK = vec3(.098, .043, .2), CREAM = vec3(1., .957, .878), VIOLET = vec3(.353, .169, .816);
const vec3 PINK = vec3(1., .247, .592), ORANGE = vec3(1., .541, .188), YELLOW = vec3(1., .831, .278);
// The theme's sunset run: 0 violet, through pink and orange, to 1 yellow.
vec3 sunset(float t) { t = clamp(t, 0., 1.) * 3.; return t < 1. ? mix(VIOLET, PINK, t) : t < 2. ? mix(PINK, ORANGE, t - 1.) : mix(ORANGE, YELLOW, t - 2.); }
float aa(float d) { return clamp(d * resolution.y + .5, 0., 1.); }   // 1 where d > 0, one pixel soft (d in frame heights)
'''

# An angled panel edge crosses the frame: B, ink line, thick cream gutter, ink line, A (nudged aside).
PIXEL['panel_wipe'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), g = .034, ink = .007;
  float s = uv.x + (uv.y - .5) * .3 / ratio * .5625, pos = mix(-.25, 1.25, ease(p));
  float d = (s - pos) * ratio;                                   // frame heights; > 0 is still A
  vec3 a = getA(uv), b = getB(uv);
  b *= 1. - .35 * env * exp(min(d + g, 0.) * 22.);               // the gutter's hard shadow falls on B
  vec3 col = mix(b, INK, aa(d + g + ink));
  col = mix(col, CREAM, aa(d + g));
  col = mix(col, INK, aa(d - g));
  return mix(col, a, aa(d - g - ink));
}
'''

# Four angled panels of B slide in from alternating sides, each with a cream gutter and ink outline.
PIXEL['panel_slide'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, n = 4.;
  float gate = smoothstep(0., .12, p) * (1. - smoothstep(.86, 1., p));
  float v = clamp(uv.y + (uv.x - .5) * .11, 0., .9999), i = floor(v * n), dir = mod(i, 2.) < 1. ? 1. : -1.;
  float t = ease(clamp((p - .09 * i) / .7, 0., 1.)), off = (1. - t) * 1.25;
  float px = uv.x + dir * off;                                   // this pixel in the sliding panel's own space
  float lead = (dir > 0. ? 1. - px : px) * ratio;                // frame heights behind the panel's leading edge
  vec3 a = getA(uv) * (1. - .4 * gate * exp(min(lead, 0.) * 14.) * step(.001, t));   // shadow thrown ahead of the panel
  if (lead < 0.) return a;
  float f = fract(v * n), band = min(f, 1. - f) / n, g = .013 * gate, ink = .008 * gate;
  float edge = min(band, lead);                                  // distance to the panel's nearest edge
  vec3 col = getB(vec2(clamp(px, 0., 1.), uv.y));
  col = mix(INK, col, clamp(aa(edge - g - ink) + (1. - step(1e-5, g)), 0., 1.));
  col = mix(CREAM, col, clamp(aa(edge - g) + (1. - step(1e-5, g)), 0., 1.));
  return mix(a, col, aa(lead));
}
'''

# A sun disc grows from a point: ink rim, pink, orange, yellow, white-hot, then B inside.
PIXEL['sun_burn'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, env = bell(p), bw = .3;
  vec2 c = vec2(.5, .44), d = (uv - c) * vec2(ratio, 1.);
  float r = length(d), far = length(vec2(.5 * ratio, .56)) + bw + .03;
  r += .012 * env * sin(atan(d.y, d.x) * 14. + p * 9.);          // a slightly scalloped rim
  float R = mix(-.06, far, p * p * (3. - 2. * p)), k = (R - r) / bw;
  vec3 a = getA(uv);
  a = 1. - (1. - a) * (1. - ORANGE * env * exp(min(k, 0.) * bw * 9.) * .9);          // heat on A ahead of the rim
  if (k < 0.) return a;
  vec3 b = getB(uv), fire = k < .35 ? mix(PINK, ORANGE, k / .35) : k < .7 ? mix(ORANGE, YELLOW, (k - .35) / .35) : mix(YELLOW, vec3(1.), (k - .7) / .3);
  float slit = step(.5, fract(uv.y * 26. - p * 3.)) * smoothstep(.25, .6, k) * (1. - smoothstep(.75, .95, k));   // sunset-sign slits
  fire = mix(fire, fire * .86 + PINK * .14, slit);
  vec3 col = mix(fire, b, smoothstep(.72, 1., k));
  col = mix(INK, col, aa((R - r) - .008 * env));
  return mix(a, col, aa(R - r));
}
'''

# Dots on a 45-degree screen grow from one corner until they join; each has an ink rim.
PIXEL['halftone_dissolve'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, cells = 13.;
  vec2 q = vec2(uv.x * ratio, uv.y) * cells / ratio, r = vec2(q.x + q.y, q.y - q.x) * .70710678;
  vec2 id = floor(r), f = fract(r) - .5;
  vec2 centre = vec2((id.x + .5) - (id.y + .5), (id.x + .5) + (id.y + .5)) * .70710678 / cells * vec2(1., ratio);   // cell centre, back in uv
  float sweep = clamp(centre.x * .45 + (1. - centre.y) * .55, 0., 1.);
  float t = clamp(p * 1.75 - sweep * .75, 0., 1.), rad = t * .76, d = length(f);
  float px = cells / resolution.x;                               // one pixel in cell units
  float rim = .11 * sin(PI * t);
  vec3 a = getA(uv), b = getB(uv);
  a = mix(a, a * .82 + PINK * .18, bell(p) * smoothstep(0., .3, t));
  vec3 col = mix(a, INK, clamp((rad - d) / px + .5, 0., 1.) * step(1e-4, t));
  return mix(col, b, clamp((rad - rim - d) / px + .5, 0., 1.) * step(1e-4, t));
}
'''

# A loaded brush drags a pink-to-yellow band across: ragged ink leading edge, dry streaks, B behind it.
PIXEL['ink_swipe'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, W = .46, ink = .05;
  float s = uv.x + (uv.y - .5) * .22, y = uv.y * resolution.y / resolution.x * .5625;
  float rag = (vnoise(vec2(y * 26., 3.)) - .5) * .13 + (vnoise(vec2(y * 150., 9.)) - .5) * .06;
  float rag2 = (vnoise(vec2(y * 34., 21.)) - .5) * .16 + (vnoise(vec2(y * 170., 5.)) - .5) * .08;
  float lead = mix(-.32, 1.5 + W, ease(p)), d = lead + rag - s;  // > 0: the brush has passed
  vec3 a = getA(uv), b = getB(uv);
  if (d <= 0.) return a;
  float streak = vnoise(vec2(y * 210., 40.)), k = clamp((d - ink) / W, 0., 1.);
  vec3 paint = sunset(.33 + k * .67) * (.9 + .16 * streak);
  paint = mix(paint, INK, smoothstep(.72, .9, streak) * .35 * (1. - k));           // dry-brush hairs of ink in the paint
  vec3 col = mix(INK, paint, smoothstep(ink * (.5 + streak), ink * (1.1 + streak), d));
  float tail = d - ink - W - rag2;                               // > 0: paint has gone, B shows
  col = mix(col, b, smoothstep(0., .012 + .05 * streak, tail));
  return mix(a, col, clamp(d * resolution.x * .7, 0., 1.));
}
'''

# Page curl in the fragment shader: A lifts from the bottom-right corner round a cylinder and folds
# back as a pale page; B lies underneath with the curl's shadow on it.
PIXEL['page_turn'] = COAST_GLSL + '''
vec2 toUv(vec2 q) { return vec2(q.x / ratio, q.y); }
vec3 transition(vec2 uv) {
  float p = progress, R = .11, gate = smoothstep(0., .1, p) * (1. - smoothstep(.85, 1., p));
  vec2 dir = normalize(vec2(-1., -.5)), corner = vec2(ratio, 1.), q = vec2(uv.x * ratio, uv.y);
  float s = dot(q - corner, dir), far = dot(-corner, dir);       // distance in from the corner; far = the opposite corner
  float f = mix(0., far + R + .03, ease(p) * .5 + p * .5);                // the fold line
  vec3 a = getA(uv), b = getB(uv), paper = CREAM;
  if (s > f) {                                                   // flat page; the folded-back flap may lie on it
    float s0 = f - PI * R - (s - f); vec2 u0 = toUv(q + dir * (s0 - s));
    if (inside(u0) > .5) { vec3 back = mix(paper, getA(u0), .12) * (.86 + .14 * smoothstep(0., .25, s - f)); return mix(INK, back, aa(min(min(u0.x, 1. - u0.x) * ratio, min(u0.y, 1. - u0.y)) - .005)); }
    return a;
  }
  float x = clamp((f - s) / R, 0., 1.);
  if (s >= f - R) {
    float th = asin(x);
    vec2 uTop = toUv(q + dir * ((f - R * (PI - th)) - s)), uLow = toUv(q + dir * ((f - R * th) - s));
    if (inside(uTop) > .5) return mix(INK, mix(paper, getA(uTop), .12) * (.62 + .38 * (1. - x * x) + .1 * x), aa(R * (1. - x) - .006 * gate) + (1. - step(1e-4, gate)));
    if (inside(uLow) > .5) return getA(uLow) * (1. - .55 * x * x * gate - .0 );
    return b * (1. - .3 * gate);
  }
  return b * (1. - .42 * gate * exp(-(f - R - s) / .07));
}
'''

# Angled slats flip over one after another; edge-on, each shows a strip of the sunset behind it.
PIXEL['sunset_blinds'] = COAST_GLSL + '''
vec3 transition(vec2 uv) {
  float p = progress, n = 9., tilt = .2;
  float v = uv.y + (uv.x - .5) * tilt, i = floor(v * n), f = fract(v * n) - .5;
  float t = clamp(p * 1.55 - (i + 1.) / (n + 2.) * .55 - uv.x * .0, 0., 1.); t = t * t * (3. - 2. * t);
  float c = cos(PI * t), w = abs(c);                             // the slat's apparent height, 1 -> 0 -> 1
  vec3 gap = sunset((i + .5) / n) * (.8 + .4 * (f + .5));        // what shows between slats
  float px = n / resolution.y, turn = sin(PI * t);
  if (w < 1e-3) return gap;
  vec2 src = uv + vec2(0., (f / w - f) / n);
  vec3 face = c > 0. ? getA(src) : getB(src);
  face = mix(face, face * (.72 + .28 * w) + sunset((i + .5) / n) * .3 * turn, turn);   // tilting slats catch the sunset
  float e = .5 * w - abs(f);                                     // > 0 on the slat
  vec3 col = mix(gap, INK, clamp((e + .035 * turn) / px + .5, 0., 1.) * step(1e-4, turn));
  return mix(col, face, clamp(e / px + .5 + 2. * (1. - smoothstep(0., .04, turn)), 0., 1.));
}
'''

FAMILY = {**{name: 'pixel' for name in PIXEL}, **{name: 'vertex' for name in VERTEX}}
CATALOG = tuple(FAMILY)
# What `params` may carry. Every transition takes an integer `seed` (default 1).
PARAMS = {'warp_wipe': {'direction': (-1., 1.)}, 'shatter': {'cols': 7}, 'tile_flip': {'cols': 4}, 'accordion_fold': {'cols': 4}, 'slice_slide': {'rows': 9}}


# ---------------------------------------------------------------- theme transitions
# A theme can bring its own transitions, and its own colours for the shared ones, without touching this
# file: library/themes/<theme>/transitions/theme_transitions.py may define any of
#     PALETTE  = {'BG': '#0b1017', 'EDGE': '#efe9dc', 'PAPER': '#cbc3ae', ...}
#                  colours for the shared transitions (the names and options listed at PALETTE above); any other
#                  name is a colour of the theme's own, a `const vec3` in the theme's shaders
#     PIXEL    = {'name': 'vec3 transition(vec2 uv) { ... }'}                 fragment shaders, written like the ones above
#     VERTEX   = {'name': dict(glsl='void displace(inout V v) { ... }', cols=..., rows=..., sub=(..), layers=[..], cull=..)}
#                  mesh transitions; `frag` may replace the mesh fragment shader (the text after the common header)
#     PARAMS   = {'name': {'direction': (-1., 1.)}}                           extra params a transition accepts
#     BACKDROP = 'vec3 transition(vec2 uv) { ... }'                           what lies behind the meshes
# The pipeline and each theme's make_previews.py call load_theme() with the theme folder before rendering.
# A theme's own name wins over a shared one. Shared transitions keep their names in every theme.
_themes, _active = {}, None

def load_theme(theme_dir):
    """Makes this theme's transitions and colours the ones render() uses; None (or a theme without
    transitions/theme_transitions.py) goes back to the shared set in its default colours.
    Returns the names of the theme's own transitions."""
    global _active
    import importlib.util
    from pathlib import Path
    file = Path(theme_dir).resolve() / 'transitions' / 'theme_transitions.py' if theme_dir else None
    if not file or not file.exists(): _active = None; return ()
    key = str(file)
    if key not in _themes:
        spec = importlib.util.spec_from_file_location('theme_transitions_' + file.parents[1].name.replace('-', '_'), file)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        theme = {'id': key, 'palette': dict(getattr(module, 'PALETTE', {})), 'pixel': dict(getattr(module, 'PIXEL', {})), 'vertex': dict(getattr(module, 'VERTEX', {})),
                'params': dict(getattr(module, 'PARAMS', {})), 'backdrop': getattr(module, 'BACKDROP', None)}
        both = set(theme['pixel']) & set(theme['vertex'])
        if both: raise ValueError(f'{file}: {", ".join(sorted(both))} defined as both a pixel and a vertex transition')
        _colors(theme['palette'], True)                                    # fails now if a colour is malformed
        _themes[key] = theme
    _active = key
    return tuple(_themes[key]['pixel']) + tuple(_themes[key]['vertex'])

def names():
    """Every transition render() accepts now: the shared ones, then the loaded theme's own."""
    theme = _themes.get(_active)
    return CATALOG + tuple(name for name in (*theme['pixel'], *theme['vertex']) if name not in FAMILY) if theme else CATALOG

def _find(name):
    """-> (family, shader source or mesh spec, params it takes, whether it is the theme's own), or None."""
    theme = _themes.get(_active)
    if theme and name in theme['pixel']: return 'pixel', theme['pixel'][name], theme['params'].get(name, {}), True
    if theme and name in theme['vertex']: return 'vertex', theme['vertex'][name], theme['params'].get(name, {}), True
    if name in PIXEL: return 'pixel', PIXEL[name], PARAMS.get(name, {}), False
    if name in VERTEX: return 'vertex', VERTEX[name], PARAMS.get(name, {}), False


class _Engine:
    """One offscreen context, reused. Programs, meshes and render targets are built on first use."""
    def __init__(self):
        self.ctx = moderngl.create_standalone_context(require=330)   # raises if this machine cannot give us OpenGL 3.3
        self.programs, self.meshes, self.targets = {}, {}, {}
        self.quad = self.ctx.buffer(np.float32([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]).tobytes())

    def program(self, name):
        """Compiled for the loaded theme's colours: the same shared shader is a different program in each theme."""
        key = (_active, name)
        if key not in self.programs:
            theme = _themes.get(_active) or {}
            common = lambda own: COMMON_HEAD + _colors(theme.get('palette'), own) + COMMON_TAIL
            if name == '_backdrop': shaders = (QUAD_VERT, common(True) + PIXEL_BODY + (theme.get('backdrop') or BACKDROP))
            else:
                family, source, _, own = _find(name)
                if family == 'pixel': shaders = (QUAD_VERT, common(own) + PIXEL_BODY + source)
                else: shaders = (common(own) + MESH_VERT_BODY + source['glsl'], common(own) + (source.get('frag') or MESH_FRAG_BODY))
            try: program = self.ctx.program(vertex_shader=shaders[0], fragment_shader=shaders[1])
            except moderngl.Error as error: raise RuntimeError(f'The shader of "{name}" does not compile:\n{error}') from None
            vao = self.ctx.vertex_array(program, [(self.quad, '2f', 'in_pos')]) if shaders[0] is QUAD_VERT else None
            self.programs[key] = (program, vao)
        return self.programs[key]

    def mesh(self, name, cols, rows, sub):
        """Tiles of sub[0] x sub[1] quads; no vertex is shared between tiles. Attributes: uv, cell, local, id."""
        key = (_active, name, cols, rows, sub)
        if key not in self.meshes:
            corners = np.float32([[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]])
            sx, sy = sub
            col, row, i, j = (a.reshape(-1, 1) for a in np.meshgrid(np.arange(cols), np.arange(rows), np.arange(sx), np.arange(sy), indexing='ij'))
            inner = (np.concatenate([i, j], 1)[:, None, :] + corners[None]) / np.float32([sx, sy])   # 0..1 inside the tile
            tile = np.concatenate([col, row], 1)[:, None, :].astype(np.float32)
            size = np.float32([cols, rows])
            data = np.concatenate([(tile + inner) / size, np.broadcast_to((tile + .5) / size, inner.shape), inner * 2 - 1, np.broadcast_to(tile, inner.shape)], 2).astype(np.float32)
            program = self.program(name)[0]
            self.meshes[key] = self.ctx.vertex_array(program, [(self.ctx.buffer(data.tobytes()), '2f 2f 2f 2f', 'in_uv', 'in_cell', 'in_local', 'in_id')], skip_errors=True)
        return self.meshes[key]

    def target(self, w, h):
        if (w, h) not in self.targets:
            ctx = self.ctx
            textures = [ctx.texture((w, h), 3, alignment=1) for _ in 'AB']
            for texture in textures: texture.repeat_x = texture.repeat_y = False; texture.anisotropy = 8.0
            flat = ctx.framebuffer([ctx.texture((w, h), 4)])
            smooth = ctx.framebuffer([ctx.renderbuffer((w, h), 4, samples=4)], ctx.depth_renderbuffer((w, h), samples=4))   # 4x anti-aliasing for mesh edges
            self.targets[(w, h)] = (textures, flat, smooth)
        return self.targets[(w, h)]

    def render(self, name, a, b, progress, params):
        ctx, (h, w) = self.ctx, a.shape[:2]
        (tex_a, tex_b), flat, smooth = self.target(w, h)
        family, spec, takes, _ = _find(name)
        mesh = family == 'vertex'
        for texture, image, unit in ((tex_a, a, 0), (tex_b, b, 1)):
            texture.write(np.ascontiguousarray(image).tobytes(), alignment=1)
            if mesh: texture.build_mipmaps()
            texture.filter = (moderngl.LINEAR_MIPMAP_LINEAR, moderngl.LINEAR) if mesh else (moderngl.LINEAR, moderngl.LINEAR)
            texture.use(unit)
        uniforms = {'texA': 0, 'texB': 1, 'progress': float(progress), 'ratio': w / h, 'resolution': (float(w), float(h)), 'seed': int(params.get('seed', 1))}

        def use(program, extra=()):
            for key, value in {**uniforms, **dict(extra)}.items():
                if key in program: program[key].value = value          # uniforms a shader does not use are compiled away
        if not mesh:
            program, vao = self.program(name)
            value_of = lambda key, default: float(params.get(key, default)) if isinstance(default, (int, float)) else tuple(params.get(key, default))
            use(program, {key: value_of(key, default) for key, default in takes.items()})
            flat.use(); ctx.disable(moderngl.DEPTH_TEST | moderngl.BLEND)
            vao.render()
        else:
            cols = int(params.get('cols', spec.get('cols', 1)))
            rows = int(params.get('rows', spec.get('rows') or max(1, round(cols * h / w))))
            if not (1 <= cols <= 64 and 1 <= rows <= 64): raise ValueError('cols and rows must be 1..64')
            smooth.use(); smooth.clear(0, 0, 0, 1, depth=1.0)
            ctx.disable(moderngl.DEPTH_TEST | moderngl.BLEND | moderngl.CULL_FACE)
            program, vao = self.program('_backdrop'); use(program); vao.render()
            program, vao = self.program(name)[0], self.mesh(name, cols, rows, tuple(spec.get('sub', (1, 1))))
            ctx.enable(moderngl.BLEND); ctx.blend_func = moderngl.SRC_ALPHA, moderngl.ONE_MINUS_SRC_ALPHA
            for layer, depth in spec['layers']:
                (ctx.enable if depth else ctx.disable)(moderngl.DEPTH_TEST)
                use(program, {'layer': layer, 'grid': (float(cols), float(rows)), 'cull': 1.0 if spec.get('cull') else 0.0})
                vao.render(moderngl.TRIANGLES)
            ctx.copy_framebuffer(flat, smooth)                           # resolve the anti-aliased picture
        return np.frombuffer(flat.read(components=3, alignment=1), np.uint8).reshape(h, w, 3).copy()


_engine = None

def render(name, frame_a, frame_b, progress, params=None, exact=True):
    """The frame `progress` (0..1) of the way from frame_a to frame_b. Does not modify its inputs.
    With exact=True (the default) progress <= 0 returns A and >= 1 returns B untouched, without the GPU."""
    global _engine
    found = _find(name)
    if not found: raise ValueError(f'Unknown transition: {name}. Options: {", ".join(names())}')
    for image in (frame_a, frame_b):
        if image.dtype != np.uint8 or image.ndim != 3 or image.shape[2] != 3: raise ValueError('Expected BGR uint8 images')
    if frame_a.shape != frame_b.shape: raise ValueError('Both frames must be the same size')
    params = dict(params or {})
    unknown = set(params) - {'seed'} - set(found[2])
    if unknown: raise ValueError(f'{name} does not take: {", ".join(sorted(unknown))}')
    progress = min(1.0, max(0.0, float(progress)))
    if exact and progress == 0: return frame_a.copy()
    if exact and progress == 1: return frame_b.copy()
    if _engine is None: _engine = _Engine()
    return _engine.render(name, frame_a, frame_b, progress, params)


def self_test(width=270, height=480, themes=True):
    """Renders every transition through the GPU at its ends and middle: the shared ones in their default colours,
    then, for every theme with a transitions/theme_transitions.py, that theme's own and the shared ones its catalog
    lists, in the theme's colours. Returns a list of failures."""
    import json
    from pathlib import Path
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:height, 0:width]
    a = np.stack([x * 255 // width, y * 255 // height, (x // 16 + y // 16) % 2 * 200], 2).astype(np.uint8)   # asymmetric: catches flips and channel swaps
    b = np.ascontiguousarray(rng.integers(0, 255, (height // 8 + 1, width // 8 + 1, 3), np.uint8).repeat(8, 0).repeat(8, 1)[:height, :width])
    failures = []

    def check(name, label=''):
        try:
            start, middle, end = (render(name, a, b, p, exact=False).astype(int) for p in (0, .5, 1))
            again = render(name, a, b, .5, exact=False)
        except Exception as error:
            print(f'{label}{name}: {error}'); failures.append(f'{label}{name}: {str(error).splitlines()[0]}'); return
        off_a, off_b = np.abs(start - a).max(), np.abs(end - b).max()
        notes = []
        if off_a > 2: notes.append(f'p=0 differs from A by {off_a}')
        if off_b > 2: notes.append(f'p=1 differs from B by {off_b}')
        if not np.array_equal(middle, again): notes.append('not deterministic')
        if min(np.abs(middle - a).mean(), np.abs(middle - b).mean()) < 2: notes.append('nothing happens at p=0.5')
        print(f'{label + name:28s} {_find(name)[0]:6s} {"ok" if not notes else "; ".join(notes)}')
        failures.extend(f'{label}{name}: {note}' for note in notes)

    previous = _active
    load_theme(None)
    for name in CATALOG: check(name)
    count = len(CATALOG)
    for folder in sorted(Path(__file__).resolve().parents[1].glob('themes/*/transitions')) if themes else ():
        if not (folder / 'theme_transitions.py').exists(): continue
        try: own = load_theme(folder.parent)
        except Exception as error: failures.append(f'{folder.parent.name}: {error}'); print(failures[-1]); continue
        listed = [item['id'] for item in json.loads((folder / 'catalog.json').read_text())['items']] if (folder / 'catalog.json').exists() else []
        for name in listed:
            if not _find(name): failures.append(f'{folder.parent.name}: the catalog lists "{name}", which does not exist'); print(failures[-1])
        todo = list(own) + [name for name in listed if name in FAMILY and name not in own]
        for name in todo: check(name, folder.parent.name + '/')
        count += len(todo)
    _active_restore(previous)
    self_test.count = count
    return failures

def _active_restore(key):
    global _active
    _active = key


if __name__ == '__main__':
    import sys
    problems = self_test()
    print(f'{self_test.count} checks ({len(CATALOG)} shared transitions) on {_engine.ctx.info["GL_RENDERER"]}, OpenGL {_engine.ctx.info["GL_VERSION"]}')
    if problems: print(f'{len(problems)} FAILED:\n  ' + '\n  '.join(problems))
    sys.exit(1 if problems else 0)
