import {C, F, coastStage, quad, panel, halftone, sun, palm, cloud, lettering, tab, place, span, easeOut, pop} from '../../coast.js';

/**
 * Shared diagram card: a sunset backdrop with a sun and palms (left out when `clear`), an angled
 * panel with a pale gutter and hard shadow, the title in outlined gradient lettering across its top
 * edge and the unit on a tag. Returns the stage plus {body, intro(t)}: draw the chart into `body`
 * (the area x 110..890, y 300..860 is free) and call intro(t) from seek.
 */
export function card(el, props) {
  const stage = coastStage(el, {clear: props.clear}), {root} = stage, back = root.append('g');
  if (!props.clear) {
    back.append('rect').attr('width', 1000).attr('height', 1000).attr('fill', `url(#${stage.id}-sunset)`);
    halftone(back, 0, 0, 1000, 520, {color: C.plum, from: 'top', cell: 34, opacity: .4});
    sun(back, 800, 150, 170); cloud(back, 250, 60, 1.2); cloud(back, 620, 930, 1.3, C.paper, .6);
    palm(back, 30, 1040, 1.5, {lean: 60, rim: C.orange}); palm(back, 985, 1060, 1.25, {lean: -70, rim: C.orange});
  }
  const cardG = root.append('g'), p = panel(cardG, quad(70, 190, 860, 720, 16, -10, 14), {fill: 'dusk', gutter: 14, shadow: 18});
  halftone(cardG.append('g').attr('clip-path', p.clip), 60, 560, 880, 380, {color: C.violet, from: 'br', cell: 30, opacity: .5});
  const body = cardG.append('g'), titleG = root.append('g');
  lettering(titleG, 0, 0, props.title.toUpperCase(), {size: 84, fit: 760, fill: 'hot', anchor: 'start', rim: 4});
  const unit = props.unit ? tab(root, 0, 0, props.unit.toUpperCase(), {size: 26, fill: 'pink', spacing: .1}) : null;
  const intro = t => {
    const q = easeOut(span(t, 0, .4));
    cardG.attr('transform', `translate(0 ${(1 - q) * 80}) rotate(${(1 - q) * 3} 500 550)`).attr('opacity', span(t, 0, .12));
    place(titleG, 96, 196, pop(t, .12, .34), -2.5); if (unit) place(unit.g, 112, 262, pop(t, .3), -2.5);
  };
  return {...stage, body, intro};
}
/** An inked bar (rect) with a gradient fill and hard shadow, growing from its base. Returns set(x, y, w, h). */
export function bar(g, fill) {
  const shadow = g.append('rect').attr('fill', C.ink), face = g.append('rect').attr('fill', fill).attr('stroke', C.ink).attr('stroke-width', 6), shine = g.append('rect').attr('fill', C.white).attr('opacity', .35);
  return (x, y, w, h, vertical = true) => {
    w = Math.max(0, w); h = Math.max(0, h);
    shadow.attr('x', x + 10).attr('y', y + 10).attr('width', w).attr('height', h); face.attr('x', x).attr('y', y).attr('width', w).attr('height', h);
    if (vertical) shine.attr('x', x + 9).attr('y', y + 9).attr('width', Math.min(12, w * .2)).attr('height', Math.max(0, h - 18)); else shine.attr('x', x + 9).attr('y', y + 9).attr('width', Math.max(0, w - 18)).attr('height', Math.min(10, h * .2));
  };
}
export {C, F};
