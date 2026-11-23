import {C, F, P, pinPath, inked, car, label, lettering, place, span, easeOut, pop, draw} from '../../coast.js';
import {card} from './_card.js';

// A coast road winding across the card: a car drives it and a pin drops at each stop along the way.
export const meta = {duration: 4.6};
export const defaults = {title: 'The road so far', unit: 'Illustrative milestones', clear: false,
  stops: [{label: 'FIRST POST', note: 'Week 1'}, {label: '1K FANS', note: 'Month 3'}, {label: 'FIRST DEAL', note: 'Month 6'}, {label: 'FULL TIME', note: 'Year 1'}]};

export function mount(el, props = defaults) {
  const {body, intro} = card(el, props), d = 'M120 800C300 800 300 640 470 640S640 480 760 470S880 380 880 350';
  const road = [[C.ink, 66], [C.night, 52]].map(([c, w]) => body.append('path').attr('d', d).attr('fill', 'none').attr('stroke', c).attr('stroke-width', w).attr('stroke-linecap', 'round'));
  body.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 78).attr('stroke-linecap', 'round').lower(); body.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.paper).attr('stroke-width', 66).attr('stroke-linecap', 'round').lower();
  const dash = body.append('path').attr('d', d).attr('fill', 'none').attr('stroke', C.yellow).attr('stroke-width', 6).attr('stroke-dasharray', '26 22');
  const node = road[0].node(), len = node.getTotalLength(), n = props.stops.length, at = i => node.getPointAtLength(len * (.06 + .88 * i / (n - 1)));
  const stops = props.stops.map((s, i) => { const p = at(i), g = body.append('g'), pin = g.append('g'); inked(pin, pinPath(0, 0, .9), {fill: i === n - 1 ? 'yellow' : 'pink', ink: 6, shadow: 6}); pin.append('circle').attr('cy', -77).attr('r', 15).attr('fill', C.paper).attr('stroke', C.ink).attr('stroke-width', 5);
    const text = g.append('g'), up = i % 2 === 0; const last = i === n - 1, lx = last ? -50 : 0, anchor = last ? 'end' : 'middle'; label(text, lx, last ? -70 : up ? -150 : 70, s.label, {size: 36, anchor}).attr('stroke', C.ink).attr('stroke-width', 8).attr('paint-order', 'stroke'); label(text, lx, last ? -38 : up ? -118 : 104, s.note, {size: 24, font: F.body, weight: 700, color: C.yellow, anchor, spacing: 0}).attr('stroke', C.ink).attr('stroke-width', 6).attr('paint-order', 'stroke');
    return {p, g, pin, text}; });
  const ride = car(body, 0, 0, .3);
  return {seek(t) {
    intro(t);
    const q = easeOut(span(t, .5, 2.6)) * .84, p = node.getPointAtLength(len * q), p2 = node.getPointAtLength(Math.min(len, len * q + 4)), ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
    dash.attr('stroke-dashoffset', -t * 30); ride.g.attr('transform', `translate(${p.x} ${p.y}) rotate(${ang}) scale(.3) translate(-200 18)`).attr('opacity', span(t, .4, .1)); ride.wheels.forEach(w => w.attr('transform', `rotate(${q * 4000})`));
    stops.forEach(({p, g, pin, text}, i) => { const when = .5 + 2.6 * (1 - Math.pow(Math.max(0, 1 - (.06 + .88 * i / (n - 1)) / .84), 1 / 3)) * 1, k = span(t, Math.min(when, 3), .25); g.attr('transform', `translate(${p.x} ${p.y})`); place(pin, 0, -(1 - k * k) * 300, 1).attr('opacity', span(t, Math.min(when, 3), .08)); text.attr('opacity', span(t, Math.min(when, 3) + .2, .2)); });
  }};
}
