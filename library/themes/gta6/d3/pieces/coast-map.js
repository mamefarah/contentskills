import {C, F, P, pinPath, inked, wavePath, palm, label, place, span, easeOut, pop, hash} from '../../coast.js';
import {card} from './_card.js';

// An invented stretch of coastline: land, beach and sea in flat color, with pins dropping on the
// places being talked about. Positions are 0..1 across the map; the map itself is not a real place.
export const meta = {duration: 4, live: true};
export const defaults = {title: 'Where it happens', unit: 'Illustrative map · not a real place', clear: false,
  pins: [{label: 'STUDIO', x: .28, y: .3}, {label: 'BEACH', x: .52, y: .6}, {label: 'PIER', x: .78, y: .42}]};

export function mount(el, props = defaults) {
  const {body, intro, defs, id} = card(el, props), X = 120, Y = 320, W = 760, H = 500;
  defs.append('clipPath').attr('id', id + '-map').append('rect').attr('x', X).attr('y', Y).attr('width', W).attr('height', H).attr('rx', 18);
  const map = body.append('g').attr('clip-path', `url(#${id}-map)`); map.append('rect').attr('x', X).attr('y', Y).attr('width', W).attr('height', H).attr('fill', P(body, 'sea'));
  const waves = [0, 1, 2, 3].map(i => map.append('path').attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 4).attr('opacity', .6).attr('stroke-linecap', 'round'));
  const coast = `M${X} ${Y}H${X + W}V${Y + 150}C${X + 640} ${Y + 110} ${X + 600} ${Y + 250} ${X + 480} ${Y + 270}S${X + 300} ${Y + 250} ${X + 250} ${Y + 340}S${X + 90} ${Y + 420} ${X} ${Y + 400}Z`;
  map.append('path').attr('d', coast).attr('fill', '#ffe1a8').attr('stroke', C.ink).attr('stroke-width', 7).attr('transform', 'translate(0 26)');
  map.append('path').attr('d', coast).attr('fill', '#ff9ec7').attr('stroke', C.ink).attr('stroke-width', 6);
  let grid = ''; for (let i = 1; i < 9; i++) grid += `M${X + i * 90} ${Y}v260M${X} ${Y + i * 60}h${W}`; map.append('path').attr('d', grid).attr('stroke', C.paper).attr('stroke-width', 5).attr('opacity', .55).attr('clip-path', null);
  for (let i = 0; i < 7; i++) palm(map, X + 60 + hash(i, 3) * 620, Y + 60 + hash(i, 8) * 150, .16 + hash(i, 5) * .06, {lean: 20, color: C.plum});
  body.append('rect').attr('x', X).attr('y', Y).attr('width', W).attr('height', H).attr('rx', 18).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 7);
  const pins = props.pins.map((p, i) => { const g = body.append('g').attr('transform', `translate(${X + p.x * W} ${Y + p.y * H})`), ring = g.append('ellipse').attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 5), pin = g.append('g'); inked(pin, pinPath(0, 0, .85), {fill: ['pink', 'yellow', 'aqua'][i % 3], ink: 6, shadow: 6}); pin.append('circle').attr('cy', -73).attr('r', 14).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 5);
    const text = label(g, 0, 48, p.label, {size: 34, anchor: 'middle'}).attr('stroke', C.ink).attr('stroke-width', 9).attr('paint-order', 'stroke').attr('stroke-linejoin', 'round'); return {pin, ring, text}; });
  return {seek(t) {
    intro(t);
    waves.forEach((w, i) => w.attr('d', wavePath(X, Y + 330 + i * 46, W, 90, 8, t * .25 * (i % 2 ? -1 : 1))));
    pins.forEach(({pin, ring, text}, i) => { const at = .7 + i * .5, k = span(t, at, .25), b = t - at - .25, r = ((t - at) % 1.4) / 1.4;
      place(pin, 0, -(1 - k * k) * 400 - (b > 0 ? Math.abs(Math.sin(b * 14)) * 20 * Math.exp(-b * 6) : 0)).attr('opacity', span(t, at, .06));
      ring.attr('rx', 16 + r * 50).attr('ry', 6 + r * 18).attr('opacity', t > at + .25 ? 1 - r : 0); text.attr('opacity', span(t, at + .3, .2)); });
  }};
}
