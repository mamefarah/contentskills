import {scene, h, set, esc, pop, popStyle, span, ease, io, expo, breathe, chip, cursor, pointer, ripple, rippleStyle, HERO} from '../../kit.js';

// A video timeline of coloured scene blocks with a playhead sweeping across. At `markAt` a cursor taps one block
// (`index`): it lifts, gets a red outline and a "Change" chip; at `fixAt` a progress fill runs over just that block
// while the rest dim, and at `doneAt` it turns green with a FIXED tick and a stopwatch reads the seconds it took.
// For "tap Change on a scene ... it fixes it in seconds". Times are seconds from the shot start.
export const meta = {duration: 10};
export const defaults = {
  mode: 'light', title: 'Your video', scenes: ['Hook', 'Step 1', 'Step 2', 'Step 3', 'End'], index: 1, change: 'Change',
  markAt: null, fixAt: null, fixFor: .6, doneAt: null, seconds: '3 s', popAt: 0, colors: ['#d97757', '#5b84b1', '#4f8a5b', '#8a6fb3', '#c6523a'],
};

export function mount(el, props = defaults) {
  const p = {...defaults, ...props}, {root, M} = scene(el, p);
  const W = 920, x = HERO.x - W / 2, y = HERO.y - 240, n = p.scenes.length, gap = 12, bw = (W - 60 - gap * (n - 1)) / n, bh = 230;
  const card = h(root, 'a mn-card', {left: x, top: y, width: W, height: 470, padding: 30});
  h(card, '', {font: '700 40px/1 Inter', color: M.ink}, esc(p.title));
  const blocks = p.scenes.map((s, i) => {
    const b = h(card, 'a', {left: 30 + i * (bw + gap), top: 110, width: bw, height: bh, borderRadius: 16, overflow: 'hidden', background: p.colors[i % p.colors.length]});
    h(b, 'a', {left: 14, bottom: 14, font: '700 26px/1 Inter', color: '#fff'}, esc(s));
    const fill = h(b, 'a', {left: 0, top: 0, bottom: 0, width: '0%', background: 'rgba(255,255,255,.55)'});
    return {b, fill};
  });
  const head = h(card, 'a', {top: 96, width: 6, height: bh + 28, borderRadius: 3, background: M.ink});
  const ticks = h(card, 'a', {left: 30, top: 370, right: 30, height: 40, background: `repeating-linear-gradient(90deg, ${M.faint} 0 2px, transparent 2px 34px)`, opacity: .7});
  const target = blocks[p.index], tx = x + 30 + p.index * (bw + gap) + bw / 2, ty = y + 110 + bh / 2;
  const c1 = chip(root, `✎ ${p.change}`, 'red', {dot: false}); set(c1, {position: 'absolute', left: tx, top: y - 50});
  const done = chip(root, '✓ FIXED', 'green', {dot: false}); set(done, {position: 'absolute', left: tx, top: y - 50});
  const watch = h(root, 'c', {left: HERO.x, top: y + 600, font: '800 120px/1 "JetBrains Mono"', color: M.fieldInk, letterSpacing: '-.04em'});
  const cur = cursor(root), rip = ripple(root);
  return {
    seek(t) {
      set(card, popStyle(pop(t, p.popAt, {d: .45, from: .9}), ''));
      const moving = p.markAt == null || t < p.markAt, hx = 30 + ((moving ? t : p.markAt) * .45 % 1) * (W - 60);
      set(head, {left: hx, opacity: moving ? 1 : .25});
      const marked = p.markAt != null && t >= p.markAt, fixing = p.fixAt != null ? span(t, p.fixAt, p.fixFor) : 0, ok = p.doneAt != null && t >= p.doneAt;
      blocks.forEach(({b, fill}, i) => {
        const me = i === p.index, lift = me && marked ? ease(span(t, p.markAt, .3)) : 0;
        set(b, {transform: `translateY(${(-24 * lift).toFixed(1)}px) scale(${1 + .06 * lift})`, zIndex: me ? 2 : 1,
          boxShadow: me && marked ? `0 0 0 5px ${ok ? M.green : M.red}, 0 18px 40px rgba(0,0,0,.25)` : 'none', opacity: marked && !me && p.fixAt != null && t >= p.fixAt ? .4 : 1});
        if (me) set(fill, {width: `${(100 * io(fixing)).toFixed(1)}%`});
      });
      set(c1, {...popStyle(pop(t, p.markAt ?? 99, {d: .35}), 'translate(-50%,-50%)'), opacity: marked && !ok ? 1 : 0});
      set(done, popStyle(pop(t, p.doneAt ?? 99, {d: .4, from: .5}), 'translate(-50%,-50%)'));
      if (p.fixAt != null && t >= p.fixAt) { const s = ok ? parseFloat(p.seconds) : Math.min(parseFloat(p.seconds), (t - p.fixAt) / p.fixFor * parseFloat(p.seconds)); watch.textContent = `⏱ ${s.toFixed(1)}s`; set(watch, {opacity: 1}); } else set(watch, {opacity: 0});
      if (p.markAt != null) { const P = pointer(t, p.markAt, [tx + 240, ty + 380], [tx, ty], {travel: .35}); set(cur, {left: P.x, top: P.y, opacity: P.o * (ok ? 1 - span(t, p.doneAt, .3) : 1), transform: `scale(${P.s})`}); set(rip, rippleStyle(t, p.markAt, tx, ty, M.red)); } else set(cur, {opacity: 0});
    },
  };
}
