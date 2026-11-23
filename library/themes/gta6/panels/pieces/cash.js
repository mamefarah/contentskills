import {C, F, coastStage, rrect, lettering, label, tab, place, span, easeOut, easeBack, slam, pop, presence, flick, hash} from '../../coast.js';

// A money pop: banknotes fan out and coins jump as a figure counts up in gold lettering.
// `y` is the vertical centre in frame pixels.
export const meta = {duration: 3.2, live: true};
export const defaults = {value: 4800, prefix: '$', suffix: '', label: 'PER MONTH', y: 380};

export function mount(el, props = defaults) {
  const {root} = coastStage(el, {overlay: true}), y = props.y, g = root.append('g');
  const bills = [-34, -17, 0, 17, 34].map((angle, i) => {
    const b = g.append('g'), inner = b.append('g');
    inner.append('path').attr('d', rrect(-150, -75, 300, 150, 14)).attr('fill', C.ink).attr('transform', 'translate(9 9)');
    inner.append('path').attr('d', rrect(-150, -75, 300, 150, 14)).attr('fill', i % 2 ? C.aqua : C.teal).attr('stroke', C.ink).attr('stroke-width', 6);
    inner.append('path').attr('d', rrect(-132, -57, 264, 114, 8)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 3).attr('opacity', .6);
    inner.append('circle').attr('r', 42).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 5);
    label(inner, 0, 22, '$', {size: 62, font: F.display, color: C.ink, anchor: 'middle', spacing: 0});
    return {b, angle, i};
  });
  const coins = [[-380, 70], [380, 40], [300, -170], [-310, -150]].map(([cx, cy], i) => {
    const c = g.append('g'); c.attr('data-coin', 1); c.append('circle').attr('r', 46).attr('fill', C.ink).attr('transform', 'translate(7 7)');
    c.append('circle').attr('r', 46).attr('fill', C.yellow).attr('stroke', C.ink).attr('stroke-width', 6); c.append('circle').attr('r', 32).attr('fill', 'none').attr('stroke', C.orange).attr('stroke-width', 5);
    label(c, 0, 18, '$', {size: 48, font: F.display, color: C.ink, anchor: 'middle', spacing: 0}); return {c, cx, cy, i};
  });
  const numG = g.append('g'), fmt = v => (props.prefix ?? '') + (Number.isInteger(props.value) ? Math.round(v).toLocaleString('en-US') : v.toFixed(1)) + (props.suffix ?? '');
  const num = lettering(numG, 0, 70, fmt(props.value), {size: 210, fit: 860, fill: 'gold', rim: 5});
  const tag = tab(g, 0, 0, props.label, {size: 46, fill: 'pink'});
  return {
    seek(t) {
      root.attr('opacity', presence(t, props.life)); g.attr('transform', flick(t, props.life, 540, y));
      bills.forEach(({b, angle, i}) => { const q = easeBack(span(t, .05 + i * .05, .4)); b.attr('transform', `translate(540 ${y + 150}) rotate(${angle * q}) translate(0 ${-350 * q}) scale(${Math.max(.001, q)})`); });
      coins.forEach(({c, cx, cy, i}) => { const k = span(t, .35 + i * .08, .5), hop = Math.sin(Math.min(1, k) * Math.PI) * 90 + Math.abs(Math.sin(t * 3 + i)) * 10; place(c, 540 + cx * easeOut(k), y + cy - hop, pop(t, .35 + i * .08), (hash(i, 2) - .5) * 30); });
      num.text(fmt(props.value * easeOut(span(t, .25, 1)))); place(numG, 540, y, slam(t, .2), -2).attr('opacity', span(t, .2, .06));
      place(tag.g, 540 - tag.w / 2, y + 180, pop(t, .6), -3);
    },
  };
}
