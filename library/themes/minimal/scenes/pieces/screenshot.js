import {scene, h, set, esc, popIn, chip, url, span, io, mix, tick, icon, HERO} from '../../kit.js';

// A real screenshot in a rounded window (title bar with three dots and a caption), slowly pushing in and panning
// from `from` to `to` (fractions of the image's overflow, 0 = top/left). Chips pop in under it at their times.
// Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'dark', src: '', title: 'career-ops', width: 940, height: 640, zoom: [1, 1.08], from: [0, 0], to: [0, 0], moveFor: 3,
  counter: null, chips: [{text: 'Runs locally', tone: 'green', at: .6}, {text: 'Open source', tone: 'blue', at: 1}, {text: 'Free', tone: 'plain', at: 1.4}], popAt: 0, y: null,
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, {mode: p.mode});
  const W = p.width, H = p.height, x = HERO.x - W / 2, y = p.y ?? HERO.y - H / 2 - 60;
  const win = h(root, 'a mn-card', {left: x, top: y, width: W, height: H + 64, overflow: 'hidden', padding: 0});
  const bar = h(win, 'a', {left: 0, top: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px', borderBottom: `1.5px solid ${M.line}`, background: M.raised});
  for (const c of ['#ff5f57', '#febc2e', '#28c840']) h(bar, '', {width: 18, height: 18, borderRadius: '50%', background: c});
  h(bar, '', {flex: 1, textAlign: 'center', marginRight: 80, font: '500 28px/1 "JetBrains Mono"', color: M.dim}, esc(p.title));
  const view = h(win, 'a', {left: 0, top: 64, width: W, height: H, overflow: 'hidden', background: '#000'});
  // A div with the picture as its background (an <img> can scroll the host while it decodes). Its height comes from
  // the image's aspect ratio, read once it has loaded (props.aspect = height / width skips the wait).
  const img = h(view, 'a', {left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', backgroundImage: `url("${url(p.src)}")`, backgroundSize: '100% auto', backgroundRepeat: 'no-repeat'});
  let aspect = p.aspect ?? 0;
  if (!aspect && p.src) { const probe = new Image(); probe.onload = () => { aspect = probe.naturalHeight / probe.naturalWidth; set(img, {height: W * aspect}); }; probe.src = url(p.src); }
  if (aspect) set(img, {height: W * aspect});
  const chipsRow = h(root, 'a', {left: 0, right: 0, top: y + H + 64 + 60, display: 'flex', justifyContent: 'center', gap: 18});
  const chips = p.chips.map(c => { const n = chip(chipsRow, c.text, c.tone ?? 'plain', {dot: c.tone !== 'plain', css: {height: 70, fontSize: 30, letterSpacing: '.02em'}}); return {n, at: c.at}; });
  // Optional counter: {value, at, for, label, y}: a white plate over the window with a number racing up to `value`,
  // a star and a burst of rays when it lands.
  const cn = p.counter, plate = cn ? h(root, 'c', {left: HERO.x, top: cn.y ?? y + H * .62, zIndex: 4, padding: '34px 56px 30px', borderRadius: 44, background: '#fff',
    boxShadow: '0 40px 100px rgba(0,0,0,.5)', textAlign: 'center'}) : null;
  const num = cn ? h(plate, '', {font: '800 170px/1 Inter', letterSpacing: '-.05em', color: '#141413', display: 'flex', alignItems: 'center', gap: 18, fontVariantNumeric: 'tabular-nums'}) : null;
  if (cn) h(plate, '', {marginTop: 10, font: '600 26px/1 "Inter Tight"', letterSpacing: '.3em', textTransform: 'uppercase', color: '#6e6c66'}, esc(cn.label ?? ''));
  const rays = cn ? h(root, 'c', {left: HERO.x, top: cn.y ?? y + H * .62, zIndex: 3, width: 1400, height: 1400, opacity: 0},
    `<svg viewBox="-700 -700 1400 1400" width="1400" height="1400">${Array.from({length: 18}, (_, i) => { const a = i / 18 * Math.PI * 2; return `<line x1="${Math.cos(a) * 330}" y1="${Math.sin(a) * 330}" x2="${Math.cos(a) * 640}" y2="${Math.sin(a) * 640}" stroke="#d97757" stroke-width="14" stroke-linecap="round"/>`; }).join('')}</svg>`) : null;
  return {
    seek(t) {
      if (cn) {
        popIn(plate, t, cn.at, 'translate(-50%,-50%)', {d: .35, from: .5});
        const v = Math.round(tick(t, cn.at, cn.for ?? 1, cn.value)), land = cn.at + (cn.for ?? 1);
        num.innerHTML = `${v.toLocaleString('en-US')}<span style="display:inline-block;transform:scale(${t >= land ? 1 + .4 * Math.exp(-(t - land) * 8) : 1})">${icon('star', 120, '#e8a33d')}</span>`;
        const r = span(t, land - .05, .6);
        set(rays, {opacity: t >= land - .05 && r < 1 ? 1 - r : 0, transform: `translate(-50%,-50%) scale(${.6 + .6 * r}) rotate(${t * 20}deg)`});
      }
      popIn(win, t, p.popAt, '', {d: .55, from: .9, rise: 50});
      const q = io(span(t, p.popAt, p.moveFor)), z = mix(p.zoom[0], p.zoom[1], q);
      const ih = aspect ? W * aspect : H;
      const ox = (W * z - W) * mix(p.from[0], p.to[0], q), oy = Math.max(0, ih * z - H) * mix(p.from[1], p.to[1], q);
      set(img, {transform: `translate(${-ox.toFixed(1)}px, ${-oy.toFixed(1)}px) scale(${z.toFixed(4)})`});
      for (const c of chips) popIn(c.n, t, c.at, '', {d: .4, from: .7});
    },
  };
}
