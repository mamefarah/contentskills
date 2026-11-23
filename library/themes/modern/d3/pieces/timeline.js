import {card, heavy, C, STEP, panel, label, rule, up, span, snap, wrap, fit, SERIES} from './_card.js';

// A timeline as a contact sheet: a white rule snaps across, then a square marker jumps from event to
// event on the beat. Each event it reaches wipes in a tall picture thumbnail above the rule and its
// year turns from ghost to solid heavy type; the caption sits under the rule in tracked capitals.
export const meta = {duration: 7};
export const defaults = {title: 'How it grew', unit: 'Milestones', clear: false,
  items: [{label: '2019', text: 'First upload'}, {label: '2020', text: 'First thousand'}, {label: '2022', text: 'Went full time'}, {label: '2023', text: 'First sponsor'}, {label: '2025', text: 'One million'}]};

export function mount(el, props = defaults) {
  const c = card(el, props), {root, T, st} = c, items = (props.items ?? []).slice(0, 6), n = Math.max(1, items.length);
  const x0 = 80, x1 = 920, y = 690, slot = (x1 - x0) / n, tw = Math.min(150, slot * .78), th = 300, tones = props.tones ?? SERIES;
  const line = rule(root, x0, y, x1, y, {width: 3});
  const ys = Math.min(56, fit(items.map(d => up(d.label)).sort((a, b) => b.length - a.length)[0] ?? 'X', slot * .9, 56, {track: .01}));
  const ev = items.map((d, i) => {
    const cx = x0 + slot * (i + .5);
    const p = panel(st, root, {x: cx - tw / 2, y: y - 90 - th, w: tw, h: th, tone: d.tone ?? tones[i % tones.length], image: d.image ?? null});
    const tick = rule(root, cx, y - 14, cx, y + 14, {width: 3});
    const yr = heavy(root, cx, y - 30, up(d.label), ys, {anchor: 'middle'});
    const lines = wrap(up(d.text ?? ''), 17, slot * .86, {font: '"Inter Tight"', weight: 600, track: .22}).slice(0, 3);
    const cap = label(root, cx, y + 58, lines.join('\n'), {size: 17, anchor: 'middle', track: .22, color: C.dim});
    return {cx, p, tick, yr, cap, at: T + .45 + i * STEP * 2.5};
  });
  const mark = root.append('rect').attr('width', 26).attr('height', 26).attr('fill', C.white).attr('stroke', C.bg).attr('stroke-width', 5);
  return {seek(t) {
    c.seek(t);
    line.draw(snap(span(t, T - .1, STEP * 3)));
    let mx = ev[0]?.cx ?? x0;
    ev.forEach((e, i) => {
      const prev = ev[i - 1]?.cx ?? x0, a = snap(span(t, e.at - STEP, STEP * 1.2)); if (t >= e.at - STEP) mx = prev + (e.cx - prev) * a;
      const on = t >= e.at, w = snap(span(t, e.at, STEP * 2));
      e.tick.draw(t >= T + .2 ? 1 : 0);
      e.yr.attr('opacity', t >= T + .2 + i * .05 ? 1 : 0).attr('fill-opacity', on ? 1 : .26).attr('stroke', C.white).attr('stroke-width', on ? 0 : 1).attr('stroke-opacity', .6);
      e.cap.attr('opacity', on ? 1 : 0);
      const hh = th * w; e.p.set({y: y - 90 - hh, h: hh, zoom: 1.15 - .15 * w, opacity: w > 0 ? 1 : 0});
    });
    mark.attr('x', mx - 13).attr('y', y - 13).attr('opacity', t >= T + .3 ? 1 : 0);
  }};
}
