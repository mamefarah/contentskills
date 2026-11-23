import {stage, text, measure, fade, leave, glide, span, mix, easeInOut, easeBack, shade, on} from '../../kit.js';

// A "HELLO, my name is" sticker badge. The name writes on from the left; it can then slip away and be replaced
// (`forgetAt` + `after`, e.g. '???', for a forgotten name), and a drawn rose can bloom on the badge's top-right corner
// (`bloom: [from, to]`, 0 nothing .. 1 full flower) for "turn the name into a picture". A small line above, a big
// label landing under it. Shared piece: drawn in the theme's look.
// Props: name, at, dur (when and how long the name writes on), forgetAt, after, kicker, label, labelAt, warn (label in
// the accent), bloom, bloomAt, bloomDur, color (the flower; the accent by default), leaf (its leaves), tilt (degrees),
// enter (false: already on screen at 0, for a first frame), cx, top, w, h (the badge).
export const meta = {duration: 3, live: true};
export const defaults = {name: 'ROSE', at: .2, dur: .45, forgetAt: null, after: '???', kicker: '', label: '', labelAt: 1, warn: false,
  bloom: null, bloomAt: .3, bloomDur: .6, color: null, leaf: null, tilt: -3, enter: true, cx: 540, top: 520, w: 820, h: 520};

const BAND = 200;

function rose(parent, R, color, leaf) {
  const g = parent.append('g'), dark = shade(color, -.38);
  const leaves = [38, 142].map(a => g.append('g').attr('data-a', a));
  for (const l of leaves) l.append('path').attr('d', `M0 0 Q${R * .55} ${-R * .42} ${R * 1.05} 0 Q${R * .55} ${R * .42} 0 0Z`).attr('fill', leaf).attr('stroke', shade(leaf, -.3)).attr('stroke-width', 5);
  const ring = (n, dist, r, turn, fill) => Array.from({length: n}, (_, i) => {
    const a = (i / n * 360 + turn) * Math.PI / 180, p = g.append('g');
    p.append('circle').attr('r', r).attr('fill', fill).attr('stroke', dark).attr('stroke-width', 5);
    return {p, x: dist * Math.cos(a), y: dist * Math.sin(a)};
  });
  const outer = ring(5, R * .5, R * .5, -90, shade(color, -.14)), mid = ring(5, R * .27, R * .42, -54, color);
  const core = g.append('g');
  core.append('circle').attr('r', R * .3).attr('fill', shade(color, .2)).attr('stroke', dark).attr('stroke-width', 5);
  core.append('path').attr('d', `M${-R * .13} ${R * .02} a${R * .13} ${R * .13} 0 1 1 ${R * .13} ${R * .13} a${R * .07} ${R * .07} 0 1 1 ${-R * .06} ${-R * .09}`)
    .attr('fill', 'none').attr('stroke', dark).attr('stroke-width', 6).attr('stroke-linecap', 'round');
  return {
    g,
    seek(b, t) {
      g.attr('opacity', b > 0 ? 1 : 0);
      leaves.forEach((l, i) => l.attr('transform', `rotate(${+l.attr('data-a') + 3 * Math.sin(t * 1.9 + i)}) translate(${R * .5} 0) scale(${easeBack(span(b, 0, .4)).toFixed(4)})`));
      outer.forEach((d, i) => d.p.attr('transform', `translate(${d.x} ${d.y}) scale(${easeBack(span(b, .12 + i * .03, .42)).toFixed(4)})`));
      mid.forEach((d, i) => d.p.attr('transform', `translate(${d.x} ${d.y}) scale(${easeBack(span(b, .36 + i * .03, .4)).toFixed(4)})`));
      core.attr('transform', `rotate(${6 * Math.sin(t * 1.3)}) scale(${easeBack(span(b, .05, .5)).toFixed(4)})`);
    },
  };
}

export function mount(el, props = defaults, {look} = {}) {
  const p = {...defaults, ...props}, st = stage(el, look), g = st.root.append('g');
  const {cx, top: y0, w, h} = p, x0 = cx - w / 2, x1 = cx + w / 2, y1 = y0 + h;
  const paper = look.accent2 ?? look.ink, onBand = on(look.accent, look), nameInk = on(paper, look);
  const r = Math.min(look.radius ?? 24, 44);

  const tag = g.append('g');
  tag.append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', h).attr('rx', r).attr('fill', look.accent).attr('filter', st.lift);
  text(tag, x0 + 52, y0 + 122, 'HELLO', {size: 112, role: 'head', color: onBand}, look).style('letter-spacing', '.04em');
  text(tag, x0 + 56, y0 + BAND - 26, 'my name is', {size: 42, role: 'body', color: onBand, weight: 600}, look);
  const fy = y0 + BAND, fh = h - BAND - 40;
  tag.append('rect').attr('x', x0 + 24).attr('y', fy).attr('width', w - 48).attr('height', fh).attr('rx', Math.min(r, 18)).attr('fill', paper);

  const fit = str => Math.min(210, 210 * (w - 150) / Math.max(1, measure(str, look, 'head', 210)));
  const size = fit(p.name || 'M'), base = fy + fh / 2 + size * .36;
  const clip = st.defs.append('clipPath').attr('id', `${st.id}-write`).append('rect').attr('x', x0).attr('y', fy).attr('height', fh);
  const name = tag.append('g').attr('clip-path', `url(#${st.id}-write)`);
  const nameText = text(name, cx, base, p.name, {size, role: 'head', color: nameInk, anchor: 'middle'}, look);
  const hasAfter = p.forgetAt != null && p.after, aSize = hasAfter ? fit(p.after) : 0;
  const after = hasAfter ? tag.append('g') : null;
  if (after) text(after, 0, aSize * .36, p.after, {size: aSize, role: 'head', color: look.accent, anchor: 'middle'}, look);

  const flower = p.bloom ? rose(tag, 150, p.color ?? look.accent, p.leaf ?? look.dim) : null;
  flower?.g.attr('transform', `translate(${x1 - 96} ${y0 + 34})`);

  const kick = p.kicker ? text(g, cx, y0 - 96, p.kicker, {size: 36, role: 'mono', color: look.dim, anchor: 'middle'}, look).style('letter-spacing', '.22em') : null;
  const lSize = p.label ? Math.min(128, 128 * 700 / Math.max(1, measure(p.label, look, 'head', 128))) : 0;
  const lab = p.label ? st.root.append('g') : null;
  if (lab) text(lab, 0, 0, p.label, {size: lSize, role: 'head', color: p.warn ? look.accent : look.ink, anchor: 'middle'}, look);

  return {
    seek(t) {
      const into = p.enter ? glide(span(t, 0, .3)) : 1, gone = 1 - leave(t, p.life);
      g.attr('opacity', (p.enter ? fade(t, 0, .15) : 1) * gone).attr('transform', `translate(0 ${(1 - into) * 70})`);
      tag.attr('transform', `rotate(${(p.tilt + .8 * Math.sin(t * 1.5)).toFixed(3)} ${cx} ${y0 + h / 2})`);
      clip.attr('width', w * easeInOut(span(t, p.at, p.dur)));
      const lost = p.forgetAt == null ? 0 : easeInOut(span(t, p.forgetAt, .22));
      nameText.attr('opacity', 1 - lost).attr('transform', `translate(0 ${lost * 46})`);
      if (after) {
        const a = span(t, p.forgetAt + .14, .26);
        after.attr('opacity', a > 0 ? 1 : 0).attr('transform', `translate(${cx} ${fy + fh / 2}) scale(${(.5 + .5 * easeBack(a)).toFixed(4)})`);
      }
      if (flower) flower.seek(mix(p.bloom[0], p.bloom[1], easeInOut(span(t, p.bloomAt, p.bloomDur))), t);
      kick?.attr('opacity', fade(t, .1, .2));
      if (lab) {
        const a = span(t, p.labelAt, .28);
        lab.attr('opacity', (a > 0 ? 1 : 0) * gone).attr('transform', `translate(${cx} ${y1 + 250}) scale(${(.6 + .4 * easeBack(a)).toFixed(4)})`);
      }
    },
  };
}
