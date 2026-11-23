import {scene, h, set, esc, popIn, content, icon, HERO, C} from '../../kit.js';

// A rounded card with a title and mono subtitle whose tiles pop in one per spoken item (an icon or glyph over a
// label), two to a row; the newest tile carries a soft blue focus ring. Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', title: 'Done for you', sub: 'only if the score clears 4.0',
  tiles: [{icon: 'icon:doc', label: 'Tailored resume', at: .3}, {icon: 'icon:send', label: 'Cover letter', at: .8}, {icon: 'icon:check', label: 'Form answers', at: 1.3}, {icon: 'icon:user', label: 'Hiring manager', at: 1.8}],
  colors: ['#3b5bdb', '#8b5cf6', '#22c55e', '#ff7a1a'], popAt: 0, cols: 2,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const cols = p.cols, rowsN = Math.ceil(p.tiles.length / cols), W = 920, gap = 26, tw = (W - 88 - gap * (cols - 1)) / cols, th = 250;
  const H = 170 + rowsN * (th + gap) + 20, x = HERO.x - W / 2, y = HERO.y - H / 2 + 20;
  const box = h(root, 'a mn-card', {left: x, top: y, width: W, height: H, padding: '42px 44px'});
  h(box, '', {font: '700 40px/1.1 Inter', color: M.ink}, esc(p.title));
  h(box, '', {font: '500 28px/1 "JetBrains Mono"', color: M.dim, marginTop: 12}, esc(p.sub));
  const tiles = p.tiles.map((tile, i) => {
    const col = i % cols, row = Math.floor(i / cols), color = tile.color ?? p.colors[i % p.colors.length];
    const n = h(box, 'a', {left: 44 + col * (tw + gap), top: 160 + row * (th + gap), width: tw, height: th, borderRadius: 26, background: M.raised, border: `1.5px solid ${M.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22});
    h(n, '', {width: 110, height: 110, borderRadius: 28, background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`, boxShadow: `0 0 50px color-mix(in srgb, ${color} 45%, transparent), inset 0 2px 0 rgba(255,255,255,.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center'}, content(tile.icon, 58, '#fff'));
    h(n, '', {font: '600 32px/1.1 Inter', color: M.ink, whiteSpace: 'nowrap'}, esc(tile.label));
    return {n, at: tile.at ?? .3 + i * .4};
  });
  return {
    seek(t) {
      popIn(box, t, p.popAt, '', {d: .5, from: .92, rise: 40});
      let newest = -1; tiles.forEach((tl, i) => { if (t >= tl.at) newest = i; });
      tiles.forEach((tl, i) => {
        popIn(tl.n, t, tl.at, '', {d: .45, from: .6, rise: 10});
        set(tl.n, {borderColor: i === newest ? M.blue : M.line, boxShadow: i === newest ? `0 0 0 4px color-mix(in srgb, ${M.blue} 30%, transparent)` : 'none'});
      });
    },
  };
}
